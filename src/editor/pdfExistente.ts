/**
 * Apertura y edición de un PDF hecho en otra herramienta — el corazón de la fase 2.
 *
 * Reparto de tareas entre los dos motores: **mupdf** hace la cirugía sobre el contenido real
 * (encontrar el texto y borrarlo con una redacción) y **pdf.js** rasteriza la página para verla
 * de fondo mientras se edita. Al exportar, el PDF editado es la base sobre la que se dibuja el
 * diseño, así que lo que ya traía sigue siendo vectorial y no una foto.
 *
 * Dónde vive el PDF abierto: en memoria mientras se trabaja, en IndexedDB para sobrevivir a una
 * recarga (ver `almacenPdf.ts`) y dentro del `.json` al guardar el proyecto, para poder seguirlo
 * en otra computadora. En el autoguardado no: localStorage no aguanta un PDF.
 */

import { borrarPdfBase, guardarPdfBase, leerPdfBase } from './almacenPdf';
import { FAMILIAS_BASE, FAMILIAS_WEB } from './fuentes';
import { borrarFormaDelPdf, borrarFormasDelPdf, formaEn, formasDelPdf, type FormaDelPdf } from './formasPdf';

/** Un texto encontrado en el PDF, en coordenadas de la hoja (Y desde arriba, como el lienzo). */
export interface TextoDelPdf {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Dónde apoya el texto: es la referencia para que el reemplazo caiga en el mismo renglón. */
  lineaBase: number;
  texto: string;
  size: number;
  negrita: boolean;
  cursiva: boolean;
  /** La familia del editor que más se parece a la del PDF, para que el reemplazo no cambie de cara. */
  familia: string;
}

/** Tipografías conocidas que no están en el editor, y con cuál de las nuestras se reemplazan. */
const EQUIVALENCIAS: Record<string, string> = {
  arial: 'Helvetica',
  helvetica: 'Helvetica',
  helveticaneue: 'Helvetica',
  verdana: 'Helvetica',
  tahoma: 'Helvetica',
  calibri: 'Helvetica',
  segoeui: 'Helvetica',
  times: 'Times',
  timesnewroman: 'Times',
  georgia: 'Times',
  garamond: 'Times',
  cambria: 'Times',
  bookantiqua: 'Times',
  courier: 'Courier',
  couriernew: 'Courier',
  consolas: 'Courier',
  monaco: 'Courier',
};

/**
 * Con qué familia del editor se reemplaza la tipografía original.
 *
 * Manda el **nombre**, no la clasificación que da mupdf: para una Open Sans incrustada informa
 * `family: "serif"`, que es falso. El nombre viene con adornos —un prefijo de subconjunto tipo
 * `ABCDEF+`, la variante y un número de mupdf, como `OpenSans-Bold-9742`—, así que primero se pela.
 */
export function familiaEquivalente(nombre: string, generica: string): string {
  const limpio = nombre
    .replace(/^[A-Z]{6}\+/, '')
    .replace(/[-_,]?\d+$/, '')
    .replace(/[-_,]?(regular|bold|italic|oblique|medium|light|black|semibold|book|roman)/gi, '')
    .replace(/[^a-z]/gi, '')
    .toLowerCase();

  // Una de las nuestras, escrita de cualquier forma ("Open Sans", "OpenSans", "open-sans").
  const propia = [...FAMILIAS_BASE, ...FAMILIAS_WEB].find((f) => f.replace(/[^a-z]/gi, '').toLowerCase() === limpio);
  if (propia) return propia;

  if (EQUIVALENCIAS[limpio]) return EQUIVALENCIAS[limpio];

  // Desconocida: se decide por lo que insinúe el nombre y, recién al final, por la clasificación.
  if (/mono|consol|courier/.test(limpio)) return 'Courier';
  if (/serif|times|georgia|garamond|roman|book/.test(limpio) && !/sans/.test(limpio)) return 'Times';
  if (/sans|arial|helvet|grotesk/.test(limpio)) return 'Helvetica';
  if (generica === 'monospace') return 'Courier';
  if (generica === 'serif') return 'Times';
  return 'Helvetica';
}

let bytesActuales: Uint8Array | null = null;
let textos: TextoDelPdf[] = [];
let formas: FormaDelPdf[] = [];
/** Sobre qué página del PDF se está trabajando. El editor maneja una por vez. */
let paginaElegida = 0;

export function hayPdfAbierto(): boolean {
  return bytesActuales !== null;
}

/** Los bytes del PDF con las ediciones ya aplicadas, para usar de base al exportar. */
export function bytesDelPdf(): Uint8Array | null {
  return bytesActuales;
}

/** Los textos que todavía tiene el PDF, para poder elegir cuál editar. */
export function textosDelPdf(): TextoDelPdf[] {
  return textos;
}

/** Las líneas y recuadros que todavía tiene el PDF dibujados en su contenido. */
export function formasDelPdfActual(): FormaDelPdf[] {
  return formas;
}

/** La forma del PDF que cae bajo un punto de la hoja, si hay alguna. */
export function formaEnPunto(x: number, y: number): FormaDelPdf | undefined {
  return formaEn(formas, x, y);
}

/**
 * Saca una forma del contenido del PDF —de verdad, no la tapa— y devuelve el fondo actualizado.
 * Es el paso equivalente a `borrarTextoDelPdf`, para poder reemplazarla por un elemento del diseño.
 */
/** Cómo se reconoce una forma entre dos lecturas del mismo PDF. */
function huella(f: FormaDelPdf): string {
  const n = (v: number) => Math.round(v * 100);
  return `${f.clase}|${n(f.x)}|${n(f.y)}|${n(f.w)}|${n(f.h)}|${f.color}|${f.relleno}`;
}

export async function quitarFormaDelPdf(objetivo: FormaDelPdf): Promise<{ fondo: string; quitadas: FormaDelPdf[] }> {
  if (!bytesActuales) throw new Error('No hay ningún PDF abierto.');

  const antes = formas;
  await asentarPdf(await borrarFormaDelPdf(bytesActuales, paginaElegida, objetivo));

  // Cuáles se fueron de verdad. Casi siempre es solo la elegida, pero la redacción se lleva todo
  // el dibujo que quede completamente cubierto por el rectángulo: sacar un recuadro grande arrastra
  // las líneas que tenía adentro. Quien llama las convierte también en elementos, así no
  // desaparece nada de la hoja y encima quedan editables.
  const quedan = new Map<string, number>();
  for (const f of formas) quedan.set(huella(f), (quedan.get(huella(f)) ?? 0) + 1);

  const quitadas: FormaDelPdf[] = [];
  for (const f of antes) {
    const clave = huella(f);
    const disponibles = quedan.get(clave) ?? 0;
    if (disponibles > 0) quedan.set(clave, disponibles - 1);
    else quitadas.push(f);
  }

  return { fondo: (await rasterizar()).fondo, quitadas };
}

/**
 * Saca de una sola vez todas las formas indicadas. Es lo que hace falta para convertirlas en
 * bloque: guardar el PDF por cada una tardaría muchísimo con las 556 de una plantilla real.
 */
export async function quitarFormasDelPdf(objetivos: FormaDelPdf[]): Promise<string> {
  if (!bytesActuales) throw new Error('No hay ningún PDF abierto.');
  await asentarPdf(await borrarFormasDelPdf(bytesActuales, paginaElegida, objetivos));
  return (await rasterizar()).fondo;
}

/** En qué página del PDF se está trabajando, contando desde 0. */
export function paginaDelPdf(): number {
  return paginaElegida;
}

export function cerrarPdf(): void {
  bytesActuales = null;
  textos = [];
  formas = [];
  paginaElegida = 0;
  void borrarPdfBase();
}

/**
 * Deja el PDF vigente en memoria y guardado, y relee sus textos editables. `pagina` sirve para
 * retomar un proyecto sobre la misma página en la que se estaba; sin ella se queda en la vigente.
 */
export async function asentarPdf(bytes: Uint8Array, pagina = paginaElegida): Promise<void> {
  paginaElegida = Math.max(0, pagina);
  bytesActuales = bytes;
  const mupdf = await motor();
  const documento = mupdf.PDFDocument.openDocument(bytes.slice(), 'application/pdf') as InstanceType<typeof mupdf.PDFDocument>;
  textos = leerTextos(documento.loadPage(paginaElegida));
  formas = await formasDelPdf(bytes, paginaElegida);
  await guardarPdfBase(bytes, paginaElegida);
}

/**
 * Recupera el PDF de base guardado en sesiones anteriores. Se llama al retomar un diseño: sin
 * esto, al recargar quedaba la imagen de fondo pero no el PDF, así que el trabajo hecho sobre su
 * contenido se perdía y al exportar salía una foto en vez del original vectorial.
 */
export async function recuperarPdfGuardado(): Promise<boolean> {
  const guardado = await leerPdfBase();
  if (!guardado) return false;
  // Se recupera también sobre qué página se estaba: el diseño restaurado estaba puesto sobre esa,
  // así que volver a la primera dejaría los elementos sobre una página que no les corresponde.
  // Alcanza con dejarla anotada: el fondo ya viene restaurado con el proyecto, no hay que
  // rasterizar de nuevo (y hacerlo acá pisaría lo que se acaba de restaurar).
  paginaElegida = guardado.pagina;
  await asentarPdf(guardado.bytes);
  return true;
}

/**
 * Un campo de formulario leído del PDF, listo para volverse un elemento 'campo' del editor. Las
 * coordenadas ya vienen como las usa el lienzo: desde la esquina superior izquierda de la hoja.
 */
export interface CampoDelPdf {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  size: number;
  familia: string;
  negrita: boolean;
  cursiva: boolean;
  color: string;
  align: 'left' | 'center' | 'right';
  readonly: boolean;
  multilinea: boolean;
  defaultValue: string;
  bordeGrosor: number;
  bordeColor: string;
  conFondo: boolean;
  fondoColor: string;
}

export interface CamposImportados {
  campos: CampoDelPdf[];
  /** Los que no se pueden representar (casillas, listas, firmas), para poder avisar por qué. */
  omitidos: { name: string; motivo: string }[];
}

/** Nombres de las fuentes estándar como aparecen en el /DA de un formulario. */
const FUENTES_DA: Record<string, { familia: string; negrita: boolean; cursiva: boolean }> = {
  Helv: { familia: 'Helvetica', negrita: false, cursiva: false },
  HeBo: { familia: 'Helvetica', negrita: true, cursiva: false },
  HeOb: { familia: 'Helvetica', negrita: false, cursiva: true },
  HeBO: { familia: 'Helvetica', negrita: true, cursiva: true },
  TiRo: { familia: 'Times', negrita: false, cursiva: false },
  TiBo: { familia: 'Times', negrita: true, cursiva: false },
  TiIt: { familia: 'Times', negrita: false, cursiva: true },
  TiBI: { familia: 'Times', negrita: true, cursiva: true },
  Cour: { familia: 'Courier', negrita: false, cursiva: false },
  CoBo: { familia: 'Courier', negrita: true, cursiva: false },
  CoOb: { familia: 'Courier', negrita: false, cursiva: true },
  CoBO: { familia: 'Courier', negrita: true, cursiva: true },
};

function hex(componentes: number[]): string {
  const aByte = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 255);
  // Un color de PDF viene en gris (1 número), RGB (3) o CMYK (4).
  if (componentes.length === 1) {
    const g = aByte(componentes[0]);
    return `#${[g, g, g].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
  }
  if (componentes.length === 4) {
    const [c, m, y, k] = componentes;
    componentes = [(1 - c) * (1 - k), (1 - m) * (1 - k), (1 - y) * (1 - k)];
  }
  return `#${componentes.slice(0, 3).map((v) => aByte(v).toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Lee del `/DA` el cuerpo, la tipografía y el color con que el campo dibuja su texto. Es una
 * cadena de operadores de PDF, tipo `/Helv 9 Tf 0 g`; con cuerpo 0 el visor lo ajusta solo, así
 * que acá se elige uno usable.
 */
function leerDA(da: string, alto: number) {
  const fuente = /\/(\w+)\s+([\d.]+)\s+Tf/.exec(da);
  const nombre = fuente?.[1] ?? 'Helv';
  const pedido = Number(fuente?.[2] ?? 0);
  const tipografia = FUENTES_DA[nombre] ?? { familia: 'Helvetica', negrita: false, cursiva: false };

  const gris = /(-?[\d.]+)\s+g(?![a-zA-Z])/.exec(da);
  const rgb = /(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+rg(?![a-zA-Z])/.exec(da);
  const cmyk = /(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+k(?![a-zA-Z])/.exec(da);
  const componentes = rgb ? rgb.slice(1, 4) : cmyk ? cmyk.slice(1, 5) : gris ? gris.slice(1, 2) : ['0'];

  return {
    ...tipografia,
    // El cuerpo automático se cambia por uno que entre en la caja, como hace cualquier visor.
    size: pedido > 0 ? pedido : Math.max(6, Math.min(12, Math.round(alto * 0.6))),
    color: hex(componentes.map(Number)),
  };
}

/**
 * Los campos AcroForm del PDF abierto. Un mismo campo puede estar colocado varias veces en la
 * hoja: cada posición se devuelve por separado, como en el editor, todas con el mismo ID.
 */
export async function camposDelPdf(): Promise<CamposImportados> {
  // Copia local: entre acá y el `await` de abajo el módulo puede quedarse sin PDF —si mientras
  // tanto se cierra o se abre otro— y la comprobación de arriba ya no valdría.
  const bytes = bytesActuales;
  if (!bytes) return { campos: [], omitidos: [] };

  const { PDFDocument, PDFTextField } = await import('@cantoo/pdf-lib');
  const doc = await PDFDocument.load(bytes.slice(), { updateMetadata: false });
  const alturaPagina = doc.getPage(paginaElegida).getHeight();

  const campos: CampoDelPdf[] = [];
  const omitidos: { name: string; motivo: string }[] = [];

  for (const campo of doc.getForm().getFields()) {
    if (!(campo instanceof PDFTextField)) {
      omitidos.push({ name: campo.getName(), motivo: `es ${campo.constructor.name.replace('PDF', '').replace('Field', '').toLowerCase()}, y el editor solo maneja campos de texto` });
      continue;
    }

    for (const widget of campo.acroField.getWidgets()) {
      const r = widget.getRectangle();
      // Un widget puede venir con las esquinas al revés; el rectángulo se normaliza.
      const x = Math.min(r.x, r.x + r.width);
      const w = Math.abs(r.width);
      const h = Math.abs(r.height);
      const yPdf = Math.min(r.y, r.y + r.height);

      const apariencia = widget.getAppearanceCharacteristics();
      const fondo = apariencia?.getBackgroundColor();
      const borde = apariencia?.getBorderColor();
      const grosorBorde = borde?.length ? (widget.getBorderStyle()?.getWidth() ?? 1) : 0;
      const da = widget.getDefaultAppearance() ?? campo.acroField.getDefaultAppearance() ?? '';
      const estilo = leerDA(da, h);

      // El rectángulo del PDF incluye el borde, pero al exportar pdf-lib lo agrega por fuera de la
      // caja que se le pide (medio grosor por lado). Sin descontarlo acá, cada vuelta de importar
      // y exportar agrandaría el campo un grosor, y el error se iría acumulando.
      const caja = {
        x: x + grosorBorde / 2,
        y: alturaPagina - yPdf - h + grosorBorde / 2,
        w: Math.max(1, w - grosorBorde),
        h: Math.max(1, h - grosorBorde),
      };

      campos.push({
        name: campo.getName(),
        // La Y ya viene dada vuelta: el PDF mide desde abajo y el lienzo desde arriba.
        x: Math.round(caja.x * 100) / 100,
        y: Math.round(caja.y * 100) / 100,
        w: Math.round(caja.w * 100) / 100,
        h: Math.round(caja.h * 100) / 100,
        size: estilo.size,
        familia: estilo.familia,
        negrita: estilo.negrita,
        cursiva: estilo.cursiva,
        color: estilo.color,
        align: campo.getAlignment() === 1 ? 'center' : campo.getAlignment() === 2 ? 'right' : 'left',
        readonly: campo.isReadOnly(),
        multilinea: campo.isMultiline(),
        defaultValue: campo.getText() ?? '',
        bordeGrosor: grosorBorde,
        bordeColor: borde?.length ? hex(borde) : '#000000',
        conFondo: !!fondo?.length,
        fondoColor: fondo?.length ? hex(fondo) : '#ffffff',
      });
    }
  }

  return { campos, omitidos };
}

/** El texto del PDF que cae bajo un punto de la hoja, si hay alguno. */
export function textoEn(x: number, y: number): TextoDelPdf | undefined {
  return textos.find((t) => x >= t.x && x <= t.x + t.w && y >= t.y && y <= t.y + t.h);
}

async function motor() {
  // Import dinámico: es WebAssembly y pesa; solo hace falta si se abre un PDF.
  return import('mupdf');
}

/**
 * Lee los textos de la primera página.
 *
 * Ojo con las coordenadas: mupdf mide la Y **desde arriba**, igual que el lienzo y al revés que
 * el PDF crudo. Vale tanto para el texto que devuelve como para el rectángulo de una redacción;
 * invertirla —que es lo que uno esperaría viniendo de pdf-lib— hace que la redacción se aplique
 * sobre la zona espejada, sin borrar nada y sin dar ningún error.
 */
function leerTextos(pagina: any): TextoDelPdf[] {
  const estructura = JSON.parse(pagina.toStructuredText('preserve-whitespace').asJSON());
  const encontrados: TextoDelPdf[] = [];

  for (const bloque of estructura.blocks ?? []) {
    if (bloque.type !== 'text') continue;
    for (const linea of bloque.lines ?? []) {
      if (!linea.text?.trim()) continue;
      encontrados.push({
        x: linea.bbox.x,
        y: linea.bbox.y,
        w: linea.bbox.w,
        h: linea.bbox.h,
        lineaBase: linea.y,
        texto: linea.text,
        size: Math.round(linea.font?.size ?? 11),
        negrita: linea.font?.weight === 'bold',
        cursiva: linea.font?.style === 'italic',
        familia: familiaEquivalente(linea.font?.name ?? '', linea.font?.family ?? ''),
      });
    }
  }
  return encontrados;
}

/**
 * Qué tiene la página, para poder explicarlo bien cuando no hay texto que editar. Sin esto los
 * dos casos se confunden: una plantilla de formulario no tiene nada dibujado —todo lo que se ve
 * son sus campos— y decirle al usuario que "puede ser un PDF escaneado" lo preocupa al pedo.
 */
export type ContenidoDePagina =
  /** Hay texto y se puede reemplazar con doble clic. */
  | 'conTexto'
  /** Hay dibujo pero ninguna letra: casi siempre es un PDF escaneado, o sea una foto. */
  | 'escaneada'
  /** La página no tiene contenido propio: lo que se ve, si algo se ve, son sus campos. */
  | 'vacia';

export interface PdfAbierto {
  /** La página elegida, rasterizada, para usar de fondo de la hoja mientras se edita. */
  fondo: string;
  ancho: number;
  alto: number;
  paginas: number;
  contenido: ContenidoDePagina;
}

/**
 * Mira si la página tiene algo dibujado, sin contar sus campos. Se recorre solo el contenido
 * —`runPageContents`, no `run`— justamente porque `run` dibuja también los campos de formulario,
 * que es lo que hacía parecer que una plantilla tenía contenido propio.
 */
async function contenidoDeLaPagina(): Promise<ContenidoDePagina> {
  if (textos.length) return 'conTexto';

  const mupdf = await motor();
  const documento = mupdf.PDFDocument.openDocument(bytesActuales!.slice(), 'application/pdf') as InstanceType<typeof mupdf.PDFDocument>;
  let dibujos = 0;
  const dispositivo = new mupdf.Device({
    fillPath: () => void dibujos++,
    strokePath: () => void dibujos++,
    fillImage: () => void dibujos++,
    fillImageMask: () => void dibujos++,
    fillText: () => void dibujos++,
  });
  (documento.loadPage(paginaElegida) as any).runPageContents(dispositivo, mupdf.Matrix.identity);
  return dibujos > 0 ? 'escaneada' : 'vacia';
}

/** Escala de rasterizado: el doble del tamaño real, para que no se vea borroso con zoom. */
const ESCALA = 2;

/** Dibuja la página elegida de los bytes vigentes y la devuelve como imagen. */
async function rasterizar(): Promise<PdfAbierto> {
  const pdfjs = await import('pdfjs-dist');
  const trabajador = await import('pdfjs-dist/build/pdf.worker.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = trabajador.default;

  // pdf.js se queda con el buffer que recibe, así que se le pasa una copia.
  const documento = await pdfjs.getDocument({ data: bytesActuales!.slice() }).promise;
  // pdf.js cuenta las páginas desde 1 y el resto del módulo desde 0.
  const pagina = await documento.getPage(paginaElegida + 1);
  const medidas = pagina.getViewport({ scale: 1 });
  const vista = pagina.getViewport({ scale: ESCALA });

  const lienzo = document.createElement('canvas');
  lienzo.width = Math.ceil(vista.width);
  lienzo.height = Math.ceil(vista.height);
  const contexto = lienzo.getContext('2d');
  if (!contexto) throw new Error('El navegador no pudo preparar el dibujo de la página.');
  // Sin anotaciones: los campos de formulario del PDF se importan como elementos del diseño, así
  // que si además vinieran dibujados en el fondo se verían dos veces —el del fondo con su valor y
  // el nuestro encima— y al borrar un campo reaparecería el de abajo, como si no se hubiera ido.
  // Fondo transparente y no blanco: donde la pagina no dibuja nada tiene que verse lo que este
  // debajo, que es donde van las formas sacadas del PDF (ver , doble clic sobre forma).
  await pagina.render({ canvas: lienzo, canvasContext: contexto, viewport: vista, background: 'transparent', annotationMode: pdfjs.AnnotationMode.DISABLE }).promise;

  return {
    fondo: lienzo.toDataURL('image/png'),
    ancho: Math.round(medidas.width),
    alto: Math.round(medidas.height),
    paginas: documento.numPages,
    contenido: await contenidoDeLaPagina(),
  };
}

export async function abrirPdf(archivo: File, pagina = 0): Promise<PdfAbierto> {
  paginaElegida = Math.max(0, pagina);
  await asentarPdf(new Uint8Array(await archivo.arrayBuffer()));
  return rasterizar();
}

/**
 * Cambia sobre qué página del PDF se trabaja y devuelve su fondo, medidas y textos editables.
 * El diseño que ya esté en la hoja no se toca: es responsabilidad de quien llama decidir qué
 * hacer con él, porque los elementos estaban puestos sobre la página anterior.
 */
export async function elegirPagina(indice: number): Promise<PdfAbierto> {
  if (!bytesActuales) throw new Error('No hay ningún PDF abierto.');
  paginaElegida = Math.max(0, indice);
  // Los textos editables son los de la página nueva, así que hay que releerlos.
  await asentarPdf(bytesActuales);
  return rasterizar();
}

/**
 * Borra un texto del contenido del PDF —de verdad, no lo tapa— y devuelve el fondo actualizado.
 * Es el paso que hace posible reemplazarlo: primero se saca el original y después el editor
 * dibuja el texto nuevo encima como un elemento más del diseño.
 */
export async function borrarTextoDelPdf(objetivo: TextoDelPdf): Promise<string> {
  if (!bytesActuales) throw new Error('No hay ningún PDF abierto.');

  const mupdf = await motor();
  // `openDocument` está tipado como Document genérico; acá siempre es un PDF.
  const documento = mupdf.PDFDocument.openDocument(bytesActuales.slice(), 'application/pdf') as InstanceType<typeof mupdf.PDFDocument>;
  const pagina = documento.loadPage(paginaElegida) as any;

  const anotacion = pagina.createAnnotation('Redact');
  // Un punto de aire: el rectángulo tiene que cubrir los glifos completos.
  anotacion.setRect([objetivo.x - 1, objetivo.y - 1, objetivo.x + objetivo.w + 1, objetivo.y + objetivo.h + 1]);
  anotacion.update();
  // Sin recuadro negro (lo tapado se reemplaza por el texto nuevo) y quitando el texto de verdad.
  pagina.applyRedactions(false, 0, 0, 0);

  // `asUint8Array()` NO devuelve bytes propios: es una vista sobre la memoria de mupdf, que se
  // reutiliza en cuanto se le pide cualquier otra cosa. Guardarla tal cual deja el PDF convertido
  // en basura un rato después —la cabecera "%PDF-" pasa a ser cualquier cosa— y el error recién
  // aparece al exportar, lejos de acá. Hay que copiarla en el momento.
  const editado = new Uint8Array(documento.saveToBuffer('').asUint8Array());

  // Se relee todo desde los bytes nuevos: la redacción cambia el contenido y con él las cajas.
  await asentarPdf(editado);
  return (await rasterizar()).fondo;
}

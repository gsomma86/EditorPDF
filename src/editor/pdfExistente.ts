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

export function cerrarPdf(): void {
  bytesActuales = null;
  textos = [];
  void borrarPdfBase();
}

/** Deja el PDF vigente en memoria y guardado, y relee sus textos editables. */
export async function asentarPdf(bytes: Uint8Array): Promise<void> {
  bytesActuales = bytes;
  const mupdf = await motor();
  const documento = mupdf.PDFDocument.openDocument(bytes.slice(), 'application/pdf') as InstanceType<typeof mupdf.PDFDocument>;
  textos = leerTextos(documento.loadPage(0));
  await guardarPdfBase(bytes);
}

/**
 * Recupera el PDF de base guardado en sesiones anteriores. Se llama al retomar un diseño: sin
 * esto, al recargar quedaba la imagen de fondo pero no el PDF, así que el trabajo hecho sobre su
 * contenido se perdía y al exportar salía una foto en vez del original vectorial.
 */
export async function recuperarPdfGuardado(): Promise<boolean> {
  const guardado = await leerPdfBase();
  if (!guardado) return false;
  await asentarPdf(guardado);
  return true;
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

export interface PdfAbierto {
  /** Página 1 rasterizada, para usar de fondo de la hoja mientras se edita. */
  fondo: string;
  ancho: number;
  alto: number;
  paginas: number;
}

/** Escala de rasterizado: el doble del tamaño real, para que no se vea borroso con zoom. */
const ESCALA = 2;

/** Dibuja la primera página de los bytes vigentes y la devuelve como imagen. */
async function rasterizar(): Promise<{ fondo: string; ancho: number; alto: number; paginas: number }> {
  const pdfjs = await import('pdfjs-dist');
  const trabajador = await import('pdfjs-dist/build/pdf.worker.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = trabajador.default;

  // pdf.js se queda con el buffer que recibe, así que se le pasa una copia.
  const documento = await pdfjs.getDocument({ data: bytesActuales!.slice() }).promise;
  const pagina = await documento.getPage(1);
  const medidas = pagina.getViewport({ scale: 1 });
  const vista = pagina.getViewport({ scale: ESCALA });

  const lienzo = document.createElement('canvas');
  lienzo.width = Math.ceil(vista.width);
  lienzo.height = Math.ceil(vista.height);
  const contexto = lienzo.getContext('2d');
  if (!contexto) throw new Error('El navegador no pudo preparar el dibujo de la página.');
  await pagina.render({ canvas: lienzo, canvasContext: contexto, viewport: vista }).promise;

  return {
    fondo: lienzo.toDataURL('image/png'),
    ancho: Math.round(medidas.width),
    alto: Math.round(medidas.height),
    paginas: documento.numPages,
  };
}

export async function abrirPdf(archivo: File): Promise<PdfAbierto> {
  await asentarPdf(new Uint8Array(await archivo.arrayBuffer()));
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
  const pagina = documento.loadPage(0) as any;

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

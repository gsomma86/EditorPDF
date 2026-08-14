/**
 * Apertura y edición de un PDF hecho en otra herramienta — el corazón de la fase 2.
 *
 * Reparto de tareas entre los dos motores: **mupdf** hace la cirugía sobre el contenido real
 * (encontrar el texto y borrarlo con una redacción) y **pdf.js** rasteriza la página para verla
 * de fondo mientras se edita. Al exportar, el PDF editado es la base sobre la que se dibuja el
 * diseño, así que lo que ya traía sigue siendo vectorial y no una foto.
 *
 * El PDF abierto vive en memoria y no en el proyecto: un PDF grande no entra en el
 * almacenamiento del navegador. Guardar el proyecto guarda el diseño, no el PDF de base.
 */

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
  bytesActuales = new Uint8Array(await archivo.arrayBuffer());

  const mupdf = await motor();
  // `openDocument` está tipado como Document genérico; acá siempre es un PDF.
  const documento = mupdf.PDFDocument.openDocument(bytesActuales.slice(), 'application/pdf') as InstanceType<typeof mupdf.PDFDocument>;
  textos = leerTextos(documento.loadPage(0));

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

  bytesActuales = documento.saveToBuffer('').asUint8Array();
  textos = textos.filter((t) => t !== objetivo);

  return (await rasterizar()).fondo;
}

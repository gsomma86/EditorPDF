/**
 * Apertura de un PDF hecho en otra herramienta — el primer escalón de la fase 2.
 *
 * Por ahora hace lo mínimo útil: leer el archivo, adoptar el tamaño de su primera página y
 * dejarla dibujada de fondo para poder diseñar encima. Los bytes originales quedan guardados en
 * memoria porque son la materia prima del paso siguiente, que es editar su contenido de verdad
 * (mupdf: redacción + reinserción); no van al autoguardado porque un PDF grande no entra en el
 * almacenamiento del navegador.
 */

export interface PdfAbierto {
  /** Página 1 rasterizada, para usar de fondo de la hoja. */
  fondo: string;
  ancho: number;
  alto: number;
  paginas: number;
}

/** Escala de rasterizado: el doble del tamaño real, para que no se vea borroso con zoom. */
const ESCALA = 2;

let bytesOriginales: Uint8Array | null = null;

/** Los bytes del PDF abierto, o null si no hay ninguno. Los va a usar la edición de contenido. */
export function pdfOriginal(): Uint8Array | null {
  return bytesOriginales;
}

export function olvidarPdf(): void {
  bytesOriginales = null;
}

export async function abrirPdf(archivo: File): Promise<PdfAbierto> {
  const datos = new Uint8Array(await archivo.arrayBuffer());
  // Se guarda una copia: pdf.js se queda con el buffer que recibe y lo deja vacío al terminar.
  bytesOriginales = datos.slice();

  // Import dinámico: pdf.js pesa bastante y solo hace falta cuando se abre un PDF.
  const pdfjs = await import('pdfjs-dist');
  const trabajador = await import('pdfjs-dist/build/pdf.worker.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = trabajador.default;

  const documento = await pdfjs.getDocument({ data: datos }).promise;
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

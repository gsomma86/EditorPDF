import { FabricImage, type Canvas } from 'fabric';
import { configPorDefecto, dimensionesDe, tamanoParecido, type ConfigPagina, type Orientacion, type TamanoPagina } from './pagina';
import { establecerAreaUtil, type Elemento } from './elemento';
import { refrescarLienzo } from './vista';
import { elementoDe, reconstruirLienzo } from './objetosFabric';

let config: ConfigPagina = configPorDefecto();

export function configActual(): ConfigPagina {
  return config;
}

// ---------- Las hojas del documento ----------

/**
 * Un documento son varias hojas y el lienzo muestra una por vez: la que se está editando vive en
 * el lienzo y las demás, guardadas acá como listas de elementos. Cambiar de hoja es volcar lo que
 * hay en el lienzo a su lugar y reconstruirlo con la otra.
 *
 * El tamaño y la orientación son **de cada hoja**: nacieron siendo del documento entero, a
 * propósito, pero abrir un PDF con páginas de medidas distintas —o insertar un anexo A4 en un
 * recibo A5— dejó esa decisión sin sostén. Los márgenes sí siguen siendo del documento.
 *
 * Ninguna de estas funciones registra un paso en el historial, igual que el resto del editor: eso
 * lo hace quien las llama, con `registrarSnapshot`. Importa sobre todo al borrar una hoja, que es
 * lo más caro de perder sin poder deshacerlo.
 */
export interface Hoja {
  elementos: Elemento[];
  /**
   * De qué página del PDF de base viene esta hoja, contando desde 0, o null si es una hoja en
   * blanco. Es lo que hace que la tira de hojas *sea* el documento: al exportar salen las páginas
   * de las hojas que queden, en el orden en que queden, así que borrar una hoja saca esa página
   * del PDF final y reordenarlas reordena el archivo.
   */
  paginaPdf: number | null;
  /**
   * Imagen de fondo propia, como data URL. Solo la usan las hojas **sin** página de PDF: las que
   * vienen de un PDF se dibujan pidiéndole la página al motor, y guardar acá esas imágenes haría
   * que un documento de 12 páginas no entrara en el autoguardado.
   */
  fondo: string | null;
  /**
   * El tamaño de **esta** hoja. Antes era del documento entero, a propósito, pero insertar otro
   * PDF lo dejó sin sostén: el caso normal es meter un anexo A4 en un recibo A5. Los márgenes sí
   * siguen siendo del documento.
   */
  tamano: TamanoPagina;
  orientacion: Orientacion;
  /** Medidas propias cuando la hoja no es un tamaño del catálogo. Si están, mandan sobre las otras dos. */
  medidas: { ancho: number; alto: number } | null;
}

export function hojaEnBlanco(): Hoja {
  const base = configPorDefecto();
  return { elementos: [], paginaPdf: null, fondo: null, tamano: base.tamano, orientacion: base.orientacion, medidas: null };
}

/** El tamaño con el que se dibuja y se exporta una hoja. */
export function dimensionesDeHoja(hoja: Hoja): { ancho: number; alto: number } {
  return dimensionesDe({ ...config, tamano: hoja.tamano, orientacion: hoja.orientacion, medidas: hoja.medidas });
}

let hojas: Hoja[] = [hojaEnBlanco()];
let hojaVigente = 0;

export function cantidadDeHojas(): number {
  return hojas.length;
}

export function hojaActual(): number {
  return hojaVigente;
}

/** La página del PDF sobre la que se está trabajando, o null si la hoja va en blanco. */
export function paginaDeLaHoja(indice = hojaVigente): number | null {
  return hojas[indice]?.paginaPdf ?? null;
}

/** El tamaño de una hoja por su número. Lo usa la tira: cada miniatura tiene la forma de la suya. */
export function medidasDeLaHoja(indice = hojaVigente): { ancho: number; alto: number } {
  return dimensionesDeHoja(hojas[indice] ?? hojas[0]);
}

/** La imagen de fondo propia de la hoja (solo la tienen las que no vienen de un PDF). */
export function fondoDeLaHoja(indice = hojaVigente): string | null {
  return hojas[indice]?.fondo ?? null;
}

function elementosDelLienzo(lienzo: Canvas): Elemento[] {
  return lienzo
    .getObjects()
    .map((o) => elementoDe(o))
    .filter((e): e is Elemento => !!e);
}

/** Vuelca al modelo lo que hay en el lienzo. Hay que llamarlo antes de leer o guardar las hojas. */
export function asentarHoja(lienzo: Canvas): void {
  hojas[hojaVigente].elementos = elementosDelLienzo(lienzo);
}

/** Todas las hojas, con la vigente ya actualizada desde el lienzo. */
export function hojasDelDocumento(lienzo: Canvas): Hoja[] {
  asentarHoja(lienzo);
  return hojas;
}

export async function irAHoja(lienzo: Canvas, indice: number): Promise<void> {
  if (indice < 0 || indice >= hojas.length || indice === hojaVigente) return;
  asentarHoja(lienzo);
  hojaVigente = indice;
  await reconstruirLienzo(lienzo, hojas[hojaVigente].elementos);
  await mostrarHojaVigente(lienzo);
}

/**
 * Agrega una hoja después de la vigente y se para en ella. Duplicar copia también de qué página
 * del PDF viene: al exportar, esa página sale dos veces con cada diseño encima.
 */
export async function agregarHoja(lienzo: Canvas, copiarLaActual = false): Promise<void> {
  asentarHoja(lienzo);
  const nueva: Hoja = copiarLaActual ? JSON.parse(JSON.stringify(hojas[hojaVigente])) : hojaEnBlanco();
  const origen = nueva.paginaPdf;

  // Duplicar una hoja que viene de un PDF duplica también su página, y las de más adelante se
  // corren un lugar. Si las dos hojas compartieran página, editar el contenido de una —borrar un
  // texto, sacar una forma— se vería en las dos: la cirugía es sobre el PDF, no sobre la hoja.
  if (copiarLaActual && origen !== null) {
    const { duplicarPaginaDelPdf, hayPdfAbierto } = await import('./pdfExistente');
    if (hayPdfAbierto()) {
      await duplicarPaginaDelPdf(origen);
      for (const hoja of hojas) {
        if (hoja.paginaPdf !== null && hoja.paginaPdf > origen) hoja.paginaPdf += 1;
      }
      nueva.paginaPdf = origen + 1;
      // Las páginas se corrieron de número: lo dibujado hasta ahora está guardado con el índice
      // viejo y mostraría la página equivocada.
      olvidarPaginasDibujadas();
    }
  }

  hojas.splice(hojaVigente + 1, 0, nueva);
  hojaVigente += 1;
  await reconstruirLienzo(lienzo, hojas[hojaVigente].elementos);
  await mostrarHojaVigente(lienzo);
}

/** Elimina una hoja. La última no se puede eliminar: un documento siempre tiene al menos una. */
export async function eliminarHoja(lienzo: Canvas, indice: number): Promise<void> {
  if (hojas.length <= 1 || indice < 0 || indice >= hojas.length) return;
  asentarHoja(lienzo);
  hojas.splice(indice, 1);
  // Si se fue la que se estaba editando, o una anterior, hay que recolocarse.
  hojaVigente = Math.min(hojaVigente > indice ? hojaVigente - 1 : hojaVigente, hojas.length - 1);
  await reconstruirLienzo(lienzo, hojas[hojaVigente].elementos);
  await mostrarHojaVigente(lienzo);
}

/** Mueve una hoja de lugar, siguiendo con la misma hoja a la vista. */
export async function moverHoja(lienzo: Canvas, desde: number, hasta: number): Promise<void> {
  if (desde === hasta || desde < 0 || hasta < 0 || desde >= hojas.length || hasta >= hojas.length) return;
  asentarHoja(lienzo);
  const vigente = hojas[hojaVigente];
  const [movida] = hojas.splice(desde, 1);
  hojas.splice(hasta, 0, movida);
  hojaVigente = hojas.indexOf(vigente);
}

/** Reemplaza todas las hojas de una (abrir un proyecto, deshacer, retomar el autoguardado). */
export async function establecerHojas(lienzo: Canvas, listas: Hoja[], indice = 0): Promise<void> {
  hojas = listas.length ? listas : [hojaEnBlanco()];
  hojaVigente = Math.min(Math.max(0, indice), hojas.length - 1);
  await reconstruirLienzo(lienzo, hojas[hojaVigente].elementos);
  await mostrarHojaVigente(lienzo);
}

/**
 * Arma un documento con una hoja por página del PDF recién abierto. Es lo que hace que la tira de
 * hojas y el PDF sean la misma cosa: se abre un PDF de 12 páginas y quedan 12 hojas.
 */
export async function hojasDesdePdf(lienzo: Canvas, paginas: number): Promise<void> {
  paginasDibujadas.clear();
  // Cada hoja toma el tamaño de **su** página: un PDF puede traerlas de medidas distintas, y con
  // un tamaño único las que no coincidieran se verían estiradas.
  const { medidasDePaginas } = await import('./pdfExistente');
  const medidas = await medidasDePaginas();

  hojas = Array.from({ length: Math.max(1, paginas) }, (_, i) => ({
    ...hojaEnBlanco(),
    paginaPdf: i,
    ...(medidas[i] ? { ...tamanoParecido(medidas[i].ancho, medidas[i].alto), medidas: medidas[i] } : {}),
  }));
  hojaVigente = 0;
  await reconstruirLienzo(lienzo, hojas[0].elementos);
  await mostrarHojaVigente(lienzo);
}

/**
 * Anota de dónde saca su fondo una hoja, sin tocar lo que se ve. Aparte de `establecerFondoDeLaHoja`
 * porque los arneses de prueba corren sin navegador y necesitan armar el documento sin dibujar nada.
 */
export function anclarHoja(indice: number, paginaPdf: number | null, fondo: string | null = null): void {
  if (!hojas[indice]) return;
  hojas[indice].paginaPdf = paginaPdf;
  hojas[indice].fondo = fondo;
}

/** Cambia el fondo de la hoja vigente: una imagen suelta, o una página del PDF de base. */
export async function establecerFondoDeLaHoja(lienzo: Canvas, fondo: string | null, paginaPdf: number | null = null): Promise<void> {
  anclarHoja(hojaVigente, paginaPdf, fondo);
  await mostrarHojaVigente(lienzo);
}

/**
 * Aplica el tamaño, la orientación y los márgenes al lienzo. Los elementos nuevos se colocan
 * dentro del área útil, así que el modelo también tiene que enterarse del cambio.
 */
export function aplicarConfigPagina(lienzo: Canvas, nueva: ConfigPagina): void {
  config = nueva;
  // El tamaño es de la hoja: la configuración vigente es su reflejo, así que cambiarlo desde el
  // menú Página cambia **la hoja que se está editando**, no las demás.
  const hoja = hojas[hojaVigente];
  if (hoja) {
    hoja.tamano = nueva.tamano;
    hoja.orientacion = nueva.orientacion;
    hoja.medidas = nueva.medidas;
  }
  const { ancho, alto } = dimensionesDe(nueva);
  establecerAreaUtil(ancho, alto, nueva.margenes);
  refrescarLienzo(lienzo);
  void aplicarFondo(lienzo);
}

/**
 * Trae al frente el tamaño de la hoja vigente. Es el camino inverso de `aplicarConfigPagina` y hay
 * que llamarlo cada vez que se cambia de hoja: si no, una hoja A4 se seguiría dibujando con las
 * medidas A5 de la anterior.
 */
function adoptarTamanoDeLaHoja(lienzo: Canvas): void {
  const hoja = hojas[hojaVigente];
  if (!hoja) return;
  config = { ...config, tamano: hoja.tamano, orientacion: hoja.orientacion, medidas: hoja.medidas };
  const { ancho, alto } = dimensionesDe(config);
  establecerAreaUtil(ancho, alto, config.margenes);
  refrescarLienzo(lienzo);
}

/**
 * Las páginas del PDF ya dibujadas, para no rasterizar de nuevo cada vez que se cambia de hoja.
 * Se vacía al cerrar o modificar el PDF: si no, seguiría mostrando la página vieja después de
 * borrarle un texto o una forma.
 */
const paginasDibujadas = new Map<number, string>();
/** Las mismas páginas pero chiquitas, para la tira de hojas. Se piden aparte y no se reescalan las
 * grandes: una miniatura pesa unos pocos KB y así un documento de 12 páginas no se lleva la memoria. */
const miniaturas = new Map<number, string>();

/** Ancho de la miniatura respecto del tamaño real. Da unos 60 px de ancho para una hoja A5. */
const ESCALA_MINIATURA = 0.15;

export function olvidarPaginasDibujadas(pagina?: number): void {
  if (pagina === undefined) {
    paginasDibujadas.clear();
    miniaturas.clear();
  } else {
    paginasDibujadas.delete(pagina);
    miniaturas.delete(pagina);
  }
}

/** La imagen chica de una hoja para la tira: su página del PDF, su fondo propio, o nada. */
export async function miniaturaDeHoja(indice: number): Promise<string | null> {
  const hoja = hojas[indice];
  if (!hoja) return null;
  if (hoja.paginaPdf === null) return hoja.fondo;

  const guardada = miniaturas.get(hoja.paginaPdf);
  if (guardada) return guardada;

  const { dibujarPagina, hayPdfAbierto } = await import('./pdfExistente');
  if (!hayPdfAbierto()) return null;
  const { fondo } = await dibujarPagina(hoja.paginaPdf, ESCALA_MINIATURA);
  miniaturas.set(hoja.paginaPdf, fondo);
  return fondo;
}

/**
 * Anota el dibujo nuevo de una página y lo pone a la vista. Es lo que se llama después de tocarle
 * el contenido al PDF —borrar un texto, sacar una forma—, que devuelven la página ya redibujada:
 * sin esto seguiría viéndose la versión anterior, con el texto que se acaba de borrar.
 */
export async function refrescarPaginaDibujada(lienzo: Canvas, pagina: number, fondo: string): Promise<void> {
  paginasDibujadas.set(pagina, fondo);
  await aplicarFondo(lienzo);
}

/** El fondo que le toca a una hoja: su página del PDF, o su imagen suelta. */
async function fondoDe(hoja: Hoja): Promise<string | null> {
  if (hoja.paginaPdf === null) return hoja.fondo;

  const guardada = paginasDibujadas.get(hoja.paginaPdf);
  if (guardada) return guardada;

  // Import dinámico y no arriba: `pdfExistente` es pesado (mupdf y pdf.js) y un documento sin PDF
  // de base no tiene por qué cargarlo.
  const { dibujarPagina, hayPdfAbierto } = await import('./pdfExistente');
  if (!hayPdfAbierto()) return null;

  try {
    const { fondo } = await dibujarPagina(hoja.paginaPdf);
    paginasDibujadas.set(hoja.paginaPdf, fondo);
    return fondo;
  } catch (error) {
    // El fondo es solo lo que se ve: si pdf.js no puede dibujar la página —o no hay navegador,
    // como en los arneses— la hoja se muestra en blanco, pero el documento sigue entero y al
    // exportar la página sale igual, porque eso lo hace pdf-lib con el PDF de verdad.
    console.warn('No se pudo dibujar la página del PDF:', error);
    return null;
  }
}

/**
 * Deja el editor mostrando la hoja vigente: su fondo, y **sobre qué página del PDF trabaja el
 * resto de la aplicación**. Lo segundo es tan importante como lo primero: el doble clic para
 * editar un texto o una forma le pide el contenido a `pdfExistente`, así que sin sincronizar la
 * página se estaría viendo la hoja 3 y editando el contenido de la 1.
 */
async function mostrarHojaVigente(lienzo: Canvas): Promise<void> {
  adoptarTamanoDeLaHoja(lienzo);
  const pagina = hojas[hojaVigente].paginaPdf;
  if (pagina !== null) {
    const { usarPagina, hayPdfAbierto } = await import('./pdfExistente');
    if (hayPdfAbierto()) await usarPagina(pagina);
  }
  await aplicarFondo(lienzo);
}

/**
 * Pone la imagen de fondo de la hoja vigente, estirada al tamaño de la página. Va como fondo del
 * lienzo y no como objeto, así no se puede seleccionar, no entra al historial y siempre queda por
 * debajo. Es aparte de `aplicarConfigPagina` porque cargar la imagen es asincrónico.
 */
export async function aplicarFondo(lienzo: Canvas): Promise<void> {
  const fondo = await fondoDe(hojas[hojaVigente]);
  if (!fondo) {
    lienzo.backgroundImage = undefined;
    lienzo.requestRenderAll();
    return;
  }

  const { ancho, alto } = dimensionesDe(config);
  const imagen = await FabricImage.fromURL(fondo);
  imagen.set({
    originX: 'left',
    originY: 'top',
    left: 0,
    top: 0,
    scaleX: ancho / (imagen.width || ancho),
    scaleY: alto / (imagen.height || alto),
  });
  lienzo.backgroundImage = imagen;
  lienzo.requestRenderAll();
}

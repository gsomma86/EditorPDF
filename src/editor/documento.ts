import { FabricImage, type Canvas } from 'fabric';
import { configPorDefecto, dimensionesDe, type ConfigPagina } from './pagina';
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
 * El tamaño, la orientación y los márgenes son del documento entero y no de cada hoja: un diseño
 * con hojas de distinto tamaño no tiene sentido para lo que hace este editor, y evitarlo saca de
 * encima un montón de casos raros.
 *
 * Ninguna de estas funciones registra un paso en el historial, igual que el resto del editor: eso
 * lo hace quien las llama, con `registrarSnapshot`. Importa sobre todo al borrar una hoja, que es
 * lo más caro de perder sin poder deshacerlo.
 */
let hojas: Elemento[][] = [[]];
let hojaVigente = 0;

export function cantidadDeHojas(): number {
  return hojas.length;
}

export function hojaActual(): number {
  return hojaVigente;
}

function elementosDelLienzo(lienzo: Canvas): Elemento[] {
  return lienzo
    .getObjects()
    .map((o) => elementoDe(o))
    .filter((e): e is Elemento => !!e);
}

/** Vuelca al modelo lo que hay en el lienzo. Hay que llamarlo antes de leer o guardar las hojas. */
export function asentarHoja(lienzo: Canvas): void {
  hojas[hojaVigente] = elementosDelLienzo(lienzo);
}

/** Todas las hojas, con la vigente ya actualizada desde el lienzo. */
export function hojasDelDocumento(lienzo: Canvas): Elemento[][] {
  asentarHoja(lienzo);
  return hojas;
}

export async function irAHoja(lienzo: Canvas, indice: number): Promise<void> {
  if (indice < 0 || indice >= hojas.length || indice === hojaVigente) return;
  asentarHoja(lienzo);
  hojaVigente = indice;
  await reconstruirLienzo(lienzo, hojas[hojaVigente]);
}

/** Agrega una hoja después de la vigente y se para en ella. Puede arrancar como copia de la actual. */
export async function agregarHoja(lienzo: Canvas, copiarLaActual = false): Promise<void> {
  asentarHoja(lienzo);
  const nueva: Elemento[] = copiarLaActual ? JSON.parse(JSON.stringify(hojas[hojaVigente])) : [];
  hojas.splice(hojaVigente + 1, 0, nueva);
  hojaVigente += 1;
  await reconstruirLienzo(lienzo, hojas[hojaVigente]);
}

/** Elimina una hoja. La última no se puede eliminar: un documento siempre tiene al menos una. */
export async function eliminarHoja(lienzo: Canvas, indice: number): Promise<void> {
  if (hojas.length <= 1 || indice < 0 || indice >= hojas.length) return;
  asentarHoja(lienzo);
  hojas.splice(indice, 1);
  // Si se fue la que se estaba editando, o una anterior, hay que recolocarse.
  hojaVigente = Math.min(hojaVigente > indice ? hojaVigente - 1 : hojaVigente, hojas.length - 1);
  await reconstruirLienzo(lienzo, hojas[hojaVigente]);
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
export async function establecerHojas(lienzo: Canvas, listas: Elemento[][], indice = 0): Promise<void> {
  hojas = listas.length ? listas : [[]];
  hojaVigente = Math.min(Math.max(0, indice), hojas.length - 1);
  await reconstruirLienzo(lienzo, hojas[hojaVigente]);
}

/**
 * Aplica el tamaño, la orientación y los márgenes al lienzo. Los elementos nuevos se colocan
 * dentro del área útil, así que el modelo también tiene que enterarse del cambio.
 */
export function aplicarConfigPagina(lienzo: Canvas, nueva: ConfigPagina): void {
  config = nueva;
  const { ancho, alto } = dimensionesDe(nueva);
  establecerAreaUtil(ancho, alto, nueva.margenes);
  refrescarLienzo(lienzo);
  void aplicarFondo(lienzo);
}

/**
 * Pone la imagen de fondo de la hoja, estirada al tamaño de la página. Va como fondo del lienzo y
 * no como objeto, así no se puede seleccionar, no entra al historial y siempre queda por debajo.
 * Es aparte de `aplicarConfigPagina` porque cargar la imagen es asincrónico.
 */
export async function aplicarFondo(lienzo: Canvas): Promise<void> {
  if (!config.fondo) {
    lienzo.backgroundImage = undefined;
    lienzo.requestRenderAll();
    return;
  }

  const { ancho, alto } = dimensionesDe(config);
  const imagen = await FabricImage.fromURL(config.fondo);
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

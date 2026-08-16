import { FabricImage, type Canvas } from 'fabric';
import { configPorDefecto, dimensionesDe, tamanoParecido, type ConfigPagina, type Orientacion, type TamanoPagina } from './pagina';
import { establecerAreaUtil, type Elemento } from './elemento';
import { refrescarLienzo } from './vista';
import { elementoDe, esPaginaFija, marcarPaginaFija, ordenarPila, reconstruirLienzo } from './objetosFabric';

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

/**
 * Una capa del documento. Son **del documento y no de cada hoja**: "Datos" o "Plantilla" son las
 * mismas en todas, y cada elemento dice a cuál pertenece. Al revés habría que rearmarlas hoja por
 * hoja, que es justo lo que nadie quiere hacer.
 */
export interface Capa {
  id: string;
  nombre: string;
  visible: boolean;
  bloqueada: boolean;
  /**
   * La capa donde caen los elementos nuevos. Es una sola en todo el documento, y vive acá —y no en
   * una variable del módulo— para que se guarde con el proyecto sin agregar nada al formato.
   */
  destino?: boolean;
}

/** Siempre hay al menos una: un elemento sin capa pertenece a la primera y nunca queda huérfano. */
let capas: Capa[] = [{ id: 'base', nombre: 'Capa 1', visible: true, bloqueada: false, destino: true }];

export function capasDelDocumento(): Capa[] {
  return capas;
}

export function establecerCapas(nuevas: Capa[]): void {
  capas = nuevas.length ? nuevas : [{ id: 'base', nombre: 'Capa 1', visible: true, bloqueada: false }];
  // La marca de destino tiene que ser de una sola capa: un proyecto viejo no trae ninguna y uno
  // manipulado a mano podría traer dos.
  if (capas.filter((c) => c.destino).length !== 1) {
    capas.forEach((c, i) => (c.destino = i === 0));
  }
  // El corte del fondo no puede quedar fuera de la lista nueva.
  capasSobreElFondo = Math.min(Math.max(0, capasSobreElFondo), capas.length);
}

/**
 * Cuántas capas van **delante** del fondo de la hoja. El fondo (la página del PDF, o la imagen de
 * la hoja) es un objeto más del apilado, y este número dice en qué lugar del orden de capas se
 * intercala: las primeras `capasSobreElFondo` quedan encima de la página y el resto, debajo.
 *
 * Es un solo número y no una marca por capa a propósito: así el corte es siempre limpio y no se
 * pueden intercalar capas de los dos lados, que es justo el estado imposible de explicar. Con el
 * valor por defecto —`capas.length`— el fondo queda detrás de todo, como fue siempre.
 */
let capasSobreElFondo = 1;

export function capasSobreElFondoDelDocumento(): number {
  return capasSobreElFondo;
}

export function establecerCapasSobreElFondo(cuantas: number): void {
  capasSobreElFondo = Math.min(Math.max(0, cuantas), capas.length);
}

/** La capa a la que van a parar los elementos nuevos. */
export function capaDestino(): Capa {
  return capas.find((c) => c.destino) ?? capas[0];
}

export function establecerCapaDestino(id: string): void {
  if (!capas.some((c) => c.id === id)) return;
  for (const capa of capas) capa.destino = capa.id === id;
}

/** La capa de un elemento, resolviendo el caso de los que no tienen ninguna anotada. */
export function capaDe(elemento: Elemento): Capa {
  return capas.find((c) => c.id === elemento.capa) ?? capas[0];
}

/** El id reservado de la capa donde cae todo lo que se saca del contenido de un PDF. */
export const CAPA_CONTENIDO_PDF = 'pdf';

/**
 * La capa donde va a parar lo que se convierte del PDF, creándola si todavía no está.
 *
 * Existe porque una forma sacada de un PDF tiene que quedar **debajo de la página**, donde estaba:
 * el texto de la hoja se dibujaba encima de ella. Antes eso era una marca por elemento; ahora es su
 * capa la que está detrás del fondo, que es lo mismo pero se ve en el panel y se puede mover.
 *
 * Nace al final de la lista —la más de atrás— y por eso queda del lado de atrás del fondo sin
 * tocar `capasSobreElFondo`: el corte cuenta capas desde adelante.
 */
export function capaDelContenidoDelPdf(): Capa {
  const existente = capas.find((c) => c.id === CAPA_CONTENIDO_PDF);
  if (existente) return existente;

  const capa: Capa = { id: CAPA_CONTENIDO_PDF, nombre: 'Contenido del PDF', visible: true, bloqueada: false };
  capas.push(capa);
  return capa;
}

/**
 * Si un elemento se ve, mirando también su capa: una capa apagada apaga todo lo suyo. Lo usan el
 * lienzo y la exportación, así que lo que se esconde tampoco sale en el PDF.
 */
export function elementoVisible(elemento: Elemento): boolean {
  return !elemento.oculto && capaDe(elemento).visible;
}

/** Si un elemento se puede tocar. Una capa bloqueada bloquea todo lo suyo. */
export function elementoBloqueado(elemento: Elemento): boolean {
  return !!elemento.bloqueado || capaDe(elemento).bloqueada;
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
  // Cómo quedó viéndose la que se deja. Va acá y no en `asentarHoja`, que corre en cada paso del
  // historial, en cada autoguardado y al exportar: sacar la miniatura redibuja el lienzo entero, y
  // hacerlo tantas veces trababa la aplicación.
  capturarMiniatura(lienzo);
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
 * Mete las páginas de otro PDF después de la hoja `despuesDe` y crea una hoja para cada una.
 *
 * Es el mismo mecanismo que duplicar una hoja —insertar páginas en el PDF de base y correr los
 * índices de las que venían después—, solo que las páginas vienen de otro archivo. Devuelve las
 * medidas de lo insertado para que quien llama pueda avisar si no coinciden con el documento.
 */
export async function insertarPdf(lienzo: Canvas, otro: Uint8Array, despuesDe: number): Promise<{ ancho: number; alto: number }[]> {
  asentarHoja(lienzo);
  const anclaje = hojas[despuesDe]?.paginaPdf;
  // Si la hoja de referencia no viene de una página (es una hoja en blanco), las páginas nuevas se
  // agregan al final del PDF; en la tira igual quedan justo después de ella.
  const trasPagina = anclaje ?? Math.max(-1, ...hojas.map((h) => h.paginaPdf ?? -1));

  const { insertarPaginasDeOtroPdf } = await import('./pdfExistente');
  const { cuantas, medidas } = await insertarPaginasDeOtroPdf(otro, trasPagina);
  if (!cuantas) return [];

  for (const hoja of hojas) {
    if (hoja.paginaPdf !== null && hoja.paginaPdf > trasPagina) hoja.paginaPdf += cuantas;
  }

  const nuevas: Hoja[] = medidas.map((m, i) => ({
    ...hojaEnBlanco(),
    paginaPdf: trasPagina + 1 + i,
    ...tamanoParecido(m.ancho, m.alto),
    medidas: m,
  }));
  hojas.splice(despuesDe + 1, 0, ...nuevas);
  hojaVigente = despuesDe + 1;

  // Los números de página se corrieron: lo dibujado hasta ahora quedó guardado con el índice viejo.
  olvidarPaginasDibujadas();
  await reconstruirLienzo(lienzo, hojas[hojaVigente].elementos);
  await mostrarHojaVigente(lienzo);
  return medidas;
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

/**
 * La miniatura tomada del lienzo, que es la única que muestra **la hoja entera**: el fondo y encima
 * lo que se haya dibujado. Las de `miniaturas` salen de la página del PDF sola, así que no incluyen
 * ni un texto reemplazado ni una imagen convertida ni nada que se haya agregado.
 *
 * Va en un `WeakMap` sobre la hoja y no en el modelo: acompaña a la hoja si se la reordena, se va
 * sola cuando la hoja deja de existir, y no termina dentro del `.json` del proyecto —una imagen en
 * base64 por hoja lo haría engordar sin necesidad—.
 */
const miniaturasDeLienzo = new WeakMap<Hoja, string>();

/**
 * Anota cómo se ve ahora la hoja que está en el lienzo. Se llama al dejarla y después de tocarle el
 * contenido al PDF: son los momentos en que lo que se ve dejó de coincidir con la página sola.
 */
export function capturarMiniatura(lienzo: Canvas, indice = hojaVigente): void {
  const hoja = hojas[indice];
  if (!hoja) return;

  // Fuera del navegador —los arneses— el lienzo es un doble sin `toDataURL`: no hay miniatura que
  // sacar y tampoco hace falta.
  if (typeof lienzo.toDataURL !== 'function') return;

  try {
    // El zoom se compensa **en el multiplicador**, sin tocar el lienzo. Fabric ya guarda y restaura
    // la vista al exportar, y multiplica por el zoom vigente: pidiendo `escala / zoom` la miniatura
    // sale siempre del mismo tamaño, se esté trabajando al 100% o al 220%.
    //
    // Nada de escribir `viewportTransform` a mano acá: hacerlo no recalcula los límites de la
    // vista, y Fabric seguía dibujando con los viejos — el lienzo quedaba lleno de copias
    // fantasma de lo que se estuviera moviendo, y terminaba trabándose.
    const zoom = lienzo.getZoom?.() || 1;
    miniaturasDeLienzo.set(hoja, lienzo.toDataURL({ format: 'png', multiplier: ESCALA_MINIATURA / zoom }));
  } catch {
    // Un lienzo "sucio" —con una imagen de otro origen— no se deja exportar. Sin miniatura propia
    // se sigue usando la de la página del PDF: peor, pero no rompe nada.
  }
}

/** La imagen chica de una hoja para la tira: lo que se ve en ella, su página del PDF, o nada. */
export async function miniaturaDeHoja(indice: number): Promise<string | null> {
  const hoja = hojas[indice];
  if (!hoja) return null;

  // Primero la del lienzo: es la que incluye lo dibujado encima del fondo.
  const propia = miniaturasDeLienzo.get(hoja);
  if (propia) return propia;

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
  // La miniatura de esa página también quedó vieja. No se reescala la grande —se dibuja aparte, a
  // su tamaño— así que acá solo se la olvida y se rehace sola la próxima vez que la tira se dibuje.
  // Sin esto, la tira seguía mostrando el texto o la imagen que se acababa de sacar.
  miniaturas.delete(pagina);
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
 * Pone la imagen de fondo de la hoja vigente, estirada al tamaño de la página.
 *
 * Va como **un objeto más de la pila** y no como `backgroundImage` del lienzo: así hay un solo
 * apilado, y las capas que van detrás de la página quedan realmente detrás sin necesidad del
 * `destination-over` que antes partía el orden en dos grupos incomunicados. Para que siga sin
 * poderse tocar, nace `selectable: false` y `evented: false`, y **no se registra en el modelo**
 * —`elementoDe` no lo conoce—, así lo saltean el historial, el panel de capas y el guardado.
 *
 * Es aparte de `aplicarConfigPagina` porque cargar la imagen es asincrónico.
 */
export async function aplicarFondo(lienzo: Canvas): Promise<void> {
  // Salga o no salga fondo nuevo, el viejo se va: si no, al pasar de una hoja con PDF a una sin él
  // la página anterior queda pegada abajo del dibujo.
  const anterior = lienzo.getObjects().filter((o) => esPaginaFija(o));
  if (anterior.length) lienzo.remove(...anterior);

  const fondo = await fondoDe(hojas[hojaVigente]);
  if (!fondo) {
    ordenarPila(lienzo);
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
    selectable: false,
    evented: false,
    hasControls: false,
    hasBorders: false,
  });
  marcarPaginaFija(imagen);
  lienzo.add(imagen);
  // `add` la deja al frente de todo: `ordenarPila` la manda al lugar que le toca según cuántas
  // capas vayan por encima de la página.
  ordenarPila(lienzo);
  lienzo.requestRenderAll();
}

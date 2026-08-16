/**
 * Formas e imágenes del contenido de un PDF, para poder editarlas como cualquier elemento del
 * diseño. Es el corazón de la fase 3, el equivalente para el dibujo de lo que `pdfExistente.ts`
 * hace con el texto.
 *
 * **Cómo se saca algo.** Con una redacción de mupdf sobre su rectángulo, pidiéndole que se lleve el
 * dibujo vectorial —o la imagen— y no toque el texto. No se emparejan formas con operadores del
 * content stream: ver el detalle en `borrarFormasDelPdf`, donde está por qué eso no funciona.
 *
 * **Qué entra.** Todo el dibujo vectorial, giradas las formas o no. Los rectángulos y las líneas
 * rectas —el 89% de lo que hay dibujado, medido sobre 120 PDF reales— se reconocen como tales y
 * entran como recuadro o línea del editor; las líneas suelen venir como rectángulos degenerados
 * —alto o ancho 0— así que son el mismo caso. El resto (curvas y dibujos de varios trazos, el 11%)
 * entra como **camino**: se guardan sus tramos tal cual y se redibujan igual. Y las imágenes, que
 * vuelven como imagen del diseño y se mueven, se estiran y se borran como cualquier otra.
 *
 * **Qué queda afuera.** Solo lo que tenga sesgo real, que no hay con qué dibujar. Sobre esos mismos
 * 120 PDF no apareció ni uno.
 */

import { crearElemento, crearElementoForma, crearElementoImagen, type Elemento } from './elemento';
import { capaDelContenidoDelPdf } from './documento';
import type { Segmento } from './figuras';

/** Una forma del contenido, en coordenadas de la hoja (Y desde arriba, como el lienzo). */
export interface FormaDelPdf {
  /** Orden en que la dibuja el PDF, desde 0. Sirve para identificarla mientras está a la vista. */
  indice: number;
  /**
   * `camino` es todo lo que no entra en un rectángulo ni en una línea: curvas y dibujos de varios
   * trazos. Sobre 120 PDF reales es el 11% de lo dibujado, así que dejarlo afuera se notaba.
   */
  clase: 'rect' | 'linea' | 'camino';
  /** Los tramos, normalizados de 0 a 1 sobre la caja. Solo lo trae `clase: 'camino'`. */
  camino?: Segmento[];
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  /** Relleno macizo, o solo el contorno. */
  relleno: boolean;
  /** Grosor del trazo, en puntos. Sin sentido si es un relleno. */
  grosor: number;
  /**
   * Cuánto está girada, en grados y en el sentido del lienzo. Casi siempre 0: las formas de un
   * PDF de oficina vienen derechas. x/y/w/h describen la caja **sin girar**, y el giro se aplica
   * después alrededor de la esquina superior izquierda, igual que en el resto del editor.
   */
  angulo: number;
}

/**
 * Una imagen del contenido del PDF, en coordenadas de la hoja. No se edita su contenido —para eso
 * está reemplazarla—, pero sí se la puede sacar del PDF y volver a colocar como imagen del diseño,
 * y de ahí en más se mueve, se achica y se borra como cualquier otra.
 */
export interface ImagenDelPdf {
  indice: number;
  x: number;
  y: number;
  w: number;
  h: number;
  angulo: number;
  /** Los píxeles, como data URL PNG, listos para volverse un `ElementoImagen`. */
  src: string;
}

function hex(componentes: number[]): string {
  const aByte = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 255);
  if (componentes.length === 1) {
    const g = aByte(componentes[0]);
    return `#${[g, g, g].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
  }
  if (componentes.length >= 4) {
    const [c, m, y, k] = componentes;
    componentes = [(1 - c) * (1 - k), (1 - m) * (1 - k), (1 - y) * (1 - k)];
  }
  return `#${componentes.slice(0, 3).map((v) => aByte(v).toString(16).padStart(2, '0')).join('')}`;
}

/** Un trazo tan fino que en la práctica es una línea, no un rectángulo. */
const GROSOR_LINEA = 1.5;

/**
 * Descompone la matriz del PDF en el ángulo que aplica y la parte sin girar.
 *
 * Una matriz `[a b c d tx ty]` que solo escala y gira se puede leer como una rotación seguida de
 * una escala: el ángulo sale de la primera columna, y deshacerlo deja una matriz de ejes rectos que
 * `medir()` ya sabe tratar. Devuelve `null` si además hay sesgo (los dos ejes no quedan
 * perpendiculares), que no se puede representar con un elemento del editor.
 *
 * El ángulo sale ya en el sentido del lienzo, sin invertirle el signo: mupdf entrega la matriz en
 * su espacio de dispositivo, que mide la Y desde arriba igual que Fabric.
 */
function separarGiro(ctm: number[]): { angulo: number; sinGiro: number[] } | null {
  const [a, b, c, d, tx, ty] = ctm;
  const angulo = Math.atan2(b, a);

  const cos = Math.cos(angulo);
  const sen = Math.sin(angulo);
  // La inversa de la rotación, aplicada a la matriz: si queda con b y c en cero, era giro puro.
  const sinGiro = [a * cos + b * sen, -a * sen + b * cos, c * cos + d * sen, -c * sen + d * cos, tx, ty];

  // La tolerancia va **en proporción al tamaño**, no en valor absoluto. Las matrices de un PDF real
  // llegan con ruido de redondeo —un `b` de 0,00002 donde debería haber un cero— y con un épsilon
  // fijo eso se leía como sesgo y la forma se descartaba, aunque el desvío fuera de centésimas de
  // milésima de punto sobre una caja de 24. Con 1e-3 relativo el corte queda en 0,06° de sesgo:
  // por debajo de eso no hay nada que un ojo pueda ver, ni que valga la pena rechazar.
  const escala = Math.max(Math.abs(sinGiro[0]), Math.abs(sinGiro[3]), 1e-9);
  if (Math.abs(sinGiro[1]) / escala > 1e-3 || Math.abs(sinGiro[2]) / escala > 1e-3) return null;

  return { angulo: (angulo * 180) / Math.PI, sinGiro };
}

/**
 * Lleva la esquina de la caja enderezada al lugar que le toca en la hoja: primero el giro que trae
 * la matriz, después su traslación. Es el orden en que lo aplica el PDF, y hacerlo al revés corre
 * la forma tanto más cuanto más lejos del origen esté.
 */
function ubicarEsquina(x: number, y: number, ctm: number[]): { x: number; y: number } {
  const [a, b, , , tx, ty] = ctm;
  const angulo = Math.atan2(b, a);
  const cos = Math.cos(angulo);
  const sen = Math.sin(angulo);
  return { x: cos * x - sen * y + tx, y: sen * x + cos * y + ty };
}

/**
 * Clasifica los puntos de un path ya enderezados. Devuelve `null` si no es un rectángulo ni una
 * línea —con curvas, con varios subcaminos o con más de cuatro puntos—, y entonces quien llama lo
 * guarda como camino libre.
 */
function medir(puntos: [number, number][], curvas: boolean, subcaminos: number): { clase: 'rect' | 'linea'; x: number; y: number; w: number; h: number } | null {
  if (curvas || subcaminos > 1) return null;

  const xs = [...new Set(puntos.map((p) => Math.round(p[0] * 100) / 100))];
  const ys = [...new Set(puntos.map((p) => Math.round(p[1] * 100) / 100))];

  // Un rectángulo recto tiene exactamente dos valores distintos de X y dos de Y, en cuatro puntos.
  // Una línea recta tiene dos puntos y comparte una de las dos coordenadas.
  const esRect = puntos.length === 4 && xs.length === 2 && ys.length === 2;
  const esLinea = puntos.length === 2 && (xs.length === 1 || ys.length === 1);
  if (!esRect && !esLinea) return null;

  const x = Math.min(...xs);
  const y = Math.min(...ys);
  const w = Math.max(...xs) - x;
  const h = Math.max(...ys) - y;

  // Un rectángulo sin espesor es en realidad una línea: así se dibujan en casi todos los PDF que
  // salen de un HTML, y tratarlo como recuadro daría un elemento de alto 0 imposible de agarrar.
  const clase = esLinea || w < GROSOR_LINEA || h < GROSOR_LINEA ? 'linea' : 'rect';
  return { clase, x, y, w, h };
}

async function motor() {
  return import('mupdf');
}

/**
 * Las formas editables de una página, en el orden en que las dibuja el PDF.
 */
export async function formasDelPdf(bytes: Uint8Array, pagina: number): Promise<FormaDelPdf[]> {
  const mupdf = await motor();
  const documento = mupdf.PDFDocument.openDocument(bytes.slice(), 'application/pdf') as InstanceType<typeof mupdf.PDFDocument>;
  const hoja = documento.loadPage(pagina) as any;

  const formas: FormaDelPdf[] = [];
  let indice = 0;

  const anotar = (path: any, ctm: number[], color: number[], relleno: boolean, grosor: number) => {
    const propio = indice++;

    // Se recorre el camino entero, guardando cada tramo: los rectos alcanzan para reconocer un
    // rectángulo o una línea, y si aparece una curva o varios subcaminos sirven igual para
    // reconstruir el dibujo tal cual.
    const puntos: [number, number][] = [];
    const tramos: Segmento[] = [];
    let curvas = false;
    let subcaminos = 0;
    path.walk({
      moveTo: (x: number, y: number) => {
        subcaminos++;
        puntos.push([x, y]);
        tramos.push({ t: 'M', x, y });
      },
      lineTo: (x: number, y: number) => {
        puntos.push([x, y]);
        tramos.push({ t: 'L', x, y });
      },
      curveTo: (x1: number, y1: number, x2: number, y2: number, x: number, y: number) => {
        curvas = true;
        // Los puntos de control entran en la caja: la contienen, así que la curva nunca se sale.
        puntos.push([x1, y1], [x2, y2], [x, y]);
        tramos.push({ t: 'C', x1, y1, x2, y2, x, y });
      },
      closePath: () => tramos.push({ t: 'Z' }),
    });

    if (!puntos.length) return;

    // Se separa el giro de la matriz y se mide la forma **enderezada**: así una línea girada 30°
    // se reconoce igual que una derecha, y el ángulo se guarda aparte. Con sesgo (los ejes dejan
    // de ser perpendiculares) no hay elemento que la represente, y se descarta.
    const separada = separarGiro(ctm);
    if (!separada) return;
    const [escalaX, , , escalaY] = separada.sinGiro;

    // Sin trasladar: la traslación se aplica *después* del giro, así que sumarla acá correría la
    // caja a un lugar que no es. Se mide la forma enderezada y recién entonces se ubica su esquina.
    const enderezados = puntos.map((p) => [escalaX * p[0], escalaY * p[1]] as [number, number]);
    const medida = medir(enderezados, curvas, subcaminos);

    const comun = {
      indice: propio,
      color: hex(color.slice(0, 4)),
      relleno,
      // El grosor está en el sistema del path: la matriz lo escala igual que a todo lo demás.
      grosor: Math.abs(grosor * escalaY) || 1,
      angulo: Math.abs(separada.angulo) < 1e-6 ? 0 : Math.round(separada.angulo * 100) / 100,
    };

    if (medida) {
      formas.push({ ...comun, ...medida, ...ubicarEsquina(medida.x, medida.y, ctm) });
      return;
    }

    // No es un rectángulo ni una línea: se guarda como camino. La caja sale de todos sus puntos y
    // los tramos se normalizan contra ella, así estirar la forma después es solo multiplicar.
    const xs = enderezados.map((p) => p[0]);
    const ys = enderezados.map((p) => p[1]);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    const w = Math.max(...xs) - x;
    const h = Math.max(...ys) - y;
    // Un camino sin superficie no se puede agarrar ni normalizar: se lo deja pasar.
    if (w < 0.5 || h < 0.5) return;

    const normal = (v: number, min: number, largo: number) => Math.round(((v - min) / largo) * 10000) / 10000;
    const camino: Segmento[] = tramos.map((t) => {
      if (t.t === 'Z') return t;
      const nx = (v: number) => normal(escalaX * v, x, w);
      const ny = (v: number) => normal(escalaY * v, y, h);
      if (t.t === 'C') return { t: 'C', x1: nx(t.x1), y1: ny(t.y1), x2: nx(t.x2), y2: ny(t.y2), x: nx(t.x), y: ny(t.y) };
      return { t: t.t, x: nx(t.x), y: ny(t.y) };
    });

    formas.push({ ...comun, clase: 'camino', camino, w, h, ...ubicarEsquina(x, y, ctm) });
  };

  const dispositivo = new mupdf.Device({
    fillPath: (path: any, _eo: boolean, ctm: number[], _cs: unknown, color: number[]) => anotar(path, ctm, color, true, 0),
    strokePath: (path: any, trazo: any, ctm: number[], _cs: unknown, color: number[]) => anotar(path, ctm, color, false, trazo?.getLineWidth?.() ?? 1),
  });

  // Solo el contenido: `run()` dibujaría también las anotaciones, y los bordes de los campos de
  // formulario aparecerían como si fueran formas de la página (ver la lección 30 de CLAUDE.md).
  hoja.runPageContents(dispositivo, mupdf.Matrix.identity);
  return formas;
}

/**
 * Rasteriza una imagen del PDF **con su transparencia puesta**.
 *
 * `toPixmap()` devuelve solo la imagen de base: donde el PDF la quiere transparente entrega negro
 * opaco, porque la transparencia no vive ahí sino en una *soft mask* aparte —una imagen en escala
 * de grises donde 0 es transparente y 255 opaco—. Sin combinarlas, un ícono con fondo transparente
 * se colocaba sobre un cuadrado negro.
 *
 * La máscara puede tener otro tamaño que la base, así que se la muestrea al vecino más cercano: es
 * suficiente, porque las dos describen la misma figura y solo cambia el detalle.
 */
function rasterizarConAlfa(mupdf: any, imagen: any): Uint8Array {
  const pix = imagen.toPixmap();
  const mascara = imagen.getMask?.();
  if (!mascara) return pix.asPNG();

  const ancho = pix.getWidth();
  const alto = pix.getHeight();
  const comps = pix.getNumberOfComponents();
  const datos = pix.getPixels();

  const mp = mascara.toPixmap();
  const mDatos = mp.getPixels();
  const mAncho = mp.getWidth();
  const mAlto = mp.getHeight();
  const mPaso = mp.getNumberOfComponents();
  const alfaEn = (x: number, y: number) => {
    const mx = Math.min(mAncho - 1, Math.floor((x * mAncho) / ancho));
    const my = Math.min(mAlto - 1, Math.floor((y * mAlto) / alto));
    return mDatos[(my * mAncho + mx) * mPaso];
  };

  // Con canal alfa ya presente alcanza con pisarlo.
  if (pix.getAlpha()) {
    for (let y = 0; y < alto; y++) {
      for (let x = 0; x < ancho; x++) datos[(y * ancho + x) * comps + comps - 1] = alfaEn(x, y);
    }
    return pix.asPNG();
  }

  // Sin canal alfa hay que armar un pixmap nuevo que sí lo tenga y copiar color + máscara. Pasa a
  // menudo: el PDF guarda la imagen en RGB puro y la transparencia enteramente en la soft mask.
  const conAlfa = new mupdf.Pixmap(pix.getColorSpace(), pix.getBounds(), true);
  const dDatos = conAlfa.getPixels();
  const dComps = conAlfa.getNumberOfComponents();
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const origen = (y * ancho + x) * comps;
      const destino = (y * ancho + x) * dComps;
      for (let c = 0; c < comps; c++) dDatos[destino + c] = datos[origen + c];
      dDatos[destino + dComps - 1] = alfaEn(x, y);
    }
  }
  return conAlfa.asPNG();
}

/** Un `Uint8Array` como data URL. Se corta en pedazos: `btoa` de una imagen entera desborda la pila. */
function comoDataUrl(bytes: Uint8Array, tipo: string): string {
  let binario = '';
  const PASO = 8192;
  for (let i = 0; i < bytes.length; i += PASO) {
    binario += String.fromCharCode(...bytes.subarray(i, i + PASO));
  }
  return `data:${tipo};base64,${btoa(binario)}`;
}

/**
 * Las imágenes del contenido de una página.
 *
 * El PDF dibuja toda imagen sobre el **cuadrado unidad**, transformado por la matriz: de ahí salen
 * el ancho (el largo de la primera columna), el alto (el de la segunda) y el giro. El ancla es la
 * esquina (0,1) del cuadrado, que es donde cae la primera fila de píxeles de la imagen.
 */
export async function imagenesDelPdf(bytes: Uint8Array, pagina: number): Promise<ImagenDelPdf[]> {
  const mupdf = await motor();
  const documento = mupdf.PDFDocument.openDocument(bytes.slice(), 'application/pdf') as InstanceType<typeof mupdf.PDFDocument>;
  const hoja = documento.loadPage(pagina) as any;

  const imagenes: ImagenDelPdf[] = [];
  let indice = 0;

  const dispositivo = new mupdf.Device({
    fillImage: (imagen: any, ctm: number[]) => {
      const propio = indice++;

      // Mismo tratamiento que las formas: se separa el giro y se trabaja con la matriz enderezada.
      // Hace falta porque **la escala puede venir negativa** —la imagen entra espejada, que es como
      // aparecen muchas en un PDF real— y entonces el ancla no es la esquina (0,0) del cuadrado
      // unidad sino la de abajo. Tomando el mínimo de las dos, sale bien en los dos casos.
      const separada = separarGiro(ctm);
      if (!separada) return;
      const [escalaX, , , escalaY] = separada.sinGiro;

      const w = Math.abs(escalaX);
      const h = Math.abs(escalaY);
      // Demasiado chica para agarrarla con el mouse: casi siempre es un separador de 1 px estirado
      // o un artefacto, no una imagen que alguien quiera tocar.
      if (w < 4 || h < 4) return;

      let src: string;
      try {
        src = comoDataUrl(rasterizarConAlfa(mupdf, imagen), 'image/png');
      } catch {
        // Hay imágenes que mupdf no sabe rasterizar (máscaras raras, espacios de color exóticos).
        // Sin píxeles no se puede reinsertar, así que no se ofrece para editar.
        return;
      }

      // La esquina de arriba a la izquierda en el marco enderezado, y de ahí a su lugar en la hoja
      // aplicando el giro y después la traslación, como con las formas.
      const esquina = ubicarEsquina(Math.min(0, escalaX), Math.min(0, escalaY), ctm);
      imagenes.push({
        indice: propio,
        x: Math.round(esquina.x * 100) / 100,
        y: Math.round(esquina.y * 100) / 100,
        w: Math.round(w * 100) / 100,
        h: Math.round(h * 100) / 100,
        angulo: Math.abs(separada.angulo) < 1e-6 ? 0 : Math.round(separada.angulo * 100) / 100,
        src,
      });
    },
  });

  // Solo el contenido, como con las formas: `run()` traería también las anotaciones.
  hoja.runPageContents(dispositivo, mupdf.Matrix.identity);
  return imagenes;
}

/**
 * Saca una imagen del contenido de la página. Misma redacción que las formas, pero pidiéndole que
 * se lleve **la imagen** (1 = quitarla) y deje quietos el dibujo vectorial y el texto.
 */
export async function borrarImagenDelPdf(bytes: Uint8Array, pagina: number, imagen: { x: number; y: number; w: number; h: number }): Promise<Uint8Array> {
  const mupdf = await motor();
  const documento = mupdf.PDFDocument.openDocument(bytes.slice(), 'application/pdf') as InstanceType<typeof mupdf.PDFDocument>;
  const hoja = documento.loadPage(pagina) as any;

  const anotacion = hoja.createAnnotation('Redact');
  anotacion.setRect([imagen.x - 0.5, imagen.y - 0.5, imagen.x + imagen.w + 0.5, imagen.y + imagen.h + 0.5]);
  anotacion.update();

  // Sin recuadros negros; imágenes fuera (1); el dibujo vectorial intacto (0) y el texto también (1).
  hoja.applyRedactions(false, 1, 0, 1);
  return new Uint8Array(documento.saveToBuffer('').asUint8Array());
}

/**
 * La imagen del PDF como elemento del diseño, en el mismo lugar y con las mismas medidas. De ahí
 * en más es una imagen común del editor: se mueve, se estira desde una esquina y se borra con Supr,
 * sin que haga falta nada propio para eso.
 *
 * Va a la misma capa que las formas, "Contenido del PDF": las dos salieron de la página y las dos
 * tienen que apilarse igual. Que antes no fuera así —la imagen quedaba encima y la forma debajo— es
 * justo lo que hacía que "Enviar atrás" pareciera funcionar con una y no con la otra.
 */
export function elementoDesdeImagen(imagen: ImagenDelPdf): Elemento {
  // Por el constructor de siempre, para que tome un id de la secuencia; después se le imponen la
  // posición y las medidas que traía en el PDF, que es lo que importa.
  const elemento = crearElementoImagen(imagen.src, imagen.w, imagen.h) as Elemento & { clase: 'imagen' };
  elemento.x = imagen.x;
  elemento.y = imagen.y;
  elemento.w = imagen.w;
  elemento.h = imagen.h;
  elemento.angulo = imagen.angulo;
  elemento.capa = capaDelContenidoDelPdf().id;
  return elemento;
}

/** La imagen que cae bajo un punto de la hoja. De adelante hacia atrás: gana la de arriba. */
export function imagenEn(imagenes: ImagenDelPdf[], x: number, y: number): ImagenDelPdf | undefined {
  return [...imagenes].reverse().find((i) => x >= i.x && x <= i.x + i.w && y >= i.y && y <= i.y + i.h);
}

// ---------- Sacar formas del contenido ----------

/**
 * Saca del contenido de la página las formas indicadas y devuelve el PDF ya modificado.
 *
 * Lo hace con una **redacción** de mupdf por cada forma, el mismo mecanismo que borra el texto,
 * pero pidiéndole que se lleve el dibujo vectorial y deje el texto quieto. Es importante que sea
 * mupdf y no una cirugía a mano sobre el content stream: el recorrido informa menos formas que
 * operadores hay —saltea los que no dibujan nada visible: en una plantilla real, 556 contra 672—
 * así que emparejarlos por posición borra el operador equivocado y se lleva puesto texto y líneas
 * que nadie pidió sacar. Con redacciones se identifica por rectángulo y ese problema no existe.
 *
 * Ojo: la redacción se lleva **todo el dibujo que quede completamente adentro** del rectángulo, así
 * que sacar un recuadro grande puede llevarse una línea que estuviera adentro. Por eso quien llama
 * conviene que compare cuántas formas quedaron.
 */
/**
 * Cómo de exigente es la redacción con el dibujo vectorial.
 *
 * `cubierto` se lleva solo lo que queda enteramente adentro del rectángulo: es lo preciso, y lo que
 * conviene casi siempre. `tocado` se lleva todo lo que lo roce, y hace falta para las figuras
 * dibujadas con relleno y borde —que en el PDF son **dos caminos**— porque el del borde no se da
 * nunca por cubierto, ni agrandando el rectángulo seis puntos (se midió).
 */
export type ModoRedaccion = 'cubierto' | 'tocado';

export async function borrarFormasDelPdf(
  bytes: Uint8Array,
  pagina: number,
  objetivos: { x: number; y: number; w: number; h: number; grosor?: number }[],
  modo: ModoRedaccion = 'cubierto'
): Promise<Uint8Array> {
  if (!objetivos.length) return bytes;

  const mupdf = await motor();
  const documento = mupdf.PDFDocument.openDocument(bytes.slice(), 'application/pdf') as InstanceType<typeof mupdf.PDFDocument>;
  const hoja = documento.loadPage(pagina) as any;

  for (const o of objetivos) {
    const anotacion = hoja.createAnnotation('Redact');
    // Medio punto de aire, nada más: con "quitar lo que toque" (ver abajo) agrandar el rectángulo
    // solo se llevaría puesto lo de al lado.
    anotacion.setRect([o.x - 0.5, o.y - 0.5, o.x + o.w + 0.5, o.y + o.h + 0.5]);
    anotacion.update();
  }

  // Sin recuadros negros; imágenes intactas (0); el dibujo vectorial según el modo pedido; el texto
  // no se toca (1) — es justo al revés que al borrar un texto, que usa (0, 0).
  hoja.applyRedactions(false, 0, modo === 'tocado' ? 2 : 1, 1);
  // Copia propia: lo que devuelve mupdf es una vista sobre su memoria y se invalida en cuanto se
  // vuelve a usar el motor (ver la lección 22 de CLAUDE.md).
  return new Uint8Array(documento.saveToBuffer('').asUint8Array());
}

/** Saca una sola forma. Es el caso del doble clic. */
export async function borrarFormaDelPdf(
  bytes: Uint8Array,
  pagina: number,
  forma: { x: number; y: number; w: number; h: number },
  modo: ModoRedaccion = 'cubierto'
): Promise<Uint8Array> {
  return borrarFormasDelPdf(bytes, pagina, [forma], modo);
}

/**
 * Convierte una forma del PDF en un elemento del diseño, con su misma posición, medidas y color.
 * Un relleno macizo se reconstruye como recuadro relleno sin borde; uno de contorno, al revés.
 *
 * Va a la capa "Contenido del PDF", que está **detrás de la página**: en el PDF esta forma estaba
 * debajo del texto y ahí tiene que seguir. Es su capa la que decide eso, no una marca del elemento,
 * así el orden que muestra el panel es el que se ve en la hoja.
 */
export function elementoDesdeForma(forma: FormaDelPdf): Elemento {
  // Un camino libre entra como elemento 'forma' con `figura: 'camino'`: comparte con las demás la
  // caja, el color, el relleno y el estilo, y lo único propio son sus tramos.
  if (forma.clase === 'camino') {
    const elemento = crearElementoForma('camino');
    elemento.camino = forma.camino;
    elemento.x = forma.x;
    elemento.y = forma.y;
    elemento.w = forma.w;
    elemento.h = forma.h;
    elemento.angulo = forma.angulo;
    elemento.color = forma.color;
    elemento.conRelleno = forma.relleno;
    elemento.rellenoColor = forma.color;
    elemento.grosor = forma.relleno ? 0 : Math.max(0.5, forma.grosor);
    const camino = elemento as Elemento;
    camino.capa = capaDelContenidoDelPdf().id;
    return camino;
  }

  const elemento = crearElemento(forma.clase) as Elemento & { clase: 'rect' | 'linea' };
  elemento.x = forma.x;
  elemento.y = forma.y;
  elemento.w = forma.w;
  elemento.h = forma.h;
  // Las medidas son las de la forma enderezada y el giro va aparte, igual que en el resto del
  // editor: todos los elementos rotan alrededor de su esquina superior izquierda.
  elemento.angulo = forma.angulo;
  elemento.color = forma.color;
  elemento.capa = capaDelContenidoDelPdf().id;
  if (elemento.clase === 'rect') {
    elemento.conRelleno = forma.relleno;
    elemento.rellenoColor = forma.color;
    elemento.grosor = forma.relleno ? 0 : Math.max(0.5, forma.grosor);
  }
  return elemento;
}

/** La forma que cae bajo un punto de la hoja. Se prueba de adelante hacia atrás: gana la de arriba. */
export function formaEn(formas: FormaDelPdf[], x: number, y: number): FormaDelPdf | undefined {
  const holgura = 2;
  return [...formas]
    .reverse()
    .find((f) => x >= f.x - holgura && x <= f.x + f.w + holgura && y >= f.y - holgura && y <= f.y + f.h + holgura);
}

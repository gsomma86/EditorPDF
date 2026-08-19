/**
 * La geometría que comparten el lienzo y el exportador, en un solo lugar: las formas y las líneas
 * internas de la tabla.
 *
 * El lienzo y el exportador dibujan **lo mismo**: los dos piden acá los puntos y solo se diferencian
 * en cómo los trazan (canvas de un lado, pdf-lib del otro). Cuando cada uno se calculaba su propia
 * geometría —como pasaba con la tabla— tocar una y olvidarse de la otra dejaba la pantalla y el PDF
 * distintos, y eso no se descubre hasta abrir el archivo exportado.
 *
 * Los puntos vienen en coordenadas locales de la caja: (0,0) es su esquina superior izquierda y la
 * Y crece hacia abajo, como en pantalla. Quien dibuje se encarga de llevarlos a donde van.
 */
import { altoTotalTabla, anchoTotalTabla, type ElementoForma, type ElementoTabla } from './elemento';

export interface Punto {
  x: number;
  y: number;
}

/**
 * Un tramo de un camino libre, el que traen las curvas y los dibujos compuestos de un PDF.
 *
 * Se guarda como lista de tramos y no como cadena SVG a propósito: así se escala multiplicando
 * números —el lienzo y el exportador lo hacen cada uno a su manera— sin tener que interpretar una
 * cadena, y viaja al `.json` del proyecto como datos y no como texto que haya que volver a parsear.
 *
 * Las coordenadas van **normalizadas de 0 a 1** sobre la caja del camino. Estirar la forma es
 * entonces multiplicar por su ancho y su alto, y no hace falta recordar el tamaño original.
 */
export type Segmento =
  | { t: 'M'; x: number; y: number }
  | { t: 'L'; x: number; y: number }
  | { t: 'C'; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
  | { t: 'Z' };

/** Cuántas puntas admite una estrella: menos de 3 no cierra y más de 20 no se distingue. */
export const PUNTAS_MIN = 3;
export const PUNTAS_MAX = 20;

/** Qué tan adentro caen los vértices interiores de la estrella, sobre el radio de los exteriores. */
const HUNDIDO_ESTRELLA = 0.42;

/**
 * Recorre los tramos de un camino llevándolos a la caja del elemento: los guarda normalizados de 0
 * a 1, así que estirarlo es multiplicar por su ancho y su alto.
 *
 * Existe para que el lienzo y el exportador recorran **lo mismo**: uno lo pasa a `ctx.bezierCurveTo`
 * y el otro a un camino SVG para pdf-lib, pero la geometría se calcula una sola vez y acá.
 */
export function recorrerCamino(
  camino: Segmento[],
  w: number,
  h: number,
  acciones: {
    mover(x: number, y: number): void;
    linea(x: number, y: number): void;
    curva(x1: number, y1: number, x2: number, y2: number, x: number, y: number): void;
    cerrar(): void;
  }
): void {
  for (const tramo of camino) {
    switch (tramo.t) {
      case 'M':
        acciones.mover(tramo.x * w, tramo.y * h);
        break;
      case 'L':
        acciones.linea(tramo.x * w, tramo.y * h);
        break;
      case 'C':
        acciones.curva(tramo.x1 * w, tramo.y1 * h, tramo.x2 * w, tramo.y2 * h, tramo.x * w, tramo.y * h);
        break;
      case 'Z':
        acciones.cerrar();
        break;
    }
  }
}

/**
 * El contorno de la figura como polígono cerrado, o `null` para la elipse y para un camino, que no
 * son polígonos: la elipse usa su primitiva (`ctx.ellipse` / `drawEllipse`) y el camino sus tramos.
 */
export function puntosDeFigura(el: ElementoForma): Punto[] | null {
  const { w, h } = el;

  switch (el.figura) {
    case 'elipse':
    // Un camino tampoco se describe con puntos: lleva sus propios tramos en `el.camino`, y quien
    // dibuja lo recorre con `recorrerCamino`.
    case 'camino':
      return null;

    case 'triangulo': {
      const verticeX = Math.max(0, Math.min(1, el.verticeX ?? 0.5)) * w;
      return [
        { x: verticeX, y: 0 },
        { x: w, y: h },
        { x: 0, y: h },
      ];
    }

    case 'flecha': {
      // La cabeza no puede comerse la flecha entera: como mucho, todo el ancho disponible.
      const cabeza = Math.min(w, Math.max(4, (el.tamanoCabeza ?? 1) * h));
      const cuerpo = Math.max(1, (el.grosorAsta ?? 0.25) * h); // media altura del asta
      const medio = h / 2;
      const base = w - cabeza;
      return [
        { x: 0, y: medio - cuerpo },
        { x: base, y: medio - cuerpo },
        { x: base, y: 0 },
        { x: w, y: medio },
        { x: base, y: h },
        { x: base, y: medio + cuerpo },
        { x: 0, y: medio + cuerpo },
      ];
    }

    case 'estrella': {
      const n = Math.max(PUNTAS_MIN, Math.min(PUNTAS_MAX, Math.round(el.puntas) || 5));
      const hundido = Math.max(0.05, Math.min(0.95, el.hundido ?? HUNDIDO_ESTRELLA));
      const puntos: Punto[] = [];
      // Los radios son los de la caja, así que la estrella se estira con ella en vez de quedar
      // siempre redonda. La primera punta va hacia arriba: es como se espera ver una estrella.
      for (let i = 0; i < n * 2; i++) {
        const angulo = -Math.PI / 2 + (i * Math.PI) / n;
        const escala = i % 2 === 0 ? 1 : hundido;
        puntos.push({
          x: w / 2 + Math.cos(angulo) * (w / 2) * escala,
          y: h / 2 + Math.sin(angulo) * (h / 2) * escala,
        });
      }
      return puntos;
    }
  }
}

/** Un trazo interno de la tabla, en coordenadas locales: (0,0) es su esquina superior izquierda. */
export interface TrazoTabla {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * Las líneas que dividen la tabla por dentro, con el grosor que le toca a cada una.
 *
 * Existe para que el lienzo y el exportador tracen **las mismas** líneas: antes cada uno acumulaba
 * las columnas y las filas por su cuenta y repetía la cuenta del estilo "doble", así que tocar una
 * y olvidarse de la otra dejaba la tabla distinta en pantalla y en el PDF.
 *
 * "Doble" son dos trazos finos separados que en conjunto suman el grosor pedido, igual que el
 * contorno: por eso el grosor devuelto no siempre es el del modelo.
 */
export function internasDeTabla(el: ElementoTabla): { grosor: number; trazos: TrazoTabla[] } {
  const ancho = anchoTotalTabla(el);
  const alto = altoTotalTabla(el);

  const doble = el.estiloInterno === 'doble';
  const grosor = doble ? Math.max(0.5, el.grosor / 3) : el.grosor;
  const desplazamientos = doble ? [-grosor, grosor] : [0];

  const trazos: TrazoTabla[] = [];

  // Las divisorias van entre columna y columna: la última no lleva, que es el borde de la tabla.
  let acumX = 0;
  for (let i = 0; i < el.cols.length - 1; i++) {
    acumX += el.cols[i];
    for (const d of desplazamientos) trazos.push({ x1: acumX + d, y1: 0, x2: acumX + d, y2: alto });
  }

  let acumY = 0;
  for (let i = 0; i < el.rows.length - 1; i++) {
    acumY += el.rows[i];
    for (const d of desplazamientos) trazos.push({ x1: 0, y1: acumY + d, x2: ancho, y2: acumY + d });
  }

  return { grosor, trazos };
}

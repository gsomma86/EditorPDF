import { FabricObject } from 'fabric';
import type { ElementoLinea } from './elemento';
import { guionDe } from './trazos';

/**
 * Cuánto se corre `left` (línea vertical) o `top` (horizontal) para agrandar la caja hacia el
 * lado del bulto sin mover el eje recto de lugar. Se usa tanto acá como en `objetosFabric.ts`
 * (al volcar un arrastre de redimensión al modelo), así que vive exportada y no duplicada.
 */
export function corrimientoPorCurvatura(curvatura: number): number {
  return Math.min(curvatura || 0, 0);
}

/**
 * El ancho/alto y la posición que le corresponden a la línea en el lienzo, ya con la curvatura
 * adentro. Sin curvatura da lo mismo que `datos.w`/`h`/`x`/`y` de siempre.
 *
 * La curvatura agranda la caja de selección hacia el lado del bulto: sin esto, el pico de una
 * curva pronunciada queda visualmente fuera del rectángulo de selección y no se puede clickear
 * ahí. `left`/`top` se corren lo mismo que crece la caja, así el eje recto de la línea —lo que
 * `x`/`y` señalan siempre— no se mueve de lugar al agrandarla.
 */
export function cajaDeLinea(datos: ElementoLinea): { left: number; top: number; width: number; height: number } {
  const horizontal = datos.w >= datos.h;
  const grosor = Math.max(0.5, horizontal ? datos.h : datos.w);
  const extra = Math.abs(datos.curvatura || 0);
  const corrimiento = corrimientoPorCurvatura(datos.curvatura);

  return horizontal
    ? { left: datos.x, top: datos.y + corrimiento, width: datos.w, height: grosor + extra }
    : { left: datos.x + corrimiento, top: datos.y, width: grosor + extra, height: datos.h };
}

/**
 * La línea es un objeto propio en vez de un rectángulo relleno. Como rectángulo, el estilo
 * (punteado / doble) no se podía aplicar: `strokeDashArray` solo afecta al contorno, y la línea
 * se dibujaba con relleno, así que siempre se veía sólida.
 *
 * El segmento corre a lo largo del eje más largo; el eje corto es el grosor.
 */
export class LineaObjeto extends FabricObject {
  static type = 'linea';
  declare datos: ElementoLinea;

  constructor(datos: ElementoLinea) {
    super({
      ...cajaDeLinea(datos),
      angle: datos.angulo,
      strokeWidth: 0,
      objectCaching: false,
    });
    this.datos = datos;
  }

  refrescarDesdeDatos(): void {
    this.set({ ...cajaDeLinea(this.datos), angle: this.datos.angulo });
    this.setCoords();
    this.dirty = true;
  }

  _render(ctx: CanvasRenderingContext2D): void {
    const { w, h, color, estilo, curvatura } = this.datos;
    const horizontal = w >= h;
    const largo = horizontal ? w : h;
    const grosor = Math.max(0.5, horizontal ? h : w);
    const curva = curvatura || 0;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineCap = 'butt';

    // `desplazamiento` corre por el eje corto (el del grosor) — es lo que separa los dos trazos
    // finos del estilo "doble". La curva se suma sobre ese mismo eje, así que sea recta o curva
    // queda siempre centrada en el largo de la línea, como pidió Germán.
    // El punto de control del cuadrático no es directamente la curvatura pedida: para que el punto
    // medio de la curva (que es lo que realmente se ve) caiga exacto en `desplazamiento + curva`,
    // el control tiene que ir al doble de esa distancia (matemática del bezier cuadrático en t=0.5).
    // `origen` resta la mitad de la curvatura porque la caja del objeto (`cajaDeLinea`) creció
    // hacia el lado del bulto: sin este corrimiento, agrandarla movería el eje recto de lugar.
    const segmento = (desplazamiento: number, ancho: number) => {
      const origen = desplazamiento - curva / 2;
      ctx.lineWidth = ancho;
      ctx.beginPath();
      if (horizontal) {
        ctx.moveTo(-largo / 2, origen);
        if (curva) ctx.quadraticCurveTo(0, origen + curva * 2, largo / 2, origen);
        else ctx.lineTo(largo / 2, origen);
      } else {
        ctx.moveTo(origen, -largo / 2);
        if (curva) ctx.quadraticCurveTo(origen + curva * 2, 0, origen, largo / 2);
        else ctx.lineTo(origen, largo / 2);
      }
      ctx.stroke();
    };

    if (estilo === 'doble') {
      // Igual que un borde CSS "double": dos trazos finos que suman el grosor pedido.
      const fino = Math.max(0.5, grosor / 3);
      ctx.setLineDash([]);
      segmento(-grosor / 2 + fino / 2, fino);
      segmento(grosor / 2 - fino / 2, fino);
    } else {
      ctx.setLineDash(guionDe(estilo, grosor));
      segmento(0, grosor);
    }

    ctx.restore();
  }
}

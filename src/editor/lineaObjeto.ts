import { FabricObject } from 'fabric';
import type { ElementoLinea } from './elemento';
import { guionDe } from './trazos';

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
      left: datos.x,
      top: datos.y,
      width: datos.w,
      height: datos.h,
      angle: datos.angulo,
      strokeWidth: 0,
      objectCaching: false,
    });
    this.datos = datos;
  }

  refrescarDesdeDatos(): void {
    this.set({ width: this.datos.w, height: this.datos.h, angle: this.datos.angulo });
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
    const segmento = (desplazamiento: number, ancho: number) => {
      ctx.lineWidth = ancho;
      ctx.beginPath();
      if (horizontal) {
        ctx.moveTo(-largo / 2, desplazamiento);
        if (curva) ctx.quadraticCurveTo(0, desplazamiento + curva * 2, largo / 2, desplazamiento);
        else ctx.lineTo(largo / 2, desplazamiento);
      } else {
        ctx.moveTo(desplazamiento, -largo / 2);
        if (curva) ctx.quadraticCurveTo(desplazamiento + curva * 2, 0, desplazamiento, largo / 2);
        else ctx.lineTo(desplazamiento, largo / 2);
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

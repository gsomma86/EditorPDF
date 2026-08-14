import { FabricObject } from 'fabric';
import type { ElementoLinea } from './elemento';

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
    const { w, h, color, estilo } = this.datos;
    const horizontal = w >= h;
    const largo = horizontal ? w : h;
    const grosor = Math.max(0.5, horizontal ? h : w);

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineCap = 'butt';

    const segmento = (desplazamiento: number, ancho: number) => {
      ctx.lineWidth = ancho;
      ctx.beginPath();
      if (horizontal) {
        ctx.moveTo(-largo / 2, desplazamiento);
        ctx.lineTo(largo / 2, desplazamiento);
      } else {
        ctx.moveTo(desplazamiento, -largo / 2);
        ctx.lineTo(desplazamiento, largo / 2);
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
      ctx.setLineDash(estilo === 'punteado' ? [Math.max(4, grosor * 3), Math.max(3, grosor * 2)] : []);
      segmento(0, grosor);
    }

    ctx.restore();
  }
}

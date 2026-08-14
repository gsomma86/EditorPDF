import { FabricObject } from 'fabric';
import type { ElementoRect } from './elemento';
import { trazarRectangulo } from './trazos';

/**
 * El recuadro es un objeto propio porque un `Rect` de Fabric solo puede trazar su borde una vez,
 * y el estilo "doble" necesita dos trazos con un espacio entre medio.
 */
export class RectObjeto extends FabricObject {
  static type = 'rect';
  declare datos: ElementoRect;

  constructor(datos: ElementoRect) {
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
    const { w, h, radio, color, estilo, grosor, conRelleno, rellenoColor } = this.datos;
    const x = -w / 2;
    const y = -h / 2;

    ctx.save();

    if (conRelleno) {
      ctx.fillStyle = rellenoColor;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, Math.max(0, Math.min(radio, w / 2, h / 2)));
      ctx.fill();
    }

    ctx.strokeStyle = color;
    trazarRectangulo(ctx, x, y, w, h, radio, estilo, grosor);

    ctx.restore();
  }
}

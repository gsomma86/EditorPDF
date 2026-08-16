import { FabricObject } from 'fabric';
import type { ElementoForma } from './elemento';
import { puntosDeFigura, recorrerCamino } from './figuras';
import { guionDe } from './trazos';

/**
 * Elipse, triángulo, flecha y estrella en el lienzo. Es un objeto propio —y no un `Ellipse` o un
 * `Polygon` de Fabric— para dibujar exactamente el camino que usa el exportador: la geometría sale
 * de `figuras.ts`, así que lo que se ve y lo que baja al PDF no pueden separarse.
 */
export class FormaObjeto extends FabricObject {
  static type = 'forma';
  declare datos: ElementoForma;

  constructor(datos: ElementoForma) {
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
    const { w, h, color, estilo, grosor, conRelleno, rellenoColor } = this.datos;
    if (w <= 0 || h <= 0) return;

    // Fabric dibuja con el origen en el centro del objeto; los puntos vienen desde la esquina.
    const dx = -w / 2;
    const dy = -h / 2;
    const puntos = puntosDeFigura(this.datos);

    ctx.save();
    ctx.beginPath();
    if (puntos) {
      puntos.forEach((p, i) => (i === 0 ? ctx.moveTo(dx + p.x, dy + p.y) : ctx.lineTo(dx + p.x, dy + p.y)));
      ctx.closePath();
    } else if (this.datos.figura === 'camino') {
      // Los tramos vienen normalizados: `recorrerCamino` los lleva a la caja de este objeto.
      recorrerCamino(this.datos.camino ?? [], w, h, {
        mover: (x, y) => ctx.moveTo(dx + x, dy + y),
        linea: (x, y) => ctx.lineTo(dx + x, dy + y),
        curva: (x1, y1, x2, y2, x, y) => ctx.bezierCurveTo(dx + x1, dy + y1, dx + x2, dy + y2, dx + x, dy + y),
        cerrar: () => ctx.closePath(),
      });
    } else {
      ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
    }

    if (conRelleno) {
      ctx.fillStyle = rellenoColor;
      ctx.fill();
    }

    ctx.strokeStyle = color;
    ctx.lineWidth = grosor;
    ctx.setLineDash(guionDe(estilo, grosor));
    ctx.stroke();
    ctx.restore();
  }
}

import type { EstiloLinea } from './elemento';

/** Grosor mínimo para que "doble" se distinga de una línea sólida: por debajo, los dos trazos
 *  y el espacio entre medio no entran y se ve igual que sólida. */
export const GROSOR_MINIMO_DOBLE = 5;

export function guionDe(estilo: EstiloLinea, grosor: number): number[] {
  return estilo === 'punteado' ? [Math.max(4, grosor * 3), Math.max(3, grosor * 2)] : [];
}

function caminoRedondeado(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radio: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.max(0, Math.min(radio, w / 2, h / 2)));
}

/**
 * Traza un rectángulo con estilo sólido, punteado o doble. "Doble" se dibuja como un borde CSS
 * `double`: dos trazos finos separados por un espacio, que en conjunto suman el grosor pedido.
 */
export function trazarRectangulo(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radio: number,
  estilo: EstiloLinea,
  grosor: number
): void {
  if (w <= 0 || h <= 0) return;

  if (estilo === 'doble') {
    const fino = Math.max(0.5, grosor / 3);
    ctx.setLineDash([]);
    ctx.lineWidth = fino;
    caminoRedondeado(ctx, x - fino, y - fino, w + fino * 2, h + fino * 2, radio + fino);
    ctx.stroke();
    caminoRedondeado(ctx, x + fino, y + fino, w - fino * 2, h - fino * 2, radio - fino);
    ctx.stroke();
    return;
  }

  ctx.lineWidth = grosor;
  ctx.setLineDash(guionDe(estilo, grosor));
  caminoRedondeado(ctx, x, y, w, h, radio);
  ctx.stroke();
}

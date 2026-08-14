import type { Canvas } from 'fabric';
import { configPorDefecto, dimensionesPagina, type ConfigPagina } from './pagina';
import { establecerAreaUtil } from './elemento';

let config: ConfigPagina = configPorDefecto();

export function configActual(): ConfigPagina {
  return config;
}

/**
 * Aplica el tamaño, la orientación y los márgenes al lienzo. Los elementos nuevos se colocan
 * dentro del área útil, así que el modelo también tiene que enterarse del cambio.
 */
export function aplicarConfigPagina(lienzo: Canvas, nueva: ConfigPagina): void {
  config = nueva;
  const { ancho, alto } = dimensionesPagina(nueva.tamano, nueva.orientacion);
  lienzo.setDimensions({ width: ancho, height: alto });
  establecerAreaUtil(ancho, alto, nueva.margenes);
  lienzo.requestRenderAll();
}

/**
 * Dibuja los márgenes como una guía punteada. Va en 'after:render' y no como un objeto del
 * lienzo para que no se pueda seleccionar, no aparezca en el historial ni viaje al PDF.
 */
export function dibujarGuiaMargenes(lienzo: Canvas): void {
  lienzo.on('after:render', () => {
    const ctx = lienzo.getContext();
    const { arriba, abajo, izquierda, derecha } = config.margenes;
    const ancho = lienzo.width - izquierda - derecha;
    const alto = lienzo.height - arriba - abajo;
    if (ancho <= 0 || alto <= 0) return;

    ctx.save();
    ctx.strokeStyle = 'rgba(55,138,221,0.45)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(izquierda, arriba, ancho, alto);
    ctx.restore();
  });
}

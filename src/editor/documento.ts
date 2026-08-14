import type { Canvas } from 'fabric';
import { configPorDefecto, dimensionesPagina, type ConfigPagina } from './pagina';
import { establecerAreaUtil } from './elemento';
import { refrescarLienzo } from './vista';

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
  establecerAreaUtil(ancho, alto, nueva.margenes);
  refrescarLienzo(lienzo);
}

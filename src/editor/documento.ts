import { FabricImage, type Canvas } from 'fabric';
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
  void aplicarFondo(lienzo);
}

/**
 * Pone la imagen de fondo de la hoja, estirada al tamaño de la página. Va como fondo del lienzo y
 * no como objeto, así no se puede seleccionar, no entra al historial y siempre queda por debajo.
 * Es aparte de `aplicarConfigPagina` porque cargar la imagen es asincrónico.
 */
export async function aplicarFondo(lienzo: Canvas): Promise<void> {
  if (!config.fondo) {
    lienzo.backgroundImage = undefined;
    lienzo.requestRenderAll();
    return;
  }

  const { ancho, alto } = dimensionesPagina(config.tamano, config.orientacion);
  const imagen = await FabricImage.fromURL(config.fondo);
  imagen.set({
    originX: 'left',
    originY: 'top',
    left: 0,
    top: 0,
    scaleX: ancho / (imagen.width || ancho),
    scaleY: alto / (imagen.height || alto),
  });
  lienzo.backgroundImage = imagen;
  lienzo.requestRenderAll();
}

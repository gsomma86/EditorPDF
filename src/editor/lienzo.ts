import { Canvas } from 'fabric';
import { dimensionesPagina, type Orientacion, type TamanoPagina } from './pagina';

export function crearLienzo(
  contenedor: HTMLElement,
  tamano: TamanoPagina = 'A4',
  orientacion: Orientacion = 'vertical'
): Canvas {
  const { ancho, alto } = dimensionesPagina(tamano, orientacion);

  const elementoCanvas = document.createElement('canvas');
  contenedor.appendChild(elementoCanvas);

  const lienzo = new Canvas(elementoCanvas, {
    width: ancho,
    height: alto,
  });
  // El blanco de la hoja lo pone el CSS (`.canvas-container`) y no el lienzo. Es a propósito: una
  // forma sacada de un PDF se dibuja *por debajo* de lo ya dibujado, para quedar donde estaba —
  // debajo del texto de la página—, y un fondo opaco del lienzo la taparía por completo.
  lienzo.renderAll();

  return lienzo;
}

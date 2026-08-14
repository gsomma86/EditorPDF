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
  lienzo.backgroundColor = '#ffffff';
  lienzo.renderAll();

  return lienzo;
}

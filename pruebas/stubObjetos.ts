/**
 * Reemplaza a `editor/objetosFabric` durante las pruebas headless: el exportador solo necesita
 * `elementoDe` y `generarQr`, y así el arnés corre en Node sin arrastrar Fabric ni el DOM.
 */
import QRCode from 'qrcode';
import type { Elemento, ElementoQr } from '../src/editor/elemento';

export function elementoDe(objeto: { __el?: Elemento }): Elemento | undefined {
  return objeto?.__el;
}

/**
 * `documento` la usa para cambiar de hoja. Estos arneses trabajan con un lienzo de mentira y una
 * sola hoja, así que no hay nada que reconstruir.
 */
export async function reconstruirLienzo(): Promise<void> {}

export function generarQr(elemento: ElementoQr): Promise<string> {
  return QRCode.toDataURL(elemento.texto || ' ', {
    margin: 0,
    color: {
      dark: elemento.color,
      light: elemento.conFondo ? elemento.fondoColor : '#00000000',
    },
  });
}

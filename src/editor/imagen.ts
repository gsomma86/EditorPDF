/**
 * Preparación de una imagen antes de que entre al diseño.
 *
 * Hace dos cosas que el editor no hacía y se notan recién más tarde:
 *
 * - **Comprueba el formato de verdad**, por los primeros bytes del archivo y no por su extensión.
 *   Un GIF renombrado a .png pasaba sin chistar y reventaba al exportar, porque el PDF solo admite
 *   PNG y JPEG y para ahí ya es tarde.
 * - **Achica lo que sobra.** Una foto de teléfono son varios megas que no aportan nada —en la hoja
 *   ocupa unos centímetros— y viajan enteros al PDF y al autoguardado. Como el diseño se guarda en
 *   localStorage, que tiene unos 5 MB, una sola foto grande alcanzaba para que dejara de guardarse
 *   en silencio.
 */

/** Más que esto no se gana nada: en la hoja una imagen ocupa unos pocos centímetros. */
const LADO_MAXIMO = 1600;
/** Los JPG se recomprimen; los PNG solo se achican, para no perder la transparencia. */
const CALIDAD_JPEG = 0.82;

export type TipoImagen = 'image/png' | 'image/jpeg';

/** El formato real del archivo, mirando su firma. `null` si no es ni PNG ni JPEG. */
export function tipoDeImagen(bytes: Uint8Array): TipoImagen | null {
  const empieza = (...esperados: number[]) => esperados.every((b, i) => bytes[i] === b);
  if (bytes.length >= 8 && empieza(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'image/png';
  if (bytes.length >= 3 && empieza(0xff, 0xd8, 0xff)) return 'image/jpeg';
  return null;
}

export interface ImagenLista {
  src: string;
  ancho: number;
  alto: number;
}

function cargar(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, rechazar) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => rechazar(new Error('La imagen no se pudo abrir.'));
    img.src = src;
  });
}

/**
 * Deja la imagen lista para el diseño, o falla si el archivo no es un PNG o un JPEG.
 * Devuelve las medidas ya achicadas, que son con las que se coloca en la hoja.
 */
export async function prepararImagen(archivo: File): Promise<ImagenLista> {
  const bytes = new Uint8Array(await archivo.arrayBuffer());
  const tipo = tipoDeImagen(bytes);
  if (!tipo) throw new Error('El archivo no es un PNG ni un JPEG.');

  const original = await cargar(URL.createObjectURL(new Blob([bytes as BlobPart], { type: tipo })));
  const escala = Math.min(1, LADO_MAXIMO / Math.max(original.naturalWidth, original.naturalHeight));

  if (escala === 1 && tipo === 'image/png') {
    // Ya entra y es PNG: se deja tal cual, sin volver a comprimirla.
    const lector = new FileReader();
    const src = await new Promise<string>((resolve) => {
      lector.onload = () => resolve(lector.result as string);
      lector.readAsDataURL(new Blob([bytes as BlobPart], { type: tipo }));
    });
    return { src, ancho: original.naturalWidth, alto: original.naturalHeight };
  }

  const ancho = Math.max(1, Math.round(original.naturalWidth * escala));
  const alto = Math.max(1, Math.round(original.naturalHeight * escala));
  const lienzo = document.createElement('canvas');
  lienzo.width = ancho;
  lienzo.height = alto;
  const contexto = lienzo.getContext('2d');
  if (!contexto) throw new Error('El navegador no pudo preparar la imagen.');
  contexto.drawImage(original, 0, 0, ancho, alto);

  return {
    src: tipo === 'image/jpeg' ? lienzo.toDataURL('image/jpeg', CALIDAD_JPEG) : lienzo.toDataURL('image/png'),
    ancho,
    alto,
  };
}

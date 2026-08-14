const CATALOGO: Record<string, () => Promise<unknown>> = {
  'Open Sans': () =>
    Promise.all([import('@fontsource/open-sans/400.css'), import('@fontsource/open-sans/400-italic.css'), import('@fontsource/open-sans/700.css'), import('@fontsource/open-sans/700-italic.css')]),
  'Noto Sans': () =>
    Promise.all([import('@fontsource/noto-sans/400.css'), import('@fontsource/noto-sans/400-italic.css'), import('@fontsource/noto-sans/700.css'), import('@fontsource/noto-sans/700-italic.css')]),
  Montserrat: () =>
    Promise.all([import('@fontsource/montserrat/400.css'), import('@fontsource/montserrat/400-italic.css'), import('@fontsource/montserrat/700.css'), import('@fontsource/montserrat/700-italic.css')]),
  Nunito: () => Promise.all([import('@fontsource/nunito/400.css'), import('@fontsource/nunito/400-italic.css'), import('@fontsource/nunito/700.css'), import('@fontsource/nunito/700-italic.css')]),
  Merriweather: () =>
    Promise.all([
      import('@fontsource/merriweather/400.css'),
      import('@fontsource/merriweather/400-italic.css'),
      import('@fontsource/merriweather/700.css'),
      import('@fontsource/merriweather/700-italic.css'),
    ]),
  'PT Serif': () =>
    Promise.all([import('@fontsource/pt-serif/400.css'), import('@fontsource/pt-serif/400-italic.css'), import('@fontsource/pt-serif/700.css'), import('@fontsource/pt-serif/700-italic.css')]),
  'Roboto Mono': () =>
    Promise.all([
      import('@fontsource/roboto-mono/400.css'),
      import('@fontsource/roboto-mono/400-italic.css'),
      import('@fontsource/roboto-mono/700.css'),
      import('@fontsource/roboto-mono/700-italic.css'),
    ]),
  // Oswald no tiene variante itálica real (la tipografía no la define) — Fabric/el navegador
  // van a simular una oblicua sobre la regular si el usuario tilda Cursiva.
  Oswald: () => Promise.all([import('@fontsource/oswald/400.css'), import('@fontsource/oswald/700.css')]),
};

/**
 * Archivos para incrustar en el PDF. Son los `.woff` (v1) de @fontsource, no los `.woff2`: un PDF
 * solo admite fuentes sfnt (TTF/OTF), y un woff v1 es sfnt con cada tabla comprimida con zlib, o
 * sea que se puede reconstruir acá mismo (ver `woffASfnt`) sin dependencias ni sumar .ttf al repo.
 * El woff2 no sirve: su compresión es Brotli con transformaciones sobre las tablas, y `embedFont`
 * lo acepta sin chistar pero después el visor descarta la fuente y sustituye por otra.
 * Se importan con `?url`: Vite los emite como assets y solo se descargan al exportar.
 *
 * Oswald no tiene itálica real; sus dos variantes apuntan a la redonda.
 */
const ARCHIVOS: Record<string, Record<string, string>> = {
  'Open Sans': {
    normal: new URL('@fontsource/open-sans/files/open-sans-latin-400-normal.woff', import.meta.url).href,
    negrita: new URL('@fontsource/open-sans/files/open-sans-latin-700-normal.woff', import.meta.url).href,
    cursiva: new URL('@fontsource/open-sans/files/open-sans-latin-400-italic.woff', import.meta.url).href,
    negritaCursiva: new URL('@fontsource/open-sans/files/open-sans-latin-700-italic.woff', import.meta.url).href,
  },
  'Noto Sans': {
    normal: new URL('@fontsource/noto-sans/files/noto-sans-latin-400-normal.woff', import.meta.url).href,
    negrita: new URL('@fontsource/noto-sans/files/noto-sans-latin-700-normal.woff', import.meta.url).href,
    cursiva: new URL('@fontsource/noto-sans/files/noto-sans-latin-400-italic.woff', import.meta.url).href,
    negritaCursiva: new URL('@fontsource/noto-sans/files/noto-sans-latin-700-italic.woff', import.meta.url).href,
  },
  Montserrat: {
    normal: new URL('@fontsource/montserrat/files/montserrat-latin-400-normal.woff', import.meta.url).href,
    negrita: new URL('@fontsource/montserrat/files/montserrat-latin-700-normal.woff', import.meta.url).href,
    cursiva: new URL('@fontsource/montserrat/files/montserrat-latin-400-italic.woff', import.meta.url).href,
    negritaCursiva: new URL('@fontsource/montserrat/files/montserrat-latin-700-italic.woff', import.meta.url).href,
  },
  Nunito: {
    normal: new URL('@fontsource/nunito/files/nunito-latin-400-normal.woff', import.meta.url).href,
    negrita: new URL('@fontsource/nunito/files/nunito-latin-700-normal.woff', import.meta.url).href,
    cursiva: new URL('@fontsource/nunito/files/nunito-latin-400-italic.woff', import.meta.url).href,
    negritaCursiva: new URL('@fontsource/nunito/files/nunito-latin-700-italic.woff', import.meta.url).href,
  },
  Merriweather: {
    normal: new URL('@fontsource/merriweather/files/merriweather-latin-400-normal.woff', import.meta.url).href,
    negrita: new URL('@fontsource/merriweather/files/merriweather-latin-700-normal.woff', import.meta.url).href,
    cursiva: new URL('@fontsource/merriweather/files/merriweather-latin-400-italic.woff', import.meta.url).href,
    negritaCursiva: new URL('@fontsource/merriweather/files/merriweather-latin-700-italic.woff', import.meta.url).href,
  },
  'PT Serif': {
    normal: new URL('@fontsource/pt-serif/files/pt-serif-latin-400-normal.woff', import.meta.url).href,
    negrita: new URL('@fontsource/pt-serif/files/pt-serif-latin-700-normal.woff', import.meta.url).href,
    cursiva: new URL('@fontsource/pt-serif/files/pt-serif-latin-400-italic.woff', import.meta.url).href,
    negritaCursiva: new URL('@fontsource/pt-serif/files/pt-serif-latin-700-italic.woff', import.meta.url).href,
  },
  'Roboto Mono': {
    normal: new URL('@fontsource/roboto-mono/files/roboto-mono-latin-400-normal.woff', import.meta.url).href,
    negrita: new URL('@fontsource/roboto-mono/files/roboto-mono-latin-700-normal.woff', import.meta.url).href,
    cursiva: new URL('@fontsource/roboto-mono/files/roboto-mono-latin-400-italic.woff', import.meta.url).href,
    negritaCursiva: new URL('@fontsource/roboto-mono/files/roboto-mono-latin-700-italic.woff', import.meta.url).href,
  },
  Oswald: {
    normal: new URL('@fontsource/oswald/files/oswald-latin-400-normal.woff', import.meta.url).href,
    negrita: new URL('@fontsource/oswald/files/oswald-latin-700-normal.woff', import.meta.url).href,
    cursiva: new URL('@fontsource/oswald/files/oswald-latin-400-normal.woff', import.meta.url).href,
    negritaCursiva: new URL('@fontsource/oswald/files/oswald-latin-700-normal.woff', import.meta.url).href,
  },
};

export function varianteDe(negrita: boolean, cursiva: boolean): string {
  if (negrita && cursiva) return 'negritaCursiva';
  if (negrita) return 'negrita';
  if (cursiva) return 'cursiva';
  return 'normal';
}

async function inflar(datos: Uint8Array): Promise<Uint8Array> {
  const flujo = new Blob([datos as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate'));
  return new Uint8Array(await new Response(flujo).arrayBuffer());
}

/**
 * Reconstruye el TTF/OTF original a partir de un WOFF v1, que es exactamente eso: la misma
 * fuente sfnt con otra cabecera y cada tabla comprimida con zlib. Se rearma la cabecera sfnt, se
 * descomprime tabla por tabla y se reescribe el directorio con los offsets nuevos, alineados a 4
 * bytes como pide el formato.
 */
export async function woffASfnt(woff: ArrayBuffer): Promise<ArrayBuffer> {
  const vista = new DataView(woff);
  if (vista.getUint32(0) !== 0x774f4646) throw new Error('El archivo no es un WOFF');

  const sabor = vista.getUint32(4);
  const cantidad = vista.getUint16(12);

  const tablas = Array.from({ length: cantidad }, (_, i) => {
    const p = 44 + i * 20;
    return {
      etiqueta: vista.getUint32(p),
      offset: vista.getUint32(p + 4),
      largoComprimido: vista.getUint32(p + 8),
      largoOriginal: vista.getUint32(p + 12),
      checksum: vista.getUint32(p + 16),
    };
  });

  const contenidos = await Promise.all(
    tablas.map((t) => {
      const trozo = new Uint8Array(woff, t.offset, t.largoComprimido);
      // Una tabla que no se achicaba quedó guardada sin comprimir.
      return t.largoComprimido >= t.largoOriginal ? Promise.resolve(trozo) : inflar(trozo);
    })
  );

  let total = 12 + cantidad * 16;
  const offsets = contenidos.map((c) => {
    const propio = total;
    total += (c.length + 3) & ~3;
    return propio;
  });

  const salida = new Uint8Array(total);
  const escritor = new DataView(salida.buffer);
  const potencia = 2 ** Math.floor(Math.log2(cantidad));
  escritor.setUint32(0, sabor);
  escritor.setUint16(4, cantidad);
  escritor.setUint16(6, potencia * 16);
  escritor.setUint16(8, Math.log2(potencia));
  escritor.setUint16(10, cantidad * 16 - potencia * 16);

  tablas.forEach((t, i) => {
    const p = 12 + i * 16;
    escritor.setUint32(p, t.etiqueta);
    escritor.setUint32(p + 4, t.checksum);
    escritor.setUint32(p + 8, offsets[i]);
    escritor.setUint32(p + 12, t.largoOriginal);
    salida.set(contenidos[i], offsets[i]);
  });

  return salida.buffer;
}

/** Bytes de la fuente listos para incrustar en el PDF, o null si la familia no es web. */
export async function bytesDeFuente(familia: string, negrita: boolean, cursiva: boolean): Promise<ArrayBuffer | null> {
  const url = ARCHIVOS[familia]?.[varianteDe(negrita, cursiva)];
  if (!url) return null;
  const respuesta = await fetch(url);
  if (!respuesta.ok) throw new Error(`No se pudo cargar la fuente ${familia}`);
  return woffASfnt(await respuesta.arrayBuffer());
}

export const FAMILIAS_BASE = ['Helvetica', 'Times', 'Courier'];
export const FAMILIAS_WEB = Object.keys(CATALOGO);

const cargadas = new Set<string>();

/**
 * Deja la familia lista para dibujar. Devuelve `true` solo si se cargó recién, porque en ese caso
 * el que llama tiene que volver a medir lo que ya esté en pantalla.
 *
 * Ojo con `document.fonts.ready`: no alcanza. Una `@font-face` es perezosa —el archivo recién se
 * pide cuando algo la usa—, así que esa promesa resuelve enseguida, antes de tener la fuente. Si
 * se mide ahí, el texto se mide con la de reemplazo y después se dibuja con la real: la caja
 * queda de otro tamaño que las letras y el texto se ve cortado. Por eso se pide cada variante a
 * mano con `document.fonts.load`, que sí espera al archivo.
 */
export async function asegurarFuenteCargada(nombre: string): Promise<boolean> {
  if (FAMILIAS_BASE.includes(nombre) || cargadas.has(nombre)) return false;
  const cargar = CATALOGO[nombre];
  if (!cargar) return false;
  await cargar();
  await Promise.all(['400', '700', 'italic 400', 'italic 700'].map((variante) => document.fonts.load(`${variante} 16px "${nombre}"`)));
  cargadas.add(nombre);
  return true;
}

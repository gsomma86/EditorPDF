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
 * Archivos para incrustar en el PDF. fontkit acepta woff2 tal cual, así que se reusan los mismos
 * que instala @fontsource — no hace falta sumar .ttf al repo. Se importan con `?url`: Vite los
 * emite como assets y solo se descargan al exportar.
 *
 * Oswald no tiene itálica real; sus dos variantes apuntan a la redonda.
 */
const ARCHIVOS: Record<string, Record<string, string>> = {
  'Open Sans': {
    normal: new URL('@fontsource/open-sans/files/open-sans-latin-400-normal.woff2', import.meta.url).href,
    negrita: new URL('@fontsource/open-sans/files/open-sans-latin-700-normal.woff2', import.meta.url).href,
    cursiva: new URL('@fontsource/open-sans/files/open-sans-latin-400-italic.woff2', import.meta.url).href,
    negritaCursiva: new URL('@fontsource/open-sans/files/open-sans-latin-700-italic.woff2', import.meta.url).href,
  },
  'Noto Sans': {
    normal: new URL('@fontsource/noto-sans/files/noto-sans-latin-400-normal.woff2', import.meta.url).href,
    negrita: new URL('@fontsource/noto-sans/files/noto-sans-latin-700-normal.woff2', import.meta.url).href,
    cursiva: new URL('@fontsource/noto-sans/files/noto-sans-latin-400-italic.woff2', import.meta.url).href,
    negritaCursiva: new URL('@fontsource/noto-sans/files/noto-sans-latin-700-italic.woff2', import.meta.url).href,
  },
  Montserrat: {
    normal: new URL('@fontsource/montserrat/files/montserrat-latin-400-normal.woff2', import.meta.url).href,
    negrita: new URL('@fontsource/montserrat/files/montserrat-latin-700-normal.woff2', import.meta.url).href,
    cursiva: new URL('@fontsource/montserrat/files/montserrat-latin-400-italic.woff2', import.meta.url).href,
    negritaCursiva: new URL('@fontsource/montserrat/files/montserrat-latin-700-italic.woff2', import.meta.url).href,
  },
  Nunito: {
    normal: new URL('@fontsource/nunito/files/nunito-latin-400-normal.woff2', import.meta.url).href,
    negrita: new URL('@fontsource/nunito/files/nunito-latin-700-normal.woff2', import.meta.url).href,
    cursiva: new URL('@fontsource/nunito/files/nunito-latin-400-italic.woff2', import.meta.url).href,
    negritaCursiva: new URL('@fontsource/nunito/files/nunito-latin-700-italic.woff2', import.meta.url).href,
  },
  Merriweather: {
    normal: new URL('@fontsource/merriweather/files/merriweather-latin-400-normal.woff2', import.meta.url).href,
    negrita: new URL('@fontsource/merriweather/files/merriweather-latin-700-normal.woff2', import.meta.url).href,
    cursiva: new URL('@fontsource/merriweather/files/merriweather-latin-400-italic.woff2', import.meta.url).href,
    negritaCursiva: new URL('@fontsource/merriweather/files/merriweather-latin-700-italic.woff2', import.meta.url).href,
  },
  'PT Serif': {
    normal: new URL('@fontsource/pt-serif/files/pt-serif-latin-400-normal.woff2', import.meta.url).href,
    negrita: new URL('@fontsource/pt-serif/files/pt-serif-latin-700-normal.woff2', import.meta.url).href,
    cursiva: new URL('@fontsource/pt-serif/files/pt-serif-latin-400-italic.woff2', import.meta.url).href,
    negritaCursiva: new URL('@fontsource/pt-serif/files/pt-serif-latin-700-italic.woff2', import.meta.url).href,
  },
  'Roboto Mono': {
    normal: new URL('@fontsource/roboto-mono/files/roboto-mono-latin-400-normal.woff2', import.meta.url).href,
    negrita: new URL('@fontsource/roboto-mono/files/roboto-mono-latin-700-normal.woff2', import.meta.url).href,
    cursiva: new URL('@fontsource/roboto-mono/files/roboto-mono-latin-400-italic.woff2', import.meta.url).href,
    negritaCursiva: new URL('@fontsource/roboto-mono/files/roboto-mono-latin-700-italic.woff2', import.meta.url).href,
  },
  Oswald: {
    normal: new URL('@fontsource/oswald/files/oswald-latin-400-normal.woff2', import.meta.url).href,
    negrita: new URL('@fontsource/oswald/files/oswald-latin-700-normal.woff2', import.meta.url).href,
    cursiva: new URL('@fontsource/oswald/files/oswald-latin-400-normal.woff2', import.meta.url).href,
    negritaCursiva: new URL('@fontsource/oswald/files/oswald-latin-700-normal.woff2', import.meta.url).href,
  },
};

export function varianteDe(negrita: boolean, cursiva: boolean): string {
  if (negrita && cursiva) return 'negritaCursiva';
  if (negrita) return 'negrita';
  if (cursiva) return 'cursiva';
  return 'normal';
}

/** Bytes de la fuente para incrustar en el PDF, o null si la familia no es web. */
export async function bytesDeFuente(familia: string, negrita: boolean, cursiva: boolean): Promise<ArrayBuffer | null> {
  const url = ARCHIVOS[familia]?.[varianteDe(negrita, cursiva)];
  if (!url) return null;
  const respuesta = await fetch(url);
  if (!respuesta.ok) throw new Error(`No se pudo cargar la fuente ${familia}`);
  return respuesta.arrayBuffer();
}

export const FAMILIAS_BASE = ['Helvetica', 'Times', 'Courier'];
export const FAMILIAS_WEB = Object.keys(CATALOGO);

const cargadas = new Set<string>();

export async function asegurarFuenteCargada(nombre: string): Promise<void> {
  if (FAMILIAS_BASE.includes(nombre) || cargadas.has(nombre)) return;
  const cargar = CATALOGO[nombre];
  if (!cargar) return;
  await cargar();
  cargadas.add(nombre);
  await document.fonts.ready;
}

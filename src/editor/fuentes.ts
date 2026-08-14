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

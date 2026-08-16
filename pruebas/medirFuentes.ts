/**
 * Cuánto pesa el PDF con las fuentes web incrustadas, y si el texto sigue siendo legible.
 *
 * Sirve para decidir con datos si vale la pena subsetear: la deuda dice que cada familia suma
 * ~20 KB, pero eso nunca se midió sobre un PDF de verdad.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { StaticCanvas } from 'fabric';
import { establecerHojas, hojaEnBlanco } from '../src/editor/documento';
import { agregarAlLienzo } from '../src/editor/objetosFabric';
import { exportarPdf } from '../src/editor/exportarPdf';
import { crearElemento } from '../src/editor/elemento';

(globalThis as any).document ??= { fonts: { load: async () => [] } };

/**
 * Las fuentes se piden con `fetch` a una URL `file://`, que Node no sabe resolver, y además el
 * bundle la arma relativa a su propia carpeta. Se le enseña las dos cosas: a leer del disco y a
 * buscar los archivos donde de verdad están, en node_modules.
 */
const fetchOriginal = globalThis.fetch;
globalThis.fetch = (async (entrada: any, init?: any) => {
  const url = String(entrada?.url ?? entrada);
  if (!url.startsWith('file:')) return fetchOriginal(entrada, init);

  const ruta = fileURLToPath(url).replace(/\\/g, '/');
  const corte = ruta.indexOf('@fontsource');
  // `import.meta.url` apunta al bundle dentro de `pruebas/dist-*`, así que node_modules queda dos
  // niveles más arriba.
  const destino = corte >= 0 ? fileURLToPath(new URL(`../../node_modules/${ruta.slice(corte)}`, import.meta.url)) : ruta;
  return new Response(new Uint8Array(await readFile(destino)));
}) as typeof fetch;

const lienzo = new StaticCanvas(undefined, { width: 595, height: 842 }) as any;
lienzo.setActiveObject = () => lienzo;
lienzo.discardActiveObject = () => lienzo;
await establecerHojas(lienzo, [hojaEnBlanco()], 0);

const FAMILIAS = ['Open Sans', 'Montserrat', 'Merriweather'];
const FRASE = 'Liquidación de haberes — período 2026';

for (const [i, familia] of FAMILIAS.entries()) {
  const texto = crearElemento('texto') as any;
  texto.text = FRASE;
  texto.familia = familia;
  texto.size = 14;
  texto.x = 40;
  texto.y = 60 + i * 40;
  await agregarAlLienzo(lienzo, texto);
}

const bytes = await exportarPdf(lienzo, { conFormulario: false });
await writeFile(fileURLToPath(new URL('../salida/fuentes.pdf', import.meta.url)), bytes);
console.log(`PDF con ${FAMILIAS.length} familias web: ${(bytes.length / 1024).toFixed(1)} KB`);

// Que pese menos no sirve si el texto dejó de leerse: se comprueba que vuelva entero.
const mupdf = await import('mupdf');
const pagina = mupdf.PDFDocument.openDocument(bytes, 'application/pdf').loadPage(0) as any;
const leido = JSON.parse(pagina.toStructuredText('preserve-whitespace').asJSON())
  .blocks.flatMap((b: any) => (b.lines ?? []).map((l: any) => l.text))
  .join(' | ');
console.log(`texto extraído: ${leido}`);
console.log(leido.split(' | ').every((t: string) => t.trim() === FRASE) ? 'OK: las tres frases salen enteras' : 'MAL: el texto no vuelve igual');

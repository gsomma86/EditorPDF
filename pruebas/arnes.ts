/**
 * Verificación headless del exportador de PDF.
 *
 * Genera un PDF por caso, lo rasteriza con mupdf a 72 dpi (1 punto = 1 píxel) y compara la caja
 * de tinta contra la que dejó el lienzo (`arnesFabric`, que renderiza los mismos casos con
 * Fabric). La pregunta que responde es la única que importa al exportar: ¿el PDF se ve donde se
 * ve en pantalla? Eso es justo lo delicado, porque el PDF mide la Y desde abajo y el lienzo
 * desde arriba, y para el texto la Y del PDF es la línea de base.
 *
 * Correr con: npm run verificar-export
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import * as mupdf from 'mupdf';
import { PDFDocument } from '@cantoo/pdf-lib';
import { exportarPdf } from '../src/editor/exportarPdf';
import type { Elemento } from '../src/editor/elemento';
import { CASOS, CASO_CAMPOS } from './casos';

const RAIZ = fileURLToPath(new URL('../..', import.meta.url));
const SALIDA = fileURLToPath(new URL('../salida/', import.meta.url));
const ALTO_PAGINA = 842; // A4 vertical, el valor por defecto de documento.ts

// ---------- Andamiaje para correr el exportador fuera del navegador ----------

const fetchOriginal = globalThis.fetch;
globalThis.fetch = (async (entrada: any, init?: any) => {
  const url = String(entrada);
  // Las fuentes se piden con `new URL('@fontsource/...', import.meta.url)`: en Node eso apunta
  // al lado del bundle, así que se sirven desde node_modules.
  const marca = url.indexOf('@fontsource/');
  if (marca >= 0) {
    const bytes = await readFile(`${RAIZ}node_modules/${decodeURIComponent(url.slice(marca))}`);
    return new Response(new Uint8Array(bytes));
  }
  return fetchOriginal(entrada, init);
}) as typeof fetch;

/** El exportador solo usa `getObjects()`; el stub de objetosFabric lee el modelo de `__el`. */
function lienzoFalso(elementos: Elemento[]): any {
  return { getObjects: () => elementos.map((el) => ({ __el: el })) };
}

// ---------- Medición ----------

interface Caja {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** Caja de la tinta: bordes del área con píxeles no blancos, en puntos desde arriba-izquierda. */
function cajaDeTinta(pdf: Uint8Array): Caja | null {
  const doc = mupdf.Document.openDocument(pdf, 'application/pdf');
  const pagina = doc.loadPage(0);
  const pix = pagina.toPixmap(mupdf.Matrix.identity, mupdf.ColorSpace.DeviceRGB, false);
  const ancho = pix.getWidth();
  const alto = pix.getHeight();
  const componentes = pix.getNumberOfComponents();
  const datos = pix.getPixels();

  let x1 = Infinity;
  let y1 = Infinity;
  let x2 = -Infinity;
  let y2 = -Infinity;

  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const i = (y * ancho + x) * componentes;
      if (datos[i] < 245 || datos[i + 1] < 245 || datos[i + 2] < 245) {
        if (x < x1) x1 = x;
        if (y < y1) y1 = y;
        if (x > x2) x2 = x;
        if (y > y2) y2 = y;
      }
    }
  }
  return x1 === Infinity ? null : { x1, y1, x2, y2 };
}

const fallos: string[] = [];
const filas: string[] = [];

function comparar(caso: string, medida: string, esperado: number, real: number, tolerancia: number): void {
  const delta = real - esperado;
  const ok = Math.abs(delta) <= tolerancia;
  if (!ok) fallos.push(`${caso} — ${medida}: el lienzo lo pone en ${esperado} y el PDF en ${real} (${delta > 0 ? '+' : ''}${delta.toFixed(1)} pt)`);
  filas.push(
    `${ok ? 'OK  ' : 'MAL '} ${caso.padEnd(18)} ${medida.padEnd(12)} lienzo ${String(esperado).padStart(6)}   pdf ${real.toFixed(1).padStart(6)}   delta ${(delta >= 0 ? '+' : '') + delta.toFixed(1)}`
  );
}

async function generar(nombre: string, elementos: Elemento[], conFormulario = false): Promise<Uint8Array> {
  const bytes = await exportarPdf(lienzoFalso(elementos), { conFormulario });
  await writeFile(`${SALIDA}${nombre}.pdf`, bytes);
  return bytes;
}

// ---------- Casos de tinta: lienzo contra PDF ----------

await mkdir(SALIDA, { recursive: true });
const referencia: Record<string, Caja | null> = JSON.parse(await readFile(`${SALIDA}geometria-lienzo.json`, 'utf8'));

console.log('Cada caso se dibuja en el lienzo y se exporta a PDF; se comparan las cajas de tinta.');
console.log('Coordenadas en puntos, desde arriba-izquierda de una A4 vertical (595x842).\n');

for (const caso of CASOS) {
  const esperado = referencia[caso.nombre];
  if (!esperado) {
    fallos.push(`${caso.nombre} — el lienzo no dibujó nada, no hay contra qué comparar`);
    continue;
  }
  const bytes = await generar(caso.nombre, caso.elementos);
  const medido = cajaDeTinta(bytes);
  if (!medido) {
    fallos.push(`${caso.nombre} — el PDF salió en blanco`);
    continue;
  }
  const tolerancia = caso.tolerancia ?? 2;
  comparar(caso.nombre, 'x izquierda', esperado.x1, medido.x1, tolerancia);
  comparar(caso.nombre, 'y arriba', esperado.y1, medido.y1, tolerancia);
  comparar(caso.nombre, 'x derecha', esperado.x2, medido.x2, tolerancia);
  comparar(caso.nombre, 'y abajo', esperado.y2, medido.y2, tolerancia);
}

// ---------- Fuentes web incrustadas ----------

{
  const bytes = await readFile(`${SALIDA}texto-open-sans.pdf`);
  const crudo = Buffer.from(bytes).toString('latin1');
  // Un PDF solo puede llevar fuentes sfnt (TTF/OTF). Un woff2 se reconoce por su firma 'wOF2':
  // si aparece, se incrustó el archivo comprimido tal cual y el visor no lo va a poder usar.
  if (crudo.includes('wOF2')) {
    fallos.push('texto-open-sans — la fuente se incrustó en formato woff2, que no es válido dentro de un PDF: el visor la descarta y sustituye por otra');
  }
  filas.push(`     texto-open-sans: peso ${(bytes.length / 1024).toFixed(0)} KB`);
}

// ---------- Campos AcroForm ----------

{
  const conForm = await generar('campos-editables', CASO_CAMPOS, true);
  const doc = await PDFDocument.load(conForm);
  const campos = doc.getForm().getFields();
  const nombres = campos.map((c) => c.getName()).sort();
  if (nombres.join(',') !== 'fecha,importe') fallos.push(`campos-editables — se esperaban [fecha, importe] y hay [${nombres.join(', ')}]`);

  const importe = campos.find((c) => c.getName() === 'importe');
  const widgets = importe ? importe.acroField.getWidgets() : [];
  if (widgets.length !== 2) fallos.push(`campos-editables — 'importe' está dos veces en la hoja y debería ser un campo con 2 apariencias; tiene ${widgets.length}`);

  for (const [i, esperadoY] of [250, 400].entries()) {
    const r = widgets[i]?.getRectangle();
    if (!r) continue;
    comparar('campos-editables', `widget ${i} x`, 100, r.x, 1);
    // El rectángulo del widget se mide desde abajo; se pasa a coordenadas del lienzo.
    comparar('campos-editables', `widget ${i} y`, esperadoY, ALTO_PAGINA - r.y - r.height, 1);
  }

  const fecha = campos.find((c) => c.getName() === 'fecha');
  if (fecha && !fecha.isReadOnly()) fallos.push("campos-editables — 'fecha' tenía que quedar de solo lectura");

  const aplanado = await generar('campos-aplanados', CASO_CAMPOS, false);
  const camposPlanos = (await PDFDocument.load(aplanado)).getForm().getFields().length;
  if (camposPlanos !== 0) fallos.push(`campos-aplanados — al exportar sin formulario no debería quedar ningún campo y quedaron ${camposPlanos}`);
  if (!cajaDeTinta(aplanado)) fallos.push('campos-aplanados — el PDF salió en blanco: se perdió la apariencia de los campos');
}

// ---------- Resultado ----------

console.log(filas.join('\n'));
console.log(`\nPDFs generados en ${SALIDA}`);

if (fallos.length) {
  console.log(`\n${fallos.length} PROBLEMA(S):`);
  for (const f of fallos) console.log(`  - ${f}`);
  process.exitCode = 1;
} else {
  console.log('\nTodo coincide con el lienzo.');
}

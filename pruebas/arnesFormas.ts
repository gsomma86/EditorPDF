/**
 * Arnés de la fase 3: detectar las formas del contenido de un PDF y sacarlas de verdad.
 *
 * Lo importante que comprueba es que el borrado sea real y **quirúrgico**: que la forma elegida
 * desaparezca, que no se lleve puesta ninguna otra, y que el texto de la página siga intacto. Un
 * error acá no se ve como un error, se ve como un PDF con cosas de menos.
 *
 * El PDF de prueba se arma acá mismo con pdf-lib, así que no depende de ningún archivo de afuera.
 * Si existe la plantilla real de la empresa, se mide también con ella.
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PDFDocument, StandardFonts, rgb } from '@cantoo/pdf-lib';
import { borrarFormaDelPdf, formaEn, formasDelPdf } from '../src/editor/formasPdf';

const SALIDA = fileURLToPath(new URL('../salida/', import.meta.url));
const PLANTILLA_REAL = 'C:/Users/gsomma/Desktop/Template recibo Argentina Napsis.pdf';

const fallos: string[] = [];
const filas: string[] = [];

function comparar(caso: string, medida: string, esperado: unknown, real: unknown): void {
  const ok = JSON.stringify(esperado) === JSON.stringify(real);
  if (!ok) fallos.push(`${caso} — ${medida}: se esperaba ${JSON.stringify(esperado)} y vino ${JSON.stringify(real)}`);
  filas.push(`${ok ? 'OK  ' : 'MAL '} ${caso.padEnd(24)} ${medida.padEnd(30)} ${JSON.stringify(real)}`);
}

const ALTO = 400;

/** Un PDF con formas de todo tipo: las que se pueden editar y las que no. */
async function pdfDePrueba(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const pagina = doc.addPage([300, ALTO]);
  const fuente = await doc.embedFont(StandardFonts.Helvetica);

  pagina.drawRectangle({ x: 20, y: 340, width: 200, height: 40, color: rgb(0.8, 0.8, 0.8) }); // relleno gris
  pagina.drawLine({ start: { x: 20, y: 320 }, end: { x: 220, y: 320 }, thickness: 1 }); // línea
  pagina.drawRectangle({ x: 20, y: 240, width: 100, height: 60, borderWidth: 2, borderColor: rgb(0, 0, 0) }); // contorno
  pagina.drawText('TEXTO QUE NO SE TOCA', { x: 20, y: 200, size: 12, font: fuente });
  pagina.drawEllipse({ x: 150, y: 150, xScale: 40, yScale: 25, color: rgb(0.2, 0.4, 0.9) }); // fuera de alcance
  return doc.save();
}

await mkdir(SALIDA, { recursive: true });

// ---------- Detectar ----------

const original = await pdfDePrueba();
await writeFile(`${SALIDA}formas-partida.pdf`, original);

const formas = await formasDelPdf(original, 0);
filas.push(`     formas detectadas: ${formas.map((f) => `${f.clase} ${Math.round(f.x)},${Math.round(f.y)} ${Math.round(f.w)}x${Math.round(f.h)}`).join(' | ')}`);

comparar('detectar', 'cuántas se pueden editar', 3, formas.length);
comparar('detectar', 'clases', ['rect', 'linea', 'rect'], formas.map((f) => f.clase));
// La elipse no entra, y el texto tampoco: solo formas.
comparar('detectar', 'la elipse queda afuera', true, !formas.some((f) => f.w > 70 && f.h > 40 && f.clase === 'rect' && f.y > 200));

// El relleno gris: y en coordenadas de hoja = alto - (y del PDF + alto de la forma).
const gris = formas[0];
comparar('detectar', 'el gris esta donde se dibujo', { x: 20, y: ALTO - 380, w: 200, h: 40 }, { x: Math.round(gris.x), y: Math.round(gris.y), w: Math.round(gris.w), h: Math.round(gris.h) });
comparar('detectar', 'color del gris', '#cccccc', gris.color);
comparar('detectar', 'el gris es relleno', true, gris.relleno);

// ---------- Encontrar por punto ----------

comparar('buscar por punto', 'adentro del gris', 0, formaEn(formas, 100, ALTO - 360)?.indice);
comparar('buscar por punto', 'en un lugar vacio', undefined, formaEn(formas, 280, 10)?.indice);

// ---------- Borrar ----------

const objetivo = formas[0];
const editado = await borrarFormaDelPdf(original, 0, objetivo.indice);
await writeFile(`${SALIDA}formas-editado.pdf`, editado);

const quedan = await formasDelPdf(editado, 0);
comparar('borrar', 'queda una forma menos', formas.length - 1, quedan.length);
comparar('borrar', 'la borrada ya no esta', true, !quedan.some((f) => Math.round(f.x) === Math.round(objetivo.x) && Math.round(f.w) === Math.round(objetivo.w) && f.relleno));
comparar('borrar', 'las otras siguen igual', formas.slice(1).map((f) => `${f.clase} ${Math.round(f.x)},${Math.round(f.y)}`), quedan.map((f) => `${f.clase} ${Math.round(f.x)},${Math.round(f.y)}`));

// Y que el texto no se haya tocado.
const mupdf = await import('mupdf');
const textoDe = (datos: Uint8Array) =>
  JSON.parse((mupdf.PDFDocument.openDocument(datos, 'application/pdf').loadPage(0) as any).toStructuredText('preserve-whitespace').asJSON())
    .blocks.flatMap((b: any) => (b.lines ?? []).map((l: any) => l.text))
    .join(' ')
    .trim();
comparar('borrar', 'el texto sigue intacto', textoDe(original), textoDe(editado));

// ---------- La plantilla real ----------

if (existsSync(PLANTILLA_REAL)) {
  const real = new Uint8Array(readFileSync(PLANTILLA_REAL));
  const suyas = await formasDelPdf(real, 0);
  const lineas = suyas.filter((f) => f.clase === 'linea').length;
  filas.push(`     plantilla real: ${suyas.length} formas editables (${lineas} lineas, ${suyas.length - lineas} recuadros)`);
  comparar('plantilla real', 'encuentra formas', true, suyas.length > 100);

  const antes = textoDe(real);
  const sinUna = await borrarFormaDelPdf(real, 0, suyas[10].indice);
  await writeFile(`${SALIDA}formas-plantilla-editada.pdf`, sinUna);
  const despues = await formasDelPdf(sinUna, 0);
  comparar('plantilla real', 'borra exactamente una', suyas.length - 1, despues.length);
  comparar('plantilla real', 'no toca el texto', antes, textoDe(sinUna));
} else {
  filas.push('     (la plantilla real no está en el escritorio: se saltea esa parte)');
}

console.log(filas.join('\n'));
console.log(`\nPDFs en ${SALIDA}`);

if (fallos.length) {
  console.log(`\n${fallos.length} PROBLEMA(S):`);
  for (const f of fallos) console.log(`  - ${f}`);
  process.exitCode = 1;
} else {
  console.log('\nLas formas se detectan y se borran sin llevarse nada más.');
}

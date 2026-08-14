/**
 * Verifica la cirugía de la fase 2: encontrar un texto dentro de un PDF ya hecho y borrarlo del
 * contenido de verdad, no taparlo. Es la base de "editar un PDF existente", así que conviene que
 * falle acá y no en el navegador.
 *
 * Usa los PDFs que deja `npm run verificar-export`, así que corre después de ese.
 * Correr con: npm run verificar-pdf
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import * as mupdf from 'mupdf';

const SALIDA = fileURLToPath(new URL('../salida/', import.meta.url));
const fallos: string[] = [];

/** Texto y cantidad de tinta de un PDF, para distinguir "borrado" de "tapado". */
function estado(datos: Uint8Array): { texto: string; tinta: number } {
  const pagina = mupdf.Document.openDocument(datos, 'application/pdf').loadPage(0);
  const pix = pagina.toPixmap(mupdf.Matrix.identity, mupdf.ColorSpace.DeviceRGB, false);
  const pixeles = pix.getPixels();
  let oscuros = 0;
  for (let i = 0; i < pixeles.length; i += pix.getNumberOfComponents()) {
    if (pixeles[i] < 200) oscuros++;
  }
  const estructura = JSON.parse(pagina.toStructuredText('preserve-whitespace').asJSON());
  const texto = (estructura.blocks ?? []).flatMap((b: any) => (b.lines ?? []).map((l: any) => l.text)).join(' | ');
  return { texto, tinta: oscuros };
}

const original = await readFile(`${SALIDA}texto-open-sans.pdf`);
const antes = estado(original);
console.log(`ANTES     texto "${antes.texto}"   tinta ${antes.tinta} px`);

const documento = mupdf.PDFDocument.openDocument(original, 'application/pdf') as InstanceType<typeof mupdf.PDFDocument>;
const pagina = documento.loadPage(0);
const linea = JSON.parse(pagina.toStructuredText('preserve-whitespace').asJSON()).blocks[0].lines[0];

console.log(`Encontrado "${linea.text}" en x=${linea.bbox.x} y=${linea.bbox.y}, ${linea.font.size} pt`);

// ¡La Y va desde ARRIBA! mupdf usa el mismo sentido que el lienzo, al revés que el PDF crudo.
// Invertirla hace que la redacción caiga en la zona espejada: no borra nada y no da ningún error.
const anotacion = pagina.createAnnotation('Redact');
anotacion.setRect([linea.bbox.x - 1, linea.bbox.y - 1, linea.bbox.x + linea.bbox.w + 1, linea.bbox.y + linea.bbox.h + 1]);
anotacion.update();
pagina.applyRedactions(false, 0, 0, 0);

const editado = documento.saveToBuffer('').asUint8Array();
await writeFile(`${SALIDA}texto-borrado.pdf`, editado);
const despues = estado(editado);
console.log(`DESPUES   texto "${despues.texto}"   tinta ${despues.tinta} px`);

if (despues.texto.includes(linea.text)) {
  fallos.push('el texto sigue estando en el contenido del PDF: la redacción no se aplicó');
}
if (despues.tinta > antes.tinta * 0.25) {
  fallos.push(`quedó demasiada tinta (${despues.tinta} px): se tapó con un recuadro en vez de borrarse`);
}
if (editado.length < 400) {
  fallos.push('el PDF editado quedó vacío o corrupto');
}

console.log(`\nPDF editado en ${SALIDA}texto-borrado.pdf`);
if (fallos.length) {
  console.log(`\n${fallos.length} PROBLEMA(S):`);
  for (const f of fallos) console.log(`  - ${f}`);
  process.exitCode = 1;
} else {
  console.log('\nEl texto se borró del contenido real del PDF.');
}

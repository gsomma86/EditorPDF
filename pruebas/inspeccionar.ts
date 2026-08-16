/**
 * Herramienta suelta, no un arnés: abre el PDF que se le pase y lista lo que el editor sabría
 * detectar en cada página —imágenes y formas—. Sirve para mirar un archivo real antes de decidir
 * si algo vale la pena, en vez de suponerlo.
 *
 *   npm run inspeccionar -- "C:/ruta/al/archivo.pdf"
 */
import { readFileSync } from 'node:fs';
import { formasDelPdf, imagenesDelPdf } from '../src/editor/formasPdf';

const ruta = process.argv[2];
if (!ruta) {
  console.log('Falta la ruta del PDF.');
  process.exit(1);
}

const bytes = new Uint8Array(readFileSync(ruta));
const mupdf = await import('mupdf');
const documento = mupdf.PDFDocument.openDocument(bytes.slice(), 'application/pdf');
const paginas = documento.countPages();

console.log(`${ruta}\n${paginas} página(s)\n`);

let totalImagenes = 0;
let totalFormas = 0;

for (let p = 0; p < paginas; p++) {
  const imagenes = await imagenesDelPdf(bytes, p);
  const formas = await formasDelPdf(bytes, p);
  totalImagenes += imagenes.length;
  totalFormas += formas.length;

  const giradas = formas.filter((f) => f.angulo !== 0).length;
  console.log(
    `página ${p + 1}: ${imagenes.length} imagen(es), ${formas.length} forma(s)` +
      (giradas ? ` (${giradas} girada(s))` : '')
  );
  for (const i of imagenes) {
    console.log(
      `    imagen  ${Math.round(i.x)},${Math.round(i.y)}  ${Math.round(i.w)}x${Math.round(i.h)}` +
        (i.angulo ? `  @${i.angulo}°` : '') +
        `  ${Math.round(i.src.length / 1024)} KB`
    );
  }
}

console.log(`\nTotal: ${totalImagenes} imagen(es) y ${totalFormas} forma(s) editables.`);

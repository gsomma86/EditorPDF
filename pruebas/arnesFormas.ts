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
import { PDFDocument, StandardFonts, degrees, rgb } from '@cantoo/pdf-lib';
import { StaticCanvas } from 'fabric';
import { borrarFormaDelPdf, borrarFormasDelPdf, borrarImagenDelPdf, elementoDesdeForma, formaEn, formasDelPdf, imagenEn, imagenesDelPdf } from '../src/editor/formasPdf';
import { establecerHojas, hojaEnBlanco } from '../src/editor/documento';
import { agregarAlLienzo } from '../src/editor/objetosFabric';
import { exportarPdf } from '../src/editor/exportarPdf';

// El catálogo de fuentes se las pide al navegador; en Node no hacen falta y alcanza con que no falle.
(globalThis as any).document ??= { fonts: { load: async () => [] } };

const lienzo = new StaticCanvas(undefined, { width: 300, height: 400 }) as any;
// `StaticCanvas` no tiene selección y agregar un elemento la usa para dejarlo seleccionado.
lienzo.setActiveObject = () => lienzo;
lienzo.discardActiveObject = () => lienzo;

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

/**
 * Un PNG de 2x2 armado byte a byte, para no depender de ningún archivo de afuera. Se escribe sin
 * filtro y con un CRC calculado a mano, que es lo mínimo que acepta un lector de PNG.
 */
function pngDePrueba(): Uint8Array {
  const zlib = require('node:zlib') as typeof import('node:zlib');
  const tabla = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tabla[n] = c;
  }
  const crc = (b: Buffer) => {
    let c = -1;
    for (const x of b) c = tabla[(c ^ x) & 255] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
  };
  const trozo = (tipo: string, datos: Buffer) => {
    const salida = Buffer.alloc(datos.length + 12);
    salida.writeUInt32BE(datos.length, 0);
    salida.write(tipo, 4, 'ascii');
    datos.copy(salida, 8);
    salida.writeUInt32BE(crc(Buffer.concat([Buffer.from(tipo, 'ascii'), datos])), datos.length + 8);
    return salida;
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(2, 0);
  ihdr.writeUInt32BE(2, 4);
  ihdr[8] = 8; // 8 bits por componente
  ihdr[9] = 2; // RGB
  // Dos filas de dos píxeles, cada una precedida por el byte de filtro (0 = sin filtro).
  const crudo = Buffer.from([0, 220, 60, 60, 60, 120, 220, 0, 60, 220, 120, 220, 60, 60]);
  return new Uint8Array(
    Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      trozo('IHDR', ihdr),
      trozo('IDAT', zlib.deflateSync(crudo, { level: 9 })),
      trozo('IEND', Buffer.alloc(0)),
    ])
  );
}

/** El mismo PNG pero RGBA, con la esquina superior izquierda totalmente transparente. */
function pngConAlfa(): Uint8Array {
  const base = Buffer.from(pngDePrueba());
  const zlib = require('node:zlib') as typeof import('node:zlib');
  // Se rehace entero: dos filas de dos píxeles RGBA, el primero transparente.
  const crudo = Buffer.from([0, 0, 0, 0, 0, 60, 120, 220, 255, 0, 60, 220, 120, 255, 220, 60, 60, 255]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(2, 0);
  ihdr.writeUInt32BE(2, 4);
  ihdr[8] = 8;
  ihdr[9] = 6; // RGBA
  // El armado de trozos y el CRC son los mismos que en `pngDePrueba`; se reusan leyéndolos de ahí.
  const conTrozo = (tipo: string, datos: Buffer) => {
    const tabla = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      tabla[n] = c;
    }
    let c = -1;
    for (const x of Buffer.concat([Buffer.from(tipo, 'ascii'), datos])) c = tabla[(c ^ x) & 255] ^ (c >>> 8);
    const salida = Buffer.alloc(datos.length + 12);
    salida.writeUInt32BE(datos.length, 0);
    salida.write(tipo, 4, 'ascii');
    datos.copy(salida, 8);
    salida.writeUInt32BE((c ^ -1) >>> 0, datos.length + 8);
    return salida;
  };
  return new Uint8Array(
    Buffer.concat([base.subarray(0, 8), conTrozo('IHDR', ihdr), conTrozo('IDAT', zlib.deflateSync(crudo, { level: 9 })), conTrozo('IEND', Buffer.alloc(0))])
  );
}

/**
 * El alfa del píxel de arriba a la izquierda de un PNG en data URL. 0 = transparente.
 *
 * Deshace el filtro de la primera fila en vez de suponer que viene sin filtrar: mupdf elige el que
 * le conviene, y dando por sentado el 0 la medición devolvía "no sé" en vez de un número.
 */
function alfaEsquina(src: string): number | null {
  if (!src) return null;
  const zlib = require('node:zlib') as typeof import('node:zlib');
  const datos = Buffer.from(src.split(',')[1], 'base64');
  if (datos[25] !== 6) return null; // no es RGBA: no hay alfa que mirar

  const trozos: Buffer[] = [];
  let i = 8;
  while (i < datos.length) {
    const largo = datos.readUInt32BE(i);
    const tipo = datos.toString('ascii', i + 4, i + 8);
    if (tipo === 'IDAT') trozos.push(datos.subarray(i + 8, i + 8 + largo));
    if (tipo === 'IEND') break;
    i += largo + 12;
  }
  const crudo = zlib.inflateSync(Buffer.concat(trozos));

  // En la primera fila la "de arriba" es toda ceros, así que Up y Paeth se reducen a lo de la
  // izquierda, que para el primer píxel también es cero: solo Sub y Average cambian algo, y para
  // el byte 0 tampoco. Alcanza con leer el cuarto byte del primer píxel.
  // Sea cual sea el filtro, para el **primer píxel de la primera fila** no hay vecino a la
  // izquierda ni arriba, así que todos se reducen a dejar el byte tal cual.
  return crudo[1 + 3];
}

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
  // Girado: pdf-lib mide la Y desde abajo y gira antihorario, así que en la hoja —Y desde arriba—
  // esto se ve girado 30° en sentido horario, que es +30 para el lienzo.
  pagina.drawRectangle({ x: 40, y: 60, width: 80, height: 30, rotate: degrees(-30), color: rgb(0.9, 0.3, 0.3) });
  return doc.save();
}

await mkdir(SALIDA, { recursive: true });

// ---------- Detectar ----------

const original = await pdfDePrueba();
await writeFile(`${SALIDA}formas-partida.pdf`, original);

const formas = await formasDelPdf(original, 0);
filas.push(`     formas detectadas: ${formas.map((f) => `${f.clase} ${Math.round(f.x)},${Math.round(f.y)} ${Math.round(f.w)}x${Math.round(f.h)} @${f.angulo}deg`).join(' | ')}`);

comparar('detectar', 'cuántas se pueden editar', 5, formas.length);
comparar('detectar', 'clases', ['rect', 'linea', 'rect', 'camino', 'rect'], formas.map((f) => f.clase));
// La elipse entra como camino —antes quedaba afuera— y el texto sigue sin contar: solo dibujo.
comparar('detectar', 'la elipse entra como camino', 1, formas.filter((f) => f.clase === 'camino').length);

// La girada: se mide **enderezada**, así que conserva sus medidas reales (80x30, no la caja que la
// envuelve, que sería más grande), y el ángulo sale aparte en el sentido del lienzo.
const girada = formas[4];
comparar('girada', 'ángulo en sentido del lienzo', 30, girada.angulo);
comparar('girada', 'conserva sus medidas', { w: 80, h: 30 }, { w: Math.round(girada.w), h: Math.round(girada.h) });
// Las cuatro esquinas reconstruidas desde x/y/w/h/ángulo tienen que dar el rectángulo dibujado.
// Es la comprobación que importa: si el ancla o el signo del ángulo estuvieran mal, la forma
// convertida aparecería corrida o espejada, y las medidas por sí solas no lo dirían.
const rad = (girada.angulo * Math.PI) / 180;
const esquina = (lx: number, ly: number) => [
  Math.round(girada.x + lx * Math.cos(rad) - ly * Math.sin(rad)),
  Math.round(girada.y + lx * Math.sin(rad) + ly * Math.cos(rad)),
];
comparar(
  'girada',
  'las 4 esquinas caen donde se dibujó',
  [[55, 314], [124, 354], [40, 340], [109, 380]],
  [esquina(0, 0), esquina(girada.w, 0), esquina(0, girada.h), esquina(girada.w, girada.h)]
);

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
const editado = await borrarFormaDelPdf(original, 0, objetivo);
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
  const sinUna = await borrarFormaDelPdf(real, 0, suyas[10]);
  await writeFile(`${SALIDA}formas-plantilla-editada.pdf`, sinUna);
  const despues = await formasDelPdf(sinUna, 0);
  comparar('plantilla real', 'borra exactamente una', suyas.length - 1, despues.length);
  comparar('plantilla real', 'no toca el texto', antes, textoDe(sinUna));
  // Todas de una: es el caso que rompio la primera version, que emparejaba formas con operadores
  // del content stream por posicion y borraba el equivocado.
  const sinNinguna = await borrarFormasDelPdf(real, 0, suyas);
  await writeFile(`${SALIDA}formas-plantilla-sin-formas.pdf`, sinNinguna);
  // No saca todas: la redacción se lleva el dibujo que queda *completamente cubierto*, y un trazo
  // pinta más ancho que su trayectoria, así que muchos sobreviven. Lo que importa acá es que saque
  // bastantes y que no rompa nada — convertirlas todas de una no se ofrece por esto mismo.
  const quedanTodas = (await formasDelPdf(sinNinguna, 0)).length;
  filas.push(`     sacando las ${suyas.length} de una: sobreviven ${quedanTodas} (por eso no se ofrece convertirlas todas)`);
  comparar('plantilla real', 'sacar muchas de una saca varias', true, quedanTodas < suyas.length);
  comparar('plantilla real', 'sacarlas todas no toca el texto', antes, textoDe(sinNinguna));
} else {
  filas.push('     (la plantilla real no está en el escritorio: se saltea esa parte)');
}

// ---------- Imágenes ----------

// Que se detecten donde están, con sus medidas, que se puedan sacar del contenido, y —lo que
// importa— que sacarlas NO se lleve el texto ni las formas de alrededor.
const conImagen = await PDFDocument.create();
{
  const pagina = conImagen.addPage([300, ALTO]);
  const fuente = await conImagen.embedFont(StandardFonts.Helvetica);
  // Un PNG mínimo de 2x2 armado a mano, para no depender de ningún archivo.
  const png = await conImagen.embedPng(pngDePrueba());
  pagina.drawImage(png, { x: 40, y: 250, width: 120, height: 90 });
  pagina.drawText('TEXTO JUNTO A LA IMAGEN', { x: 20, y: 200, size: 12, font: fuente });
  pagina.drawRectangle({ x: 20, y: 100, width: 200, height: 40, color: rgb(0.8, 0.8, 0.8) });
}
const bytesImagen = new Uint8Array(await conImagen.save());
await writeFile(`${SALIDA}imagenes-partida.pdf`, bytesImagen);

const imagenes = await imagenesDelPdf(bytesImagen, 0);
filas.push(`     imágenes detectadas: ${imagenes.map((i) => `${Math.round(i.x)},${Math.round(i.y)} ${Math.round(i.w)}x${Math.round(i.h)} @${i.angulo}deg`).join(' | ')}`);

comparar('imágenes', 'cuántas hay', 1, imagenes.length);
// y de hoja = alto - (y del PDF + alto de la imagen) = 400 - (250 + 90) = 60.
comparar('imágenes', 'dónde está', { x: 40, y: 60, w: 120, h: 90 }, {
  x: Math.round(imagenes[0].x), y: Math.round(imagenes[0].y), w: Math.round(imagenes[0].w), h: Math.round(imagenes[0].h),
});
comparar('imágenes', 'sin girar', 0, imagenes[0].angulo);
comparar('imágenes', 'trae los píxeles', true, imagenes[0].src.startsWith('data:image/png;base64,'));
comparar('imágenes', 'se la encuentra por punto', 0, imagenEn(imagenes, 100, 100)?.indice);
comparar('imágenes', 'afuera no hay nada', undefined, imagenEn(imagenes, 280, 380)?.indice);

// Una imagen **espejada y con ruido en la matriz**, que es como llegan de un PDF real: la escala Y
// negativa y un `b`/`c` de 0,00002 donde debería haber cero. Los dos casos juntos rompían la
// detección —el ruido la descartaba por "sesgo" y el espejado la ubicaba un alto más abajo— y
// aparecieron recién probando un manual de verdad, no con PDFs armados acá.
{
  const doc = await PDFDocument.create();
  const pagina = doc.addPage([300, ALTO]);
  const png = await doc.embedPng(pngDePrueba());
  pagina.drawImage(png, { x: 60, y: 200, width: 40, height: 40 });
  const bytes = new Uint8Array(await doc.save());

  // Se le mete el ruido a mano en el content stream: es lo que hace un generador de PDF real al
  // redondear, y no hay forma de pedírselo a pdf-lib.
  const texto = Buffer.from(bytes).toString('latin1');
  const conRuido = texto.replace(/40 0 0 40 60 200 cm/, '40 0.00002 -0.000013 40 60 200 cm');
  const detectadas = await imagenesDelPdf(new Uint8Array(Buffer.from(conRuido, 'latin1')), 0);

  comparar('matriz con ruido', 'no se descarta por sesgo', 1, detectadas.length);
  comparar('matriz con ruido', 'la ubica bien igual', { x: 60, y: ALTO - 240, w: 40, h: 40 }, {
    x: Math.round(detectadas[0]?.x), y: Math.round(detectadas[0]?.y), w: Math.round(detectadas[0]?.w), h: Math.round(detectadas[0]?.h),
  });
  comparar('matriz con ruido', 'el ángulo queda en cero', 0, detectadas[0]?.angulo);
}

// Una imagen con transparencia. En el PDF eso no vive en la imagen sino en una *soft mask* aparte,
// y `toPixmap()` sola devuelve negro opaco donde debería ser transparente: los íconos de un manual
// real aparecían sobre un cuadrado negro. Se comprueba mirando el alfa de una esquina.
{
  const doc = await PDFDocument.create();
  const pagina = doc.addPage([300, ALTO]);
  // pdf-lib arma la SMask solo si el PNG trae alfa, así que este es RGBA y no RGB como el otro.
  const png = await doc.embedPng(pngConAlfa());
  pagina.drawImage(png, { x: 60, y: 200, width: 40, height: 40 });
  const detectadas = await imagenesDelPdf(new Uint8Array(await doc.save()), 0);

  comparar('transparencia', 'se detecta', 1, detectadas.length);
  comparar('transparencia', 'la esquina queda transparente', 0, alfaEsquina(detectadas[0]?.src ?? ''));
}

const sinImagen = await borrarImagenDelPdf(bytesImagen, 0, imagenes[0]);
await writeFile(`${SALIDA}imagenes-sin-imagen.pdf`, sinImagen);
comparar('imágenes', 'se fue del contenido', 0, (await imagenesDelPdf(sinImagen, 0)).length);
// Lo que más importa: sacar la imagen no puede llevarse lo de al lado.
comparar('imágenes', 'el texto sigue intacto', textoDe(bytesImagen), textoDe(sinImagen));
comparar('imágenes', 'las formas siguen ahí', (await formasDelPdf(bytesImagen, 0)).length, (await formasDelPdf(sinImagen, 0)).length);

// ---------- Caminos: curvas y dibujos de varios trazos ----------

// Lo que se comprueba es la vuelta completa: un círculo del PDF se detecta como camino, se
// convierte en elemento y al exportarlo vuelve a caer en el mismo lugar y del mismo tamaño. Es lo
// único que delata un error de normalización o de ancla, que las medidas sueltas no cuentan.
{
  const doc = await PDFDocument.create();
  const pagina = doc.addPage([300, ALTO]);
  // Una elipse: pdf-lib la dibuja con curvas de Bézier, así que entra como camino.
  pagina.drawEllipse({ x: 150, y: 300, xScale: 50, yScale: 30, borderWidth: 2, borderColor: rgb(0, 0, 0) });
  const bytes = new Uint8Array(await doc.save());
  await writeFile(`${SALIDA}camino-partida.pdf`, bytes);

  const detectadas = await formasDelPdf(bytes, 0);
  const camino = detectadas.find((f) => f.clase === 'camino');

  comparar('camino', 'la curva se detecta', true, Boolean(camino));
  comparar('camino', 'tiene tramos curvos', true, (camino?.camino ?? []).some((t) => t.t === 'C'));
  // La caja sale de los puntos de control, que contienen a la curva: por eso puede ser un poco
  // mayor que los 100x60 exactos de la elipse. Se comprueba que la contenga y no se dispare.
  comparar('camino', 'la caja contiene la elipse', true, (camino?.w ?? 0) >= 100 && (camino?.w ?? 0) <= 108);
  comparar('camino', 'y no se dispara de alto', true, (camino?.h ?? 0) >= 60 && (camino?.h ?? 0) <= 68);
  // Todos los tramos quedan normalizados dentro de su caja.
  const dentro = (camino?.camino ?? []).every((t) =>
    t.t === 'Z' ? true : [t.x, t.y, ...(t.t === 'C' ? [t.x1, t.y1, t.x2, t.y2] : [])].every((v) => v >= -0.001 && v <= 1.001)
  );
  comparar('camino', 'los tramos van de 0 a 1', true, dentro);

  // La vuelta completa: convertirlo y exportarlo tiene que devolver la curva donde estaba.
  await establecerHojas(lienzo, [hojaEnBlanco()], 0);
  await agregarAlLienzo(lienzo, elementoDesdeForma(camino!));
  const exportado = await exportarPdf(lienzo, { conFormulario: false });
  await writeFile(`${SALIDA}camino-exportado.pdf`, exportado);

  const devuelta = (await formasDelPdf(exportado, 0)).find((f) => f.clase === 'camino');
  comparar('camino', 'al exportar sigue siendo curva', true, Boolean(devuelta));
  comparar(
    'camino',
    'vuelve al mismo lugar y tamaño',
    { x: Math.round(camino!.x), y: Math.round(camino!.y), w: Math.round(camino!.w), h: Math.round(camino!.h) },
    { x: Math.round(devuelta?.x ?? -1), y: Math.round(devuelta?.y ?? -1), w: Math.round(devuelta?.w ?? -1), h: Math.round(devuelta?.h ?? -1) }
  );
}

// ---------- Figuras con relleno y borde ----------

// El PDF las guarda como **dos caminos**: uno pinta el relleno y otro el contorno. Sacar uno tiene
// que llevarse los dos, o queda el contorno flotando sobre la hoja — que es justo lo que pasaba.
// El contorno no se da nunca por "cubierto" (se midió: ni agrandando el rectángulo 6 puntos), así
// que hace falta el modo que se lleva lo que roce el rectángulo.
{
  const doc = await PDFDocument.create();
  const pagina = doc.addPage([300, ALTO]);
  pagina.drawEllipse({ x: 150, y: 300, xScale: 50, yScale: 30, color: rgb(0.27, 0.45, 0.77), borderWidth: 1.5, borderColor: rgb(0.18, 0.32, 0.56) });
  // Otra bien lejos, para comprobar que el modo amplio no se lleva lo que no toca.
  pagina.drawRectangle({ x: 20, y: 40, width: 60, height: 20, color: rgb(0, 0, 0) });
  const bytes = new Uint8Array(await doc.save());

  const dos = await formasDelPdf(bytes, 0);
  comparar('relleno y borde', 'son dos caminos más el testigo', 3, dos.length);

  const contorno = dos.find((f) => f.clase === 'camino' && !f.relleno)!;
  // Con el modo preciso el contorno se resiste: es la razón de que exista la escalada.
  const preciso = await formasDelPdf(await borrarFormaDelPdf(bytes, 0, contorno), 0);
  comparar('relleno y borde', 'con "cubierto" el contorno sobrevive', true, preciso.some((f) => f.clase === 'camino' && !f.relleno));

  const amplio = await formasDelPdf(await borrarFormaDelPdf(bytes, 0, contorno, 'tocado'), 0);
  comparar('relleno y borde', 'con "tocado" se van los dos', 0, amplio.filter((f) => f.clase === 'camino').length);
  comparar('relleno y borde', 'y lo de lejos queda intacto', 1, amplio.length);
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

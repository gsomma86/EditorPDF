/**
 * Arnés de la fase 2: abrir un PDF con campos, importarlos y volver a exportarlo.
 *
 * Es el recorrido que más se va a usar —tomar una plantilla que ya existe y editarla— y donde
 * aparecieron dos bugs que solo se veían haciendo la vuelta completa: la exportación fallaba
 * entera porque los nombres chocaban con los campos que ya traía el PDF, y cada vuelta agrandaba
 * los campos medio punto por lado. Los dos se encontraron a mano; esta prueba los deja cubiertos.
 *
 * El PDF de partida se genera acá mismo, con casos a propósito (bordes de 0, 1 y 2 puntos, las
 * tres alineaciones, valores, solo lectura y varias líneas), así que la prueba no depende de
 * ningún archivo de afuera.
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { PDFDocument, StandardFonts, TextAlignment, rgb } from '@cantoo/pdf-lib';
import { asentarPdf, camposDelPdf, cerrarPdf, type CampoDelPdf } from '../src/editor/pdfExistente';
import { anclarHoja } from '../src/editor/documento';
import { exportarPdf } from '../src/editor/exportarPdf';
import type { Elemento } from '../src/editor/elemento';

const SALIDA = fileURLToPath(new URL('../salida/', import.meta.url));
const ALTO = 792;

const fallos: string[] = [];
const filas: string[] = [];

function comparar(caso: string, medida: string, esperado: unknown, real: unknown): void {
  const ok = JSON.stringify(esperado) === JSON.stringify(real);
  if (!ok) fallos.push(`${caso} — ${medida}: se esperaba ${JSON.stringify(esperado)} y vino ${JSON.stringify(real)}`);
  filas.push(`${ok ? 'OK  ' : 'MAL '} ${caso.padEnd(30)} ${medida.padEnd(22)} ${JSON.stringify(real)}`);
}

/** Los casos del PDF de partida: cada uno prueba algo distinto. */
const CASOS = [
  { name: 'sin_borde', x: 50, y: 700, w: 200, h: 20, borde: 0, align: TextAlignment.Left, valor: 'sin borde' },
  { name: 'borde_fino', x: 50, y: 650, w: 200, h: 20, borde: 1, align: TextAlignment.Center, valor: 'centrado' },
  { name: 'borde_grueso', x: 50, y: 600, w: 200, h: 30, borde: 2, align: TextAlignment.Right, valor: 'a la derecha' },
  { name: 'solo_lectura', x: 50, y: 550, w: 200, h: 20, borde: 1, align: TextAlignment.Left, valor: 'no se toca', readonly: true },
  { name: 'varias_lineas', x: 50, y: 480, w: 200, h: 50, borde: 1, align: TextAlignment.Left, valor: 'uno\ndos', multilinea: true },
];

async function pdfDePartida(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const pagina = doc.addPage([612, ALTO]);
  const fuente = await doc.embedFont(StandardFonts.Helvetica);
  const formulario = doc.getForm();

  for (const caso of CASOS) {
    const campo = formulario.createTextField(caso.name);
    campo.setText(caso.valor);
    campo.setAlignment(caso.align);
    if (caso.readonly) campo.enableReadOnly();
    if (caso.multilinea) campo.enableMultiline();
    campo.addToPage(pagina, {
      x: caso.x,
      y: caso.y,
      width: caso.w,
      height: caso.h,
      font: fuente,
      borderWidth: caso.borde,
      borderColor: caso.borde > 0 ? rgb(0, 0, 0) : undefined,
    });
    campo.setFontSize(9);
  }
  return doc.save();
}

/** Los rectángulos de los campos de un PDF, por nombre, como los guarda el archivo. */
async function rectangulos(bytes: Uint8Array): Promise<Record<string, number[]>> {
  const doc = await PDFDocument.load(bytes);
  const salida: Record<string, number[]> = {};
  for (const campo of doc.getForm().getFields()) {
    const r = campo.acroField.getWidgets()[0].getRectangle();
    salida[campo.getName()] = [r.x, r.y, r.width, r.height].map((v) => Math.round(v * 100) / 100);
  }
  return salida;
}

/** Arma el elemento del editor a partir de un campo leído, igual que hace la interfaz al abrir. */
function comoElemento(campo: CampoDelPdf, id: number): Elemento {
  return {
    clase: 'campo',
    id,
    angulo: 0,
    tipo: 'Texto',
    subrayado: false,
    invisible: false,
    repComodin: '#',
    repFilas: 1,
    repSep: 0,
    ...campo,
  } as Elemento;
}

await mkdir(SALIDA, { recursive: true });

const original = await pdfDePartida();
await writeFile(`${SALIDA}campos-partida.pdf`, original);
const antes = await rectangulos(original);

// ---------- Importar ----------

await asentarPdf(original);
// La hoja se apoya en la página 0 del PDF, como cuando se abre uno desde el editor: sin eso sería
// una hoja en blanco y al exportar saldría una página nueva en vez de la del PDF.
anclarHoja(0, 0);
const { campos, omitidos } = await camposDelPdf();

comparar('importar', 'cantidad de campos', CASOS.length, campos.length);
comparar('importar', 'omitidos', [], omitidos);

for (const caso of CASOS) {
  const leido = campos.find((c) => c.name === caso.name);
  if (!leido) {
    fallos.push(`importar — falta el campo ${caso.name}`);
    continue;
  }
  // La caja que vuelve es la misma que se pidió al crear el campo, sin importar el borde: pdf-lib
  // lo agrega por fuera al escribir y la importación lo descuenta al leer, así que se cancelan.
  // Eso es justo lo que evita que los campos crezcan un poco en cada vuelta.
  comparar(`importar ${caso.name}`, 'x/ancho', [caso.x, caso.w], [leido.x, leido.w]);
  comparar(`importar ${caso.name}`, 'y desde arriba', ALTO - caso.y - caso.h, leido.y);
  comparar(`importar ${caso.name}`, 'alineación', ['left', 'center', 'right'][caso.align], leido.align);
  comparar(`importar ${caso.name}`, 'valor', caso.valor, leido.defaultValue);
  comparar(`importar ${caso.name}`, 'solo lectura', !!caso.readonly, leido.readonly);
  comparar(`importar ${caso.name}`, 'varias líneas', !!caso.multilinea, leido.multilinea);
  comparar(`importar ${caso.name}`, 'grosor del borde', caso.borde, leido.bordeGrosor);
}

// ---------- Exportar y comparar ----------

const lienzo = { getObjects: () => campos.map((c, i) => ({ __el: comoElemento(c, i) })) } as any;
const exportado = await exportarPdf(lienzo, { conFormulario: true });
await writeFile(`${SALIDA}campos-vuelta.pdf`, exportado);
const despues = await rectangulos(exportado);

// Que no se dupliquen: el PDF de base ya traía estos campos y el diseño los vuelve a escribir.
comparar('exportar', 'cantidad de campos', Object.keys(antes).length, Object.keys(despues).length);
for (const nombre of Object.keys(antes)) {
  comparar('exportar', `rectángulo de ${nombre}`, antes[nombre], despues[nombre]);
}

cerrarPdf();

console.log(filas.join('\n'));
console.log(`\nPDFs en ${SALIDA}`);

if (fallos.length) {
  console.log(`\n${fallos.length} PROBLEMA(S):`);
  for (const f of fallos) console.log(`  - ${f}`);
  process.exitCode = 1;
} else {
  console.log('\nLa vuelta completa devuelve los campos intactos.');
}

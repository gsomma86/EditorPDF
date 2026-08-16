/**
 * Arnés de multipágina: un documento con varias hojas, cada una con sus elementos.
 *
 * Comprueba lo que no se ve mirando la pantalla: que cambiar de hoja no mezcle ni pierda
 * elementos, que deshacer alcance también a las operaciones de hoja (borrar una hoja con cosas
 * adentro es lo más caro de perder), y que al exportar cada hoja salga en su propia página.
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { StaticCanvas } from 'fabric';
import { PDFDocument, PDFName } from '@cantoo/pdf-lib';
import { agregarHoja, cantidadDeHojas, eliminarHoja, establecerHojas, hojaActual, establecerCapas, hojaEnBlanco, hojasDelDocumento, insertarPdf, irAHoja, moverHoja } from '../src/editor/documento';
import { inicializarHistorial, deshacer, registrarSnapshot, rehacer } from '../src/editor/historial';
import { agregarAlLienzo } from '../src/editor/objetosFabric';
import { exportarPdf } from '../src/editor/exportarPdf';
import { crearElemento, crearElementoFirma, crearElementoForma, type Elemento } from '../src/editor/elemento';

// fabric/node arma su propio DOM, pero el catalogo de fuentes pide las web al navegador: en Node
// no hacen falta y alcanza con que no reviente.
(globalThis as any).document ??= { fonts: { load: async () => [] } };

const SALIDA = fileURLToPath(new URL('../salida/', import.meta.url));

const fallos: string[] = [];
const filas: string[] = [];

function comparar(caso: string, medida: string, esperado: unknown, real: unknown): void {
  const ok = JSON.stringify(esperado) === JSON.stringify(real);
  if (!ok) fallos.push(`${caso} — ${medida}: se esperaba ${JSON.stringify(esperado)} y vino ${JSON.stringify(real)}`);
  filas.push(`${ok ? 'OK  ' : 'MAL '} ${caso.padEnd(26)} ${medida.padEnd(26)} ${JSON.stringify(real)}`);
}

/** Un texto reconocible, para saber después qué hoja es cuál. */
async function ponerTexto(lienzo: any, contenido: string): Promise<void> {
  const elemento = crearElemento('texto') as Elemento & { clase: 'texto' };
  elemento.text = contenido;
  elemento.x = 50;
  elemento.y = 100;
  elemento.size = 20;
  await agregarAlLienzo(lienzo, elemento);
}

const textosDe = (hojas: { elementos: Elemento[] }[]) => hojas.map((h) => h.elementos.filter((e) => e.clase === 'texto').map((e: any) => e.text));

await mkdir(SALIDA, { recursive: true });

const lienzo = new StaticCanvas(undefined, { width: 595, height: 842 }) as any;
// `StaticCanvas` es la variante sin interacción y no tiene selección; agregar un elemento la usa
// para dejarlo seleccionado. Acá no se prueba eso, así que alcanza con que no falte.
lienzo.setActiveObject = () => lienzo;
lienzo.discardActiveObject = () => lienzo;

inicializarHistorial(lienzo);

// ---------- Armar tres hojas ----------

await ponerTexto(lienzo, 'HOJA UNO');
registrarSnapshot(lienzo);

await agregarHoja(lienzo);
await ponerTexto(lienzo, 'HOJA DOS');
registrarSnapshot(lienzo);

await agregarHoja(lienzo);
await ponerTexto(lienzo, 'HOJA TRES');
registrarSnapshot(lienzo);

comparar('armado', 'cantidad de hojas', 3, cantidadDeHojas());
comparar('armado', 'hoja vigente', 2, hojaActual());
comparar('armado', 'textos por hoja', [['HOJA UNO'], ['HOJA DOS'], ['HOJA TRES']], textosDe(hojasDelDocumento(lienzo)));

// ---------- Ir y volver no mezcla nada ----------

await irAHoja(lienzo, 0);
comparar('cambiar de hoja', 'lo que hay en el lienzo', ['HOJA UNO'], textosDe([hojasDelDocumento(lienzo)[0]])[0]);
comparar('cambiar de hoja', 'hoja vigente', 0, hojaActual());

await irAHoja(lienzo, 2);
comparar('volver', 'textos por hoja', [['HOJA UNO'], ['HOJA DOS'], ['HOJA TRES']], textosDe(hojasDelDocumento(lienzo)));

// ---------- Reordenar ----------

await moverHoja(lienzo, 2, 0);
comparar('mover la tercera al frente', 'orden', [['HOJA TRES'], ['HOJA UNO'], ['HOJA DOS']], textosDe(hojasDelDocumento(lienzo)));
comparar('mover la tercera al frente', 'sigue la misma a la vista', 0, hojaActual());
await moverHoja(lienzo, 0, 2);

// ---------- Borrar y deshacer ----------

await eliminarHoja(lienzo, 1);
registrarSnapshot(lienzo);
comparar('borrar la del medio', 'cantidad de hojas', 2, cantidadDeHojas());
comparar('borrar la del medio', 'textos por hoja', [['HOJA UNO'], ['HOJA TRES']], textosDe(hojasDelDocumento(lienzo)));

await deshacer(lienzo);
comparar('deshacer el borrado', 'cantidad de hojas', 3, cantidadDeHojas());
comparar('deshacer el borrado', 'textos por hoja', [['HOJA UNO'], ['HOJA DOS'], ['HOJA TRES']], textosDe(hojasDelDocumento(lienzo)));

await rehacer(lienzo);
comparar('rehacer el borrado', 'cantidad de hojas', 2, cantidadDeHojas());
await deshacer(lienzo);

// ---------- La última hoja no se puede borrar ----------

// Sin registrar el paso a propósito: lo que se prueba acá es el tope, no el historial.
await eliminarHoja(lienzo, 2);
await eliminarHoja(lienzo, 1);
await eliminarHoja(lienzo, 0);
comparar('borrar de más', 'siempre queda una hoja', 1, cantidadDeHojas());

// ---------- Exportar: una página por hoja ----------

// Se rearman tres hojas desde cero, en vez de deshacer: los borrados de arriba no registraron
// paso, así que no hay nada que deshacer y esperar lo contrario sería probar mal.
await agregarHoja(lienzo);
await ponerTexto(lienzo, 'HOJA DOS');
await agregarHoja(lienzo);
await ponerTexto(lienzo, 'HOJA TRES');
comparar('rearmar', 'cantidad de hojas', 3, cantidadDeHojas());

const bytes = await exportarPdf(lienzo, { conFormulario: true });
await writeFile(`${SALIDA}multipagina.pdf`, bytes);

const exportado = await PDFDocument.load(bytes);
comparar('exportar', 'páginas en el PDF', 3, exportado.getPageCount());

// Y que cada hoja haya caído en SU página, en orden: contar páginas no alcanza, tres páginas
// con el contenido cambiado de lugar contarían igual.
const mupdf = await import('mupdf');
const leido = mupdf.PDFDocument.openDocument(bytes, 'application/pdf');
const textoDePagina = (i: number) =>
  JSON.parse((leido.loadPage(i) as any).toStructuredText('preserve-whitespace').asJSON())
    .blocks.flatMap((b: any) => (b.lines ?? []).map((l: any) => l.text))
    .join(' ')
    .trim();

comparar('exportar', 'texto por página', ['HOJA UNO', 'HOJA DOS', 'HOJA TRES'], [0, 1, 2].map(textoDePagina));

// ---------- Sobre un PDF de base: las hojas mandan sobre las páginas ----------

// El caso que cambió en la fase 3: el documento son las hojas, no el archivo que se abrió. Lo que
// se borre o se mueva acá tiene que borrarse o moverse en el PDF exportado.
const partida = await PDFDocument.create();
for (const letra of ['A', 'B', 'C', 'D']) {
  partida.addPage([420, 595]).drawText(`PAGINA ${letra}`, { x: 50, y: 500, size: 20 });
}
const bytesPartida = new Uint8Array(await partida.save());
await writeFile(`${SALIDA}hojas-partida.pdf`, bytesPartida);

const { asentarPdf, cerrarPdf } = await import('../src/editor/pdfExistente');
await asentarPdf(bytesPartida);

// Una hoja por página, como al abrir un PDF desde el editor. `hojasDesdePdf` no sirve acá: dibuja
// el fondo, y en Node no hay con qué rasterizar.
await establecerHojas(lienzo, [0, 1, 2, 3].map((p) => ({ ...hojaEnBlanco(), paginaPdf: p })), 0);
comparar('PDF de base', 'una hoja por página', 4, cantidadDeHojas());

// Se borra la segunda y se manda la última al principio.
await eliminarHoja(lienzo, 1);
await moverHoja(lienzo, 2, 0);

const conBase = await exportarPdf(lienzo, { conFormulario: true });
await writeFile(`${SALIDA}hojas-sobre-pdf.pdf`, conBase);

const leidoBase = mupdf.PDFDocument.openDocument(conBase, 'application/pdf');
const textoBase = (i: number) =>
  JSON.parse((leidoBase.loadPage(i) as any).toStructuredText('preserve-whitespace').asJSON())
    .blocks.flatMap((b: any) => (b.lines ?? []).map((l: any) => l.text))
    .join(' ')
    .trim();

comparar('PDF de base', 'páginas exportadas', 3, (await PDFDocument.load(conBase)).getPageCount());
comparar('PDF de base', 'la borrada no sale y el orden es el de la tira', ['PAGINA D', 'PAGINA A', 'PAGINA C'], [0, 1, 2].map(textoBase));

// ---------- Duplicar una hoja duplica su página ----------

// Si las dos hojas compartieran página, editar el contenido de una se vería en la otra: la cirugía
// (borrar un texto, sacar una forma) es sobre el PDF, no sobre la hoja.
await asentarPdf(bytesPartida);
await establecerHojas(lienzo, [0, 1, 2, 3].map((p) => ({ ...hojaEnBlanco(), paginaPdf: p })), 0);
await agregarHoja(lienzo, true);

const { bytesDelPdf } = await import('../src/editor/pdfExistente');
const conCopia = await PDFDocument.load(bytesDelPdf()!.slice());
comparar('duplicar hoja', 'el PDF tiene una página más', 5, conCopia.getPageCount());
comparar(
  'duplicar hoja',
  'cada hoja con su propia página',
  [0, 1, 2, 3, 4],
  hojasDelDocumento(lienzo).map((h) => h.paginaPdf)
);

const leidoCopia = mupdf.PDFDocument.openDocument(bytesDelPdf()!.slice(), 'application/pdf');
const textoCopia = (i: number) =>
  JSON.parse((leidoCopia.loadPage(i) as any).toStructuredText('preserve-whitespace').asJSON())
    .blocks.flatMap((b: any) => (b.lines ?? []).map((l: any) => l.text))
    .join(' ')
    .trim();
comparar('duplicar hoja', 'la copia quedó al lado del original', ['PAGINA A', 'PAGINA A', 'PAGINA B'], [0, 1, 2].map(textoCopia));

// ---------- Insertar otro PDF en una posición ----------

// Sobre el PDF de 4 páginas (A/B/C/D) se mete otro de 2 (X/Y) después de la primera hoja: las
// páginas nuevas tienen que quedar en el medio y las de más adelante correrse de número.
await asentarPdf(bytesPartida);
await establecerHojas(lienzo, [0, 1, 2, 3].map((p) => ({ ...hojaEnBlanco(), paginaPdf: p })), 0);

const anexo = await PDFDocument.create();
for (const letra of ['X', 'Y']) {
  anexo.addPage([595, 842]).drawText(`ANEXO ${letra}`, { x: 50, y: 700, size: 20 });
}
const medidasInsertadas = await insertarPdf(lienzo, new Uint8Array(await anexo.save()), 0);

comparar('insertar PDF', 'hojas del documento', 6, cantidadDeHojas());
comparar('insertar PDF', 'medidas de lo insertado', [{ ancho: 595, alto: 842 }, { ancho: 595, alto: 842 }], medidasInsertadas);
comparar('insertar PDF', 'paginas de cada hoja', [0, 1, 2, 3, 4, 5], hojasDelDocumento(lienzo).map((h) => h.paginaPdf));
comparar('insertar PDF', 'queda parado en la primera insertada', 1, hojaActual());

const conAnexo = await exportarPdf(lienzo, { conFormulario: true });
await writeFile(`${SALIDA}hojas-con-anexo.pdf`, conAnexo);
const leidoAnexo = mupdf.PDFDocument.openDocument(conAnexo, 'application/pdf');
const textoAnexo = (i: number) =>
  JSON.parse((leidoAnexo.loadPage(i) as any).toStructuredText('preserve-whitespace').asJSON())
    .blocks.flatMap((b: any) => (b.lines ?? []).map((l: any) => l.text))
    .join(' ')
    .trim();
comparar(
  'insertar PDF',
  'el anexo quedó en el medio',
  ['PAGINA A', 'ANEXO X', 'ANEXO Y', 'PAGINA B', 'PAGINA C', 'PAGINA D'],
  [0, 1, 2, 3, 4, 5].map(textoAnexo)
);

// ---------- Los campos del PDF insertado no se pierden ----------

// `copyPages` trae los widgets como anotaciones de la página pero no los anota en el formulario
// del documento: sin registrarlos, los campos del PDF que entra quedan huérfanos y nadie los ve.
const conCampos = await PDFDocument.create();
const hojaConCampos = conCampos.addPage([595, 842]);
const formEntrante = conCampos.getForm();
for (const nombre of ['anexo_uno', 'anexo_dos']) {
  const campo = formEntrante.createTextField(nombre);
  campo.addToPage(hojaConCampos, { x: 50, y: nombre === 'anexo_uno' ? 700 : 650, width: 200, height: 20 });
}

await asentarPdf(bytesPartida);
await establecerHojas(lienzo, [0, 1, 2, 3].map((p) => ({ ...hojaEnBlanco(), paginaPdf: p })), 0);
await insertarPdf(lienzo, new Uint8Array(await conCampos.save()), 1);

const { camposDelPdf } = await import('../src/editor/pdfExistente');
const leidosTrasInsertar = await camposDelPdf();
comparar(
  'insertar con campos',
  'los campos del PDF insertado se conservan',
  ['anexo_dos', 'anexo_uno'],
  leidosTrasInsertar.campos.map((c) => c.name).sort()
);
comparar('insertar con campos', 'y saben en qué página están', [2, 2], leidosTrasInsertar.campos.map((c) => c.pagina));

// ---------- Cada hoja con su propio tamaño ----------

// El documento tenía un solo tamaño hasta la fase 4; ahora es de cada hoja, que es lo que permite
// mezclar un anexo A4 con un recibo A5 sin que ninguna de las dos se vea estirada.
cerrarPdf();
await establecerHojas(
  lienzo,
  [
    { ...hojaEnBlanco(), tamano: 'A5', orientacion: 'vertical' },
    { ...hojaEnBlanco(), tamano: 'A4', orientacion: 'vertical' },
    { ...hojaEnBlanco(), tamano: 'A4', orientacion: 'horizontal' },
  ],
  0
);

const mixto = await PDFDocument.load(await exportarPdf(lienzo, { conFormulario: true }));
comparar(
  'tamaño por hoja',
  'cada página con sus medidas',
  [[420, 595], [595, 842], [842, 595]],
  mixto.getPages().map((p) => [Math.round(p.getWidth()), Math.round(p.getHeight())])
);

// ---------- Capas: lo apagado no sale en el PDF ----------

// Es la diferencia con "Ocultar campos", que es solo una vista: acá lo que se ve es lo que se
// obtiene, así que un elemento apagado —o de una capa apagada— no llega al archivo.
cerrarPdf();
establecerCapas([
  { id: 'base', nombre: 'Capa 1', visible: true, bloqueada: false },
  { id: 'oculta', nombre: 'Apagada', visible: false, bloqueada: false },
]);
await establecerHojas(lienzo, [hojaEnBlanco()], 0);
await ponerTexto(lienzo, 'SE VE');
await ponerTexto(lienzo, 'APAGADO POR SI MISMO');
await ponerTexto(lienzo, 'APAGADO POR SU CAPA');

const enLaHoja = hojasDelDocumento(lienzo)[0].elementos;
enLaHoja[1].oculto = true;
enLaHoja[2].capa = 'oculta';

const conCapas = await exportarPdf(lienzo, { conFormulario: true });
const leidoCapas = mupdf.PDFDocument.openDocument(conCapas, 'application/pdf');
const textoConCapas = JSON.parse((leidoCapas.loadPage(0) as any).toStructuredText('preserve-whitespace').asJSON())
  .blocks.flatMap((b: any) => (b.lines ?? []).map((l: any) => l.text))
  .join(' ')
  .trim();
comparar('capas', 'solo sale lo que se ve', 'SE VE', textoConCapas);
comparar('capas', 'los tres siguen en el modelo', 3, hojasDelDocumento(lienzo)[0].elementos.length);

// ---------- Campo de firma ----------

// Tiene que llegar al PDF como campo de firma de verdad —`/FT /Sig`, anotado en el formulario y
// con `/SigFlags`— y **vacío**: si trajera valor ya estaría firmado, que no es lo que hace el editor.
await establecerHojas(lienzo, [hojaEnBlanco()], 0);
const firma = crearElementoFirma('firma_empleador', 'Firma del empleador');
firma.x = 60;
firma.y = 700;
await agregarAlLienzo(lienzo, firma);

const conFirma = await exportarPdf(lienzo, { conFormulario: true });
await writeFile(`${SALIDA}con-firma.pdf`, conFirma);

const docFirma = await PDFDocument.load(conFirma);
const campos = docFirma.getForm().getFields();
comparar('campo de firma', 'lo ve el formulario', ['firma_empleador'], campos.map((c) => c.getName()));
comparar('campo de firma', 'es de tipo firma', 'PDFSignature', campos[0]?.constructor.name);

// Sobre los diccionarios y no sobre los bytes: pdf-lib guarda comprimido y buscar texto suelto
// dentro del PDF daría siempre negativo.
const acroFirma = docFirma.catalog.lookup(PDFName.of('AcroForm')) as any;
comparar('campo de firma', 'el documento se declara con firmas', '3', String(acroFirma?.get(PDFName.of('SigFlags'))));
const dictFirma = (campos[0] as any).acroField.dict;
comparar('campo de firma', 'queda vacío, sin firmar', undefined, dictFirma.get(PDFName.of('V')));
comparar('campo de firma', 'lo apunta la página', true, Boolean(dictFirma.get(PDFName.of('P'))));

// Ida y vuelta: al reabrir ese PDF la firma tiene que volver como firma y en el mismo lugar, no
// perderse ni convertirse en un campo de texto.
await asentarPdf(conFirma);
const reabierto = await camposDelPdf();
comparar('reabrir la firma', 'vuelve como firma', ['firma_empleador'], reabierto.firmas.map((f) => f.name));
comparar('reabrir la firma', 'en el mismo lugar', [60, 700, 150, 55], reabierto.firmas.map((f) => [f.x, f.y, f.w, f.h])[0]);
comparar('reabrir la firma', 'no se cuela entre los de texto', [], reabierto.campos.map((c) => c.name));
cerrarPdf();

// ---------- Formas geométricas ----------

// Que las cuatro figuras bajen dibujadas al PDF, cada una con la geometría que le corresponde. Se
// mide sobre el contenido de la página —los operadores de dibujo— porque una figura no deja campos
// ni texto que mirar: si el camino no está, no está.
await establecerHojas(lienzo, [hojaEnBlanco()], 0);
for (const [i, figura] of (['elipse', 'triangulo', 'flecha', 'estrella'] as const).entries()) {
  const forma = crearElementoForma(figura);
  forma.x = 40;
  forma.y = 40 + i * 140;
  forma.conRelleno = figura === 'estrella';
  await agregarAlLienzo(lienzo, forma);
}

const conFormas = await exportarPdf(lienzo, { conFormulario: false });
await writeFile(`${SALIDA}formas.pdf`, conFormas);

const paginaFormas = mupdf.PDFDocument.openDocument(conFormas, 'application/pdf').loadPage(0) as any;
// `/Contents` puede ser un stream o un arreglo de streams —pdf-lib escribe un arreglo—, así que se
// juntan todos antes de mirar los operadores.
const contents = paginaFormas.getObject().get('Contents') as any;
const partes: any[] = contents.isArray() ? Array.from({ length: contents.length }, (_, i) => contents.get(i)) : [contents];
const contenido = partes.map((p) => new TextDecoder().decode(p.readStream().asUint8Array())).join('\n');
// Un camino cerrado por figura: `m` lo abre y `h` lo cierra. La elipse se dibuja con curvas (`c`)
// y las otras tres solo con rectas (`l`), con tantas como vértices tiene cada una.
const cuantos = (patron: RegExp) => contenido.match(patron)?.length ?? 0;
comparar('formas', 'cuatro caminos cerrados', 4, cuantos(/(^|\s)h(\s|$)/g));
comparar('formas', 'la elipse va con curvas', true, cuantos(/(^|\s)c(\s|$)/g) >= 4);
// Triángulo (3) + flecha (7) + estrella de 5 puntas (10) = 20 vértices, menos el primero de cada
// figura, que lo pone `m`: 17 rectas.
comparar('formas', 'rectas de las tres poligonales', 17, cuantos(/(^|\s)l(\s|$)/g));
comparar('formas', 'solo la estrella va rellena', 1, cuantos(/(^|\s)B(\s|$)/g));

console.log(filas.join('\n'));
console.log(`\nPDF en ${SALIDA}multipagina.pdf`);

if (fallos.length) {
  console.log(`\n${fallos.length} PROBLEMA(S):`);
  for (const f of fallos) console.log(`  - ${f}`);
  process.exitCode = 1;
} else {
  console.log('\nLas hojas se mantienen separadas, se pueden deshacer y cada una sale en su página.');
}

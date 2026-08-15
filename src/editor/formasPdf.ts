/**
 * Formas del contenido de un PDF: las líneas y recuadros que trae dibujados, para poder editarlos
 * como cualquier elemento del diseño. Es el corazón de la fase 3, el equivalente para formas de lo
 * que `pdfExistente.ts` hace con el texto.
 *
 * **Cómo se ubica una forma.** El recorrido de mupdf entrega los rellenos y trazos en el mismo
 * orden en que aparecen sus operadores en el content stream, así que la enésima forma que se ve es
 * la enésima que se pinta: se las empareja **por posición**. Comparar coordenadas no serviría,
 * porque los números del stream están en el sistema que impone la matriz vigente (`cm`), que casi
 * nunca es la identidad.
 *
 * **Qué entra.** Rectángulos de ejes rectos y líneas rectas, que sobre 60 PDF reales son el 84% de
 * lo que hay dibujado. Las líneas suelen venir como rectángulos degenerados —alto o ancho 0— así
 * que son el mismo caso. Curvas, paths compuestos y formas rotadas se detectan pero se marcan como
 * fuera de alcance: no se ofrecen para editar.
 */

/** Una forma del contenido, en coordenadas de la hoja (Y desde arriba, como el lienzo). */
export interface FormaDelPdf {
  /** Posición entre las formas pintadas de la página, contando desde 0 en el orden del dibujo. */
  indice: number;
  clase: 'rect' | 'linea';
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  /** Relleno macizo, o solo el contorno. */
  relleno: boolean;
  /** Grosor del trazo, en puntos. Sin sentido si es un relleno. */
  grosor: number;
}

function hex(componentes: number[]): string {
  const aByte = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 255);
  if (componentes.length === 1) {
    const g = aByte(componentes[0]);
    return `#${[g, g, g].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
  }
  if (componentes.length >= 4) {
    const [c, m, y, k] = componentes;
    componentes = [(1 - c) * (1 - k), (1 - m) * (1 - k), (1 - y) * (1 - k)];
  }
  return `#${componentes.slice(0, 3).map((v) => aByte(v).toString(16).padStart(2, '0')).join('')}`;
}

/** Un trazo tan fino que en la práctica es una línea, no un rectángulo. */
const GROSOR_LINEA = 1.5;

/**
 * Clasifica los puntos de un path ya pasados a coordenadas de la hoja. Devuelve null si la forma
 * no es de las que se pueden editar: con curvas, con más de cuatro puntos, o girada.
 */
function medir(puntos: [number, number][], curvas: boolean): { clase: 'rect' | 'linea'; x: number; y: number; w: number; h: number } | null {
  if (curvas) return null;

  const xs = [...new Set(puntos.map((p) => Math.round(p[0] * 100) / 100))];
  const ys = [...new Set(puntos.map((p) => Math.round(p[1] * 100) / 100))];

  // Un rectángulo recto tiene exactamente dos valores distintos de X y dos de Y, en cuatro puntos.
  // Una línea recta tiene dos puntos y comparte una de las dos coordenadas.
  const esRect = puntos.length === 4 && xs.length === 2 && ys.length === 2;
  const esLinea = puntos.length === 2 && (xs.length === 1 || ys.length === 1);
  if (!esRect && !esLinea) return null;

  const x = Math.min(...xs);
  const y = Math.min(...ys);
  const w = Math.max(...xs) - x;
  const h = Math.max(...ys) - y;

  // Un rectángulo sin espesor es en realidad una línea: así se dibujan en casi todos los PDF que
  // salen de un HTML, y tratarlo como recuadro daría un elemento de alto 0 imposible de agarrar.
  const clase = esLinea || w < GROSOR_LINEA || h < GROSOR_LINEA ? 'linea' : 'rect';
  return { clase, x, y, w, h };
}

async function motor() {
  return import('mupdf');
}

/**
 * Las formas editables de una página. El índice que llevan es el que hay que pasarle a
 * `borrarFormaDelPdf` para sacarla del contenido.
 */
export async function formasDelPdf(bytes: Uint8Array, pagina: number): Promise<FormaDelPdf[]> {
  const mupdf = await motor();
  const documento = mupdf.PDFDocument.openDocument(bytes.slice(), 'application/pdf') as InstanceType<typeof mupdf.PDFDocument>;
  const hoja = documento.loadPage(pagina) as any;

  const formas: FormaDelPdf[] = [];
  let indice = 0;

  const anotar = (path: any, ctm: number[], color: number[], relleno: boolean, grosor: number) => {
    const propio = indice++;
    const puntos: [number, number][] = [];
    let curvas = false;
    path.walk({
      moveTo: (x: number, y: number) => puntos.push([x, y]),
      lineTo: (x: number, y: number) => puntos.push([x, y]),
      curveTo: () => {
        curvas = true;
      },
      closePath: () => {},
    });

    const [a, b, c, d, tx, ty] = ctm;
    // Girada: la matriz mezcla los ejes. Se descarta antes de medir, que asume ejes rectos.
    if (Math.abs(b) > 1e-6 || Math.abs(c) > 1e-6) return;

    const enLaHoja = puntos.map((p) => [a * p[0] + c * p[1] + tx, b * p[0] + d * p[1] + ty] as [number, number]);
    const medida = medir(enLaHoja, curvas);
    if (!medida) return;

    formas.push({
      indice: propio,
      ...medida,
      color: hex(color.slice(0, 4)),
      relleno,
      // El grosor está en el sistema del path: la matriz lo escala igual que a todo lo demás.
      grosor: Math.abs(grosor * d) || 1,
    });
  };

  const dispositivo = new mupdf.Device({
    fillPath: (path: any, _eo: boolean, ctm: number[], _cs: unknown, color: number[]) => anotar(path, ctm, color, true, 0),
    strokePath: (path: any, trazo: any, ctm: number[], _cs: unknown, color: number[]) => anotar(path, ctm, color, false, trazo?.getLineWidth?.() ?? 1),
  });

  // Solo el contenido: `run()` dibujaría también las anotaciones, y los bordes de los campos de
  // formulario aparecerían como si fueran formas de la página (ver la lección 30 de CLAUDE.md).
  hoja.runPageContents(dispositivo, mupdf.Matrix.identity);
  return formas;
}

// ---------- Sacar una forma del contenido ----------

/** Qué pinta cada operador, en el orden en que el recorrido de mupdf los va a informar. */
const PINTA: Record<string, ('relleno' | 'trazo')[]> = {
  f: ['relleno'],
  F: ['relleno'],
  'f*': ['relleno'],
  S: ['trazo'],
  s: ['trazo'],
  B: ['relleno', 'trazo'],
  'B*': ['relleno', 'trazo'],
  b: ['relleno', 'trazo'],
  'b*': ['relleno', 'trazo'],
  n: [],
};

const CONSTRUYE = new Set(['m', 'l', 'c', 'v', 'y', 'h', 're']);

/**
 * Recorre un content stream y devuelve, por cada operador que pinta, desde qué byte empieza su
 * camino y hasta cuál llega. Es un lector chico a propósito: no interpreta el PDF, solo necesita
 * saber dónde está cada operador, salteando lo que puede confundirlo (cadenas, comentarios y las
 * imágenes incrustadas, cuyos bytes crudos pueden contener cualquier cosa).
 */
function operadoresQuePintan(texto: string): { desde: number; hasta: number; eventos: ('relleno' | 'trazo')[] }[] {
  const salida: { desde: number; hasta: number; eventos: ('relleno' | 'trazo')[] }[] = [];
  let inicioCamino = -1;
  let i = 0;

  const esDelimitador = (c: string) => c === undefined || /[\s()<>[\]{}/%]/.test(c);

  while (i < texto.length) {
    const c = texto[i];

    if (c === '%') {
      while (i < texto.length && texto[i] !== '\n') i++;
      continue;
    }
    if (c === '(') {
      let nivel = 1;
      i++;
      while (i < texto.length && nivel > 0) {
        if (texto[i] === '\\') i++;
        else if (texto[i] === '(') nivel++;
        else if (texto[i] === ')') nivel--;
        i++;
      }
      continue;
    }
    if (esDelimitador(c)) {
      i++;
      continue;
    }

    let fin = i;
    while (fin < texto.length && !esDelimitador(texto[fin])) fin++;
    const palabra = texto.slice(i, fin);

    // Imagen incrustada: entre `ID` y `EI` hay bytes crudos que no se pueden leer como operadores.
    if (palabra === 'BI') {
      const id = texto.indexOf('ID', fin);
      const ei = id < 0 ? -1 : texto.indexOf('EI', id);
      i = ei < 0 ? texto.length : ei + 2;
      continue;
    }

    if (CONSTRUYE.has(palabra)) {
      if (inicioCamino < 0) inicioCamino = i;
    } else if (palabra in PINTA) {
      salida.push({ desde: inicioCamino < 0 ? i : inicioCamino, hasta: fin, eventos: PINTA[palabra] });
      inicioCamino = -1;
    }

    i = fin;
  }
  return salida;
}

/**
 * Borra del contenido la forma número `indice` —el mismo que trae `formasDelPdf`— y devuelve los
 * bytes del PDF ya modificado.
 *
 * El camino y su operador se reemplazan por espacios en vez de recortarse: un content stream
 * tolera espacios en cualquier lado, y así no hay que recalcular longitudes ni offsets. Si el
 * operador pintaba relleno y contorno a la vez (`B`), se van los dos: son el mismo dibujo.
 */
export async function borrarFormaDelPdf(bytes: Uint8Array, pagina: number, indice: number): Promise<Uint8Array> {
  const mupdf = await motor();
  const documento = mupdf.PDFDocument.openDocument(bytes.slice(), 'application/pdf') as InstanceType<typeof mupdf.PDFDocument>;
  const hoja = (documento.loadPage(pagina) as any).getObject().resolve();

  const contenido = hoja.get('Contents');
  const partes: any[] = contenido.isArray() ? Array.from({ length: contenido.length }, (_, i) => contenido.get(i)) : [contenido];

  // Las partes de `Contents` son un solo stream cortado en pedazos, así que la cuenta de formas
  // sigue de una a la siguiente.
  let vistas = 0;
  for (const parte of partes) {
    const crudo = parte.readStream().asUint8Array();
    const texto = new TextDecoder('latin1').decode(crudo);
    const pintados = operadoresQuePintan(texto);

    for (const op of pintados) {
      const propias = op.eventos.length;
      if (indice < vistas + propias) {
        const limpio = texto.slice(0, op.desde) + ' '.repeat(op.hasta - op.desde) + texto.slice(op.hasta);
        parte.writeStream(new TextEncoder().encode(limpio));
        return documento.saveToBuffer('').asUint8Array();
      }
      vistas += propias;
    }
  }

  throw new Error(`No se encontró la forma ${indice} en el contenido de la página.`);
}

/** La forma que cae bajo un punto de la hoja. Se prueba de adelante hacia atrás: gana la de arriba. */
export function formaEn(formas: FormaDelPdf[], x: number, y: number): FormaDelPdf | undefined {
  const holgura = 2;
  return [...formas]
    .reverse()
    .find((f) => x >= f.x - holgura && x <= f.x + f.w + holgura && y >= f.y - holgura && y <= f.y + f.h + holgura);
}

/**
 * Formas del contenido de un PDF: las líneas y recuadros que trae dibujados, para poder editarlos
 * como cualquier elemento del diseño. Es el corazón de la fase 3, el equivalente para formas de lo
 * que `pdfExistente.ts` hace con el texto.
 *
 * **Cómo se saca una forma.** Con una redacción de mupdf sobre su rectángulo, pidiéndole que se
 * lleve el dibujo vectorial y no toque el texto. No se emparejan formas con operadores del content
 * stream: ver el detalle en `borrarFormasDelPdf`, donde está por qué eso no funciona.
 *
 * **Qué entra.** Rectángulos de ejes rectos y líneas rectas, que sobre 60 PDF reales son el 84% de
 * lo que hay dibujado. Las líneas suelen venir como rectángulos degenerados —alto o ancho 0— así
 * que son el mismo caso. Curvas, paths compuestos y formas rotadas se detectan pero se marcan como
 * fuera de alcance: no se ofrecen para editar.
 */

import { crearElemento, type Elemento } from './elemento';

/** Una forma del contenido, en coordenadas de la hoja (Y desde arriba, como el lienzo). */
export interface FormaDelPdf {
  /** Orden en que la dibuja el PDF, desde 0. Sirve para identificarla mientras está a la vista. */
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
  /**
   * Cuánto está girada, en grados y en el sentido del lienzo. Casi siempre 0: las formas de un
   * PDF de oficina vienen derechas. x/y/w/h describen la caja **sin girar**, y el giro se aplica
   * después alrededor de la esquina superior izquierda, igual que en el resto del editor.
   */
  angulo: number;
}

/**
 * Una imagen del contenido del PDF, en coordenadas de la hoja. No se edita su contenido —para eso
 * está reemplazarla—, pero sí se la puede sacar del PDF y volver a colocar como imagen del diseño,
 * y de ahí en más se mueve, se achica y se borra como cualquier otra.
 */
export interface ImagenDelPdf {
  indice: number;
  x: number;
  y: number;
  w: number;
  h: number;
  angulo: number;
  /** Los píxeles, como data URL PNG, listos para volverse un `ElementoImagen`. */
  src: string;
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
 * Descompone la matriz del PDF en el ángulo que aplica y la parte sin girar.
 *
 * Una matriz `[a b c d tx ty]` que solo escala y gira se puede leer como una rotación seguida de
 * una escala: el ángulo sale de la primera columna, y deshacerlo deja una matriz de ejes rectos que
 * `medir()` ya sabe tratar. Devuelve `null` si además hay sesgo (los dos ejes no quedan
 * perpendiculares), que no se puede representar con un elemento del editor.
 *
 * El ángulo sale ya en el sentido del lienzo, sin invertirle el signo: mupdf entrega la matriz en
 * su espacio de dispositivo, que mide la Y desde arriba igual que Fabric.
 */
function separarGiro(ctm: number[]): { angulo: number; sinGiro: number[] } | null {
  const [a, b, c, d, tx, ty] = ctm;
  const angulo = Math.atan2(b, a);

  const cos = Math.cos(angulo);
  const sen = Math.sin(angulo);
  // La inversa de la rotación, aplicada a la matriz: si queda con b y c en cero, era giro puro.
  const sinGiro = [a * cos + b * sen, -a * sen + b * cos, c * cos + d * sen, -c * sen + d * cos, tx, ty];
  if (Math.abs(sinGiro[1]) > 1e-6 || Math.abs(sinGiro[2]) > 1e-6) return null;

  return { angulo: (angulo * 180) / Math.PI, sinGiro };
}

/**
 * Lleva la esquina de la caja enderezada al lugar que le toca en la hoja: primero el giro que trae
 * la matriz, después su traslación. Es el orden en que lo aplica el PDF, y hacerlo al revés corre
 * la forma tanto más cuanto más lejos del origen esté.
 */
function ubicarEsquina(x: number, y: number, ctm: number[]): { x: number; y: number } {
  const [a, b, , , tx, ty] = ctm;
  const angulo = Math.atan2(b, a);
  const cos = Math.cos(angulo);
  const sen = Math.sin(angulo);
  return { x: cos * x - sen * y + tx, y: sen * x + cos * y + ty };
}

/**
 * Clasifica los puntos de un path ya pasados a coordenadas de la hoja. Devuelve null si la forma
 * no es de las que se pueden editar: con curvas o con más de cuatro puntos.
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
 * Las formas editables de una página, en el orden en que las dibuja el PDF.
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

    // Se separa el giro de la matriz y se mide la forma **enderezada**: así una línea girada 30°
    // se reconoce igual que una derecha, y el ángulo se guarda aparte. Con sesgo (los ejes dejan
    // de ser perpendiculares) no hay elemento que la represente, y se descarta.
    const separada = separarGiro(ctm);
    if (!separada) return;
    const [escalaX, , , escalaY] = separada.sinGiro;

    // Sin trasladar: la traslación se aplica *después* del giro, así que sumarla acá correría la
    // caja a un lugar que no es. Se mide la forma enderezada y recién entonces se ubica su esquina.
    const enderezados = puntos.map((p) => [escalaX * p[0], escalaY * p[1]] as [number, number]);
    const medida = medir(enderezados, curvas);
    if (!medida) return;

    const esquina = ubicarEsquina(medida.x, medida.y, ctm);

    formas.push({
      indice: propio,
      ...medida,
      ...esquina,
      color: hex(color.slice(0, 4)),
      relleno,
      // El grosor está en el sistema del path: la matriz lo escala igual que a todo lo demás.
      grosor: Math.abs(grosor * escalaY) || 1,
      angulo: Math.abs(separada.angulo) < 1e-6 ? 0 : Math.round(separada.angulo * 100) / 100,
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

// ---------- Sacar formas del contenido ----------

/**
 * Saca del contenido de la página las formas indicadas y devuelve el PDF ya modificado.
 *
 * Lo hace con una **redacción** de mupdf por cada forma, el mismo mecanismo que borra el texto,
 * pero pidiéndole que se lleve el dibujo vectorial y deje el texto quieto. Es importante que sea
 * mupdf y no una cirugía a mano sobre el content stream: el recorrido informa menos formas que
 * operadores hay —saltea los que no dibujan nada visible: en una plantilla real, 556 contra 672—
 * así que emparejarlos por posición borra el operador equivocado y se lleva puesto texto y líneas
 * que nadie pidió sacar. Con redacciones se identifica por rectángulo y ese problema no existe.
 *
 * Ojo: la redacción se lleva **todo el dibujo que quede completamente adentro** del rectángulo, así
 * que sacar un recuadro grande puede llevarse una línea que estuviera adentro. Por eso quien llama
 * conviene que compare cuántas formas quedaron.
 */
export async function borrarFormasDelPdf(bytes: Uint8Array, pagina: number, objetivos: { x: number; y: number; w: number; h: number }[]): Promise<Uint8Array> {
  if (!objetivos.length) return bytes;

  const mupdf = await motor();
  const documento = mupdf.PDFDocument.openDocument(bytes.slice(), 'application/pdf') as InstanceType<typeof mupdf.PDFDocument>;
  const hoja = documento.loadPage(pagina) as any;

  for (const o of objetivos) {
    const anotacion = hoja.createAnnotation('Redact');
    // Medio punto de aire: una línea de grosor 0,5 tiene que quedar cubierta por su rectángulo.
    anotacion.setRect([o.x - 0.5, o.y - 0.5, o.x + o.w + 0.5, o.y + o.h + 0.5]);
    anotacion.update();
  }

  // Sin recuadros negros; imágenes intactas (0); el dibujo vectorial se quita si queda cubierto
  // (1); el texto no se toca (1) — es justo al revés que al borrar un texto, que usa (0, 0).
  hoja.applyRedactions(false, 0, 1, 1);
  // Copia propia: lo que devuelve mupdf es una vista sobre su memoria y se invalida en cuanto se
  // vuelve a usar el motor (ver la lección 22 de CLAUDE.md).
  return new Uint8Array(documento.saveToBuffer('').asUint8Array());
}

/** Saca una sola forma. Es el caso del doble clic. */
export async function borrarFormaDelPdf(bytes: Uint8Array, pagina: number, forma: { x: number; y: number; w: number; h: number }): Promise<Uint8Array> {
  return borrarFormasDelPdf(bytes, pagina, [forma]);
}

/**
 * Convierte una forma del PDF en un elemento del diseño, con su misma posición, medidas y color.
 * Un relleno macizo se reconstruye como recuadro relleno sin borde; uno de contorno, al revés.
 * Queda marcado como `debajoDeLaPagina` porque en el PDF estaba debajo del texto y ahí tiene que
 * seguir; el modelo lo lleva para que sobreviva a deshacer, cambiar de hoja y recargar.
 */
export function elementoDesdeForma(forma: FormaDelPdf): Elemento {
  const elemento = crearElemento(forma.clase) as Elemento & { clase: 'rect' | 'linea' };
  elemento.x = forma.x;
  elemento.y = forma.y;
  elemento.w = forma.w;
  elemento.h = forma.h;
  // Las medidas son las de la forma enderezada y el giro va aparte, igual que en el resto del
  // editor: todos los elementos rotan alrededor de su esquina superior izquierda.
  elemento.angulo = forma.angulo;
  elemento.color = forma.color;
  elemento.debajoDeLaPagina = true;
  if (elemento.clase === 'rect') {
    elemento.conRelleno = forma.relleno;
    elemento.rellenoColor = forma.color;
    elemento.grosor = forma.relleno ? 0 : Math.max(0.5, forma.grosor);
  }
  return elemento;
}

/** La forma que cae bajo un punto de la hoja. Se prueba de adelante hacia atrás: gana la de arriba. */
export function formaEn(formas: FormaDelPdf[], x: number, y: number): FormaDelPdf | undefined {
  const holgura = 2;
  return [...formas]
    .reverse()
    .find((f) => x >= f.x - holgura && x <= f.x + f.w + holgura && y >= f.y - holgura && y <= f.y + f.h + holgura);
}

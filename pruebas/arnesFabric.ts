/**
 * Mide qué dibuja realmente el lienzo. Renderiza cada caso en un canvas de Fabric del tamaño de
 * la hoja, saca la caja de tinta y la deja en un JSON que después usa el arnés del PDF como
 * referencia: lo que se ve en pantalla es la verdad contra la que hay que comparar el exportado.
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { StaticCanvas } from 'fabric';
import { crearObjetoFabric } from '../src/editor/objetosFabric';
import { CASOS } from './casos';

// Relativo al bundle (pruebas/dist-fabric/), para que los dos arneses escriban en pruebas/salida.
// fabric/node arma su propio DOM pero no expone `document` global, y el catálogo de fuentes lo usa
// para pedirle las familias web al navegador. Acá no hacen falta: node-canvas dibuja con las del
// sistema, y los bytes para el PDF los lee el otro arnés desde node_modules.
(globalThis as any).document ??= { fonts: { load: async () => [] } };

const SALIDA = fileURLToPath(new URL('../salida/', import.meta.url));
const ANCHO = 595;
const ALTO = 842;

await mkdir(SALIDA, { recursive: true });

const referencia: Record<string, { x1: number; y1: number; x2: number; y2: number } | null> = {};

for (const caso of CASOS) {
  const lienzo = new StaticCanvas(undefined, { width: ANCHO, height: ALTO });
  lienzo.backgroundColor = '#ffffff';

  for (const elemento of caso.elementos) {
    const objeto = await crearObjetoFabric(elemento);
    lienzo.add(objeto);
  }
  lienzo.renderAll();

  const ctx = (lienzo as any).getNodeCanvas().getContext('2d');
  const { data } = ctx.getImageData(0, 0, ANCHO, ALTO);

  let x1 = Infinity;
  let y1 = Infinity;
  let x2 = -Infinity;
  let y2 = -Infinity;
  for (let y = 0; y < ALTO; y++) {
    for (let x = 0; x < ANCHO; x++) {
      const i = (y * ANCHO + x) * 4;
      if (data[i] < 245 || data[i + 1] < 245 || data[i + 2] < 245) {
        if (x < x1) x1 = x;
        if (y < y1) y1 = y;
        if (x > x2) x2 = x;
        if (y > y2) y2 = y;
      }
    }
  }

  referencia[caso.nombre] = x1 === Infinity ? null : { x1, y1, x2, y2 };
  const c = referencia[caso.nombre];
  console.log(`${caso.nombre.padEnd(18)} ${c ? `tinta x ${c.x1}..${c.x2}  y ${c.y1}..${c.y2}` : 'NO DIBUJÓ NADA'}`);
}

await writeFile(`${SALIDA}geometria-lienzo.json`, JSON.stringify(referencia, null, 2));
console.log(`\nReferencia guardada en ${SALIDA}geometria-lienzo.json`);

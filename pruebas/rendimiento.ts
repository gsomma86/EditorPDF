/**
 * Mide cuánto tarda un diseño grande. El roadmap tenía el rendimiento anotado como "sin medir";
 * esto lo pone en números en vez de suponer. Corre en Node con el Fabric de verdad, así que mide
 * lo mismo que hace el navegador al construir y dibujar el lienzo.
 *
 * Correr con: npm run medir-rendimiento
 */
import { StaticCanvas } from 'fabric';
import { crearObjetoFabric } from '../src/editor/objetosFabric';
import type { Elemento } from '../src/editor/elemento';

(globalThis as any).document ??= { fonts: { load: async () => [] } };

const ANCHO = 595;
const ALTO = 842;

function elementosDePrueba(cantidad: number): Elemento[] {
  const elementos: Elemento[] = [];
  for (let i = 0; i < cantidad; i++) {
    const x = 20 + (i % 8) * 68;
    const y = 20 + Math.floor(i / 8) * 26;
    // Mezcla parecida a un recibo real: mucho texto y campo, algunas líneas y recuadros.
    switch (i % 5) {
      case 0:
      case 1:
        elementos.push({ clase: 'texto', id: i, x, y, angulo: 0, vertical: false, separacion: 0, multilinea: false, text: `Etiqueta ${i}`, size: 9, familia: 'Helvetica', negrita: false, cursiva: false, subrayado: false, color: '#111111', align: 'left' });
        break;
      case 2:
      case 3:
        elementos.push({
          clase: 'campo',
          id: i,
          name: `campo_${i}`,
          x,
          y,
          angulo: 0,
          w: 60,
          h: 14,
          tipo: 'Texto',
          size: 8,
          familia: 'Helvetica',
          negrita: false,
          cursiva: false,
          subrayado: false,
          color: '#000000',
          align: 'left',
          invisible: false,
          readonly: false,
          multilinea: false,
          repComodin: '#',
          repFilas: 1,
          repSep: 0,
          defaultValue: '',
          bordeGrosor: 0,
          bordeColor: '#000000',
          conFondo: false,
          fondoColor: '#ffffff',
        });
        break;
      default:
        elementos.push({ clase: 'linea', id: i, x, y, w: 60, h: 1, angulo: 0, color: '#111111', estilo: 'solido' });
    }
  }
  return elementos;
}

async function medir(cantidad: number): Promise<void> {
  const elementos = elementosDePrueba(cantidad);

  const inicioArmado = performance.now();
  const lienzo = new StaticCanvas(undefined, { width: ANCHO, height: ALTO });
  lienzo.backgroundColor = '#ffffff';
  for (const elemento of elementos) lienzo.add(await crearObjetoFabric(elemento));
  const armado = performance.now() - inicioArmado;

  const inicioPrimerDibujo = performance.now();
  lienzo.renderAll();
  const primerDibujo = performance.now() - inicioPrimerDibujo;

  // Redibujar es lo que pasa en cada movimiento del mouse: es el número que se siente.
  const vueltas = 20;
  const inicioRedibujo = performance.now();
  for (let i = 0; i < vueltas; i++) lienzo.renderAll();
  const redibujo = (performance.now() - inicioRedibujo) / vueltas;

  console.log(
    `${String(cantidad).padStart(4)} elementos   armar ${armado.toFixed(0).padStart(5)} ms   ` +
      `primer dibujo ${primerDibujo.toFixed(1).padStart(6)} ms   redibujo ${redibujo.toFixed(1).padStart(5)} ms  ` +
      `(${(1000 / redibujo).toFixed(0)} cuadros por segundo)`
  );
}

console.log('Rendimiento del lienzo con documentos grandes. Una hoja A4 llena entrada tiene ~200 elementos.\n');
for (const cantidad of [50, 200, 500, 1000]) await medir(cantidad);
console.log('\nRedibujo es lo que se siente al arrastrar: por debajo de ~16 ms se ve fluido (60 cuadros por segundo).');

import type { Canvas } from 'fabric';
import type { Elemento } from './elemento';
import { establecerHojas, hojaActual, hojasDelDocumento } from './documento';

/**
 * Cada paso guarda el documento entero —todas las hojas y cuál se estaba viendo— y no solo lo que
 * hay en el lienzo. Es lo que hace que deshacer alcance también a las operaciones de hoja: sin
 * esto, borrar una hoja con diez elementos sería lo único del editor que no se puede deshacer.
 */
interface Instantanea {
  hojas: Elemento[][];
  actual: number;
}

let hist: Instantanea[] = [];
let hi = -1;
let restaurando = false;

function clonar(lienzo: Canvas): Instantanea {
  return {
    hojas: JSON.parse(JSON.stringify(hojasDelDocumento(lienzo))),
    actual: hojaActual(),
  };
}

export function inicializarHistorial(lienzo: Canvas): void {
  hist = [clonar(lienzo)];
  hi = 0;
}

/** Registrar el estado actual como un paso nuevo del historial — llamar después de cada acción
 * estructural (crear, borrar, duplicar, mover/redimensionar, reordenar capas, y las de hoja). Los
 * cambios de propiedades en vivo (tipear, arrastrar un color) no generan un paso propio, igual que
 * en el editor público. */
export function registrarSnapshot(lienzo: Canvas): void {
  if (restaurando) return;
  hist = hist.slice(0, hi + 1);
  hist.push(clonar(lienzo));
  hi = hist.length - 1;
}

async function restaurar(lienzo: Canvas, paso: Instantanea): Promise<void> {
  restaurando = true;
  // Se clona al restaurar: si no, el historial entregaría sus propias listas y editar el lienzo
  // terminaría cambiando el paso guardado.
  await establecerHojas(lienzo, JSON.parse(JSON.stringify(paso.hojas)), paso.actual);
  restaurando = false;
}

export async function deshacer(lienzo: Canvas): Promise<void> {
  if (hi <= 0) return;
  hi -= 1;
  await restaurar(lienzo, hist[hi]);
}

export async function rehacer(lienzo: Canvas): Promise<void> {
  if (hi >= hist.length - 1) return;
  hi += 1;
  await restaurar(lienzo, hist[hi]);
}

export function puedeDeshacer(): boolean {
  return hi > 0;
}

export function puedeRehacer(): boolean {
  return hi < hist.length - 1;
}

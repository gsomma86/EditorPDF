import type { Canvas } from 'fabric';
import { elementoDe, reconstruirLienzo } from './objetosFabric';
import type { Elemento } from './elemento';

let hist: Elemento[][] = [];
let hi = -1;
let restaurando = false;

function estadoActual(lienzo: Canvas): Elemento[] {
  return lienzo
    .getObjects()
    .map((o) => elementoDe(o))
    .filter((e): e is Elemento => !!e);
}

function clonar(lista: Elemento[]): Elemento[] {
  return JSON.parse(JSON.stringify(lista));
}

export function inicializarHistorial(lienzo: Canvas): void {
  hist = [clonar(estadoActual(lienzo))];
  hi = 0;
}

/** Registrar el estado actual como un paso nuevo del historial — llamar después de cada acción
 * estructural (crear, borrar, duplicar, mover/redimensionar, reordenar capas). Los cambios de
 * propiedades en vivo (tipear, arrastrar un color) no generan un paso propio, igual que en el
 * editor público. */
export function registrarSnapshot(lienzo: Canvas): void {
  if (restaurando) return;
  hist = hist.slice(0, hi + 1);
  hist.push(clonar(estadoActual(lienzo)));
  hi = hist.length - 1;
}

export async function deshacer(lienzo: Canvas): Promise<void> {
  if (hi <= 0) return;
  hi -= 1;
  restaurando = true;
  await reconstruirLienzo(lienzo, hist[hi]);
  restaurando = false;
}

export async function rehacer(lienzo: Canvas): Promise<void> {
  if (hi >= hist.length - 1) return;
  hi += 1;
  restaurando = true;
  await reconstruirLienzo(lienzo, hist[hi]);
  restaurando = false;
}

export function puedeDeshacer(): boolean {
  return hi > 0;
}

export function puedeRehacer(): boolean {
  return hi < hist.length - 1;
}

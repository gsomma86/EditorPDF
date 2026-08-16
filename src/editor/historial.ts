import type { Canvas } from 'fabric';
import type { Elemento } from './elemento';
import { capasDelDocumento, establecerCapas, establecerHojas, hojaActual, hojasDelDocumento, type Capa } from './documento';

/**
 * Cada paso guarda el documento entero —todas las hojas, cuál se estaba viendo y las capas— y no
 * solo lo que hay en el lienzo. Es lo que hace que deshacer alcance también a las operaciones de
 * hoja: sin esto, borrar una hoja con diez elementos sería lo único del editor que no se puede
 * deshacer.
 *
 * Las capas entran por lo mismo: un elemento anota su capa por id, así que un paso que restaure los
 * elementos sin restaurar las capas los dejaría apuntando a una que ya no existe. Y desde que se
 * pueden reordenar, el orden de las capas y el apilado de los objetos tienen que volver juntos o el
 * documento queda contándose dos historias distintas.
 */
interface Instantanea {
  hojas: Elemento[][];
  actual: number;
  capas: Capa[];
}

let hist: Instantanea[] = [];
let hi = -1;
let restaurando = false;

function clonar(lienzo: Canvas): Instantanea {
  return {
    hojas: JSON.parse(JSON.stringify(hojasDelDocumento(lienzo))),
    actual: hojaActual(),
    capas: JSON.parse(JSON.stringify(capasDelDocumento())),
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
  // Las capas primero: los objetos se arman mirando si la suya está apagada o trabada, así que con
  // las capas viejas todavía puestas nacerían con las marcas equivocadas.
  establecerCapas(JSON.parse(JSON.stringify(paso.capas)));
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

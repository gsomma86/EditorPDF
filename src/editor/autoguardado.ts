import type { Canvas } from 'fabric';
import { cargarProyecto, leerProyecto, serializarProyecto, type Proyecto } from './proyecto';

const CLAVE = 'editorpdf.autoguardado';
const ESPERA_MS = 800;

let temporizador: number | undefined;

/** Guarda en este navegador con un respiro, para no escribir en cada tecla. */
export function programarAutoguardado(lienzo: Canvas, campos: () => string[]): void {
  clearTimeout(temporizador);
  temporizador = window.setTimeout(() => {
    try {
      localStorage.setItem(CLAVE, JSON.stringify(serializarProyecto(lienzo, campos())));
    } catch {
      // Sin espacio o en modo privado: no vale la pena molestar al usuario por esto.
    }
  }, ESPERA_MS);
}

export function hayAutoguardado(): boolean {
  return !!localStorage.getItem(CLAVE);
}

export function leerAutoguardado(): Proyecto | null {
  const texto = localStorage.getItem(CLAVE);
  if (!texto) return null;
  try {
    return leerProyecto(texto);
  } catch {
    return null;
  }
}

export function borrarAutoguardado(): void {
  localStorage.removeItem(CLAVE);
}

export async function restaurarAutoguardado(lienzo: Canvas): Promise<Proyecto | null> {
  const proyecto = leerAutoguardado();
  if (!proyecto) return null;
  await cargarProyecto(lienzo, proyecto);
  return proyecto;
}

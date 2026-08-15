/**
 * Guarda el PDF de base entre sesiones.
 *
 * Va en IndexedDB y no en localStorage, que es donde vive el autoguardado del diseño: localStorage
 * tiene un tope de unos 5 MB, guarda solo texto —así que un PDF habría que pasarlo a base64 y
 * crecería un tercio— y encima le competiría el lugar al diseño. IndexedDB guarda bytes tal cual y
 * sin ese techo.
 */

const BASE = 'editorpdf';
const ALMACEN = 'pdf';
const CLAVE = 'base';

function abrir(): Promise<IDBDatabase> {
  return new Promise((resolve, rechazar) => {
    const pedido = indexedDB.open(BASE, 1);
    pedido.onupgradeneeded = () => pedido.result.createObjectStore(ALMACEN);
    pedido.onsuccess = () => resolve(pedido.result);
    pedido.onerror = () => rechazar(pedido.error);
  });
}

/** Cualquier problema de almacenamiento se traga: no vale perder la sesión por esto. */
async function conAlmacen<T>(modo: IDBTransactionMode, accion: (almacen: IDBObjectStore) => IDBRequest): Promise<T | null> {
  try {
    const base = await abrir();
    return await new Promise<T | null>((resolve) => {
      const transaccion = base.transaction(ALMACEN, modo);
      const pedido = accion(transaccion.objectStore(ALMACEN));
      pedido.onsuccess = () => resolve((pedido.result as T) ?? null);
      pedido.onerror = () => resolve(null);
      transaccion.oncomplete = () => base.close();
    });
  } catch {
    return null;
  }
}

export interface PdfGuardado {
  bytes: Uint8Array;
  /** Sobre qué página se estaba trabajando: sin esto, al recargar se volvía siempre a la primera. */
  pagina: number;
}

export async function guardarPdfBase(bytes: Uint8Array, pagina: number): Promise<void> {
  await conAlmacen('readwrite', (almacen) => almacen.put({ bytes, pagina }, CLAVE));
}

export async function leerPdfBase(): Promise<PdfGuardado | null> {
  const guardado = await conAlmacen<PdfGuardado | Uint8Array>('readonly', (almacen) => almacen.get(CLAVE));
  if (!guardado) return null;
  // Las sesiones anteriores guardaban solo los bytes, sin la página.
  if (guardado instanceof Uint8Array) return { bytes: guardado, pagina: 0 };
  return { bytes: new Uint8Array(guardado.bytes), pagina: guardado.pagina ?? 0 };
}

export async function borrarPdfBase(): Promise<void> {
  await conAlmacen('readwrite', (almacen) => almacen.delete(CLAVE));
}

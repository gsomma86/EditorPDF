/**
 * Reemplaza a `editor/almacenPdf` en las pruebas headless: guarda en IndexedDB, que no existe en
 * Node. Lo que se prueba es el recorrido de importar y exportar, no la persistencia, así que
 * alcanza con recordarlo en memoria.
 */
let guardado: { bytes: Uint8Array; pagina: number } | null = null;

export async function guardarPdfBase(bytes: Uint8Array, pagina: number): Promise<void> {
  guardado = { bytes, pagina };
}

export async function leerPdfBase(): Promise<{ bytes: Uint8Array; pagina: number } | null> {
  return guardado;
}

export async function borrarPdfBase(): Promise<void> {
  guardado = null;
}

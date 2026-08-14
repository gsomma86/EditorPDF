/**
 * Catálogo de campos en CSV. El editor público usa los encabezados de un CSV para sugerir campos,
 * así que se lee la primera fila; si el archivo tiene una sola columna, se toma toda la columna.
 */

function separador(linea: string): string {
  return (linea.match(/;/g)?.length ?? 0) > (linea.match(/,/g)?.length ?? 0) ? ';' : ',';
}

function limpiar(valor: string): string {
  return valor.trim().replace(/^"(.*)"$/s, '$1').trim();
}

export function camposDesdeCsv(texto: string): string[] {
  const lineas = texto.split(/\r?\n/).filter((l) => l.trim());
  if (!lineas.length) return [];

  const sep = separador(lineas[0]);
  const encabezados = lineas[0].split(sep).map(limpiar).filter(Boolean);

  // Una sola columna: el catálogo es la columna entera, no solo su encabezado.
  if (encabezados.length <= 1) {
    return [...new Set(lineas.map(limpiar).filter(Boolean))];
  }
  return [...new Set(encabezados)];
}

export function csvDesdeCampos(campos: string[]): string {
  return campos.map((c) => (/[",;\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(';');
}

export function descargarCsv(texto: string, nombre: string): void {
  const limpio = nombre.trim().replace(/[\\/:*?"<>|]/g, '') || 'campos';
  // El BOM hace que Excel abra bien los acentos.
  const blob = new Blob(['﻿' + texto], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = `${limpio}.csv`;
  enlace.click();
  URL.revokeObjectURL(url);
}

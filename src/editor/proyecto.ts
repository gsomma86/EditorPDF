import type { Canvas } from 'fabric';
import { reservarIds, type Elemento } from './elemento';
import { elementoDe, reconstruirLienzo } from './objetosFabric';
import { aplicarConfigPagina, configActual } from './documento';
import { configPorDefecto, type ConfigPagina } from './pagina';

/** Formato del archivo .json. La versión permite migrar proyectos viejos más adelante. */
export interface Proyecto {
  version: 1;
  pagina: ConfigPagina;
  elementos: Elemento[];
  campos: string[];
}

export function serializarProyecto(lienzo: Canvas, campos: string[]): Proyecto {
  const elementos = lienzo
    .getObjects()
    .map((o) => elementoDe(o))
    .filter((e): e is Elemento => !!e);

  return {
    version: 1,
    pagina: JSON.parse(JSON.stringify(configActual())),
    elementos: JSON.parse(JSON.stringify(elementos)),
    campos: [...campos],
  };
}

export function descargarProyecto(proyecto: Proyecto, nombre: string): void {
  const limpio = nombre.trim().replace(/[\\/:*?"<>|]/g, '') || 'proyecto';
  const blob = new Blob([JSON.stringify(proyecto, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = `${limpio}.json`;
  enlace.click();
  URL.revokeObjectURL(url);
}

export function leerProyecto(texto: string): Proyecto {
  const datos = JSON.parse(texto) as Partial<Proyecto>;
  if (!Array.isArray(datos.elementos)) {
    throw new Error('El archivo no parece un proyecto de EditorPDF: no tiene elementos.');
  }
  return {
    version: 1,
    pagina: datos.pagina ?? configPorDefecto(),
    elementos: datos.elementos,
    campos: Array.isArray(datos.campos) ? datos.campos : [],
  };
}

export async function cargarProyecto(lienzo: Canvas, proyecto: Proyecto): Promise<void> {
  aplicarConfigPagina(lienzo, proyecto.pagina);
  reservarIds(proyecto.elementos);
  await reconstruirLienzo(lienzo, proyecto.elementos);
}

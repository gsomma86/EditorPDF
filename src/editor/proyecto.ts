import type { Canvas } from 'fabric';
import { reservarIds, type Elemento } from './elemento';

import { aplicarConfigPagina, configActual, establecerHojas, hojaActual, hojasDelDocumento } from './documento';
import { configPorDefecto, type ConfigPagina } from './pagina';
import { asentarPdf, bytesDelPdf, cerrarPdf, paginaDelPdf } from './pdfExistente';

/** Formato del archivo .json. La versión permite migrar proyectos viejos más adelante. */
export interface Proyecto {
  version: 1;
  pagina: ConfigPagina;
  /**
   * Las hojas del documento, cada una con sus elementos. Los proyectos anteriores a multipágina
   * traen solo `elementos`: al leerlos, eso se convierte en una hoja única.
   */
  hojas?: Elemento[][];
  /** La primera hoja. Se sigue escribiendo para que un proyecto nuevo se pueda abrir en una version anterior. */
  elementos: Elemento[];
  /** En que hoja se estaba trabajando. */
  hoja?: number;
  campos: string[];
  /**
   * El PDF sobre el que se está trabajando, en base64. Solo viaja en el archivo que se descarga,
   * para que el proyecto sea completo y se pueda seguir en otra computadora; el autoguardado no
   * lo incluye, porque localStorage no aguanta un PDF (ver `almacenPdf.ts`).
   */
  pdfBase?: string | null;
  /** Sobre qué página del PDF estaba puesto el diseño. */
  pdfPagina?: number;
}

function aBase64(bytes: Uint8Array): string {
  // De a pedazos: pasarle un array enorme a String.fromCharCode desborda la pila.
  let texto = '';
  for (let i = 0; i < bytes.length; i += 8192) {
    texto += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return btoa(texto);
}

function desdeBase64(texto: string): Uint8Array {
  const crudo = atob(texto);
  const bytes = new Uint8Array(crudo.length);
  for (let i = 0; i < crudo.length; i++) bytes[i] = crudo.charCodeAt(i);
  return bytes;
}

export function serializarProyecto(lienzo: Canvas, campos: string[], conPdf = false): Proyecto {
  // `hojasDelDocumento` vuelca primero lo que hay en el lienzo, que es la hoja que se está editando.
  const hojas: Elemento[][] = JSON.parse(JSON.stringify(hojasDelDocumento(lienzo)));
  const pdf = conPdf ? bytesDelPdf() : null;

  return {
    version: 1,
    pagina: JSON.parse(JSON.stringify(configActual())),
    hojas,
    elementos: hojas[0] ?? [],
    hoja: hojaActual(),
    campos: [...campos],
    pdfBase: pdf ? aBase64(pdf) : null,
    pdfPagina: paginaDelPdf(),
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

/**
 * Completa las propiedades que se fueron sumando al modelo después de las primeras versiones: un
 * proyecto viejo no las trae y sin esto quedarían en undefined, que Fabric interpreta como NaN y
 * hace desaparecer el objeto. Al agregar una propiedad nueva al modelo, completarla también acá.
 */
function alDia(elemento: Elemento): Elemento {
  return {
    ...elemento,
    angulo: elemento.angulo ?? 0,
    ...(elemento.clase === 'texto' ? { vertical: elemento.vertical ?? false, separacion: elemento.separacion ?? 0, multilinea: elemento.multilinea ?? false } : {}),
    ...(elemento.clase === 'campo'
      ? { multilinea: elemento.multilinea ?? false, repComodin: elemento.repComodin ?? '#', repFilas: elemento.repFilas ?? 1, repSep: elemento.repSep ?? 0 }
      : {}),
  };
}

export function leerProyecto(texto: string): Proyecto {
  const datos = JSON.parse(texto) as Partial<Proyecto>;
  if (!Array.isArray(datos.elementos) && !Array.isArray(datos.hojas)) {
    throw new Error('El archivo no parece un proyecto de EditorPDF: no tiene elementos.');
  }
  // Un proyecto anterior a multipágina trae una sola lista de elementos: es su hoja única.
  const hojas = (Array.isArray(datos.hojas) && datos.hojas.length ? datos.hojas : [datos.elementos ?? []]).map((hoja) => hoja.map(alDia));

  return {
    version: 1,
    pagina: datos.pagina ?? configPorDefecto(),
    hojas,
    elementos: hojas[0],
    hoja: Math.min(Math.max(0, datos.hoja ?? 0), hojas.length - 1),
    campos: Array.isArray(datos.campos) ? datos.campos : [],
    pdfBase: datos.pdfBase ?? null,
    pdfPagina: datos.pdfPagina ?? 0,
  };
}

/**
 * `conservarPdf` es para el autoguardado: su proyecto nunca trae el PDF —vive aparte, en
 * IndexedDB, porque localStorage no lo aguanta— así que soltarlo ahí lo borraría justo antes de
 * recuperarlo. Al importar un `.json`, en cambio, sí corresponde soltar el que hubiera abierto:
 * era de otro trabajo.
 */
export async function cargarProyecto(lienzo: Canvas, proyecto: Proyecto, conservarPdf = false): Promise<void> {
  aplicarConfigPagina(lienzo, proyecto.pagina);
  const hojas = proyecto.hojas ?? [proyecto.elementos];
  reservarIds(hojas.flat());
  await establecerHojas(lienzo, hojas, proyecto.hoja ?? 0);

  if (proyecto.pdfBase) {
    await asentarPdf(desdeBase64(proyecto.pdfBase), proyecto.pdfPagina ?? 0);
  } else if (!conservarPdf) {
    cerrarPdf();
  }
}

import type { Canvas } from 'fabric';
import { reservarIds, type Elemento } from './elemento';

import {
  aplicarConfigPagina,
  capaDelContenidoDelPdf,
  capasDelDocumento,
  capasSobreElFondoDelDocumento,
  CAPA_CONTENIDO_PDF,
  configActual,
  establecerCapas,
  establecerCapasSobreElFondo,
  establecerHojas,
  hojaActual,
  hojasDelDocumento,
  type Capa,
  type Hoja,
} from './documento';
import { configPorDefecto, type ConfigPagina } from './pagina';
import { asentarPdf, bytesDelPdf, cerrarPdf } from './pdfExistente';

/** Formato del archivo .json. La versión permite migrar proyectos viejos más adelante. */
export interface Proyecto {
  version: 1;
  pagina: ConfigPagina;
  /**
   * Las hojas del documento, cada una con sus elementos, su fondo y de qué página del PDF viene.
   * Los proyectos anteriores a multipágina traen solo `elementos`, y los anteriores a que el fondo
   * fuera de cada hoja traen listas de elementos sueltas: `leerProyecto` convierte los dos casos.
   */
  hojas?: (Hoja | Elemento[])[];
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
  /**
   * Sobre qué página del PDF estaba puesto el diseño. Ya no se escribe —cada hoja se acuerda de su
   * página— pero se sigue leyendo para abrir proyectos hechos antes de ese cambio.
   */
  pdfPagina?: number;
  /** Las capas del documento. Un proyecto anterior a capas no las trae y se abre con una sola. */
  capas?: Capa[];
  /**
   * Cuántas capas van delante de la página del PDF. Un proyecto anterior al apilado único no lo
   * trae: se deduce de los elementos marcados `debajoDeLaPagina`, que era como se decía antes.
   */
  capasSobreElFondo?: number;
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
  const hojas: Hoja[] = JSON.parse(JSON.stringify(hojasDelDocumento(lienzo)));
  const pdf = conPdf ? bytesDelPdf() : null;

  return {
    version: 1,
    pagina: JSON.parse(JSON.stringify(configActual())),
    hojas,
    elementos: hojas[0]?.elementos ?? [],
    hoja: hojaActual(),
    campos: [...campos],
    capas: JSON.parse(JSON.stringify(capasDelDocumento())),
    capasSobreElFondo: capasSobreElFondoDelDocumento(),
    pdfBase: pdf ? aBase64(pdf) : null,
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
  // La descarga es asincrónica: el clic la larga y el navegador lee el blob después. Soltando la
  // URL en la misma vuelta se le puede sacar el contenido antes de que lo lea, y el archivo sale
  // vacío o no sale. Se le da tiempo antes de liberarla.
  setTimeout(() => URL.revokeObjectURL(url), 30000);
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
  const crudas = Array.isArray(datos.hojas) && datos.hojas.length ? datos.hojas : [datos.elementos ?? []];

  // El fondo de un proyecto viejo era del documento entero y el diseño estaba puesto sobre una sola
  // página del PDF: esa hoja se queda con las dos cosas y las demás, que no existían, no aplican.
  const fondoViejo = (datos.pagina as { fondo?: string | null } | undefined)?.fondo ?? null;
  // El tamaño también era del documento: un proyecto viejo se abre con todas sus hojas de ese
  // tamaño, que es exactamente como se veía cuando se guardó.
  const base = datos.pagina ?? configPorDefecto();
  const tamanoViejo = { tamano: base.tamano, orientacion: base.orientacion, medidas: base.medidas ?? null };

  const hojas: Hoja[] = crudas.map((hoja, i) =>
    Array.isArray(hoja)
      ? { elementos: hoja.map(alDia), paginaPdf: datos.pdfBase ? (datos.pdfPagina ?? 0) + i : null, fondo: datos.pdfBase ? null : fondoViejo, ...tamanoViejo }
      : {
          elementos: (hoja.elementos ?? []).map(alDia),
          paginaPdf: hoja.paginaPdf ?? null,
          fondo: hoja.fondo ?? null,
          tamano: hoja.tamano ?? tamanoViejo.tamano,
          orientacion: hoja.orientacion ?? tamanoViejo.orientacion,
          medidas: hoja.medidas ?? tamanoViejo.medidas,
        }
  );

  return {
    version: 1,
    pagina: datos.pagina ?? configPorDefecto(),
    hojas,
    elementos: hojas[0].elementos,
    hoja: Math.min(Math.max(0, datos.hoja ?? 0), hojas.length - 1),
    campos: Array.isArray(datos.campos) ? datos.campos : [],
    capas: Array.isArray(datos.capas) && datos.capas.length ? datos.capas : undefined,
    capasSobreElFondo: typeof datos.capasSobreElFondo === 'number' ? datos.capasSobreElFondo : undefined,
    pdfBase: datos.pdfBase ?? null,
    pdfPagina: datos.pdfPagina ?? 0,
  };
}

/**
 * Trae al modelo nuevo los proyectos guardados cuando "ir debajo de la página" era una marca de
 * cada elemento (`debajoDeLaPagina`) en vez del lugar de su capa en el apilado.
 *
 * Los marcados se mudan a la capa "Contenido del PDF", que queda detrás del fondo, y así se siguen
 * viendo igual que antes. Sin esto, un proyecto viejo con formas convertidas las mostraría de golpe
 * **encima** de la página, tapando el texto que antes las cubría.
 */
function migrarDebajoDeLaPagina(hojas: Hoja[], proyecto: Proyecto): void {
  const marcados = hojas.flatMap((hoja) => hoja.elementos).filter((e) => (e as { debajoDeLaPagina?: boolean }).debajoDeLaPagina);
  if (marcados.length) {
    const capa = capaDelContenidoDelPdf();
    for (const elemento of marcados) {
      elemento.capa = capa.id;
      delete (elemento as { debajoDeLaPagina?: boolean }).debajoDeLaPagina;
    }
  }

  // Un proyecto que ya trae el dato manda; uno viejo deja la página detrás de todas las capas menos
  // la del contenido, que es donde acaban de caer los elementos migrados.
  const capas = capasDelDocumento();
  if (typeof proyecto.capasSobreElFondo === 'number') {
    establecerCapasSobreElFondo(proyecto.capasSobreElFondo);
  } else {
    const contenido = capas.findIndex((c) => c.id === CAPA_CONTENIDO_PDF);
    establecerCapasSobreElFondo(contenido >= 0 ? contenido : capas.length);
  }
}

/**
 * `conservarPdf` es para el autoguardado: su proyecto nunca trae el PDF —vive aparte, en
 * IndexedDB, porque localStorage no lo aguanta— así que soltarlo ahí lo borraría justo antes de
 * recuperarlo. Al importar un `.json`, en cambio, sí corresponde soltar el que hubiera abierto:
 * era de otro trabajo.
 */
export async function cargarProyecto(lienzo: Canvas, proyecto: Proyecto, conservarPdf = false): Promise<void> {
  aplicarConfigPagina(lienzo, proyecto.pagina);
  // Antes de las hojas: los objetos se dibujan mirando si su capa esta visible o bloqueada.
  establecerCapas(proyecto.capas ?? []);
  // `leerProyecto` ya dejó las hojas con su forma nueva; el `?? []` es para quien arme un Proyecto
  // a mano (los arneses de prueba) sin pasar por él.
  const deLaPagina = { tamano: proyecto.pagina.tamano, orientacion: proyecto.pagina.orientacion, medidas: proyecto.pagina.medidas };
  const hojas: Hoja[] = (proyecto.hojas ?? []).map((hoja) =>
    Array.isArray(hoja) ? { elementos: hoja, paginaPdf: null, fondo: null, ...deLaPagina } : hoja
  );
  const conElementos = hojas.length ? hojas : [{ elementos: proyecto.elementos, paginaPdf: null, fondo: null, ...deLaPagina }];
  reservarIds(conElementos.flatMap((hoja) => hoja.elementos));
  migrarDebajoDeLaPagina(conElementos, proyecto);

  // El PDF primero: las hojas se dibujan pidiéndole sus páginas, así que si no está abierto todavía
  // saldrían todas en blanco.
  if (proyecto.pdfBase) {
    await asentarPdf(desdeBase64(proyecto.pdfBase), conElementos[proyecto.hoja ?? 0]?.paginaPdf ?? 0);
  } else if (!conservarPdf) {
    cerrarPdf();
  }

  await establecerHojas(lienzo, conElementos, proyecto.hoja ?? 0);
}

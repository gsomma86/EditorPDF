import './style.css';
import { montarEspacioTrabajo } from './ui/shell';
import { crearLienzo } from './editor/lienzo';
import { crearElemento, crearElementoCampo, crearElementoImagen, crearElementoTabla, duplicarElemento, type ClaseSimple, type Elemento } from './editor/elemento';
import { activarModoCompletar, agregarAlLienzo, elementoDe, reconstruirLienzo, sincronizarGeometria } from './editor/objetosFabric';
import { escapeHtml, mostrarMultiSeleccion, mostrarPropiedades, mostrarSinSeleccion } from './ui/panelPropiedades';
import { ActiveSelection, type FabricObject } from 'fabric';
import { borrarAutoguardado, hayAutoguardado, programarAutoguardado, restaurarAutoguardado } from './editor/autoguardado';
import { camposDesdeCsv, csvDesdeCampos, descargarCsv } from './editor/csvCampos';
import { confirmar, mostrarAyuda, mostrarPreflight, pedirExportarPdf, pedirFilasColumnas, pedirMargenes, pedirNombreArchivo, pedirNuevoProyecto } from './ui/modales';
import { formatearPeso, pesoDelPdf, verificarDiseno } from './editor/preflight';
import { montarPanelCampos } from './ui/panelCampos';
import { cablearAyuda } from './ui/ayuda';
import { montarColumnas } from './ui/columnas';
import { deshacer, inicializarHistorial, puedeDeshacer, puedeRehacer, registrarSnapshot, rehacer } from './editor/historial';
import { t, type ClaveI18n } from './ui/i18n';
import { aplicarConfigPagina, configActual } from './editor/documento';
import { activarVista, configurarVista, establecerZoom, vistaActual } from './editor/vista';
import { configPorDefecto, tamanoParecido, type Orientacion, type TamanoPagina } from './editor/pagina';
import { cargarProyecto, descargarProyecto, leerProyecto, serializarProyecto } from './editor/proyecto';

const raiz = document.querySelector<HTMLDivElement>('#app')!;
const espacio = montarEspacioTrabajo(raiz);
const lienzo = crearLienzo(espacio.lienzoCont);
const panelCampos = montarPanelCampos(espacio.panelCampos, async (nombre) => {
  const elemento = crearElementoCampo(nombre);
  await agregarAlLienzo(lienzo, elemento);
  registrarSnapshot(lienzo);
  guardar();
});
const ayuda = cablearAyuda();
montarColumnas(espacio.raiz);
activarVista(lienzo);
aplicarConfigPagina(lienzo, configPorDefecto());
inicializarHistorial(lienzo);

function actualizarEscaladoUniforme(objeto: import('fabric').FabricObject): void {
  const elemento = elementoDe(objeto);
  lienzo.uniformScaling = elemento?.clase === 'imagen' ? elemento.proporcion : true;
}

function guardar(): void {
  programarAutoguardado(lienzo, panelCampos.obtenerCatalogo);
  programarPeso();
}

/**
 * Lo que se cambia desde el panel de propiedades no pasa por ningún evento del lienzo, así que
 * sin esto no se autoguardaba nada: al recargar se perdían el color, la alineación, la separación
 * entre letras y todo lo demás. Se escucha en el panel porque input/change/click burbujean: vale
 * para todos sus controles y para los que se agreguen después, sin avisar en cada handler.
 * No registra un paso en el historial: tipear o arrastrar un color no genera uno, igual que en el
 * editor público (ver `registrarSnapshot`).
 */
for (const evento of ['input', 'change', 'click']) {
  espacio.panelPropiedades.addEventListener(evento, () => guardar());
}

let temporizadorPeso: number | undefined;
let generacionPeso = 0;

/**
 * Recalcula el peso del PDF después de cada cambio, pero con un respiro como el autoguardado:
 * generarlo de verdad no es gratis y en una ráfaga de cambios solo interesa el último. El
 * contador de generación descarta las respuestas que llegan fuera de orden.
 */
function programarPeso(): void {
  const boton = document.getElementById('ed-peso-btn');
  if (!boton) return;
  // Se saca data-i18n: el texto pasa a tener un valor calculado (o un error) que ese atributo no
  // puede representar, así que de acá en más lo mantiene este código y no el barrido de idioma.
  boton.removeAttribute('data-i18n');
  clearTimeout(temporizadorPeso);
  boton.textContent = t('shell.status.pesoCalculando');
  temporizadorPeso = window.setTimeout(async () => {
    const generacion = ++generacionPeso;
    try {
      const peso = formatearPeso(await pesoDelPdf(lienzo));
      if (generacion === generacionPeso) boton.textContent = t('shell.status.pesoValor', { peso });
    } catch {
      if (generacion === generacionPeso) boton.textContent = t('shell.status.pesoError');
    }
  }, 800);
}

/** Vuelve a seleccionar un conjunto tras una acción de grupo, o limpia si quedó vacío. */
function reseleccionar(objetos: FabricObject[]): void {
  registrarSnapshot(lienzo);
  guardar();
  if (!objetos.length) {
    lienzo.discardActiveObject();
    lienzo.requestRenderAll();
    mostrarSinSeleccion(espacio.panelPropiedades);
    return;
  }
  if (objetos.length === 1) {
    lienzo.setActiveObject(objetos[0]);
  } else {
    lienzo.setActiveObject(new ActiveSelection(objetos, { canvas: lienzo }));
  }
  lienzo.requestRenderAll();
}

function alSeleccionar(e: { selected?: FabricObject[] }): void {
  const seleccion = e.selected ?? [];
  const activo = lienzo.getActiveObject();
  const varios = activo instanceof ActiveSelection ? activo.getObjects() : seleccion;

  if (varios.length > 1) {
    mostrarMultiSeleccion(espacio.panelPropiedades, lienzo, varios, reseleccionar);
    return;
  }
  const objeto = varios[0];
  if (objeto) {
    mostrarPropiedades(espacio.panelPropiedades, lienzo, objeto);
    actualizarEscaladoUniforme(objeto);
  }
}

/**
 * Agregar o sacar objetos también es un cambio que hay que guardar. Hace falta porque hay caminos
 * que no pasan por el panel ni por `object:modified`: por ejemplo hacer repetible un campo, donde
 * el clic del botón ocurre antes de confirmar el modal y después ya no hay ningún evento.
 */
lienzo.on('object:added', () => guardar());
lienzo.on('object:removed', () => guardar());

lienzo.on('selection:created', alSeleccionar);
lienzo.on('selection:updated', alSeleccionar);
lienzo.on('selection:cleared', () => {
  mostrarSinSeleccion(espacio.panelPropiedades);
});

lienzo.on('object:modified', async (e) => {
  const objeto = e.target;
  if (!objeto) return;

  // Al mover varios juntos, las posiciones de cada uno son relativas al grupo: hay que deshacer
  // la selección para que Fabric escriba las absolutas, sincronizar y volver a armarla.
  if (objeto instanceof ActiveSelection) {
    const hijos = objeto.getObjects();
    lienzo.discardActiveObject();
    // Sincronizar puede devolver OTRO objeto: un campo se reconstruye cuando cambia de tamaño, y
    // moverlo dentro de una selección le deja escala. Hay que quedarse con el objeto vigente; si
    // se rearma la selección con el viejo, el que se acababa de sacar del lienzo vuelve y queda
    // duplicado en cada movimiento.
    const vigentes: FabricObject[] = [];
    for (const hijo of hijos) vigentes.push(await sincronizarGeometria(lienzo, hijo));
    lienzo.setActiveObject(new ActiveSelection(vigentes, { canvas: lienzo }));
    lienzo.requestRenderAll();
    registrarSnapshot(lienzo);
    guardar();
    return;
  }

  const vigente = await sincronizarGeometria(lienzo, objeto);
  lienzo.requestRenderAll();
  if (lienzo.getActiveObject() === vigente && elementoDe(vigente)) {
    mostrarPropiedades(espacio.panelPropiedades, lienzo, vigente);
  }
  registrarSnapshot(lienzo);
  guardar();
});

const SIMPLES: ClaseSimple[] = ['texto', 'linea', 'rect', 'qr'];

const inputImagen = document.createElement('input');
inputImagen.type = 'file';
inputImagen.accept = 'image/png,image/jpeg';
inputImagen.style.display = 'none';
document.body.appendChild(inputImagen);

inputImagen.addEventListener('change', async () => {
  const archivo = inputImagen.files?.[0];
  if (!archivo) return;
  const src = await new Promise<string>((resolve) => {
    const lector = new FileReader();
    lector.onload = () => resolve(lector.result as string);
    lector.readAsDataURL(archivo);
  });
  const dimensiones = await new Promise<{ ancho: number; alto: number }>((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ ancho: img.naturalWidth || 1, alto: img.naturalHeight || 1 });
    img.src = src;
  });
  const elemento = crearElementoImagen(src, dimensiones.ancho, dimensiones.alto);
  await agregarAlLienzo(lienzo, elemento);
  registrarSnapshot(lienzo);
  guardar();
});

espacio.menubar.querySelectorAll<HTMLElement>('[data-dib]').forEach((boton) => {
  boton.addEventListener('click', async () => {
    const clase = boton.dataset.dib;

    if (clase === 'imagen') {
      inputImagen.value = '';
      inputImagen.click();
      return;
    }

    if (clase === 'tabla') {
      const resultado = await pedirFilasColumnas();
      if (!resultado) return;
      const elemento = crearElementoTabla(resultado.filas, resultado.columnas);
      await agregarAlLienzo(lienzo, elemento);
      registrarSnapshot(lienzo);
      guardar();
      return;
    }

    if ((SIMPLES as string[]).includes(clase ?? '')) {
      const elemento = crearElemento(clase as ClaseSimple);
      await agregarAlLienzo(lienzo, elemento);
      registrarSnapshot(lienzo);
      guardar();
    }
  });
});

async function accionDeshacer(): Promise<void> {
  if (!puedeDeshacer()) return;
  await deshacer(lienzo);
  mostrarSinSeleccion(espacio.panelPropiedades);
}

async function accionRehacer(): Promise<void> {
  if (!puedeRehacer()) return;
  await rehacer(lienzo);
  mostrarSinSeleccion(espacio.panelPropiedades);
}

document.getElementById('ed-undo')?.addEventListener('click', accionDeshacer);
document.getElementById('ed-redo')?.addEventListener('click', accionRehacer);

// Los ítems del menú Editar hacen exactamente lo mismo que sus atajos: llaman a las mismas
// funciones. Antes solo existía el atajo, así que el menú parecía roto.
document.getElementById('ed-seleccionar-todo')!.addEventListener('click', seleccionarTodo);
document.getElementById('ed-copiar')!.addEventListener('click', () => copiarSeleccion(false));
document.getElementById('ed-cortar')!.addEventListener('click', () => copiarSeleccion(true));
document.getElementById('ed-pegar')!.addEventListener('click', () => void pegar());

const FLECHAS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

document.addEventListener('keydown', (e) => {
  const enCampoDeTexto = ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName);
  if (enCampoDeTexto) return;

  if (e.key === 'Delete' || e.key === 'Backspace') {
    const activo = lienzo.getActiveObject();
    if (!activo) return;
    e.preventDefault();
    const objetos = activo instanceof ActiveSelection ? activo.getObjects() : [activo];
    lienzo.discardActiveObject();
    lienzo.remove(...objetos);
    lienzo.requestRenderAll();
    mostrarSinSeleccion(espacio.panelPropiedades);
    registrarSnapshot(lienzo);
    guardar();
    return;
  }

  const direccion = FLECHAS[e.key];
  if (direccion && !e.ctrlKey && !e.metaKey) {
    const objeto = lienzo.getActiveObject();
    if (!objeto) return;
    e.preventDefault(); // si no, las flechas scrollean la página
    const paso = e.shiftKey ? 10 : 1;
    objeto.set({ left: (objeto.left ?? 0) + direccion[0] * paso, top: (objeto.top ?? 0) + direccion[1] * paso });
    objeto.setCoords();
    // Se reusa el camino de soltar el mouse: vuelca la posición al modelo, refresca el panel,
    // registra el paso en el historial y autoguarda.
    lienzo.fire('object:modified', { target: objeto } as never);
    lienzo.requestRenderAll();
    return;
  }

  if (!(e.ctrlKey || e.metaKey)) return;
  const tecla = e.key.toLowerCase();
  if (tecla === 'z' && !e.shiftKey) {
    e.preventDefault();
    accionDeshacer();
  } else if (tecla === 'y' || (tecla === 'z' && e.shiftKey)) {
    e.preventDefault();
    accionRehacer();
  } else if (tecla === 'c' || tecla === 'x') {
    if (!copiarSeleccion(tecla === 'x')) return;
    e.preventDefault();
  } else if (tecla === 'v') {
    e.preventDefault();
    pegar();
  } else if (e.key === '/') {
    e.preventDefault();
    ayuda.verAtajos();
  } else if (tecla === 'a') {
    if (!lienzo.getObjects().length) return;
    e.preventDefault(); // si no, el navegador selecciona el texto de toda la página
    seleccionarTodo();
  }
});

// ---------- Completar campos ----------

/** Los elementos que hay ahora en el lienzo, en orden. */
function elementosDelLienzo(): Elemento[] {
  return lienzo
    .getObjects()
    .map((o) => elementoDe(o))
    .filter((el): el is Elemento => !!el);
}

document.getElementById('ed-completar')!.addEventListener('change', async (e) => {
  const encendido = (e.target as HTMLInputElement).checked;
  activarModoCompletar(encendido);
  lienzo.discardActiveObject();
  await reconstruirLienzo(lienzo, elementosDelLienzo());

  // Con el modo prendido solo se tocan los campos: el resto del diseño queda quieto para no
  // moverlo sin querer mientras se completa.
  if (encendido) {
    for (const objeto of lienzo.getObjects()) {
      if (elementoDe(objeto)?.clase !== 'campo') objeto.set({ selectable: false, evented: false });
    }
  }
  lienzo.requestRenderAll();
  mostrarSinSeleccion(espacio.panelPropiedades);
});

// Lo que se escribe en un campo es su valor por defecto: el mismo que muestra el panel y el que
// viaja al PDF, así que completar la hoja es también prepararla.
lienzo.on('text:changed', (e) => {
  const elemento = elementoDe(e.target as FabricObject);
  if (elemento?.clase !== 'campo') return;
  elemento.defaultValue = (e.target as unknown as { text: string }).text;
  guardar();
});

// ---------- Copiar, cortar y pegar ----------

/**
 * El portapapeles es propio, no el del sistema: lo que se copia son elementos del modelo, que no
 * tienen forma de viajar por el portapapeles del navegador sin inventar un formato.
 */
let portapapeles: Elemento[] = [];

function seleccionarTodo(): void {
  const objetos = lienzo.getObjects();
  if (!objetos.length) return;
  lienzo.discardActiveObject();
  lienzo.setActiveObject(objetos.length === 1 ? objetos[0] : new ActiveSelection([...objetos], { canvas: lienzo }));
  lienzo.requestRenderAll();
}

function seleccionados(): FabricObject[] {
  const activo = lienzo.getActiveObject();
  if (!activo) return [];
  return activo instanceof ActiveSelection ? activo.getObjects() : [activo];
}

/** Devuelve false si no había nada que copiar, para no comerse el atajo del navegador. */
function copiarSeleccion(cortar: boolean): boolean {
  const objetos = seleccionados();
  const elementos = objetos.map((o) => elementoDe(o)).filter((el): el is Elemento => !!el);
  if (!elementos.length) return false;

  portapapeles = JSON.parse(JSON.stringify(elementos));

  if (cortar) {
    lienzo.discardActiveObject();
    lienzo.remove(...objetos);
    lienzo.requestRenderAll();
    mostrarSinSeleccion(espacio.panelPropiedades);
    registrarSnapshot(lienzo);
    guardar();
  }
  return true;
}

async function pegar(): Promise<void> {
  if (!portapapeles.length) return;

  const nuevos: FabricObject[] = [];
  for (const elemento of portapapeles) {
    // duplicarElemento le da un ID nuevo y lo corre un poco, así la copia no tapa al original.
    nuevos.push(await agregarAlLienzo(lienzo, duplicarElemento(elemento)));
  }

  // El portapapeles se queda con lo recién pegado: pegar de nuevo vuelve a correrse en vez de
  // apilar todas las copias en el mismo lugar.
  portapapeles = nuevos.map((o) => elementoDe(o)).filter((el): el is Elemento => !!el).map((el) => JSON.parse(JSON.stringify(el)));

  lienzo.discardActiveObject();
  if (nuevos.length === 1) {
    lienzo.setActiveObject(nuevos[0]);
  } else {
    lienzo.setActiveObject(new ActiveSelection(nuevos, { canvas: lienzo }));
  }
  lienzo.requestRenderAll();
  registrarSnapshot(lienzo);
  guardar();
}

// ---------- Página ----------

const selTamano = document.getElementById('ed-tamano') as HTMLSelectElement;
const selOrient = document.getElementById('ed-orient') as HTMLSelectElement;
const estadoTam = document.getElementById('ed-status-tam')!;
const estadoOrient = document.getElementById('ed-status-orient')!;

const selFondo = document.getElementById('ed-fondo-modo') as HTMLSelectElement;

function reflejarPagina(): void {
  const config = configActual();
  selTamano.value = config.tamano;
  selOrient.value = config.orientacion;
  selFondo.value = config.fondo ? 'imagen' : 'blanco';
  // Se guarda la clave en data-i18n (no solo el texto ya traducido): así, si más tarde se cambia
  // de idioma sin volver a tocar la página, el barrido de aplicarIdioma() sabe qué re-traducir.
  estadoTam.dataset.i18n = `pagina.tamano.${config.tamano}`;
  estadoTam.textContent = t(estadoTam.dataset.i18n as ClaveI18n);
  estadoOrient.dataset.i18n = config.orientacion === 'horizontal' ? 'pagina.orientacion.horizontal' : 'pagina.orientacion.vertical';
  estadoOrient.textContent = t(estadoOrient.dataset.i18n as ClaveI18n);
}

function cambiarPagina(cambio: Partial<ReturnType<typeof configActual>>): void {
  aplicarConfigPagina(lienzo, { ...configActual(), ...cambio });
  reflejarPagina();
  guardar();
}

// ---------- Fondo de la hoja ----------

const inputFondo = document.createElement('input');
inputFondo.type = 'file';
inputFondo.accept = 'image/png,image/jpeg';
inputFondo.style.display = 'none';
document.body.appendChild(inputFondo);

inputFondo.addEventListener('change', async () => {
  const archivo = inputFondo.files?.[0];
  if (!archivo) {
    reflejarPagina(); // canceló el diálogo: el select vuelve a lo que hay
    return;
  }
  const fondo = await new Promise<string>((resolve) => {
    const lector = new FileReader();
    lector.onload = () => resolve(lector.result as string);
    lector.readAsDataURL(archivo);
  });
  cambiarPagina({ fondo });
});

// ---------- Abrir un PDF existente ----------

const inputPdf = document.createElement('input');
inputPdf.type = 'file';
inputPdf.accept = 'application/pdf';
inputPdf.style.display = 'none';
document.body.appendChild(inputPdf);

document.getElementById('ed-abrir-pdf')!.addEventListener('click', async () => {
  if (
    lienzo.getObjects().length &&
    !(await confirmar(t('confirmar.abrirPdf.titulo'), t('confirmar.abrirPdf.mensaje'), t('confirmar.abrirPdf.aceptar')))
  ) {
    return;
  }
  inputPdf.value = '';
  inputPdf.click();
});

inputPdf.addEventListener('change', async () => {
  const archivo = inputPdf.files?.[0];
  if (!archivo) return;

  try {
    const { abrirPdf, textosDelPdf, camposDelPdf } = await import('./editor/pdfExistente');
    const pdf = await abrirPdf(archivo);

    // La hoja toma las medidas del PDF, que puede no ser de ningún tamaño del catálogo.
    cambiarPagina({ fondo: pdf.fondo, medidas: { ancho: pdf.ancho, alto: pdf.alto }, ...tamanoParecido(pdf.ancho, pdf.alto) });

    // Los campos AcroForm entran ya colocados en la hoja, con sus mismas coordenadas, tipografía
    // y color: quedan listos para editar en un paso, en vez de que haya que rearmar la plantilla
    // a mano campo por campo.
    const { campos, omitidos } = await camposDelPdf();
    for (const campo of campos) {
      const elemento = {
        ...crearElementoCampo(campo.name),
        x: campo.x,
        y: campo.y,
        w: campo.w,
        h: campo.h,
        size: campo.size,
        familia: campo.familia,
        negrita: campo.negrita,
        cursiva: campo.cursiva,
        color: campo.color,
        align: campo.align,
        readonly: campo.readonly,
        multilinea: campo.multilinea,
        defaultValue: campo.defaultValue,
        bordeGrosor: campo.bordeGrosor,
        bordeColor: campo.bordeColor,
        conFondo: campo.conFondo,
        fondoColor: campo.fondoColor,
      };
      await agregarAlLienzo(lienzo, elemento);
    }
    // Un mismo ID puede repetirse en varias posiciones (como en el editor): el catálogo lo lista
    // una sola vez. Se suma al catálogo existente, sin repetir, igual que al importar un CSV.
    if (campos.length) {
      panelCampos.establecerCatalogo([...new Set([...panelCampos.obtenerCatalogo(), ...campos.map((c) => c.name)])]);
    }
    if (campos.length || omitidos.length) {
      registrarSnapshot(lienzo);
      guardar();
    }

    const cuantos = textosDelPdf().length;
    await mostrarAyuda(
      t('ayuda.pdfAbierto.titulo'),
      `<p>${t('ayuda.pdfAbierto.tamano', { ancho: pdf.ancho, alto: pdf.alto })}</p>
       ${
         cuantos
           ? `<p>${cuantos === 1 ? t('ayuda.pdfAbierto.textoUno') : t('ayuda.pdfAbierto.textoVarios', { n: cuantos })}${t('ayuda.pdfAbierto.textoResto')}</p>`
           : `<p>${t('ayuda.pdfAbierto.sinTexto')}</p>`
       }
       ${
         campos.length
           ? `<p>${campos.length === 1 ? t('ayuda.pdfAbierto.campoUno') : t('ayuda.pdfAbierto.camposVarios', { n: campos.length })}</p>`
           : ''
       }
       ${
         omitidos.length
           ? `<p>${t('ayuda.pdfAbierto.omitidosTitulo')}</p><ul>${omitidos.map((o) => `<li><b>${escapeHtml(o.name)}</b>: ${escapeHtml(o.motivo)}</li>`).join('')}</ul>`
           : ''
       }
       ${pdf.paginas > 1 ? `<p>${t('ayuda.pdfAbierto.paginas', { n: pdf.paginas })}</p>` : ''}`
    );
  } catch (error) {
    await mostrarAyuda(t('ayuda.pdfError.titulo'), `<p>${(error as Error).message}</p><p>${t('ayuda.pdfError.cuerpo')}</p>`);
  }
});

/**
 * Doble clic sobre un texto del PDF de base: se borra del contenido original y se agrega como
 * elemento del diseño, en el mismo lugar y con el mismo cuerpo, listo para editar. De ahí en más
 * es un texto común, con todo lo que eso trae (panel, deshacer, exportación).
 */
lienzo.on('mouse:dblclick', async (e) => {
  const { hayPdfAbierto, textoEn, borrarTextoDelPdf } = await import('./editor/pdfExistente');
  if (!hayPdfAbierto() || e.target) return; // si cayó sobre un objeto, manda el objeto

  const punto = lienzo.getScenePoint(e.e);
  const original = textoEn(punto.x, punto.y);
  if (!original) return;

  const fondo = await borrarTextoDelPdf(original);
  cambiarPagina({ fondo });

  const elemento = crearElemento('texto') as Elemento & { clase: 'texto' };
  elemento.text = original.texto;
  elemento.size = original.size;
  elemento.negrita = original.negrita;
  elemento.cursiva = original.cursiva;
  elemento.familia = original.familia;
  elemento.x = Math.round(original.x);
  // El modelo mide desde el tope de la caja del texto y el PDF desde su línea de base, así que
  // hay que restar la ascendente. Se pide la de verdad —la misma que va a usar la exportación—
  // para que el reemplazo caiga exactamente en el renglón del original.
  // Sin redondear: la ascendente tiene decimales y redondear la posición devolvía el reemplazo
  // un punto arriba del original. Los redondeos vienen después, si se lo mueve a mano.
  const { ascendenteDeFuente } = await import('./editor/exportarPdf');
  elemento.y = original.lineaBase - (await ascendenteDeFuente(elemento.familia, elemento.negrita, elemento.cursiva, elemento.size));

  const objeto = await agregarAlLienzo(lienzo, elemento);
  mostrarPropiedades(espacio.panelPropiedades, lienzo, objeto);
  registrarSnapshot(lienzo);
  guardar();
});

selFondo.addEventListener('change', () => {
  if (selFondo.value === 'blanco') {
    cambiarPagina({ fondo: null });
    return;
  }
  inputFondo.value = '';
  inputFondo.click();
});

selTamano.addEventListener('change', () => cambiarPagina({ tamano: selTamano.value as TamanoPagina }));
selOrient.addEventListener('change', () => cambiarPagina({ orientacion: selOrient.value as Orientacion }));

document.getElementById('ed-margenes')!.addEventListener('click', async () => {
  const margenes = await pedirMargenes(configActual().margenes);
  if (margenes) cambiarPagina({ margenes });
});

reflejarPagina();

// ---------- Catálogo de campos en CSV ----------

const inputCsv = document.createElement('input');
inputCsv.type = 'file';
inputCsv.accept = '.csv,text/csv';
inputCsv.style.display = 'none';
document.body.appendChild(inputCsv);

document.getElementById('ed-csv-importar')!.addEventListener('click', () => {
  inputCsv.value = '';
  inputCsv.click();
});

inputCsv.addEventListener('change', async () => {
  const archivo = inputCsv.files?.[0];
  if (!archivo) return;
  const nombres = camposDesdeCsv(await archivo.text());
  if (!nombres.length) {
    await confirmar(t('confirmar.csvSinCampos.titulo'), t('confirmar.csvSinCampos.mensaje'), t('modal.btn.entendido'));
    return;
  }
  // Se suman a los que ya estaban, sin repetir.
  panelCampos.establecerCatalogo([...new Set([...panelCampos.obtenerCatalogo(), ...nombres])]);
  guardar();
});

document.getElementById('ed-csv-exportar')!.addEventListener('click', async () => {
  const campos = panelCampos.obtenerCatalogo();
  if (!campos.length) {
    await confirmar(t('confirmar.catalogoVacio.titulo'), t('confirmar.catalogoVacio.mensaje'), t('modal.btn.entendido'));
    return;
  }
  descargarCsv(csvDesdeCampos(campos), 'campos');
});

// ---------- Ver y zoom ----------

const chkCuadricula = document.getElementById('ed-cuadricula') as HTMLInputElement;
const numPaso = document.getElementById('ed-paso') as HTMLInputElement;
const chkReglas = document.getElementById('ed-reglas') as HTMLInputElement;
const chkGuias = document.getElementById('ed-guias') as HTMLInputElement;

chkCuadricula.addEventListener('change', () => configurarVista(lienzo, { cuadricula: chkCuadricula.checked }));
numPaso.addEventListener('change', () => configurarVista(lienzo, { paso: Math.max(2, Number(numPaso.value) || 5) }));
chkReglas.addEventListener('change', () => configurarVista(lienzo, { reglas: chkReglas.checked }));
chkGuias.addEventListener('change', () => configurarVista(lienzo, { guias: chkGuias.checked }));

const rangoZoom = document.getElementById('ed-zoom') as HTMLInputElement;
const valorZoom = document.getElementById('ed-zoom-val')!;

function aplicarZoom(porcentaje: number): void {
  establecerZoom(lienzo, porcentaje / 100);
  const real = Math.round(vistaActual().zoom * 100);
  rangoZoom.value = String(real);
  valorZoom.textContent = `${real}%`;
}

rangoZoom.addEventListener('input', () => aplicarZoom(Number(rangoZoom.value)));
document.getElementById('ed-zoom-menos')!.addEventListener('click', () => aplicarZoom(Math.round(vistaActual().zoom * 100) - 10));
document.getElementById('ed-zoom-mas')!.addEventListener('click', () => aplicarZoom(Math.round(vistaActual().zoom * 100) + 10));

// passive: false porque hay que cancelar el zoom del navegador antes de aplicar el propio.
espacio.lienzoCont.addEventListener(
  'wheel',
  (e) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    aplicarZoom(Math.round(vistaActual().zoom * 100) + (e.deltaY < 0 ? 10 : -10));
  },
  { passive: false }
);

// ---------- Archivo ----------

document.getElementById('ed-nuevo')!.addEventListener('click', async () => {
  const config = await pedirNuevoProyecto(configActual());
  if (!config) return;
  aplicarConfigPagina(lienzo, config);
  await reconstruirLienzo(lienzo, []);
  panelCampos.establecerCatalogo([]);
  mostrarSinSeleccion(espacio.panelPropiedades);
  reflejarPagina();
  inicializarHistorial(lienzo);
});

document.getElementById('ed-guardar-proyecto')!.addEventListener('click', async () => {
  const nombre = await pedirNombreArchivo(t('confirmar.guardarProyecto.titulo'), t('confirmar.guardarProyecto.mensaje'), 'proyecto');
  if (nombre === null) return;
  // Con el PDF de base adentro: así el archivo se basta a sí mismo para seguir en otra máquina.
  descargarProyecto(serializarProyecto(lienzo, panelCampos.obtenerCatalogo(), true), nombre);
});

const inputProyecto = document.createElement('input');
inputProyecto.type = 'file';
inputProyecto.accept = '.json,application/json';
inputProyecto.style.display = 'none';
document.body.appendChild(inputProyecto);

document.getElementById('ed-importar-proyecto')!.addEventListener('click', async () => {
  const hayTrabajo = lienzo.getObjects().length > 0;
  if (
    hayTrabajo &&
    !(await confirmar(t('confirmar.importarProyecto.titulo'), t('confirmar.importarProyecto.mensaje'), t('confirmar.importarProyecto.aceptar')))
  )
    return;
  inputProyecto.value = '';
  inputProyecto.click();
});

document.getElementById('ed-verificar')!.addEventListener('click', async () => {
  await verificarYExportar();
});

document.getElementById('ed-peso-btn')!.addEventListener('click', () => programarPeso());

async function verificarYExportar(): Promise<void> {
  const hallazgos = verificarDiseno(lienzo);
  if (!(await mostrarPreflight(hallazgos))) return;
  await exportarConDialogo();
}

async function exportarConDialogo(): Promise<void> {
  const opciones = await pedirExportarPdf('documento');
  if (!opciones) return;
  try {
    // pdf-lib y fontkit pesan bastante y solo hacen falta al exportar: se cargan recién acá.
    const { exportarPdf, descargarPdf } = await import('./editor/exportarPdf');
    const bytes = await exportarPdf(lienzo, { conFormulario: opciones.conFormulario, sinApariencias: opciones.sinApariencias });
    descargarPdf(bytes, opciones.nombre);
  } catch (error) {
    await confirmar(
      t('confirmar.noSePudoExportar.titulo'),
      error instanceof Error ? error.message : t('confirmar.noSePudoExportar.generico'),
      t('modal.btn.entendido')
    );
  }
}

// Exportar pasa antes por la verificación, así los problemas se ven antes de generar el archivo.
document.getElementById('ed-exportar-pdf')!.addEventListener('click', verificarYExportar);
document.getElementById('ed-preflight-btn')!.addEventListener('click', verificarYExportar);

inputProyecto.addEventListener('change', async () => {
  const archivo = inputProyecto.files?.[0];
  if (!archivo) return;
  try {
    const proyecto = leerProyecto(await archivo.text());
    await cargarProyecto(lienzo, proyecto);
    panelCampos.establecerCatalogo(proyecto.campos);
    mostrarSinSeleccion(espacio.panelPropiedades);
    reflejarPagina();
    inicializarHistorial(lienzo);
  } catch (error) {
    await confirmar(
      t('confirmar.noSePudoImportar.titulo'),
      error instanceof Error ? error.message : t('confirmar.noSePudoImportar.generico'),
      t('modal.btn.entendido')
    );
  }
});

// ---------- Autoguardado ----------

document.getElementById('ed-nuevo')!.addEventListener('click', async () => {
  borrarAutoguardado();
  // Empezar de cero también suelta el PDF de base, o quedaría de fondo de un diseño nuevo.
  (await import('./editor/pdfExistente')).cerrarPdf();
});

// Al abrir, ofrecer seguir donde se dejó. Se pregunta en vez de restaurar solo, para no
// pisar sin aviso a quien esperaba empezar en blanco.
if (hayAutoguardado()) {
  const seguir = await confirmar(
    t('confirmar.continuarDondeDejaste.titulo'),
    t('confirmar.continuarDondeDejaste.mensaje'),
    t('confirmar.continuarDondeDejaste.aceptar')
  );
  const { recuperarPdfGuardado, cerrarPdf, textosDelPdf } = await import('./editor/pdfExistente');

  if (seguir) {
    const proyecto = await restaurarAutoguardado(lienzo);
    if (proyecto) {
      panelCampos.establecerCatalogo(proyecto.campos);
      reflejarPagina();
      inicializarHistorial(lienzo);
    }
    // El PDF de base va aparte del diseño: no entra en el autoguardado (no es texto y es
    // grande), así que se recupera de su propio almacén. Sin esto quedaba la imagen de fondo
    // pero no el PDF, y al exportar salía una foto en vez del original vectorial.
    if (await recuperarPdfGuardado()) {
      const cuantos = textosDelPdf().length;
      // Se saca data-i18n: de otro modo un cambio de idioma posterior pisaría este texto con el
      // de "Guardado automático...", que es lo que ese atributo apunta a traducir por defecto.
      const estadoIzq = espacio.raiz.querySelector<HTMLElement>('.ed-status-izq')!;
      estadoIzq.removeAttribute('data-i18n');
      estadoIzq.textContent = t('shell.status.pdfRecuperado') + (cuantos ? t('shell.status.pdfRecuperadoTextos', { n: cuantos }) : '');
    }
  } else {
    borrarAutoguardado();
    cerrarPdf();
  }
}

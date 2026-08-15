import './style.css';
import { montarEspacioTrabajo } from './ui/shell';
import { crearLienzo } from './editor/lienzo';
import { crearElemento, crearElementoCampo, crearElementoImagen, crearElementoTabla, duplicarElemento, type ClaseSimple, type Elemento } from './editor/elemento';
import { activarModoCompletar, agregarAlLienzo, elementoDe, enModoCompletar, reconstruirLienzo, sincronizarGeometria } from './editor/objetosFabric';
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
import { alCambiarIdioma, aplicarIdioma, t, type ClaveI18n } from './ui/i18n';
import { agregarHoja, aplicarConfigPagina, cantidadDeHojas, configActual, eliminarHoja, establecerFondoDeLaHoja, fondoDeLaHoja, establecerHojas, hojaActual, hojaEnBlanco, hojasDesdePdf, irAHoja, medidasDeLaHoja, miniaturaDeHoja, moverHoja, olvidarPaginasDibujadas, paginaDeLaHoja, refrescarPaginaDibujada } from './editor/documento';
import { activarVista, configurarVista, establecerZoom, vistaActual } from './editor/vista';
import { configPorDefecto, type Orientacion, type TamanoPagina } from './editor/pagina';
import { cargarProyecto, descargarProyecto, leerProyecto, serializarProyecto } from './editor/proyecto';
import type { CampoDelPdf } from './editor/pdfExistente';

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

/**
 * El menú del navegador —Atrás, Actualizar, Ver código fuente— no tiene nada que ver con un editor
 * y le saca sensación de aplicación, así que no aparece en ninguna parte, tampoco adentro de los
 * cuadros de texto: ahí copiar y pegar quedan con sus atajos de teclado.
 *
 * Los menús propios no se ven afectados: el de la tira de hojas escucha el mismo evento sobre su
 * elemento, que se atiende antes que este, y ya hace `preventDefault` por su cuenta.
 */
document.addEventListener('contextmenu', (e) => e.preventDefault());

let temporizadorPeso: number | undefined;
let generacionPeso = 0;

/** Lo último que se supo del peso, para poder reescribirlo si cambia el idioma. */
let estadoPeso: { clave: ClaveI18n; peso?: string } = { clave: 'shell.status.pesoCalculando' };

function mostrarPeso(): void {
  const boton = document.getElementById('ed-peso-btn');
  if (!boton) return;
  // Se saca data-i18n: el texto pasa a tener un valor calculado (o un error) que ese atributo no
  // puede representar, así que de acá en más lo mantiene este código y no el barrido de idioma.
  boton.removeAttribute('data-i18n');
  boton.textContent = t(estadoPeso.clave, estadoPeso.peso ? { peso: estadoPeso.peso } : undefined);
}

/**
 * Recalcula el peso del PDF después de cada cambio, pero con un respiro como el autoguardado:
 * generarlo de verdad no es gratis y en una ráfaga de cambios solo interesa el último. El
 * contador de generación descarta las respuestas que llegan fuera de orden.
 */
function programarPeso(): void {
  clearTimeout(temporizadorPeso);
  estadoPeso = { clave: 'shell.status.pesoCalculando' };
  mostrarPeso();
  temporizadorPeso = window.setTimeout(async () => {
    const generacion = ++generacionPeso;
    try {
      const peso = formatearPeso(await pesoDelPdf(lienzo));
      if (generacion !== generacionPeso) return;
      estadoPeso = { clave: 'shell.status.pesoValor', peso };
    } catch {
      if (generacion !== generacionPeso) return;
      estadoPeso = { clave: 'shell.status.pesoError' };
    }
    mostrarPeso();
  }, 800);
}

/**
 * Al cambiar de idioma, el barrido de `data-i18n` traduce lo que está escrito en el HTML, pero no
 * lo que arma el código: las pestañas de hojas, el peso y el panel de propiedades —que se dibuja
 * al seleccionar y se queda como estaba hasta la próxima selección—. Se vuelven a dibujar acá.
 */
alCambiarIdioma(() => {
  reflejarHojas();
  mostrarPeso();
  const activo = lienzo.getActiveObject();
  const varios = activo instanceof ActiveSelection ? activo.getObjects() : activo ? [activo] : [];
  if (varios.length > 1) mostrarMultiSeleccion(espacio.panelPropiedades, lienzo, varios, reseleccionar);
  else if (varios[0] && elementoDe(varios[0])) mostrarPropiedades(espacio.panelPropiedades, lienzo, varios[0]);
  else mostrarSinSeleccion(espacio.panelPropiedades);
});

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
  try {
    // Comprueba que sea PNG o JPEG de verdad —por sus bytes, no por la extensión— y la achica si
    // es enorme: si no, viaja entera al PDF y al autoguardado, que no la aguanta.
    const { prepararImagen } = await import('./editor/imagen');
    const imagen = await prepararImagen(archivo);
    const elemento = crearElementoImagen(imagen.src, imagen.ancho, imagen.alto);
    await agregarAlLienzo(lienzo, elemento);
    registrarSnapshot(lienzo);
    guardar();
  } catch (error) {
    // El motivo del rechazo viaja en el error; si no lo trae, se avisa en general.
    await confirmar(
      t('confirmar.noSePudoImportar.titulo'),
      error instanceof Error ? error.message : t('confirmar.noSePudoImportar.generico'),
      t('modal.btn.entendido')
    );
  }
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
  reflejarHojas();
}

async function accionRehacer(): Promise<void> {
  if (!puedeRehacer()) return;
  await rehacer(lienzo);
  mostrarSinSeleccion(espacio.panelPropiedades);
  reflejarHojas();
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

const paginasCont = document.getElementById('ed-status-paginas')!;
const paginasDivisor = document.getElementById('ed-status-divisor-paginas')!;

/**
 * Cuántas páginas va a tener el PDF exportado: una por hoja. Se muestra solo con más de una,
 * porque es ahí donde importa —al borrar o duplicar hojas, el archivo final deja de coincidir con
 * el PDF que se abrió y hasta ahora nada lo decía.
 */
function reflejarCantidadDePaginas(): void {
  const total = cantidadDeHojas();
  paginasCont.hidden = total < 2;
  paginasDivisor.hidden = total < 2;
  // Sin `data-i18n`: lleva un número adentro, así que el barrido de aplicarIdioma() lo dejaría en
  // el molde sin reemplazar. Se rehace desde alCambiarIdioma(), como el resto del texto con datos.
  paginasCont.textContent = t('shell.status.paginas', { n: total });
}

function reflejarPagina(): void {
  const config = configActual();
  selTamano.value = config.tamano;
  selOrient.value = config.orientacion;
  selFondo.value = paginaDeLaHoja() !== null ? 'pdf' : fondoDeLaHoja() ? 'imagen' : 'blanco';
  // La tira muestra la forma de cada hoja, así que hay que rehacerla cuando cambia el tamaño o la
  // orientación de la que se está editando.
  reflejarHojas();
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

// ---------- Hojas del documento ----------

const hojasLista = document.getElementById('ed-hojas-lista')!;

/** Deja el editor consistente después de tocar las hojas. Todas las operaciones terminan igual. */
async function trasCambiarHojas(conHistorial: boolean): Promise<void> {
  mostrarSinSeleccion(espacio.panelPropiedades);
  if (conHistorial) registrarSnapshot(lienzo);
  reflejarCantidadDePaginas();
  // Cada hoja tiene su tamaño, así que el menú Página y la barra de estado muestran el de la que
  // se está editando: sin esto seguían mostrando el de la hoja anterior y parecía que el tamaño
  // se hubiera aplicado a todas. `reflejarPagina` también rehace la tira.
  reflejarPagina();
  guardar();
}

/**
 * Redibuja la tira de hojas. Se llama después de cualquier operación que agregue, saque, reordene
 * o cambie de hoja —incluidos deshacer/rehacer y cargar un proyecto—, porque ninguna de esas
 * funciones toca la interfaz por su cuenta.
 *
 * Cada hoja se muestra como la página que es. Las imágenes se piden después de armar la tira y se
 * van colocando a medida que salen: con un PDF de doce páginas, dibujarlas todas antes de mostrar
 * nada dejaría la tira vacía varios segundos.
 */
function reflejarHojas(): void {
  const total = cantidadDeHojas();
  const actual = hojaActual();

  hojasLista.innerHTML =
    Array.from(
      { length: total },
      (_, i) => `
    <div class="ed-hoja ${i === actual ? 'activa' : ''}" draggable="true" data-hoja="${i}" title="${t('shell.hojas.etiqueta', { n: i + 1 })}" style="--relacion-hoja: ${relacionDeLaHoja(i)}">
      <div class="ed-hoja-papel">
        <img alt="" data-mini="${i}" hidden>
        <div class="ed-hoja-acciones">
          <button type="button" data-duplicar="${i}" title="${t('shell.hojas.duplicarTt')}">⧉</button>
          <button type="button" class="borrar" data-cerrar="${i}" title="${t('shell.hojas.cerrarTt')}" ${total > 1 ? '' : 'disabled'}>×</button>
        </div>
      </div>
      <div class="ed-hoja-et">${i + 1}${origenDeLaHoja(i)}</div>
    </div>`
    ).join('') +
    `<div class="ed-hoja-nueva" id="ed-hoja-agregar" title="${t('shell.hojas.agregarTt')}"><div class="ed-hoja-papel">+</div><div class="ed-hoja-et" data-i18n="shell.hojas.nueva"></div></div>`;

  aplicarIdioma(hojasLista);
  void pintarMiniaturas();

  hojasLista.querySelectorAll<HTMLElement>('.ed-hoja').forEach((tarjeta) => {
    const indice = Number(tarjeta.dataset.hoja);

    tarjeta.addEventListener('click', async (e) => {
      if ((e.target as HTMLElement).closest('button')) return;
      await irAHoja(lienzo, indice);
      await trasCambiarHojas(false);
    });

    tarjeta.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      menuDeHoja(indice, e.clientX, e.clientY);
    });

    // Reordenar arrastrando: HTML5 drag and drop nativo, alcanza para una tira corta.
    tarjeta.addEventListener('dragstart', (e) => {
      e.dataTransfer?.setData('text/plain', String(indice));
    });
    tarjeta.addEventListener('dragover', (e) => e.preventDefault());
    tarjeta.addEventListener('drop', async (e) => {
      e.preventDefault();
      const desde = Number(e.dataTransfer?.getData('text/plain'));
      if (Number.isNaN(desde) || desde === indice) return;
      await moverHoja(lienzo, desde, indice);
      await trasCambiarHojas(true);
    });
  });

  hojasLista.querySelectorAll<HTMLButtonElement>('[data-cerrar]').forEach((boton) => {
    boton.addEventListener('click', () => void borrarHoja(Number(boton.dataset.cerrar)));
  });
  hojasLista.querySelectorAll<HTMLButtonElement>('[data-duplicar]').forEach((boton) => {
    boton.addEventListener('click', () => void duplicarHoja(Number(boton.dataset.duplicar)));
  });
  document.getElementById('ed-hoja-agregar')!.addEventListener('click', () => void nuevaHoja(cantidadDeHojas() - 1));
}

/**
 * La forma de la miniatura, hoja por hoja. Va en el estilo de cada tarjeta y no una sola vez en la
 * raíz: con el tamaño por hoja, una sola proporción para toda la tira dibujaba todas las
 * miniaturas con la forma de la hoja que estuviera abierta —una A4 vertical se veía apaisada solo
 * porque la hoja de al lado lo era—.
 */
function relacionDeLaHoja(indice: number): number {
  const { ancho, alto } = medidasDeLaHoja(indice);
  return ancho / alto;
}

/**
 * De qué página del PDF viene la hoja, cuando ya no coincide con su número. Después de borrar o
 * reordenar, "3" a secas no dice nada: esto es lo que permite reconocerla contra el original.
 */
function origenDeLaHoja(indice: number): string {
  const pagina = paginaDeLaHoja(indice);
  if (pagina === null || pagina === indice) return '';
  return ` <span class="ed-hoja-orig">p.${pagina + 1}</span>`;
}

async function pintarMiniaturas(): Promise<void> {
  for (const img of hojasLista.querySelectorAll<HTMLImageElement>('[data-mini]')) {
    const fuente = await miniaturaDeHoja(Number(img.dataset.mini));
    // Otra operación pudo rehacer la tira mientras se dibujaba: si esta imagen ya no está en el
    // documento, colocarla no rompe nada pero es al pedo, y el bucle sigue con una tira vieja.
    if (!img.isConnected) return;
    if (!fuente) continue;
    img.src = fuente;
    img.hidden = false;
  }
}

async function borrarHoja(indice: number): Promise<void> {
  await eliminarHoja(lienzo, indice);
  await trasCambiarHojas(true);
}

async function duplicarHoja(indice: number): Promise<void> {
  await irAHoja(lienzo, indice);
  await agregarHoja(lienzo, true);
  await trasCambiarHojas(true);
}

/**
 * Agrega una hoja en blanco **después de `despuesDe`**. `agregarHoja` inserta siempre después de
 * la hoja vigente, así que hay que pararse primero donde lo pidieron: desde el menú, la hoja sobre
 * la que se hizo clic derecho —que puede no ser la que se está editando—, y desde el botón `+`, la
 * última. Sin esto, las dos siempre caían en el lugar 2.
 */
async function nuevaHoja(despuesDe: number): Promise<void> {
  await irAHoja(lienzo, despuesDe);
  await agregarHoja(lienzo, false);
  await trasCambiarHojas(true);
}

/** El menú de clic derecho sobre una hoja: lo que no entra en dos botones de 15 px. */
function menuDeHoja(indice: number, x: number, y: number): void {
  const opciones: { clave: ClaveI18n; roja?: boolean; hacer: () => Promise<void> }[] = [
    { clave: 'shell.hojas.duplicarTt', hacer: () => duplicarHoja(indice) },
    { clave: 'shell.hojas.insertar', hacer: () => nuevaHoja(indice) },
    { clave: 'shell.hojas.insertarPdf', hacer: async () => pedirPdfParaInsertar(indice) },
    { clave: 'shell.hojas.moverIzq', hacer: async () => {
      await moverHoja(lienzo, indice, Math.max(0, indice - 1));
      await trasCambiarHojas(true);
    } },
    { clave: 'shell.hojas.moverDer', hacer: async () => {
      await moverHoja(lienzo, indice, Math.min(cantidadDeHojas() - 1, indice + 1));
      await trasCambiarHojas(true);
    } },
    { clave: 'shell.hojas.cerrarTt', roja: true, hacer: () => borrarHoja(indice) },
  ];

  const menu = document.createElement('div');
  menu.className = 'ed-hoja-menu';
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;

  for (const opcion of opciones) {
    const fila = document.createElement('div');
    fila.textContent = t(opcion.clave);
    if (opcion.roja) fila.className = 'roja';
    if (opcion.roja && cantidadDeHojas() < 2) fila.classList.add('apagada');
    // `pointerdown` y no `click`: el que cierra el menú también escucha pointerdown, así que con
    // click el menú ya no existía cuando llegaba el evento y ninguna opción hacía nada.
    else fila.addEventListener('pointerdown', () => {
      menu.remove();
      void opcion.hacer();
    });
    menu.appendChild(fila);
  }

  document.body.appendChild(menu);
  // Si se abre cerca del borde, el menú se corre para adentro en vez de salirse de la ventana.
  const caja = menu.getBoundingClientRect();
  if (caja.right > innerWidth) menu.style.left = `${innerWidth - caja.width - 6}px`;
  if (caja.bottom > innerHeight) menu.style.top = `${y - caja.height}px`;

  const cerrar = () => menu.remove();
  setTimeout(() => addEventListener('pointerdown', cerrar, { once: true }));
}

reflejarHojas();

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
  // El fondo es de esta hoja, no del documento: las demás siguen con el suyo.
  await establecerFondoDeLaHoja(lienzo, fondo);
  reflejarPagina();
  reflejarHojas();
  guardar();
});

/**
 * Coloca los campos importados de un PDF, cada uno en la hoja que muestra su página. Al terminar
 * vuelve a la hoja en la que se estaba: importar no debería mover a nadie de lugar.
 */
async function colocarCamposImportados(campos: CampoDelPdf[]): Promise<void> {
  if (!campos.length) return;
  const volverA = hojaActual();

  // De página del PDF a hoja: después de borrar o reordenar no coinciden, y una página puede no
  // tener ninguna hoja (si se borró) o tener dos (si se duplicó); vale la primera.
  const hojaDePagina = new Map<number, number>();
  for (let i = cantidadDeHojas() - 1; i >= 0; i--) {
    const pagina = paginaDeLaHoja(i);
    if (pagina !== null) hojaDePagina.set(pagina, i);
  }

  for (const campo of campos) {
    const destino = hojaDePagina.get(campo.pagina);
    if (destino === undefined) continue;
    await irAHoja(lienzo, destino);
    await agregarAlLienzo(lienzo, {
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
    });
  }

  await irAHoja(lienzo, volverA);
}

// ---------- Insertar otro PDF ----------

const inputInsertar = document.createElement('input');
inputInsertar.type = 'file';
inputInsertar.accept = 'application/pdf';
inputInsertar.style.display = 'none';
document.body.appendChild(inputInsertar);

/** Después de qué hoja va a entrar el PDF que se elija. */
let insertarDespuesDe = 0;

function pedirPdfParaInsertar(despuesDe: number): void {
  insertarDespuesDe = despuesDe;
  inputInsertar.value = '';
  inputInsertar.click();
}

inputInsertar.addEventListener('change', async () => {
  const archivo = inputInsertar.files?.[0];
  if (!archivo) return;

  try {
    const { insertarPdf } = await import('./editor/documento');
    const { camposDelPdf, textosDelPdf, usarPagina } = await import('./editor/pdfExistente');

    const antes = medidasDeLaHoja(insertarDespuesDe);
    const medidas = await insertarPdf(lienzo, new Uint8Array(await archivo.arrayBuffer()), insertarDespuesDe);
    if (!medidas.length) return;

    // Los campos se releen del PDF ya fusionado y se reparten por página, así que los que estaban
    // colocados no se tocan y los que entran caen en sus hojas nuevas.
    const primera = paginaDeLaHoja(insertarDespuesDe + 1) ?? 0;
    const paginasNuevas = new Set(medidas.map((_, i) => primera + i));
    const { campos } = await camposDelPdf();
    const nuevos = campos.filter((c) => paginasNuevas.has(c.pagina));
    await colocarCamposImportados(nuevos);

    // Cuántos textos se pueden editar con doble clic en lo que entró. Hay que recorrer página por
    // página porque el módulo lee los textos de la que esté vigente.
    let textos = 0;
    for (const pagina of paginasNuevas) {
      await usarPagina(pagina);
      textos += textosDelPdf().length;
    }
    await irAHoja(lienzo, insertarDespuesDe + 1);

    registrarSnapshot(lienzo);
    await trasCambiarHojas(false);

    // El aviso de tamaño distinto no bloquea: la inserción ya se hizo y cada hoja se dibuja y se
    // exporta con sus propias medidas, así que es información, no un problema que haya que resolver.
    const distintas = medidas.filter((m) => m.ancho !== antes.ancho || m.alto !== antes.alto);
    await mostrarAyuda(
      t('ayuda.pdfInsertado.titulo'),
      `<p>${t('ayuda.pdfInsertado.paginas', { n: medidas.length })}</p>` +
        (textos ? `<p>${t(textos === 1 ? 'ayuda.pdfAbierto.textoUno' : 'ayuda.pdfAbierto.textoVarios', { n: textos })}${t('ayuda.pdfAbierto.textoResto')}</p>` : '') +
        (nuevos.length ? `<p>${t(nuevos.length === 1 ? 'ayuda.pdfAbierto.campoUno' : 'ayuda.pdfAbierto.camposVarios', { n: nuevos.length })}</p>` : '') +
        (distintas.length
          ? `<p>${t('ayuda.pdfInsertado.otroTamano', { n: distintas.length, ancho: distintas[0].ancho, alto: distintas[0].alto })}</p>`
          : '')
    );
  } catch (error) {
    await mostrarAyuda(t('ayuda.pdfInsertado.titulo'), `<p>${escapeHtml(String((error as Error)?.message ?? error))}</p>`);
  }
});

document.getElementById('ed-insertar-pdf')!.addEventListener('click', () => pedirPdfParaInsertar(hojaActual()));

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

    // Una hoja por página: el documento *es* el PDF. Lo que se borre o se mueva acá se borra o se
    // mueve en el archivo exportado. Cada hoja toma además las medidas de **su** página, que puede
    // no ser de ningún tamaño del catálogo ni la misma para todas.
    olvidarPaginasDibujadas();
    await hojasDesdePdf(lienzo, pdf.paginas);
    reflejarHojas();
    reflejarCantidadDePaginas();
    reflejarPagina();

    // Los campos AcroForm entran ya colocados en la hoja, con sus mismas coordenadas, tipografía
    // y color: quedan listos para editar en un paso, en vez de que haya que rearmar la plantilla
    // a mano campo por campo. **Cada uno va a la hoja de su página**: en un formulario de varias
    // páginas, meterlos todos en la primera los amontonaba encima del contenido equivocado.
    const { campos, omitidos } = await camposDelPdf();
    await colocarCamposImportados(campos);
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
           : `<p>${t(pdf.contenido === 'vacia' ? 'ayuda.pdfAbierto.vacia' : 'ayuda.pdfAbierto.sinTexto')}</p>`
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
  const { hayPdfAbierto, textoEn, borrarTextoDelPdf, formaEnPunto, quitarFormaDelPdf } = await import('./editor/pdfExistente');
  if (!hayPdfAbierto()) return;

  // Si el doble clic cayó sobre un objeto, manda el objeto... salvo que sea un campo importado del
  // mismo PDF. Los campos de una plantilla real tapan casi la mitad de la hoja, así que si
  // bloquearan el paso, la mitad de las líneas y recuadros del PDF quedarían inalcanzables. La
  // caja de un campo es un marcador, no un dibujo; lo que uno haya dibujado sí tiene prioridad.
  const encima = e.target ? elementoDe(e.target) : undefined;
  if (e.target && (encima?.clase !== 'campo' || enModoCompletar())) return;

  const punto = lienzo.getScenePoint(e.e);
  const original = textoEn(punto.x, punto.y);

  // Sin texto abajo, se prueba con las formas: las líneas y recuadros que el PDF trae dibujados.
  // El texto tiene prioridad porque suele estar encima de ellas y es lo que más se edita.
  if (!original) {
    const forma = formaEnPunto(punto.x, punto.y);
    if (!forma) return;

    // Sacarla puede llevarse también las formas que tenía completamente adentro —una banda gris se
    // lleva las líneas que la bordean—, así que se convierten todas las que se hayan ido: si no,
    // desaparecerían de la hoja sin que nadie las pidiera.
    const { fondo, quitadas } = await quitarFormaDelPdf(forma);
    await refrescarPaginaDibujada(lienzo, paginaDeLaHoja() ?? 0, fondo);

    const { elementoDesdeForma } = await import('./editor/formasPdf');
    let elegido: FabricObject | undefined;

    // En el orden en que las dibujaba el PDF, mandando cada una al fondo. Ojo con el orden final:
    // estas formas se dibujan por debajo de lo ya dibujado, así que el apilado que se ve es el
    // inverso del orden del arreglo. Recorriendo así, la última que pintaba el PDF queda primera y
    // por lo tanto arriba, como estaba. Al revés, una banda gris tapa sus propias líneas.
    for (const salida of quitadas) {
      const nuevo = await agregarAlLienzo(lienzo, elementoDesdeForma(salida));
      lienzo.sendObjectToBack(nuevo);
      if (salida === forma) elegido = nuevo;
    }

    lienzo.requestRenderAll();
    if (elegido) {
      lienzo.setActiveObject(elegido);
      mostrarPropiedades(espacio.panelPropiedades, lienzo, elegido);
    }
    registrarSnapshot(lienzo);
    guardar();
    return;
  }

  const fondo = await borrarTextoDelPdf(original);
  await refrescarPaginaDibujada(lienzo, paginaDeLaHoja() ?? 0, fondo);

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

selFondo.addEventListener('change', async () => {
  if (selFondo.value === 'blanco') {
    // Deja de venir del PDF: al exportar, esta hoja sale como página en blanco.
    await establecerFondoDeLaHoja(lienzo, null);
    reflejarPagina();
    reflejarHojas();
    guardar();
    return;
  }
  // Un PDF de fondo es lo mismo que abrirlo: además de verse de fondo queda de base al exportar,
  // así que lo que ya traía sigue siendo vectorial en vez de una foto. Por eso se reusa ese
  // camino entero, con su aviso previo si hay algo dibujado.
  if (selFondo.value === 'pdf') {
    document.getElementById('ed-abrir-pdf')!.click();
    return;
  }
  inputFondo.value = '';
  inputFondo.click();
});

// Elegir un tamaño del catálogo suelta las medidas propias: las hojas que vienen de un PDF las
// tienen, y como mandan sobre el tamaño, sin esto elegir "Oficio" no cambiaba nada.
selTamano.addEventListener('change', () => cambiarPagina({ tamano: selTamano.value as TamanoPagina, medidas: null }));
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
  // Una sola hoja vacía: vaciar el lienzo no alcanza, porque las otras hojas viven en el modelo
  // y seguirían saliendo en el PDF.
  await establecerHojas(lienzo, [hojaEnBlanco()], 0);
  panelCampos.establecerCatalogo([]);
  mostrarSinSeleccion(espacio.panelPropiedades);
  reflejarPagina();
  reflejarHojas();
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
    reflejarHojas();
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
  olvidarPaginasDibujadas();
  reflejarCantidadDePaginas();
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
    // El PDF de base va aparte del diseño: no entra en el autoguardado (no es texto y es grande),
    // así que se recupera de su propio almacén. Sin esto quedaba la imagen de fondo pero no el
    // PDF, y al exportar salía una foto en vez del original vectorial.
    // Va **antes** de restaurar el diseño: cada hoja se dibuja pidiéndole su página al PDF, así
    // que restaurando primero saldrían todas en blanco.
    const recuperado = await recuperarPdfGuardado();

    const proyecto = await restaurarAutoguardado(lienzo);
    if (proyecto) {
      panelCampos.establecerCatalogo(proyecto.campos);
      reflejarPagina();
      reflejarHojas();
      reflejarCantidadDePaginas();
      inicializarHistorial(lienzo);
    }
    if (recuperado) {
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

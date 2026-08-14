import './style.css';
import { montarEspacioTrabajo } from './ui/shell';
import { crearLienzo } from './editor/lienzo';
import { crearElemento, crearElementoCampo, crearElementoImagen, crearElementoTabla, type ClaseSimple } from './editor/elemento';
import { agregarAlLienzo, elementoDe, reconstruirLienzo, sincronizarGeometria } from './editor/objetosFabric';
import { mostrarMultiSeleccion, mostrarPropiedades, mostrarSinSeleccion } from './ui/panelPropiedades';
import { ActiveSelection, type FabricObject } from 'fabric';
import { borrarAutoguardado, hayAutoguardado, programarAutoguardado, restaurarAutoguardado } from './editor/autoguardado';
import { camposDesdeCsv, csvDesdeCampos, descargarCsv } from './editor/csvCampos';
import { confirmar, mostrarPreflight, pedirExportarPdf, pedirFilasColumnas, pedirMargenes, pedirNombreArchivo, pedirNuevoProyecto } from './ui/modales';
import { formatearPeso, pesoDelPdf, verificarDiseno } from './editor/preflight';
import { montarPanelCampos } from './ui/panelCampos';
import { deshacer, inicializarHistorial, puedeDeshacer, puedeRehacer, registrarSnapshot, rehacer } from './editor/historial';
import { aplicarConfigPagina, configActual } from './editor/documento';
import { activarVista, configurarVista, establecerZoom, vistaActual } from './editor/vista';
import { configPorDefecto, type Orientacion, type TamanoPagina } from './editor/pagina';
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
activarVista(lienzo);
aplicarConfigPagina(lienzo, configPorDefecto());
inicializarHistorial(lienzo);

function actualizarEscaladoUniforme(objeto: import('fabric').FabricObject): void {
  const elemento = elementoDe(objeto);
  lienzo.uniformScaling = elemento?.clase === 'imagen' ? elemento.proporcion : true;
}

function guardar(): void {
  programarAutoguardado(lienzo, panelCampos.obtenerCatalogo);
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
    for (const hijo of hijos) await sincronizarGeometria(lienzo, hijo);
    lienzo.setActiveObject(new ActiveSelection(hijos, { canvas: lienzo }));
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

document.addEventListener('keydown', (e) => {
  const enCampoDeTexto = ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName);
  if (enCampoDeTexto || !(e.ctrlKey || e.metaKey)) return;
  const tecla = e.key.toLowerCase();
  if (tecla === 'z' && !e.shiftKey) {
    e.preventDefault();
    accionDeshacer();
  } else if (tecla === 'y' || (tecla === 'z' && e.shiftKey)) {
    e.preventDefault();
    accionRehacer();
  }
});

// ---------- Página ----------

const selTamano = document.getElementById('ed-tamano') as HTMLSelectElement;
const selOrient = document.getElementById('ed-orient') as HTMLSelectElement;
const estadoTam = document.getElementById('ed-status-tam')!;
const estadoOrient = document.getElementById('ed-status-orient')!;

function reflejarPagina(): void {
  const config = configActual();
  selTamano.value = config.tamano;
  selOrient.value = config.orientacion;
  estadoTam.textContent = config.tamano;
  estadoOrient.textContent = config.orientacion === 'horizontal' ? 'Horizontal' : 'Vertical';
}

function cambiarPagina(cambio: Partial<ReturnType<typeof configActual>>): void {
  aplicarConfigPagina(lienzo, { ...configActual(), ...cambio });
  reflejarPagina();
}

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
    await confirmar('CSV sin campos', 'No se encontró ningún nombre de campo en el archivo.', 'Entendido');
    return;
  }
  // Se suman a los que ya estaban, sin repetir.
  panelCampos.establecerCatalogo([...new Set([...panelCampos.obtenerCatalogo(), ...nombres])]);
  guardar();
});

document.getElementById('ed-csv-exportar')!.addEventListener('click', async () => {
  const campos = panelCampos.obtenerCatalogo();
  if (!campos.length) {
    await confirmar('Catálogo vacío', 'Todavía no hay campos en el catálogo para exportar.', 'Entendido');
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
  const nombre = await pedirNombreArchivo(
    'Guardar proyecto',
    'Se descarga un archivo .json con el diseño completo, para seguir editándolo después o en otra PC.',
    'proyecto'
  );
  if (nombre === null) return;
  descargarProyecto(serializarProyecto(lienzo, panelCampos.obtenerCatalogo()), nombre);
});

const inputProyecto = document.createElement('input');
inputProyecto.type = 'file';
inputProyecto.accept = '.json,application/json';
inputProyecto.style.display = 'none';
document.body.appendChild(inputProyecto);

document.getElementById('ed-importar-proyecto')!.addEventListener('click', async () => {
  const hayTrabajo = lienzo.getObjects().length > 0;
  if (hayTrabajo && !(await confirmar('Importar proyecto', 'Se va a reemplazar el diseño actual. ¿Continuar?', 'Importar'))) return;
  inputProyecto.value = '';
  inputProyecto.click();
});

document.getElementById('ed-verificar')!.addEventListener('click', async () => {
  await verificarYExportar();
});

const botonPeso = document.getElementById('ed-peso-btn')!;
botonPeso.addEventListener('click', async () => {
  botonPeso.textContent = 'Calculando…';
  try {
    botonPeso.textContent = `Peso: ${formatearPeso(await pesoDelPdf(lienzo))}`;
  } catch {
    botonPeso.textContent = 'Peso: no se pudo calcular';
  }
});

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
    const bytes = await exportarPdf(lienzo, { conFormulario: opciones.conFormulario });
    descargarPdf(bytes, opciones.nombre);
  } catch (error) {
    await confirmar('No se pudo exportar', error instanceof Error ? error.message : 'Ocurrió un error al generar el PDF.', 'Entendido');
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
    await confirmar('No se pudo importar', error instanceof Error ? error.message : 'El archivo no se pudo leer.', 'Entendido');
  }
});

// ---------- Autoguardado ----------

document.getElementById('ed-nuevo')!.addEventListener('click', borrarAutoguardado);

// Al abrir, ofrecer seguir donde se dejó. Se pregunta en vez de restaurar solo, para no
// pisar sin aviso a quien esperaba empezar en blanco.
if (hayAutoguardado()) {
  const seguir = await confirmar(
    'Continuar donde dejaste',
    'Encontramos un diseño guardado automáticamente en este navegador. ¿Querés retomarlo?',
    'Retomar'
  );
  if (seguir) {
    const proyecto = await restaurarAutoguardado(lienzo);
    if (proyecto) {
      panelCampos.establecerCatalogo(proyecto.campos);
      reflejarPagina();
      inicializarHistorial(lienzo);
    }
  } else {
    borrarAutoguardado();
  }
}

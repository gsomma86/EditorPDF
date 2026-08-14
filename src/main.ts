import './style.css';
import { montarEspacioTrabajo } from './ui/shell';
import { crearLienzo } from './editor/lienzo';
import { crearElemento, crearElementoCampo, crearElementoImagen, crearElementoTabla, type ClaseSimple } from './editor/elemento';
import { agregarAlLienzo, elementoDe, reconstruirLienzo, sincronizarGeometria } from './editor/objetosFabric';
import { mostrarPropiedades, mostrarSinSeleccion } from './ui/panelPropiedades';
import { confirmar, pedirExportarPdf, pedirFilasColumnas, pedirMargenes, pedirNombreArchivo, pedirNuevoProyecto } from './ui/modales';
import { montarPanelCampos } from './ui/panelCampos';
import { deshacer, inicializarHistorial, puedeDeshacer, puedeRehacer, registrarSnapshot, rehacer } from './editor/historial';
import { aplicarConfigPagina, configActual, dibujarGuiaMargenes } from './editor/documento';
import { configPorDefecto, type Orientacion, type TamanoPagina } from './editor/pagina';
import { cargarProyecto, descargarProyecto, leerProyecto, serializarProyecto } from './editor/proyecto';

const raiz = document.querySelector<HTMLDivElement>('#app')!;
const espacio = montarEspacioTrabajo(raiz);
const lienzo = crearLienzo(espacio.lienzoCont);
const panelCampos = montarPanelCampos(espacio.panelCampos, async (nombre) => {
  const elemento = crearElementoCampo(nombre);
  await agregarAlLienzo(lienzo, elemento);
  registrarSnapshot(lienzo);
});
dibujarGuiaMargenes(lienzo);
aplicarConfigPagina(lienzo, configPorDefecto());
inicializarHistorial(lienzo);

function actualizarEscaladoUniforme(objeto: import('fabric').FabricObject): void {
  const elemento = elementoDe(objeto);
  lienzo.uniformScaling = elemento?.clase === 'imagen' ? elemento.proporcion : true;
}

lienzo.on('selection:created', (e) => {
  const objeto = e.selected?.[0];
  if (objeto) {
    mostrarPropiedades(espacio.panelPropiedades, lienzo, objeto);
    actualizarEscaladoUniforme(objeto);
  }
});
lienzo.on('selection:updated', (e) => {
  const objeto = e.selected?.[0];
  if (objeto) {
    mostrarPropiedades(espacio.panelPropiedades, lienzo, objeto);
    actualizarEscaladoUniforme(objeto);
  }
});
lienzo.on('selection:cleared', () => {
  mostrarSinSeleccion(espacio.panelPropiedades);
});
lienzo.on('object:modified', async (e) => {
  const objeto = e.target;
  if (!objeto) return;
  const vigente = await sincronizarGeometria(lienzo, objeto);
  lienzo.requestRenderAll();
  if (lienzo.getActiveObject() === vigente && elementoDe(vigente)) {
    mostrarPropiedades(espacio.panelPropiedades, lienzo, vigente);
  }
  registrarSnapshot(lienzo);
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
      return;
    }

    if ((SIMPLES as string[]).includes(clase ?? '')) {
      const elemento = crearElemento(clase as ClaseSimple);
      await agregarAlLienzo(lienzo, elemento);
      registrarSnapshot(lienzo);
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

document.getElementById('ed-exportar-pdf')!.addEventListener('click', async () => {
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
});

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

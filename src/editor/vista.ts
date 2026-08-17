import type { Canvas, FabricObject } from 'fabric';
import { configActual } from './documento';
import { dimensionesDe } from './pagina';
import { pasoRepeticion } from './elemento';
import { elementoDe } from './objetosFabric';

const PASO_REGLA = 50;
const UMBRAL_SNAP = 6;

export interface EstadoVista {
  zoom: number;
  cuadricula: boolean;
  paso: number;
  reglas: boolean;
  guias: boolean;
}

const estado: EstadoVista = { zoom: 1, cuadricula: false, paso: 5, reglas: false, guias: true };

export function vistaActual(): EstadoVista {
  return estado;
}

let lienzoRef: Canvas | null = null;
/** Guías de alineación vigentes durante un arrastre, en puntos. */
let guiasX: number[] = [];
let guiasY: number[] = [];

export function tamanoPaginaActual(): { ancho: number; alto: number } {
  const config = configActual();
  return dimensionesDe(config);
}

/** Ajusta el tamaño del canvas al de la hoja por el zoom. Llamar tras cambiar página o zoom. */
export function refrescarLienzo(lienzo: Canvas): void {
  const { ancho, alto } = tamanoPaginaActual();
  lienzo.setDimensions({ width: ancho * estado.zoom, height: alto * estado.zoom });
  lienzo.setZoom(estado.zoom);
  dibujarReglas(lienzo);
  lienzo.requestRenderAll();
}

export function establecerZoom(lienzo: Canvas, zoom: number): void {
  estado.zoom = Math.min(4, Math.max(0.25, zoom));
  refrescarLienzo(lienzo);
}

export function configurarVista(lienzo: Canvas, cambios: Partial<EstadoVista>): void {
  Object.assign(estado, cambios);
  refrescarLienzo(lienzo);
}

// ---------- Reglas ----------

function dibujarReglas(lienzo: Canvas): void {
  // Sin capa de interacción no hay dónde dibujar: pasa en los arneses, que corren sin navegador
  // sobre un `StaticCanvas`. Las reglas son solo lo que se ve, así que no dibujarlas no cambia nada.
  const contenedor = lienzo.upperCanvasEl?.parentElement as HTMLElement | undefined;
  if (!contenedor) return;
  contenedor.querySelectorAll('.ed-regla').forEach((n) => n.remove());
  if (!estado.reglas) return;

  const { ancho, alto } = tamanoPaginaActual();

  const horizontal = document.createElement('div');
  horizontal.className = 'ed-regla ed-regla-h';
  for (let x = 0; x <= ancho; x += PASO_REGLA) {
    const marca = document.createElement('span');
    marca.className = 'ed-regla-marca';
    marca.style.left = `${x * estado.zoom}px`;
    marca.textContent = String(x);
    horizontal.appendChild(marca);
  }
  contenedor.appendChild(horizontal);

  const vertical = document.createElement('div');
  vertical.className = 'ed-regla ed-regla-v';
  for (let y = 0; y <= alto; y += PASO_REGLA) {
    const marca = document.createElement('span');
    marca.className = 'ed-regla-marca';
    marca.style.top = `${y * estado.zoom}px`;
    marca.textContent = String(y);
    vertical.appendChild(marca);
  }
  contenedor.appendChild(vertical);
}

// ---------- Cuadrícula, márgenes y guías ----------

/**
 * Dibuja los adornos que no son parte del documento: cuadrícula, márgenes y guías de alineación.
 * Va en 'after:render' y no como objetos del lienzo para que no se puedan seleccionar, no entren
 * al historial ni viajen al PDF. El contexto llega sin el zoom aplicado, así que se escala acá.
 */
function dibujarAdornos(lienzo: Canvas): void {
  const ctx = lienzo.getContext();
  const { ancho, alto } = tamanoPaginaActual();

  ctx.save();
  ctx.scale(estado.zoom, estado.zoom);

  if (estado.cuadricula && estado.paso >= 2) {
    ctx.strokeStyle = 'rgba(4,44,83,0.08)';
    ctx.lineWidth = 1 / estado.zoom;
    ctx.beginPath();
    for (let x = estado.paso; x < ancho; x += estado.paso) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, alto);
    }
    for (let y = estado.paso; y < alto; y += estado.paso) {
      ctx.moveTo(0, y);
      ctx.lineTo(ancho, y);
    }
    ctx.stroke();
  }

  const { arriba, abajo, izquierda, derecha } = configActual().margenes;
  const anchoUtil = ancho - izquierda - derecha;
  const altoUtil = alto - arriba - abajo;
  if (anchoUtil > 0 && altoUtil > 0) {
    ctx.strokeStyle = 'rgba(55,138,221,0.45)';
    ctx.lineWidth = 1 / estado.zoom;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(izquierda, arriba, anchoUtil, altoUtil);
    ctx.setLineDash([]);
  }

  // Fantasmas de un campo repetible: las filas 2 en adelante, que no son objetos del lienzo sino
  // repeticiones que aparecen recién al exportar. Se dibujan acá, como la cuadrícula y los
  // márgenes, para que no se puedan seleccionar ni entren al historial.
  for (const objeto of lienzo.getObjects()) {
    const elemento = elementoDe(objeto);
    if (elemento?.clase !== 'campo' || elemento.repFilas <= 1) continue;

    ctx.save();
    ctx.translate(elemento.x, elemento.y);
    ctx.rotate((elemento.angulo * Math.PI) / 180);
    ctx.strokeStyle = 'rgba(55,138,221,0.55)';
    ctx.fillStyle = 'rgba(55,138,221,0.05)';
    ctx.lineWidth = 1 / estado.zoom;
    ctx.setLineDash([4, 3]);
    for (let fila = 1; fila < elemento.repFilas; fila++) {
      const y = fila * pasoRepeticion(elemento);
      ctx.fillRect(0, y, elemento.w, elemento.h);
      ctx.strokeRect(0, y, elemento.w, elemento.h);
    }
    ctx.setLineDash([]);
    ctx.restore();
  }

  if (guiasX.length || guiasY.length) {
    ctx.strokeStyle = '#e24b4a';
    ctx.lineWidth = 1 / estado.zoom;
    ctx.beginPath();
    for (const x of guiasX) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, alto);
    }
    for (const y of guiasY) {
      ctx.moveTo(0, y);
      ctx.lineTo(ancho, y);
    }
    ctx.stroke();
  }

  ctx.restore();
}

// ---------- Enganche al mover ----------

function bordesDe(objeto: FabricObject): { x: number[]; y: number[] } {
  const izq = objeto.left ?? 0;
  const arr = objeto.top ?? 0;
  const w = (objeto.width ?? 0) * (objeto.scaleX ?? 1);
  const h = (objeto.height ?? 0) * (objeto.scaleY ?? 1);
  return { x: [izq, izq + w / 2, izq + w], y: [arr, arr + h / 2, arr + h] };
}

/** Posiciones de referencia: bordes y centro de la hoja, sus márgenes y los demás objetos. */
function referencias(lienzo: Canvas, movido: FabricObject): { x: number[]; y: number[] } {
  const { ancho, alto } = tamanoPaginaActual();
  const m = configActual().margenes;
  const x = [0, ancho / 2, ancho, m.izquierda, ancho - m.derecha];
  const y = [0, alto / 2, alto, m.arriba, alto - m.abajo];

  for (const otro of lienzo.getObjects()) {
    if (otro === movido) continue;
    const bordes = bordesDe(otro);
    x.push(...bordes.x);
    y.push(...bordes.y);
  }
  return { x, y };
}

function engancharEje(valores: number[], refs: number[]): { ajuste: number; guia: number } | null {
  let mejor: { ajuste: number; guia: number; distancia: number } | null = null;
  for (const valor of valores) {
    for (const ref of refs) {
      const distancia = Math.abs(valor - ref);
      if (distancia <= UMBRAL_SNAP && (!mejor || distancia < mejor.distancia)) {
        mejor = { ajuste: ref - valor, guia: ref, distancia };
      }
    }
  }
  return mejor ? { ajuste: mejor.ajuste, guia: mejor.guia } : null;
}

export function activarVista(lienzo: Canvas): void {
  lienzoRef = lienzo;
  lienzo.on('after:render', () => dibujarAdornos(lienzo));

  lienzo.on('object:moving', (e) => {
    const objeto = e.target;
    if (!objeto) return;

    guiasX = [];
    guiasY = [];

    const cuadriculaActiva = estado.cuadricula && estado.paso >= 2;
    if (cuadriculaActiva) {
      objeto.set({
        left: Math.round((objeto.left ?? 0) / estado.paso) * estado.paso,
        top: Math.round((objeto.top ?? 0) / estado.paso) * estado.paso,
      });
    }

    if (!estado.guias) return;

    // Con la cuadrícula puesta, la posición ya la decidió ella: la guía roja se muestra si
    // coincide justo con una referencia, pero no vuelve a mover el objeto — si no, se pisarían
    // entre sí y el objeto quedaría temblando entre los dos ajustes.
    const refs = referencias(lienzo, objeto);
    const bordes = bordesDe(objeto);

    const enX = engancharEje(bordes.x, refs.x);
    if (enX) {
      if (!cuadriculaActiva) objeto.set({ left: (objeto.left ?? 0) + enX.ajuste });
      guiasX.push(enX.guia);
    }
    const enY = engancharEje(bordes.y, refs.y);
    if (enY) {
      if (!cuadriculaActiva) objeto.set({ top: (objeto.top ?? 0) + enY.ajuste });
      guiasY.push(enY.guia);
    }
  });

  const limpiar = () => {
    if (!guiasX.length && !guiasY.length) return;
    guiasX = [];
    guiasY = [];
    lienzoRef?.requestRenderAll();
  };
  lienzo.on('mouse:up', limpiar);
  lienzo.on('object:modified', limpiar);
}

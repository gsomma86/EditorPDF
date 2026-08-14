import type { Canvas } from 'fabric';
import { elementoDe, reemplazarObjeto } from './objetosFabric';
import { registrarSnapshot } from './historial';
import { altoTotalTabla, anchoTotalTabla, type ElementoTabla } from './elemento';

const MIN_COL = 8;
const MIN_ROW = 6;

export function activarResizeTabla(lienzo: Canvas): void {
  const contenedor = lienzo.upperCanvasEl.parentElement as HTMLElement;
  let barras: HTMLElement[] = [];

  function limpiarBarras(): void {
    barras.forEach((b) => b.remove());
    barras = [];
  }

  function actualizarBarras(): void {
    limpiarBarras();
    const activo = lienzo.getActiveObject();
    const elemento = activo ? elementoDe(activo) : undefined;
    if (!activo || !elemento || elemento.clase !== 'tabla') return;

    const ancho = anchoTotalTabla(elemento);
    const alto = altoTotalTabla(elemento);
    const left = activo.left ?? 0;
    const top = activo.top ?? 0;

    let acumX = 0;
    for (let i = 0; i < elemento.cols.length - 1; i++) {
      acumX += elemento.cols[i];
      const barra = document.createElement('div');
      barra.className = 'ed-barra-col';
      barra.style.left = `${left + acumX}px`;
      barra.style.top = `${top}px`;
      barra.style.height = `${alto}px`;
      contenedor.appendChild(barra);
      barras.push(barra);
      wireDrag(barra, 'col', i);
    }

    let acumY = 0;
    for (let i = 0; i < elemento.rows.length - 1; i++) {
      acumY += elemento.rows[i];
      const barra = document.createElement('div');
      barra.className = 'ed-barra-fila';
      barra.style.left = `${left}px`;
      barra.style.top = `${top + acumY}px`;
      barra.style.width = `${ancho}px`;
      contenedor.appendChild(barra);
      barras.push(barra);
      wireDrag(barra, 'row', i);
    }
  }

  function wireDrag(barra: HTMLElement, tipo: 'col' | 'row', indice: number): void {
    barra.addEventListener('mousedown', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();

      const activo = lienzo.getActiveObject();
      const elemento = activo ? (elementoDe(activo) as ElementoTabla | undefined) : undefined;
      if (!activo || !elemento) return;

      let objetoActual = activo;
      const inicioX = ev.clientX;
      const inicioY = ev.clientY;
      const medidaInicial = tipo === 'col' ? elemento.cols[indice] : elemento.rows[indice];
      let ocupado = false;

      const mover = (m: MouseEvent) => {
        if (ocupado) return;
        const delta = tipo === 'col' ? m.clientX - inicioX : m.clientY - inicioY;
        const nuevaMedida = Math.max(tipo === 'col' ? MIN_COL : MIN_ROW, Math.round(medidaInicial + delta));
        if (tipo === 'col') elemento.cols[indice] = nuevaMedida;
        else elemento.rows[indice] = nuevaMedida;

        ocupado = true;
        reemplazarObjeto(lienzo, objetoActual, elemento).then((nuevo) => {
          objetoActual = nuevo;
          actualizarBarras();
          ocupado = false;
        });
      };
      const soltar = () => {
        document.removeEventListener('mousemove', mover);
        document.removeEventListener('mouseup', soltar);
        registrarSnapshot(lienzo);
      };
      document.addEventListener('mousemove', mover);
      document.addEventListener('mouseup', soltar);
    });
  }

  lienzo.on('selection:created', actualizarBarras);
  lienzo.on('selection:updated', actualizarBarras);
  lienzo.on('selection:cleared', limpiarBarras);
  lienzo.on('object:removed', (e) => {
    if (elementoDe(e.target)?.clase === 'tabla') limpiarBarras();
  });
  // Las barras se calculan a partir de activo.left/top: si el usuario arrastra o escala la
  // tabla (no solo al seleccionarla), hay que seguir el objeto en cada tick o quedan pegadas
  // a la posición vieja — es justo lo que reportó Germán al mover la tabla.
  lienzo.on('object:moving', (e) => {
    if (elementoDe(e.target)?.clase === 'tabla') actualizarBarras();
  });
  lienzo.on('object:scaling', (e) => {
    if (elementoDe(e.target)?.clase === 'tabla') actualizarBarras();
  });
}

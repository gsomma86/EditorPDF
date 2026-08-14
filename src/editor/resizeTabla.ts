import type { Canvas } from 'fabric';
import { elementoDe, reemplazarObjeto } from './objetosFabric';
import { altoTotalTabla, anchoTotalTabla, type ElementoTabla } from './elemento';

const TOLERANCIA = 5;

interface EstadoDrag {
  elemento: ElementoTabla;
  tipo: 'col' | 'row';
  indice: number;
}

export function activarResizeTabla(lienzo: Canvas): void {
  let estado: EstadoDrag | null = null;
  let ocupado = false;

  function divisorEnPuntero(elemento: ElementoTabla, localX: number, localY: number): EstadoDrag | null {
    const ancho = anchoTotalTabla(elemento);
    const alto = altoTotalTabla(elemento);
    if (localX < -TOLERANCIA || localX > ancho + TOLERANCIA || localY < -TOLERANCIA || localY > alto + TOLERANCIA) return null;

    let acum = 0;
    for (let i = 0; i < elemento.cols.length - 1; i++) {
      acum += elemento.cols[i];
      if (Math.abs(localX - acum) <= TOLERANCIA) return { elemento, tipo: 'col', indice: i };
    }
    acum = 0;
    for (let i = 0; i < elemento.rows.length - 1; i++) {
      acum += elemento.rows[i];
      if (Math.abs(localY - acum) <= TOLERANCIA) return { elemento, tipo: 'row', indice: i };
    }
    return null;
  }

  lienzo.on('mouse:down', (opt) => {
    const activo = lienzo.getActiveObject();
    if (!activo) return;
    const elemento = elementoDe(activo);
    if (!elemento || elemento.clase !== 'tabla') return;

    const puntero = lienzo.getScenePoint(opt.e);
    const localX = puntero.x - (activo.left ?? 0);
    const localY = puntero.y - (activo.top ?? 0);
    const hit = divisorEnPuntero(elemento, localX, localY);
    if (!hit) return;

    estado = hit;
    activo.set({ lockMovementX: true, lockMovementY: true });
  });

  lienzo.on('mouse:move', (opt) => {
    if (!estado || ocupado) return;
    const activo = lienzo.getActiveObject();
    if (!activo) {
      estado = null;
      return;
    }

    const puntero = lienzo.getScenePoint(opt.e);
    const localX = puntero.x - (activo.left ?? 0);
    const localY = puntero.y - (activo.top ?? 0);
    const { elemento, tipo, indice } = estado;

    let acumAnterior = 0;
    if (tipo === 'col') {
      for (let i = 0; i < indice; i++) acumAnterior += elemento.cols[i];
      elemento.cols[indice] = Math.max(8, Math.round(localX - acumAnterior));
    } else {
      for (let i = 0; i < indice; i++) acumAnterior += elemento.rows[i];
      elemento.rows[indice] = Math.max(6, Math.round(localY - acumAnterior));
    }

    ocupado = true;
    reemplazarObjeto(lienzo, activo, elemento).then((nuevo) => {
      nuevo.set({ lockMovementX: true, lockMovementY: true });
      ocupado = false;
    });
  });

  lienzo.on('mouse:up', () => {
    if (!estado) return;
    estado = null;
    const activo = lienzo.getActiveObject();
    if (activo) activo.set({ lockMovementX: false, lockMovementY: false });
  });
}

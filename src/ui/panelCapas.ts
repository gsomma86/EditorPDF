/**
 * La lista de capas y objetos de la hoja.
 *
 * Es la respuesta a un problema concreto: con una plantilla real hay doscientos elementos
 * amontonados y, si uno queda tapado por otro, no había forma de llegar a él sin mover lo de
 * arriba. Desde acá se lo encuentra, se lo selecciona, se lo apaga o se lo traba.
 *
 * La lista va **de adelante hacia atrás**, como en cualquier editor: lo de arriba es lo que se ve
 * encima. Ojo con eso: en el lienzo el primero del arreglo es el de más atrás, así que el orden se
 * invierte para mostrarlo.
 */

import type { Canvas } from 'fabric';
import { capaDe, capasDelDocumento, elementoBloqueado, elementoVisible, establecerCapas, type Capa } from '../editor/documento';
import { aplicarMarcas, elementoDe } from '../editor/objetosFabric';
import type { Elemento } from '../editor/elemento';
import { t } from './i18n';

export interface PanelCapas {
  /** Vuelve a dibujar la lista. Se llama tras cualquier cambio en el lienzo o en las capas. */
  refrescar(): void;
}

/** Con qué nombre aparece un elemento que no tiene uno puesto a mano. */
function nombreDe(elemento: Elemento): string {
  if (elemento.nombre) return elemento.nombre;
  if (elemento.clase === 'campo') return elemento.name;
  if (elemento.clase === 'texto') return `"${elemento.text.slice(0, 24)}"`;
  // Las cuatro figuras son una sola clase, pero en la lista se nombran por lo que son: decir
  // "Forma" cuatro veces no ayudaría a encontrar ninguna.
  if (elemento.clase === 'forma') return t(`tipo.forma.${elemento.figura}` as never);
  return t(`tipo.${elemento.clase}` as never);
}

const ICONO: Record<string, string> = {
  texto: '✏',
  linea: '➖',
  rect: '▭',
  elipse: '⬭',
  triangulo: '►',
  flecha: '➔',
  estrella: '★',
  tabla: '▦',
  imagen: '🖼',
  qr: '▪',
  campo: '⌸',
  firma: '✒',
};

export function montarPanelCapas(panel: HTMLElement, lienzo: Canvas, alCambiar: () => void): PanelCapas {
  function refrescar(): void {
    const capas = capasDelDocumento();
    // De adelante hacia atrás: en el lienzo el último es el que se ve encima.
    const enOrden = [...lienzo.getObjects()].reverse();
    const activo = lienzo.getActiveObject();

    panel.innerHTML = capas
      .map((capa) => {
        const suyos = enOrden.filter((o) => {
          const el = elementoDe(o);
          return el && capaDe(el).id === capa.id;
        });

        const objetos = suyos
          .map((objeto) => {
            const el = elementoDe(objeto)!;
            const clases = ['ed-obj', el.oculto ? 'oculto' : '', el.bloqueado ? 'bloq' : '', objeto === activo ? 'sel' : ''];
            return `
              <div class="${clases.filter(Boolean).join(' ')}" data-id="${el.id}" title="${nombreDe(el)}">
                <span class="ed-obj-ic">${ICONO[el.clase === 'forma' ? el.figura : el.clase] ?? '▫'}</span>
                <span class="ed-obj-nom">${nombreDe(el)}</span>
                <button type="button" class="ed-obj-btn" data-ver="${el.id}" data-i18n-title="capas.verTt" title="${t('capas.verTt')}">${el.oculto ? '⃠' : '👁'}</button>
                <button type="button" class="ed-obj-btn" data-trabar="${el.id}" data-i18n-title="capas.trabarTt" title="${t('capas.trabarTt')}">${el.bloqueado ? '🔒' : '🔓'}</button>
              </div>`;
          })
          .join('');

        return `
          <div class="ed-capa" data-capa="${capa.id}">
            <div class="ed-capa-head">
              <button type="button" class="ed-obj-btn" data-capa-ver="${capa.id}" title="${t('capas.verTt')}">${capa.visible ? '👁' : '⃠'}</button>
              <button type="button" class="ed-obj-btn" data-capa-trabar="${capa.id}" title="${t('capas.trabarTt')}">${capa.bloqueada ? '🔒' : '🔓'}</button>
              <span class="ed-capa-nom" data-renombrar="${capa.id}">${capa.nombre}</span>
              <span class="ed-col-n">${suyos.length}</span>
            </div>
            ${objetos}
          </div>`;
      })
      .join('');

    panel.insertAdjacentHTML(
      'beforeend',
      `<div class="ed-capas-acciones"><button type="button" id="ed-capa-nueva">${t('capas.nueva')}</button></div>`
    );
  }

  /** Busca un elemento por su id en la hoja que está a la vista. */
  const buscar = (id: number) => lienzo.getObjects().find((o) => elementoDe(o)?.id === id);

  panel.addEventListener('click', (e) => {
    const destino = e.target as HTMLElement;
    const capas = capasDelDocumento();

    // Apagar o trabar una capa entera.
    const verCapa = destino.dataset.capaVer;
    const trabarCapa = destino.dataset.capaTrabar;
    if (verCapa || trabarCapa) {
      const capa = capas.find((c) => c.id === (verCapa ?? trabarCapa))!;
      if (verCapa) capa.visible = !capa.visible;
      else capa.bloqueada = !capa.bloqueada;
      refrescarObjetos();
      return;
    }

    const ver = destino.dataset.ver;
    const trabar = destino.dataset.trabar;
    if (ver || trabar) {
      const objeto = buscar(Number(ver ?? trabar));
      const el = objeto && elementoDe(objeto);
      if (!el) return;
      if (ver) el.oculto = !el.oculto;
      else el.bloqueado = !el.bloqueado;
      refrescarObjetos();
      return;
    }

    if (destino.id === 'ed-capa-nueva') {
      establecerCapas([...capas, { id: `c${Date.now()}`, nombre: t('capas.nombreNueva', { n: capas.length + 1 }), visible: true, bloqueada: false }]);
      refrescar();
      alCambiar();
      return;
    }

    // Clic en la fila: seleccionar en el lienzo, que es para lo que más se usa la lista.
    const fila = destino.closest<HTMLElement>('.ed-obj');
    if (fila) {
      const objeto = buscar(Number(fila.dataset.id));
      if (!objeto || !objeto.selectable) return;
      lienzo.setActiveObject(objeto);
      lienzo.requestRenderAll();
      refrescar();
    }
  });

  /** Vuelve a aplicar al lienzo lo que dice el modelo y redibuja la lista. */
  function refrescarObjetos(): void {
    for (const objeto of lienzo.getObjects()) {
      const el = elementoDe(objeto);
      if (el) aplicarMarcas(objeto, el);
    }
    // Lo que se acaba de apagar o trabar no puede quedar seleccionado.
    const activo = lienzo.getActiveObject();
    const el = activo && elementoDe(activo);
    if (el && (!elementoVisible(el) || elementoBloqueado(el))) lienzo.discardActiveObject();
    lienzo.requestRenderAll();
    refrescar();
    alCambiar();
  }

  // Renombrar una capa con doble clic, en su lugar.
  panel.addEventListener('dblclick', (e) => {
    const destino = (e.target as HTMLElement).closest<HTMLElement>('[data-renombrar]');
    if (!destino) return;
    const capa = capasDelDocumento().find((c) => c.id === destino.dataset.renombrar) as Capa;
    const nuevo = prompt(t('capas.renombrar'), capa.nombre);
    if (nuevo === null) return;
    capa.nombre = nuevo.trim() || capa.nombre;
    refrescar();
    alCambiar();
  });

  refrescar();
  return { refrescar };
}

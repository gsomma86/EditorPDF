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

import type { Canvas, FabricObject } from 'fabric';
import { capaDe, capasDelDocumento, elementoBloqueado, elementoVisible, establecerCapaDestino, establecerCapas, type Capa } from '../editor/documento';
import { agregarAlLienzo, aplicarMarcas, elementoDe } from '../editor/objetosFabric';
import { duplicarElemento, type Elemento } from '../editor/elemento';
import { registrarSnapshot } from '../editor/historial';
import { pedirDestinoAlBorrarCapa, pedirTexto } from './modales';
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
  // Las figuras son una sola clase, pero en la lista se nombran por lo que son: repetir "Forma"
  // en cada una no ayudaría a encontrar ninguna.
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
  camino: '〰',
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
              <div class="${clases.filter(Boolean).join(' ')}" data-id="${el.id}" title="${nombreDe(el)}" draggable="true">
                <span class="ed-obj-ic">${ICONO[el.clase === 'forma' ? el.figura : el.clase] ?? '▫'}</span>
                <span class="ed-obj-nom">${nombreDe(el)}</span>
                <button type="button" class="ed-obj-btn" data-ver="${el.id}" data-i18n-title="capas.verTt" title="${t('capas.verTt')}">${el.oculto ? '⃠' : '👁'}</button>
                <button type="button" class="ed-obj-btn" data-trabar="${el.id}" data-i18n-title="capas.trabarTt" title="${t('capas.trabarTt')}">${el.bloqueado ? '🔒' : '🔓'}</button>
              </div>`;
          })
          .join('');

        return `
          <div class="ed-capa ${capa.destino ? 'destino' : ''}" data-capa="${capa.id}">
            <div class="ed-capa-head" draggable="true" data-arrastrar-capa="${capa.id}">
              <button type="button" class="ed-obj-btn" data-capa-ver="${capa.id}" title="${t('capas.verTt')}">${capa.visible ? '👁' : '⃠'}</button>
              <button type="button" class="ed-obj-btn" data-capa-trabar="${capa.id}" title="${t('capas.trabarTt')}">${capa.bloqueada ? '🔒' : '🔓'}</button>
              <span class="ed-capa-nom" data-destino="${capa.id}" title="${t('capas.destinoTt')}">${capa.nombre}</span>
              ${capa.destino ? `<span class="ed-capa-marca" title="${t('capas.destinoTt')}">◉</span>` : ''}
              <span class="ed-col-n">${suyos.length}</span>
              <button type="button" class="ed-obj-btn ed-capa-menu-btn" data-capa-menu="${capa.id}" title="${t('capas.menuTt')}">⋯</button>
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
      // El número sale del más alto que ya se haya usado, no de cuántas capas hay: contando, al
      // borrar una y crear otra salían dos capas con el mismo nombre.
      const usados = capas.map((c) => Number(/(\d+)\s*$/.exec(c.nombre)?.[1] ?? 0));
      // La recién creada pasa a ser la destino: si se creó una capa es para poner algo adentro.
      const nueva = { id: `c${Date.now()}`, nombre: t('capas.nombreNueva', { n: Math.max(0, ...usados) + 1 }), visible: true, bloqueada: false };
      establecerCapas([...capas, nueva]);
      establecerCapaDestino(nueva.id);
      refrescar();
      alCambiar();
      registrarSnapshot(lienzo);
      return;
    }

    const abrirMenu = destino.dataset.capaMenu;
    if (abrirMenu) {
      menuDeCapa(abrirMenu, destino);
      return;
    }

    // Clic en el nombre de la capa: pasa a ser la que recibe los elementos nuevos.
    const marcar = destino.dataset.destino;
    if (marcar) {
      establecerCapaDestino(marcar);
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

  /**
   * Como `refrescarObjetos`, pero además deja un paso en el historial. Lo usan las operaciones que
   * cambian la estructura del documento —crear, mover, duplicar o borrar una capa—, que sí se
   * tienen que poder deshacer. Apagar o trabar no: son de vista, como en el resto del editor.
   */
  function refrescarConHistorial(): void {
    refrescarObjetos();
    registrarSnapshot(lienzo);
  }

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

  /** Los objetos del lienzo que pertenecen a una capa, de atrás hacia adelante. */
  const objetosDe = (capaId: string) =>
    lienzo.getObjects().filter((o) => {
      const el = elementoDe(o);
      return el && capaDe(el).id === capaId;
    });

  /**
   * Rehace el apilado del lienzo para que respete el orden de las capas: la primera de la lista es
   * la que se ve más adelante, como se la muestra. Sin esto, mover una capa cambiaría la lista pero
   * no lo que se ve, y la lista estaría mintiendo.
   *
   * Ojo con las formas sacadas de un PDF: se dibujan con `destination-over` y su apilado real es el
   * inverso (ver `moverEnLaPila` en objetosFabric). Viven todas en la capa de base, así que
   * mientras no se las reparta entre capas esto no las afecta.
   */
  function aplicarOrdenDeCapas(): void {
    const capas = capasDelDocumento();
    // De la última a la primera, mandando cada una al frente: al terminar, la primera de la lista
    // quedó adelante de todas.
    for (let i = capas.length - 1; i >= 0; i--) {
      for (const objeto of objetosDe(capas[i].id)) lienzo.bringObjectToFront(objeto);
    }
  }

  /** Cambia una capa de lugar en la lista y reordena el lienzo para que se vea el cambio. */
  function moverCapa(id: string, hasta: number): void {
    const capas = [...capasDelDocumento()];
    const desde = capas.findIndex((c) => c.id === id);
    if (desde < 0 || hasta < 0 || hasta >= capas.length || desde === hasta) return;
    const [capa] = capas.splice(desde, 1);
    capas.splice(hasta, 0, capa);
    establecerCapas(capas);
    aplicarOrdenDeCapas();
    refrescarConHistorial();
  }

  /** El menú de una capa: renombrar, duplicar, mover y eliminar. */
  function menuDeCapa(id: string, boton: HTMLElement): void {
    const capas = capasDelDocumento();
    const indice = capas.findIndex((c) => c.id === id);
    const capa = capas[indice];
    if (!capa) return;

    // Las opciones que no se pueden usar se muestran apagadas y no se sacan: si desaparecieran, el
    // resto del menú cambiaría de lugar entre una capa y otra.
    const item = (accion: string, icono: string, clave: Parameters<typeof t>[0], habilitada: boolean, roja = false) =>
      `<div class="it ${habilitada ? '' : 'apagada'} ${roja ? 'roja' : ''}" ${habilitada ? `data-accion="${accion}"` : ''}>
         <span class="ic">${icono}</span>${t(clave)}
       </div>`;

    const menu = document.createElement('div');
    menu.className = 'ed-capas-menu';
    menu.innerHTML =
      item('renombrar', '✎', 'capas.menu.renombrar', true) +
      item('duplicar', '⧉', 'capas.menu.duplicar', true) +
      '<div class="ed-dd-sep"></div>' +
      item('subir', '↑', 'capas.menu.subir', indice > 0) +
      item('bajar', '↓', 'capas.menu.bajar', indice < capas.length - 1) +
      '<div class="ed-dd-sep"></div>' +
      item('borrar', '✕', 'capas.menu.borrar', capas.length > 1, true);

    const caja = boton.getBoundingClientRect();
    menu.style.left = `${Math.max(4, caja.right - 190)}px`;
    menu.style.top = `${caja.bottom + 2}px`;
    document.body.appendChild(menu);

    const cerrar = () => {
      menu.remove();
      document.removeEventListener('pointerdown', afuera, true);
    };
    const afuera = (ev: PointerEvent) => {
      if (!menu.contains(ev.target as Node)) cerrar();
    };
    // En `pointerdown`, no en `click`: el que cierra el menú también lo es y llega antes, así que
    // con `click` la opción no se llegaba a ejecutar nunca (lección 33).
    menu.addEventListener('pointerdown', (ev) => {
      const opcion = (ev.target as HTMLElement).closest<HTMLElement>('[data-accion]');
      if (!opcion) return;
      cerrar();
      void ejecutar(opcion.dataset.accion!, id, indice);
    });
    document.addEventListener('pointerdown', afuera, true);
  }

  async function ejecutar(accion: string, id: string, indice: number): Promise<void> {
    const capas = capasDelDocumento();
    const capa = capas.find((c) => c.id === id);
    if (!capa) return;

    if (accion === 'subir') return moverCapa(id, indice - 1);
    if (accion === 'bajar') return moverCapa(id, indice + 1);

    if (accion === 'renombrar') {
      const nuevo = await pedirTexto(t('capas.menu.renombrar'), t('capas.nombreLbl'), capa.nombre);
      if (nuevo === null) return;
      capa.nombre = nuevo.trim() || capa.nombre;
      refrescar();
      alCambiar();
      registrarSnapshot(lienzo);
      return;
    }

    if (accion === 'duplicar') {
      // Con lo que tiene adentro: una capa vacía con el mismo nombre no le sirve a nadie. Los
      // objetos se clonan como al duplicar uno suelto —corridos unos puntos— y van a la capa nueva.
      const nueva: Capa = { id: `c${Date.now()}`, nombre: t('capas.nombreCopia', { nombre: capa.nombre }), visible: capa.visible, bloqueada: capa.bloqueada };
      const copias = objetosDe(id).map((o) => elementoDe(o)!).filter(Boolean);
      establecerCapas([...capas.slice(0, indice + 1), nueva, ...capas.slice(indice + 1)]);
      for (const original of copias) {
        const clon = duplicarElemento(original);
        clon.capa = nueva.id;
        await agregarAlLienzo(lienzo, clon);
      }
      aplicarOrdenDeCapas();
      refrescarConHistorial();
      return;
    }

    if (accion === 'borrar') {
      if (capas.length < 2) return;
      const quedan = capas.filter((c) => c.id !== id);
      const suyos = objetosDe(id);

      // Con algo adentro se pregunta qué hacer, en vez de decidir por el otro: las dos respuestas
      // son razonables. Photoshop y compañía se llevan el contenido; mover a otra capa es más
      // conservador. Deshacer cubre las dos, así que ninguna es una trampa.
      if (suyos.length) {
        const que = await pedirDestinoAlBorrarCapa(capa.nombre, suyos.length, quedan);
        if (!que) return;

        if (que.accion === 'todo') lienzo.remove(...suyos);
        else {
          for (const objeto of suyos) {
            const el = elementoDe(objeto);
            if (el) el.capa = que.capa;
          }
        }
      }

      establecerCapas(quedan);
      aplicarOrdenDeCapas();
      refrescarConHistorial();
    }
  }

  /**
   * Manda elementos a otra capa. Si el que se agarró es parte de una selección de varios, van
   * todos: mover de a uno con una plantilla llena de campos no es trabajo de nadie.
   */
  function moverACapa(id: number, capaId: string): void {
    const objeto = buscar(id);
    if (!objeto) return;
    const activo = lienzo.getActiveObject();
    const enGrupo = (activo as any)?.getObjects?.() as FabricObject[] | undefined;
    const alcance = enGrupo?.includes(objeto) ? enGrupo : [objeto];
    for (const uno of alcance) {
      const el = elementoDe(uno);
      if (el) el.capa = capaId;
    }
    refrescarConHistorial();
  }

  // ---------- Arrastrar: un objeto a otra capa, o una capa a otra posición ----------

  // Dos arrastres distintos comparten los mismos eventos, así que se distingue por dónde empezó:
  // agarrando la fila de un objeto se lo cambia de capa; agarrando la cabecera se reordena la capa.
  let arrastrado: number | null = null;
  let capaArrastrada: string | null = null;

  panel.addEventListener('dragstart', (e) => {
    const cabecera = (e.target as HTMLElement).closest<HTMLElement>('[data-arrastrar-capa]');
    if (cabecera) {
      capaArrastrada = cabecera.dataset.arrastrarCapa!;
      cabecera.closest('.ed-capa')!.classList.add('arrastrando');
      e.dataTransfer?.setData('text/plain', capaArrastrada);
      return;
    }
    const fila = (e.target as HTMLElement).closest<HTMLElement>('.ed-obj');
    if (!fila) return;
    arrastrado = Number(fila.dataset.id);
    fila.classList.add('arrastrando');
    // Firefox no arranca el arrastre si no se le pone algo al portapapeles.
    e.dataTransfer?.setData('text/plain', String(arrastrado));
  });

  panel.addEventListener('dragend', () => {
    arrastrado = null;
    capaArrastrada = null;
    panel.querySelectorAll('.arrastrando, .sobre, .sobre-capa').forEach((n) => n.classList.remove('arrastrando', 'sobre', 'sobre-capa'));
  });

  panel.addEventListener('dragover', (e) => {
    const caja = (e.target as HTMLElement).closest<HTMLElement>('.ed-capa');
    if (!caja || (arrastrado === null && capaArrastrada === null)) return;
    e.preventDefault(); // sin esto el navegador no deja soltar
    panel.querySelectorAll('.sobre, .sobre-capa').forEach((n) => n.classList.remove('sobre', 'sobre-capa'));
    // Reordenando se marca solo la línea de arriba, que es donde va a caer; cambiando un objeto de
    // capa se marca la capa entera, que es lo que lo va a recibir.
    if (capaArrastrada && caja.dataset.capa !== capaArrastrada) caja.classList.add('sobre-capa');
    else if (arrastrado !== null) caja.classList.add('sobre');
  });

  panel.addEventListener('drop', (e) => {
    const caja = (e.target as HTMLElement).closest<HTMLElement>('.ed-capa');
    if (!caja) return;
    e.preventDefault();

    if (capaArrastrada) {
      const capas = capasDelDocumento();
      const hasta = capas.findIndex((c) => c.id === caja.dataset.capa);
      moverCapa(capaArrastrada, hasta);
      capaArrastrada = null;
      return;
    }

    if (arrastrado !== null) {
      moverACapa(arrastrado, caja.dataset.capa!);
      arrastrado = null;
    }
  });

  // ---------- Clic derecho: mover a la capa que se elija ----------

  panel.addEventListener('contextmenu', (e) => {
    const fila = (e.target as HTMLElement).closest<HTMLElement>('.ed-obj');
    if (!fila) return;
    e.preventDefault();
    const id = Number(fila.dataset.id);
    const el = elementoDe(buscar(id)!);
    if (!el) return;

    const menu = document.createElement('div');
    menu.className = 'ed-capas-menu';
    menu.innerHTML =
      // Renombrar arriba: con dos QR o tres líneas, el nombre automático los llama igual y no hay
      // forma de distinguirlos en la lista. El nombre a mano ya vivía en el modelo (`Marcas`) y se
      // guardaba con el proyecto; lo que faltaba era dónde escribirlo.
      `<div class="it" data-renombrar-obj><span class="ic">✎</span>${t('capas.menu.renombrar')}</div>` +
      '<div class="ed-dd-sep"></div>' +
      `<div class="ed-dd-nota">${t('capas.moverA')}</div>` +
      capasDelDocumento()
        .map((c) => `<div data-mover="${c.id}">${c.nombre}${capaDe(el).id === c.id ? ' ✓' : ''}</div>`)
        .join('');
    menu.style.left = `${e.clientX}px`;
    menu.style.top = `${e.clientY}px`;
    document.body.appendChild(menu);

    const cerrar = () => {
      menu.remove();
      document.removeEventListener('pointerdown', afuera, true);
    };
    const afuera = (ev: PointerEvent) => {
      if (!menu.contains(ev.target as Node)) cerrar();
    };
    // Las opciones se atienden en `pointerdown` y no en `click`: el que cierra el menú también es
    // un `pointerdown`, que llega antes que el `click` y se llevaría la opción puesta (lección 33).
    menu.addEventListener('pointerdown', (ev) => {
      if ((ev.target as HTMLElement).closest('[data-renombrar-obj]')) {
        cerrar();
        void (async () => {
          // Se ofrece el nombre que se está mostrando —el puesto a mano o el automático—, así
          // renombrar "QR" a "QR de la factura" no arranca de un campo vacío.
          const nuevo = await pedirTexto(t('capas.menu.renombrar'), t('capas.nombreObjLbl'), nombreDe(el));
          if (nuevo === null) return;
          // Vacío borra el nombre a mano y vuelve al automático, que es la forma de deshacerlo.
          el.nombre = nuevo.trim() || undefined;
          refrescarConHistorial();
        })();
        return;
      }
      const opcion = (ev.target as HTMLElement).closest<HTMLElement>('[data-mover]');
      if (!opcion) return;
      moverACapa(id, opcion.dataset.mover!);
      cerrar();
    });
    document.addEventListener('pointerdown', afuera, true);
  });

  // Renombrar una capa con doble clic, en su lugar.
  // Renombrar ya no se hace con doble clic: el primer clic marca la capa destino y redibuja la
  // lista entera, así que el segundo caía sobre un elemento nuevo y el doble clic nunca llegaba.
  // Vive en el menú de la capa (⋯), donde además no compite con nada.

  refrescar();
  return { refrescar };
}

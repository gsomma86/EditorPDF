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
import {
  capaDe,
  capasDelDocumento,
  capasSobreElFondoDelDocumento,
  elementoBloqueado,
  elementoVisible,
  establecerCapaDestino,
  establecerCapas,
  establecerCapasSobreElFondo,
  fondoDeLaHoja,
  paginaDeLaHoja,
  type Capa,
} from '../editor/documento';
import { agregarAlLienzo, aplicarMarcas, elementoDe, moverEnLaPila, ordenarPila } from '../editor/objetosFabric';
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
  /**
   * Las capas plegadas, por id. Con una plantilla real la capa de base tiene casi doscientos
   * campos, y la lista entera es un solo chorizo donde las demás capas no se distinguen: plegarla
   * deja ver la estructura de un vistazo.
   *
   * Es estado de **vista**, como apagar o trabar: no va al modelo ni al historial. Vive en el
   * módulo para que aguante los redibujados —la lista se rearma entera en cada `refrescar`— y se
   * pierde al recargar, que es cuando de todas formas se vuelve a empezar.
   */
  const plegadas = new Set<string>();

  function refrescar(): void {
    // De adelante hacia atrás: en el lienzo el último es el que se ve encima.
    const enOrden = [...lienzo.getObjects()].reverse();
    const activo = lienzo.getActiveObject();

    panel.innerHTML = filas()
      .map((fila) => {
        // La página del PDF va como una fila más, para que la lista no prometa un orden que el
        // lienzo no respeta: lo que quede por debajo de ella se dibuja debajo de la página.
        if (fila.fondo) {
          return `
          <div class="ed-capa ed-capa-fondo" data-fondo="1">
            <div class="ed-capa-head" draggable="true" data-arrastrar-fondo="1" title="${t('capas.fondoTt')}">
              <span class="ed-obj-ic">📄</span>
              <span class="ed-capa-nom" data-i18n="capas.fondo">${t('capas.fondo')}</span>
            </div>
          </div>`;
        }

        const capa = fila.capa!;
        const suyos = enOrden.filter((o) => {
          const el = elementoDe(o);
          return el && capaDe(el).id === capa.id;
        });

        const plegada = plegadas.has(capa.id);
        // Plegada no se dibuja ninguna fila: es justamente lo que hace que la lista entre en
        // pantalla. El contador de la cabecera sigue diciendo cuántos hay, así que no se pierde de
        // vista que la capa tiene algo adentro.
        const objetos = plegada
          ? ''
          : suyos
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

        // Con la capa plegada, lo seleccionado en el lienzo queda sin fila que lo muestre. La
        // cabecera lo avisa, para que no parezca que el objeto se perdió de la lista.
        const escondeLaSeleccion = plegada && suyos.some((o) => o === activo);

        return `
          <div class="ed-capa ${capa.destino ? 'destino' : ''} ${plegada ? 'plegada' : ''}" data-capa="${capa.id}">
            <div class="ed-capa-head" draggable="true" data-arrastrar-capa="${capa.id}">
              <button type="button" class="ed-obj-btn ed-capa-plegar" data-plegar="${capa.id}" title="${t(plegada ? 'capas.desplegarTt' : 'capas.plegarTt')}">${plegada ? '▸' : '▾'}</button>
              <button type="button" class="ed-obj-btn" data-capa-ver="${capa.id}" title="${t('capas.verTt')}">${capa.visible ? '👁' : '⃠'}</button>
              <button type="button" class="ed-obj-btn" data-capa-trabar="${capa.id}" title="${t('capas.trabarTt')}">${capa.bloqueada ? '🔒' : '🔓'}</button>
              <span class="ed-capa-nom" data-destino="${capa.id}" title="${t('capas.destinoTt')}">${capa.nombre}</span>
              ${capa.destino ? `<span class="ed-capa-marca" title="${t('capas.destinoTt')}">◉</span>` : ''}
              ${escondeLaSeleccion ? `<span class="ed-capa-sel" title="${t('capas.tieneSeleccionTt')}">●</span>` : ''}
              <span class="ed-col-n">${suyos.length}</span>
              <button type="button" class="ed-obj-btn ed-capa-menu-btn" data-capa-menu="${capa.id}" title="${t('capas.menuTt')}">⋯</button>
            </div>
            ${objetos}
          </div>`;
      })
      .join('');

    // "Plegar todo" solo tiene sentido con más de una capa; con una sola, el botón de su cabecera
    // ya hace lo mismo.
    const capas = capasDelDocumento();
    const todasPlegadas = capas.length > 0 && capas.every((c) => plegadas.has(c.id));
    const botonTodo =
      capas.length > 1
        ? `<button type="button" id="ed-capas-plegar-todo">${t(todasPlegadas ? 'capas.desplegarTodo' : 'capas.plegarTodo')}</button>`
        : '';

    panel.insertAdjacentHTML(
      'beforeend',
      `<div class="ed-capas-acciones">${botonTodo}<button type="button" id="ed-capa-nueva">${t('capas.nueva')}</button></div>`
    );
  }

  /** Busca un elemento por su id en la hoja que está a la vista. */
  const buscar = (id: number) => lienzo.getObjects().find((o) => elementoDe(o)?.id === id);

  panel.addEventListener('click', (e) => {
    const destino = e.target as HTMLElement;
    const capas = capasDelDocumento();

    // Plegar o desplegar una capa. Es solo de vista: no toca el modelo ni deja paso en el historial.
    const plegar = destino.dataset.plegar;
    if (plegar) {
      if (plegadas.has(plegar)) plegadas.delete(plegar);
      else plegadas.add(plegar);
      refrescar();
      return;
    }

    if (destino.id === 'ed-capas-plegar-todo') {
      const capas = capasDelDocumento();
      // Si ya estaban todas plegadas, el botón despliega; si no, pliega las que falten.
      if (capas.every((c) => plegadas.has(c.id))) plegadas.clear();
      else for (const c of capas) plegadas.add(c.id);
      refrescar();
      return;
    }

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
      // Va al final de las que están **encima** de la página, no al final de todo: si naciera
      // detrás de la página, lo primero que se dibujara en ella no se vería y parecería un bug.
      // Con la página al fondo —lo habitual— ese lugar es el final de la lista, como siempre.
      const corte = Math.min(capasSobreElFondoDelDocumento(), capas.length);
      establecerCapas([...capas.slice(0, corte), nueva, ...capas.slice(corte)]);
      establecerCapasSobreElFondo(corte + 1);
      establecerCapaDestino(nueva.id);
      ordenarPila(lienzo);
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
   * La lista tal como se la ve: las capas **más la página del PDF**, que es una fila más porque en
   * el lienzo es un objeto más del apilado. Tenerlas juntas en un solo arreglo es lo que hace que
   * reordenar sea un `splice` y no una cuenta: la posición de la página sale de dónde quedó su fila.
   */
  type Fila = { capa: Capa; fondo?: false } | { fondo: true; capa?: undefined };

  function filas(): Fila[] {
    const capas = capasDelDocumento();
    const lista: Fila[] = capas.map((capa) => ({ capa }));
    if (hayFondo()) lista.splice(Math.min(capasSobreElFondoDelDocumento(), capas.length), 0, { fondo: true });
    return lista;
  }

  /** Vuelca al modelo una lista ya reordenada: qué capas hay, en qué orden, y dónde quedó la página. */
  function asentarFilas(lista: Fila[]): void {
    const capas = lista.filter((f) => !f.fondo).map((f) => f.capa!);
    const corte = lista.findIndex((f) => f.fondo);
    establecerCapas(capas);
    establecerCapasSobreElFondo(corte < 0 ? capas.length : corte);
  }

  /** Si la hoja tiene algo de fondo: su página del PDF, o una imagen propia. */
  const hayFondo = () => paginaDeLaHoja() !== null || fondoDeLaHoja() !== null;

  /**
   * Cambia una fila de lugar y reordena el lienzo para que se vea el cambio. Sirve igual para una
   * capa y para la página: mover la página es lo que decide qué capas quedan encima de ella.
   */
  function moverFila(desde: number, hasta: number): void {
    const lista = filas();
    if (desde < 0 || hasta < 0 || desde >= lista.length || hasta >= lista.length || desde === hasta) return;
    const [fila] = lista.splice(desde, 1);
    lista.splice(hasta, 0, fila);
    asentarFilas(lista);
    ordenarPila(lienzo);
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

    // Subir y bajar se miden sobre la lista completa, que incluye la página: una capa que está justo
    // debajo de ella sí puede subir, aunque sea la primera de las capas de atrás.
    const enLista = filas().findIndex((f) => f.capa?.id === id);
    const menu = document.createElement('div');
    menu.className = 'ed-capas-menu';
    menu.innerHTML =
      item('renombrar', '✎', 'capas.menu.renombrar', true) +
      item('duplicar', '⧉', 'capas.menu.duplicar', true) +
      '<div class="ed-dd-sep"></div>' +
      item('subir', '↑', 'capas.menu.subir', enLista > 0) +
      item('bajar', '↓', 'capas.menu.bajar', enLista < filas().length - 1) +
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

    // Sobre la lista completa —capas y página—, así el menú también sirve para cruzar la página, que
    // es lo mismo que hace arrastrarla.
    if (accion === 'subir' || accion === 'bajar') {
      const desde = filas().findIndex((f) => f.capa?.id === id);
      return moverFila(desde, accion === 'subir' ? desde - 1 : desde + 1);
    }

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
      const corte = capasSobreElFondoDelDocumento();
      establecerCapas([...capas.slice(0, indice + 1), nueva, ...capas.slice(indice + 1)]);
      // La copia queda del mismo lado de la página que la original: si la de origen iba detrás, se
      // corre el corte para que la copia también quede detrás.
      establecerCapasSobreElFondo(indice + 1 < corte ? corte + 1 : corte);
      for (const original of copias) {
        const clon = duplicarElemento(original);
        clon.capa = nueva.id;
        await agregarAlLienzo(lienzo, clon);
      }
      ordenarPila(lienzo);
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

      // Que no quede su id colgado en las plegadas: si más adelante naciera otra capa con el mismo
      // id, aparecería plegada sin que nadie lo hubiera pedido.
      plegadas.delete(id);
      const corte = capasSobreElFondoDelDocumento();
      establecerCapas(quedan);
      // Si la que se fue estaba delante de la página, el corte se corre con ella; si no, no se mueve.
      establecerCapasSobreElFondo(indice < corte ? corte - 1 : corte);
      ordenarPila(lienzo);
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
    // Cambiar de capa cambia dónde va en el apilado: sin esto la fila se muda en la lista pero el
    // objeto se queda dibujado donde estaba, y la lista vuelve a mentir.
    ordenarPila(lienzo);
    // Y cada uno al frente de su capa nueva, para que caiga siempre en el mismo lugar y no donde lo
    // deje el orden que traía de antes.
    for (const uno of alcance) moverEnLaPila(lienzo, uno, 'frente');
    refrescarConHistorial();
  }

  // ---------- Arrastrar: un objeto a otra capa, o una capa a otra posición ----------

  // Dos arrastres distintos comparten los mismos eventos, así que se distingue por dónde empezó:
  // agarrando la fila de un objeto se lo cambia de capa; agarrando la cabecera se reordena la capa.
  let arrastrado: number | null = null;
  let capaArrastrada: string | null = null;
  let fondoArrastrado = false;

  panel.addEventListener('dragstart', (e) => {
    const laPagina = (e.target as HTMLElement).closest<HTMLElement>('[data-arrastrar-fondo]');
    if (laPagina) {
      fondoArrastrado = true;
      laPagina.closest('.ed-capa')!.classList.add('arrastrando');
      e.dataTransfer?.setData('text/plain', 'fondo');
      return;
    }
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
    fondoArrastrado = false;
    panel.querySelectorAll('.arrastrando, .sobre, .sobre-capa').forEach((n) => n.classList.remove('arrastrando', 'sobre', 'sobre-capa'));
  });

  panel.addEventListener('dragover', (e) => {
    const caja = (e.target as HTMLElement).closest<HTMLElement>('.ed-capa');
    if (!caja || (arrastrado === null && capaArrastrada === null && !fondoArrastrado)) return;
    e.preventDefault(); // sin esto el navegador no deja soltar
    panel.querySelectorAll('.sobre, .sobre-capa').forEach((n) => n.classList.remove('sobre', 'sobre-capa'));
    // Reordenando se marca solo la línea de arriba, que es donde va a caer; cambiando un objeto de
    // capa se marca la capa entera, que es lo que lo va a recibir.
    if (fondoArrastrado && !caja.dataset.fondo) caja.classList.add('sobre-capa');
    else if (capaArrastrada && caja.dataset.capa !== capaArrastrada) caja.classList.add('sobre-capa');
    // Un objeto no se puede soltar en la página: no es una capa, no tiene contenido propio.
    else if (arrastrado !== null && !caja.dataset.fondo) caja.classList.add('sobre');
  });

  /** En qué posición de la lista está la fila del DOM que recibió el arrastre. */
  const indiceDeFila = (caja: HTMLElement): number =>
    caja.dataset.fondo ? filas().findIndex((f) => f.fondo) : filas().findIndex((f) => f.capa?.id === caja.dataset.capa);

  panel.addEventListener('drop', (e) => {
    const caja = (e.target as HTMLElement).closest<HTMLElement>('.ed-capa');
    if (!caja) return;
    e.preventDefault();

    if (fondoArrastrado) {
      moverFila(filas().findIndex((f) => f.fondo), indiceDeFila(caja));
      fondoArrastrado = false;
      return;
    }

    if (capaArrastrada) {
      moverFila(filas().findIndex((f) => f.capa?.id === capaArrastrada), indiceDeFila(caja));
      capaArrastrada = null;
      return;
    }

    if (arrastrado !== null) {
      // Sobre la página no hay dónde poner un objeto: se ignora en vez de mandarlo a cualquier capa.
      if (caja.dataset.capa) moverACapa(arrastrado, caja.dataset.capa);
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

import { IDIOMAS_DISPONIBLES, aplicarIdioma, cambiarIdioma, idiomaActual, type Idioma } from './i18n';

const MENU_ARCHIVO = `
  <div class="ed-dd-item" id="ed-nuevo"><span data-i18n="menu.archivo.nuevo"></span> <span class="ed-dd-tecla">Ctrl+Alt+N</span></div>
  <div class="ed-dd-item" id="ed-abrir-pdf"><span data-i18n="menu.archivo.abrirPdf"></span> <span class="ed-dd-tecla">Ctrl+O</span></div>
  <div class="ed-dd-item" id="ed-importar-proyecto"><span data-i18n="menu.archivo.importarProyecto"></span> <span class="ed-dd-tecla">Ctrl+Shift+O</span></div>
  <div class="ed-dd-sep"></div>
  <div class="ed-dd-item" id="ed-guardar-proyecto"><span data-i18n="menu.archivo.guardarProyecto"></span> <span class="ed-dd-tecla">Ctrl+S</span></div>
  <div class="ed-dd-item" id="ed-verificar"><span data-i18n="menu.archivo.verificar"></span> <span class="ed-dd-tecla">Ctrl+Alt+V</span></div>
  <div class="ed-dd-item" id="ed-exportar-pdf"><span data-i18n="menu.archivo.exportarPdf"></span> <span class="ed-dd-tecla">Ctrl+E</span></div>
`;

const MENU_EDITAR = `
  <div class="ed-dd-item" id="ed-undo"><span data-i18n="menu.editar.deshacer"></span> <span class="ed-dd-tecla">Ctrl+Z</span></div>
  <div class="ed-dd-item" id="ed-redo"><span data-i18n="menu.editar.rehacer"></span> <span class="ed-dd-tecla">Ctrl+Y</span></div>
  <div class="ed-dd-sep"></div>
  <div class="ed-dd-item" id="ed-seleccionar-todo"><span data-i18n="menu.editar.seleccionarTodo"></span> <span class="ed-dd-tecla">Ctrl+A</span></div>
  <div class="ed-dd-item" id="ed-cortar"><span data-i18n="menu.editar.cortar"></span> <span class="ed-dd-tecla">Ctrl+X</span></div>
  <div class="ed-dd-item" id="ed-copiar"><span data-i18n="menu.editar.copiar"></span> <span class="ed-dd-tecla">Ctrl+C</span></div>
  <div class="ed-dd-item" id="ed-pegar"><span data-i18n="menu.editar.pegar"></span> <span class="ed-dd-tecla">Ctrl+V</span></div>
`;

const MENU_VER = `
  <label class="ed-dd-check ed-dd-persistente"><input type="checkbox" id="ed-cuadricula" /> <span data-i18n="menu.ver.cuadricula"></span> <span class="ed-dd-tecla">Ctrl+'</span></label>
  <div class="ed-dd-item ed-dd-persistente">
    <span data-i18n="menu.ver.paso"></span>
    <input type="number" id="ed-paso" value="5" min="2" max="50" data-i18n-title="menu.ver.pasoTt" />
  </div>
  <label class="ed-dd-check ed-dd-persistente"><input type="checkbox" id="ed-reglas" /> <span data-i18n="menu.ver.reglas"></span> <span class="ed-dd-tecla">Ctrl+Alt+R</span></label>
  <label class="ed-dd-check ed-dd-persistente"><input type="checkbox" id="ed-guias" checked /> <span data-i18n="menu.ver.alineacion"></span> <span class="ed-dd-tecla">Ctrl+;</span></label>
  <div class="ed-dd-sep"></div>
  <div class="ed-dd-nota" data-i18n="menu.ver.barras"></div>
  <label class="ed-dd-check ed-dd-persistente"><input type="checkbox" data-barra="campos" checked /> <span data-i18n="menu.ver.barraCampos"></span></label>
  <label class="ed-dd-check ed-dd-persistente"><input type="checkbox" data-barra="props" checked /> <span data-i18n="menu.ver.barraProps"></span></label>
  <label class="ed-dd-check ed-dd-persistente"><input type="checkbox" data-barra="capas" checked /> <span data-i18n="menu.ver.barraCapas"></span></label>
  <label class="ed-dd-check ed-dd-persistente"><input type="checkbox" data-barra="hojas" checked /> <span data-i18n="menu.ver.barraHojas"></span></label>
  <div class="ed-dd-item" id="ed-restaurar-barras"><span data-i18n="menu.ver.restaurarBarras"></span> <span class="ed-dd-tecla">Ctrl+Alt+B</span></div>
`;

const MENU_PAGINA = `
  <div class="ed-dd-item ed-dd-persistente">
    <span data-i18n="menu.pagina.tamano"></span>
    <select id="ed-tamano">
      <option value="A4" data-i18n="pagina.tamano.A4"></option>
      <option value="Carta" data-i18n="pagina.tamano.Carta"></option>
      <option value="Oficio" data-i18n="pagina.tamano.Oficio"></option>
      <option value="A5" data-i18n="pagina.tamano.A5"></option>
    </select>
  </div>
  <div class="ed-dd-item ed-dd-persistente">
    <span data-i18n="menu.pagina.orientacion"></span>
    <select id="ed-orient">
      <option value="vertical" data-i18n="pagina.orientacion.vertical"></option>
      <option value="horizontal" data-i18n="pagina.orientacion.horizontal"></option>
    </select>
  </div>
  <div class="ed-dd-item ed-dd-persistente">
    <span data-i18n="menu.pagina.fondo"></span>
    <select id="ed-fondo-modo">
      <option value="blanco" data-i18n="pagina.fondo.blanco"></option>
      <option value="imagen" data-i18n="pagina.fondo.imagen"></option>
      <option value="pdf" data-i18n="pagina.fondo.pdf"></option>
    </select>
  </div>
  <div class="ed-dd-sep"></div>
  <div class="ed-dd-item" id="ed-insertar-pdf"><span data-i18n="menu.pagina.insertarPdf"></span> <span class="ed-dd-tecla">Ctrl+Alt+I</span></div>
  <div class="ed-dd-item" id="ed-margenes"><span data-i18n="menu.pagina.margenes"></span> <span class="ed-dd-tecla">Ctrl+Alt+M</span></div>
`;

const MENU_CAMPOS = `
  <div class="ed-dd-nota" data-i18n="menu.campos.notaDibujo"></div>
  <div class="ed-dd-item" data-dib="texto"><span data-i18n="menu.campos.dibTexto"></span> <span class="ed-dd-tecla">T</span></div>
  <div class="ed-dd-item" data-dib="linea"><span data-i18n="menu.campos.dibLinea"></span> <span class="ed-dd-tecla">L</span></div>
  <div class="ed-dd-item" data-dib="rect"><span data-i18n="menu.campos.dibRect"></span> <span class="ed-dd-tecla">R</span></div>
  <div class="ed-dd-item" data-dib="tabla"><span data-i18n="menu.campos.dibTabla"></span> <span class="ed-dd-tecla">B</span></div>
  <div class="ed-dd-item" data-dib="imagen"><span data-i18n="menu.campos.dibImagen"></span> <span class="ed-dd-tecla">I</span></div>
  <div class="ed-dd-item" data-dib="qr"><span data-i18n="menu.campos.dibQr"></span> <span class="ed-dd-tecla">Q</span></div>
  <div class="ed-dd-sep"></div>
  <div class="ed-dd-item" id="ed-csv-importar"><span data-i18n="menu.campos.csvImportar"></span> <span class="ed-dd-tecla">Ctrl+Alt+C</span></div>
  <div class="ed-dd-item" id="ed-csv-exportar"><span data-i18n="menu.campos.csvExportar"></span> <span class="ed-dd-tecla">Ctrl+Alt+X</span></div>
  <div class="ed-dd-sep"></div>
  <label class="ed-dd-check ed-dd-persistente"><input type="checkbox" id="ed-completar" /> <span data-i18n="menu.campos.completar"></span> <span class="ed-dd-tecla">F2</span></label>
  <label class="ed-dd-check ed-dd-persistente"><input type="checkbox" id="ed-ocultar-campos" /> <span data-i18n="menu.campos.ocultar"></span> <span class="ed-dd-tecla">F4</span></label>
`;

const MENU_AYUDA = `
  <div class="ed-dd-item" id="ed-ayuda-guia"><span data-i18n="ayuda.menu.guia"></span> <span class="ed-dd-tecla">F1</span></div>
  <div class="ed-dd-item" id="ed-ayuda-atajos"><span data-i18n="ayuda.menu.atajos"></span> <span class="ed-dd-tecla">Ctrl+/</span></div>
  <div class="ed-dd-sep"></div>
  <div class="ed-dd-item" id="ed-ayuda-csv" data-i18n="ayuda.menu.csv"></div>
  <div class="ed-dd-item" id="ed-ayuda-repetibles" data-i18n="ayuda.menu.repetibles"></div>
  <div class="ed-dd-item" id="ed-ayuda-apariencias" data-i18n="ayuda.menu.apariencias"></div>
  <div class="ed-dd-sep"></div>
  <div class="ed-dd-item" id="ed-ayuda-faq" data-i18n="ayuda.menu.faq"></div>
  <div class="ed-dd-sep"></div>
  <div class="ed-dd-item" id="ed-ayuda-acerca" data-i18n="ayuda.menu.acerca"></div>
`;

const MENUS: { id: string; etiqueta: import('./i18n').ClaveI18n; contenido: string }[] = [
  { id: 'archivo', etiqueta: 'menu.archivo', contenido: MENU_ARCHIVO },
  { id: 'editar', etiqueta: 'menu.editar', contenido: MENU_EDITAR },
  { id: 'ver', etiqueta: 'menu.ver', contenido: MENU_VER },
  { id: 'pagina', etiqueta: 'menu.pagina', contenido: MENU_PAGINA },
  { id: 'campos', etiqueta: 'menu.campos', contenido: MENU_CAMPOS },
  { id: 'ayuda', etiqueta: 'menu.ayuda', contenido: MENU_AYUDA },
];

/**
 * Las tres piezas que se pueden mover de lugar. Cada una es autónoma —su cabecera, su contenido— y
 * vive dentro de una *ranura*: los dos costados, abajo, o una ventana suelta. Se escriben acá y no
 * en el layout porque el layout ya no sabe cuál va en cada lado; eso lo decide `paneles.ts`.
 *
 * La cabecera es igual en las tres para que puedan intercambiarse sin casos especiales: el título
 * (que solo se ve flotando), desacoplar y colapsar.
 */
const PIEZAS: Record<string, { titulo: string; cuerpo: string }> = {
  campos: {
    titulo: 'shell.herramientas.titulo',
    cuerpo: `
      <div class="ed-panel-cont" id="ed-panel-campos">
        <div class="ed-props-tit"><strong data-i18n="shell.herramientas.titulo"></strong></div>
        <div class="ed-col" data-seccion="dibujo"><span class="ed-col-ic">−</span><span class="ed-col-t" data-i18n="shell.dibujo.titulo"></span></div>
        <div class="ed-seccion ed-herramientas" data-cuerpo="dibujo">
          ${['texto', 'linea', 'rect', 'tabla', 'imagen', 'qr']
            .map((clase, i) => {
              const claves = ['dibTexto', 'dibLinea', 'dibRect', 'dibTabla', 'dibImagen', 'dibQr'];
              const teclas = ['T', 'L', 'R', 'B', 'I', 'Q'];
              return `<button type="button" class="ed-herramienta" data-dib="${clase}" title="${teclas[i]}"><span data-i18n="menu.campos.${claves[i]}"></span></button>`;
            })
            .join('')}
        </div>

        <div class="ed-col" data-seccion="acroform"><span class="ed-col-ic">−</span><span class="ed-col-t" data-i18n="shell.campos.titulo"></span><span class="ed-col-n">0</span></div>
        <div class="ed-seccion" data-cuerpo="acroform">
          <div class="ed-campos-add"><input type="text" id="ed-campo-nuevo" data-i18n-placeholder="shell.campos.placeholder" /><button type="button" id="ed-campo-agregar">+</button></div>
          <div id="ed-lista-campos"></div>
          <p class="nota" data-i18n="shell.campos.nota"></p>
          <button type="button" class="ed-boton-firma" id="ed-campo-firma" data-i18n="campos.agregarFirma"></button>
          <p class="nota" data-i18n="campos.notaFirma"></p>
        </div>
      </div>`,
  },
  props: {
    titulo: 'shell.propiedades.titulo',
    cuerpo: `
      <div class="ed-panel-cont" id="ed-panel-propiedades">
        <div class="ed-props-tit"><strong data-i18n="shell.propiedades.titulo"></strong></div>
        <div class="ed-sinsel" data-i18n="shell.sinSeleccion"></div>
      </div>`,
  },
  capas: {
    titulo: 'shell.capas.titulo',
    cuerpo: '<div class="ed-panel-cont"><div class="ed-props-tit"><strong data-i18n="shell.capas.titulo"></strong></div><div id="ed-panel-capas"></div></div>',
  },
  hojas: {
    titulo: 'shell.hojas.titulo',
    cuerpo: `<div class="ed-hojas-lista" id="ed-hojas-lista"></div>`,
  },
};

function htmlDePieza(nombre: string): string {
  const pieza = PIEZAS[nombre];
  return `
    <section class="ed-pieza" id="ed-pieza-${nombre}" data-pieza="${nombre}">
      <div class="ed-pieza-head">
        <span class="ed-pieza-tit" data-i18n="${pieza.titulo}"></span>
        <button type="button" class="ed-pieza-btn" data-accion="colapsar" data-i18n-title="shell.panelToggleTt">‹</button>
        <button type="button" class="ed-pieza-btn" data-accion="desacoplar" data-i18n-title="shell.pieza.desacoplarTt">⧉</button>
        <button type="button" class="ed-pieza-btn" data-accion="cerrar" data-i18n-title="shell.pieza.cerrarTt">✕</button>
      </div>
      ${pieza.cuerpo}
    </section>`;
}

export interface EspacioTrabajo {
  raiz: HTMLElement;
  menubar: HTMLElement;
  lienzoCont: HTMLElement;
  panelCampos: HTMLElement;
  panelPropiedades: HTMLElement;
}

export function montarEspacioTrabajo(raiz: HTMLElement): EspacioTrabajo {
  raiz.innerHTML = `
    <div class="ed-header">
      <img class="ed-marca-ic" src="/avion.png" alt="" width="26" height="26"><span class="ed-marca">EditorPDF</span>
      <span class="relleno"></span>
      <div class="ed-idioma-wrap">
        <button class="ed-idioma-btn" type="button" id="ed-idioma-btn" data-i18n-title="shell.idiomaTt">${idiomaActual().toUpperCase()} ▾</button>
        <div class="ed-dropdown" data-dd-idioma>
          ${(Object.keys(IDIOMAS_DISPONIBLES) as Idioma[])
            .map((id) => `<div class="ed-dd-item" data-idioma="${id}">${IDIOMAS_DISPONIBLES[id]}</div>`)
            .join('')}
        </div>
      </div>
    </div>

    <div class="ed-toolbar" id="ed-menubar">
      ${MENUS.map(
        (m) => `
        <div class="ed-menu-item">
          <button type="button" class="ed-menu-btn" data-menu="${m.id}"><span data-i18n="${m.etiqueta}"></span> <span class="ed-menu-car">▾</span></button>
          <div class="ed-dropdown" data-dd="${m.id}">${m.contenido}</div>
        </div>`
      ).join('')}
    </div>

    <div class="ed-layout" id="ed-layout">
      <!-- Cada costado admite dos barras, una arriba de la otra, con su separador en el medio. -->
      <div class="ed-costado" id="ed-costado-izq">
        <div class="ed-ranura" id="ed-ranura-izq-1"></div>
        <div class="ed-separador-h ed-sep-costado" id="ed-separador-izq-sub" data-i18n-title="shell.separadorAltoTt"></div>
        <div class="ed-ranura" id="ed-ranura-izq-2"></div>
      </div>
      <div class="ed-separador" id="ed-separador-izq" data-i18n-title="shell.separadorTt"><button type="button" class="ed-colapsar-costado" id="ed-colapsar-izq" data-i18n-title="shell.colapsarCostadoTt">‹</button></div>

      <div class="ed-lienzo-cont">
        <div class="ed-lienzo-scroll" id="ed-lienzo-scroll"></div>
      </div>

      <div class="ed-separador" id="ed-separador-der" data-i18n-title="shell.separadorTt"><button type="button" class="ed-colapsar-costado" id="ed-colapsar-der" data-i18n-title="shell.colapsarCostadoTt">‹</button></div>
      <div class="ed-costado" id="ed-costado-der">
        <div class="ed-ranura" id="ed-ranura-der-1"></div>
        <div class="ed-separador-h ed-sep-costado" id="ed-separador-der-sub" data-i18n-title="shell.separadorAltoTt"></div>
        <div class="ed-ranura" id="ed-ranura-der-2"></div>
      </div>
    </div>

    <div class="ed-separador-h" id="ed-separador-hojas" data-i18n-title="shell.separadorTt"></div>
    <div class="ed-ranura" id="ed-ranura-abajo"></div>

    <div class="ed-status">
      <div class="ed-status-izq" data-i18n="shell.status.autoguardado"></div>
      <div class="ed-status-der">
        <span class="ed-status-vista"><b id="ed-status-tam">A4</b> · <span id="ed-status-orient" data-i18n="pagina.orientacion.vertical"></span></span>
        <div class="ed-status-divisor"></div>
        <span class="ed-status-campos" id="ed-status-campos" data-i18n="shell.status.camposOcultos" hidden></span>
        <span class="ed-status-paginas" id="ed-status-paginas" hidden></span>
        <div class="ed-status-divisor" id="ed-status-divisor-paginas" hidden></div>
        <button type="button" class="ed-status-peso" id="ed-peso-btn" data-i18n="shell.status.peso"></button>
        <div class="ed-status-divisor"></div>
        <button type="button" class="ed-status-peso" id="ed-preflight-btn" data-i18n="shell.status.verificar"></button>
        <div class="ed-status-divisor"></div>
        <div class="ed-zoom-slider">
          <button type="button" id="ed-zoom-menos" data-i18n-title="shell.zoom.alejarTt">−</button>
          <input type="range" id="ed-zoom" min="25" max="400" step="5" value="100" data-i18n-title="shell.zoom.tt" />
          <button type="button" id="ed-zoom-mas" data-i18n-title="shell.zoom.acercarTt">+</button>
          <span id="ed-zoom-val">100%</span>
        </div>
      </div>
    </div>

    <div class="ed-flotantes" id="ed-flotantes"></div>
    <div class="ed-sombra-acople" id="ed-sombra-acople" hidden></div>
  `;

  // Las piezas nacen en su ranura por defecto; `paneles.ts` las reubica según lo que esté guardado.
  raiz.querySelector('#ed-ranura-izq-1')!.innerHTML = htmlDePieza('campos');
  raiz.querySelector('#ed-ranura-izq-2')!.innerHTML = htmlDePieza('capas');
  raiz.querySelector('#ed-ranura-der-1')!.innerHTML = htmlDePieza('props');

  raiz.querySelector('#ed-ranura-abajo')!.innerHTML = htmlDePieza('hojas');

  const menubar = raiz.querySelector<HTMLElement>('#ed-menubar')!;
  wireMenuDesplegable(menubar);
  wireSelectorIdioma(raiz);
  aplicarIdioma(raiz);

  return {
    raiz,
    menubar,
    lienzoCont: raiz.querySelector<HTMLElement>('#ed-lienzo-scroll')!,
    panelCampos: raiz.querySelector<HTMLElement>('#ed-panel-campos')!,
    panelPropiedades: raiz.querySelector<HTMLElement>('#ed-panel-propiedades')!,
  };
}

function wireSelectorIdioma(raiz: HTMLElement): void {
  const boton = raiz.querySelector<HTMLButtonElement>('#ed-idioma-btn')!;
  const dropdown = raiz.querySelector<HTMLElement>('[data-dd-idioma]')!;

  boton.addEventListener('click', (evento) => {
    evento.stopPropagation();
    dropdown.classList.toggle('abierto');
  });

  dropdown.querySelectorAll<HTMLElement>('[data-idioma]').forEach((item) => {
    item.addEventListener('click', () => {
      const idioma = item.dataset.idioma as Idioma;
      cambiarIdioma(idioma);
      boton.innerHTML = `${idioma.toUpperCase()} ▾`;
      dropdown.classList.remove('abierto');
    });
  });

  document.addEventListener('click', () => dropdown.classList.remove('abierto'));
}

function wireMenuDesplegable(menubar: HTMLElement): void {
  const botones = Array.from(menubar.querySelectorAll<HTMLButtonElement>('.ed-menu-btn'));

  function cerrarTodos(): void {
    menubar.querySelectorAll('.ed-dropdown.abierto').forEach((d) => d.classList.remove('abierto'));
    botones.forEach((b) => b.classList.remove('abierto'));
  }

  botones.forEach((boton) => {
    boton.addEventListener('click', (evento) => {
      evento.stopPropagation();
      const id = boton.dataset.menu;
      const dropdown = menubar.querySelector<HTMLElement>(`[data-dd="${id}"]`)!;
      const yaAbierto = dropdown.classList.contains('abierto');
      cerrarTodos();
      if (!yaAbierto) {
        dropdown.classList.add('abierto');
        boton.classList.add('abierto');
      }
    });
  });

  // Las filas con un select adentro (tamaño, orientación) no deben cerrar el menú al usarlas.
  menubar.querySelectorAll('.ed-dd-persistente').forEach((fila) => {
    fila.addEventListener('click', (evento) => evento.stopPropagation());
  });

  document.addEventListener('click', cerrarTodos);
}

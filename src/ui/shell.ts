import { IDIOMAS_DISPONIBLES, aplicarIdioma, cambiarIdioma, idiomaActual, type Idioma } from './i18n';

const MENU_ARCHIVO = `
  <div class="ed-dd-item" id="ed-nuevo" data-i18n="menu.archivo.nuevo"></div>
  <div class="ed-dd-item" id="ed-abrir-pdf" data-i18n="menu.archivo.abrirPdf"></div>
  <div class="ed-dd-item" id="ed-importar-proyecto" data-i18n="menu.archivo.importarProyecto"></div>
  <div class="ed-dd-sep"></div>
  <div class="ed-dd-item" id="ed-guardar-proyecto" data-i18n="menu.archivo.guardarProyecto"></div>
  <div class="ed-dd-item" id="ed-verificar" data-i18n="menu.archivo.verificar"></div>
  <div class="ed-dd-item" id="ed-exportar-pdf" data-i18n="menu.archivo.exportarPdf"></div>
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
  <div class="ed-dd-item ed-dd-persistente">
    <label class="ed-dd-check"><input type="checkbox" id="ed-cuadricula" /> <span data-i18n="menu.ver.cuadricula"></span></label>
    <input type="number" id="ed-paso" value="5" min="2" max="50" data-i18n-title="menu.ver.pasoTt" />
  </div>
  <label class="ed-dd-check ed-dd-persistente"><input type="checkbox" id="ed-reglas" /> <span data-i18n="menu.ver.reglas"></span></label>
  <label class="ed-dd-check ed-dd-persistente"><input type="checkbox" id="ed-guias" checked /> <span data-i18n="menu.ver.alineacion"></span></label>
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
  <div class="ed-dd-item" id="ed-margenes" data-i18n="menu.pagina.margenes"></div>
`;

const MENU_CAMPOS = `
  <div class="ed-dd-nota" data-i18n="menu.campos.notaDibujo"></div>
  <div class="ed-dd-item" data-dib="texto" data-i18n="menu.campos.dibTexto"></div>
  <div class="ed-dd-item" data-dib="linea" data-i18n="menu.campos.dibLinea"></div>
  <div class="ed-dd-item" data-dib="rect" data-i18n="menu.campos.dibRect"></div>
  <div class="ed-dd-item" data-dib="tabla" data-i18n="menu.campos.dibTabla"></div>
  <div class="ed-dd-item" data-dib="imagen" data-i18n="menu.campos.dibImagen"></div>
  <div class="ed-dd-item" data-dib="qr" data-i18n="menu.campos.dibQr"></div>
  <div class="ed-dd-sep"></div>
  <div class="ed-dd-item" id="ed-csv-importar" data-i18n="menu.campos.csvImportar"></div>
  <div class="ed-dd-item" id="ed-csv-exportar" data-i18n="menu.campos.csvExportar"></div>
  <div class="ed-dd-sep"></div>
  <label class="ed-dd-check ed-dd-persistente"><input type="checkbox" id="ed-completar" /> <span data-i18n="menu.campos.completar"></span></label>
`;

const MENU_AYUDA = `
  <div class="ed-dd-item" id="ed-ayuda-guia" data-i18n="ayuda.menu.guia"></div>
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
      <span class="ed-marca">EditorPDF</span>
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

    <div class="ed-layout">
      <aside class="ed-panel izq" id="ed-panel-izq">
        <div class="ed-panel-head"><button type="button" class="ed-panel-toggle" id="ed-toggle-izq" data-i18n-title="shell.panelToggleTt">‹</button></div>
        <div class="ed-panel-cont" id="ed-panel-campos">
          <div class="ed-col"><span class="ed-col-ic">−</span><span class="ed-col-t" data-i18n="shell.campos.titulo"></span><span class="ed-col-n">0</span></div>
          <div class="ed-campos-add"><input type="text" id="ed-campo-nuevo" data-i18n-placeholder="shell.campos.placeholder" /><button type="button" id="ed-campo-agregar">+</button></div>
          <div id="ed-lista-campos"></div>
          <p class="nota" data-i18n="shell.campos.nota"></p>
        </div>
      </aside>

      <div class="ed-separador" id="ed-separador-izq" data-i18n-title="shell.separadorTt"></div>

      <div class="ed-lienzo-cont">
        <div class="ed-lienzo-scroll" id="ed-lienzo-scroll"></div>
      </div>

      <div class="ed-separador" id="ed-separador-der" data-i18n-title="shell.separadorTt"></div>

      <aside class="ed-panel der" id="ed-panel-der">
        <div class="ed-panel-head"><button type="button" class="ed-panel-toggle" id="ed-toggle-der" data-i18n-title="shell.panelToggleTt">›</button></div>
        <div class="ed-panel-cont" id="ed-panel-propiedades">
          <div class="ed-props-tit"><strong data-i18n="shell.propiedades.titulo"></strong></div>
          <div class="ed-sinsel" data-i18n="shell.sinSeleccion"></div>
        </div>
      </aside>
    </div>

    <div class="ed-status">
      <div class="ed-status-izq" data-i18n="shell.status.autoguardado"></div>
      <div class="ed-status-der">
        <span class="ed-status-vista"><b id="ed-status-tam">A4</b> · <span id="ed-status-orient" data-i18n="pagina.orientacion.vertical"></span></span>
        <div class="ed-status-divisor" id="ed-status-divisor-pagina" hidden></div>
        <span class="ed-status-pagina" id="ed-status-pagina" hidden>
          <span data-i18n="shell.status.paginaLbl"></span>
          <select id="ed-pagina-select"></select>
        </span>
        <div class="ed-status-divisor"></div>
        <button type="button" class="ed-status-peso" id="ed-peso-btn" data-i18n="shell.status.peso"></button>
        <div class="ed-status-divisor"></div>
        <button type="button" class="ed-status-peso" id="ed-preflight-btn" data-i18n="shell.status.verificar"></button>
        <div class="ed-status-divisor"></div>
        <div class="ed-zoom-slider">
          <button type="button" id="ed-zoom-menos" data-i18n-title="shell.zoom.alejarTt">−</button>
          <input type="range" id="ed-zoom" min="25" max="300" step="5" value="100" data-i18n-title="shell.zoom.tt" />
          <button type="button" id="ed-zoom-mas" data-i18n-title="shell.zoom.acercarTt">+</button>
          <span id="ed-zoom-val">100%</span>
        </div>
      </div>
    </div>
  `;

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

const MENU_ARCHIVO = `
  <div class="ed-dd-item" id="ed-nuevo">Nuevo proyecto</div>
  <div class="ed-dd-item" id="ed-abrir-pdf">Abrir PDF…</div>
  <div class="ed-dd-item" id="ed-importar-proyecto">Importar proyecto (.json)…</div>
  <div class="ed-dd-sep"></div>
  <div class="ed-dd-item" id="ed-guardar-proyecto">Guardar proyecto…</div>
  <div class="ed-dd-item" id="ed-verificar">Verificar diseño</div>
  <div class="ed-dd-item" id="ed-exportar-pdf">Exportar PDF…</div>
`;

const MENU_EDITAR = `
  <div class="ed-dd-item" id="ed-undo">Deshacer <span class="ed-dd-tecla">Ctrl+Z</span></div>
  <div class="ed-dd-item" id="ed-redo">Rehacer <span class="ed-dd-tecla">Ctrl+Y</span></div>
  <div class="ed-dd-item">Seleccionar todo <span class="ed-dd-tecla">Ctrl+A</span></div>
  <div class="ed-dd-item">Copiar <span class="ed-dd-tecla">Ctrl+C</span></div>
  <div class="ed-dd-item">Pegar <span class="ed-dd-tecla">Ctrl+V</span></div>
`;

const MENU_VER = `
  <div class="ed-dd-item ed-dd-persistente">
    <label class="ed-dd-check"><input type="checkbox" id="ed-cuadricula" /> Cuadrícula</label>
    <input type="number" id="ed-paso" value="5" min="2" max="50" title="Separación (pt)" />
  </div>
  <label class="ed-dd-check ed-dd-persistente"><input type="checkbox" id="ed-reglas" /> Reglas</label>
  <label class="ed-dd-check ed-dd-persistente"><input type="checkbox" id="ed-guias" checked /> Alineación</label>
`;

const MENU_PAGINA = `
  <div class="ed-dd-item ed-dd-persistente">
    <span>Tamaño</span>
    <select id="ed-tamano">
      <option value="A4">A4</option>
      <option value="Carta">Carta</option>
      <option value="Oficio">Oficio</option>
      <option value="A5">A5</option>
    </select>
  </div>
  <div class="ed-dd-item ed-dd-persistente">
    <span>Orientación</span>
    <select id="ed-orient">
      <option value="vertical">Vertical</option>
      <option value="horizontal">Horizontal</option>
    </select>
  </div>
  <div class="ed-dd-sep"></div>
  <div class="ed-dd-item" id="ed-margenes">Configurar márgenes…</div>
`;

const MENU_CAMPOS = `
  <div class="ed-dd-nota">Dibujo</div>
  <div class="ed-dd-item" data-dib="texto">✏ Texto</div>
  <div class="ed-dd-item" data-dib="linea">➖ Línea</div>
  <div class="ed-dd-item" data-dib="rect">▭ Recuadro</div>
  <div class="ed-dd-item" data-dib="tabla">▦ Tabla</div>
  <div class="ed-dd-item" data-dib="imagen">🖼 Imagen</div>
  <div class="ed-dd-item" data-dib="qr">▪ QR</div>
  <div class="ed-dd-sep"></div>
  <div class="ed-dd-item" id="ed-csv-importar">⬆ Importar campos (CSV)</div>
  <div class="ed-dd-item" id="ed-csv-exportar">⬇ Exportar campos (CSV)</div>
  <div class="ed-dd-sep"></div>
  <label class="ed-dd-check ed-dd-persistente"><input type="checkbox" id="ed-completar" /> Completar campos</label>
`;

const MENU_AYUDA = `
  <div class="ed-dd-item">🚀 Guía rápida</div>
  <div class="ed-dd-item">⌨️ Atajos de teclado</div>
  <div class="ed-dd-item">❓ Preguntas frecuentes</div>
  <div class="ed-dd-sep"></div>
  <div class="ed-dd-item">ℹ️ Acerca de...</div>
`;

const MENUS: { id: string; etiqueta: string; contenido: string }[] = [
  { id: 'archivo', etiqueta: 'Archivo', contenido: MENU_ARCHIVO },
  { id: 'editar', etiqueta: 'Editar', contenido: MENU_EDITAR },
  { id: 'ver', etiqueta: 'Ver', contenido: MENU_VER },
  { id: 'pagina', etiqueta: 'Página', contenido: MENU_PAGINA },
  { id: 'campos', etiqueta: 'Campos', contenido: MENU_CAMPOS },
  { id: 'ayuda', etiqueta: 'Ayuda', contenido: MENU_AYUDA },
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
      <button class="ed-idioma-btn" type="button">ES ▾</button>
    </div>

    <div class="ed-toolbar" id="ed-menubar">
      ${MENUS.map(
        (m) => `
        <div class="ed-menu-item">
          <button type="button" class="ed-menu-btn" data-menu="${m.id}">${m.etiqueta} <span class="ed-menu-car">▾</span></button>
          <div class="ed-dropdown" data-dd="${m.id}">${m.contenido}</div>
        </div>`
      ).join('')}
    </div>

    <div class="ed-layout">
      <aside class="ed-panel izq">
        <div class="ed-panel-head"><button type="button" class="ed-panel-toggle">‹</button></div>
        <div class="ed-panel-cont" id="ed-panel-campos">
          <div class="ed-col"><span class="ed-col-ic">−</span><span class="ed-col-t">Campos AcroForm</span><span class="ed-col-n">0</span></div>
          <div class="ed-campos-add"><input type="text" id="ed-campo-nuevo" placeholder="ID del campo" /><button type="button" id="ed-campo-agregar">+</button></div>
          <div id="ed-lista-campos"></div>
          <p class="nota">Clic en un campo para colocarlo en la hoja (podés repetirlo).</p>
        </div>
      </aside>

      <div class="ed-lienzo-cont">
        <div class="ed-lienzo-scroll" id="ed-lienzo-scroll"></div>
      </div>

      <aside class="ed-panel der">
        <div class="ed-panel-head"><button type="button" class="ed-panel-toggle">›</button></div>
        <div class="ed-panel-cont" id="ed-panel-propiedades">
          <div class="ed-props-tit"><strong>Propiedades</strong></div>
          <div class="ed-sinsel">Seleccioná un elemento del lienzo. Con Ctrl o Shift agregás varios; también podés arrastrar un recuadro sobre el lienzo.</div>
        </div>
      </aside>
    </div>

    <div class="ed-status">
      <div class="ed-status-izq">Guardado automático en este navegador</div>
      <div class="ed-status-der">
        <span class="ed-status-vista"><b id="ed-status-tam">A4</b> · <span id="ed-status-orient">Vertical</span></span>
        <div class="ed-status-divisor"></div>
        <button type="button" class="ed-status-peso">Peso: calcular</button>
        <div class="ed-status-divisor"></div>
        <button type="button" class="ed-status-peso">Verificar</button>
        <div class="ed-status-divisor"></div>
        <div class="ed-zoom-slider">
          <button type="button" id="ed-zoom-menos" title="Alejar">−</button>
          <input type="range" id="ed-zoom" min="25" max="300" step="5" value="100" title="Zoom" />
          <button type="button" id="ed-zoom-mas" title="Acercar">+</button>
          <span id="ed-zoom-val">100%</span>
        </div>
      </div>
    </div>
  `;

  const menubar = raiz.querySelector<HTMLElement>('#ed-menubar')!;
  wireMenuDesplegable(menubar);

  return {
    raiz,
    menubar,
    lienzoCont: raiz.querySelector<HTMLElement>('#ed-lienzo-scroll')!,
    panelCampos: raiz.querySelector<HTMLElement>('#ed-panel-campos')!,
    panelPropiedades: raiz.querySelector<HTMLElement>('#ed-panel-propiedades')!,
  };
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

import { TAMANOS, type ConfigPagina, type Margenes, type Orientacion, type TamanoPagina } from '../editor/pagina';

function abrir(contenido: string, alConfirmar: (raiz: HTMLElement) => unknown): Promise<unknown> {
  const overlay = document.createElement('div');
  overlay.className = 'ed-modal-overlay';
  overlay.innerHTML = `<div class="ed-modal">${contenido}</div>`;
  document.body.appendChild(overlay);

  const primerCampo = overlay.querySelector<HTMLInputElement>('input, select');
  primerCampo?.focus();

  return new Promise((resolve) => {
    const cerrar = (resultado: unknown) => {
      document.removeEventListener('keydown', onTecla);
      overlay.remove();
      resolve(resultado);
    };
    const onTecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cerrar(null);
    };
    document.addEventListener('keydown', onTecla);

    overlay.querySelector('[data-cancelar]')!.addEventListener('click', () => cerrar(null));
    overlay.querySelector('[data-confirmar]')!.addEventListener('click', () => cerrar(alConfirmar(overlay)));
  });
}

function opcionesTamano(actual: TamanoPagina): string {
  return (Object.keys(TAMANOS) as TamanoPagina[]).map((t) => `<option value="${t}" ${t === actual ? 'selected' : ''}>${t}</option>`).join('');
}

function camposMargenes(m: Margenes): string {
  return `<div class="ed-modal-grid">
    <div><label class="ed-lbl">Arriba</label><input type="number" data-mg="arriba" class="mono" value="${m.arriba}" min="0"></div>
    <div><label class="ed-lbl">Abajo</label><input type="number" data-mg="abajo" class="mono" value="${m.abajo}" min="0"></div>
    <div><label class="ed-lbl">Izquierda</label><input type="number" data-mg="izquierda" class="mono" value="${m.izquierda}" min="0"></div>
    <div><label class="ed-lbl">Derecha</label><input type="number" data-mg="derecha" class="mono" value="${m.derecha}" min="0"></div>
  </div>`;
}

function leerMargenes(raiz: HTMLElement): Margenes {
  const valor = (nombre: keyof Margenes) => Math.max(0, Number(raiz.querySelector<HTMLInputElement>(`[data-mg="${nombre}"]`)!.value) || 0);
  return { arriba: valor('arriba'), abajo: valor('abajo'), izquierda: valor('izquierda'), derecha: valor('derecha') };
}

export function pedirNuevoProyecto(actual: ConfigPagina): Promise<ConfigPagina | null> {
  return abrir(
    `<div class="ed-modal-tit">Crear diseño nuevo</div>
     <div class="ed-modal-sub">Configurá el tamaño, la orientación y los márgenes iniciales de la hoja. Se descarta el diseño actual.</div>
     <div class="ed-modal-grid">
       <div><label class="ed-lbl">Tamaño de hoja</label><select data-tamano>${opcionesTamano(actual.tamano)}</select></div>
       <div><label class="ed-lbl">Orientación</label><select data-orient>
         <option value="vertical" ${actual.orientacion === 'vertical' ? 'selected' : ''}>Vertical</option>
         <option value="horizontal" ${actual.orientacion === 'horizontal' ? 'selected' : ''}>Horizontal</option>
       </select></div>
     </div>
     <div class="ed-sec-tit" style="margin-top:14px;">Márgenes de hoja (pt)</div>
     ${camposMargenes(actual.margenes)}
     <div class="ed-modal-acciones">
       <button type="button" data-cancelar>Cancelar</button>
       <button type="button" class="primario" data-confirmar>Crear diseño</button>
     </div>`,
    (raiz) => ({
      tamano: raiz.querySelector<HTMLSelectElement>('[data-tamano]')!.value as TamanoPagina,
      orientacion: raiz.querySelector<HTMLSelectElement>('[data-orient]')!.value as Orientacion,
      margenes: leerMargenes(raiz),
    })
  ) as Promise<ConfigPagina | null>;
}

export function pedirMargenes(actual: Margenes): Promise<Margenes | null> {
  return abrir(
    `<div class="ed-modal-tit">Configurar márgenes</div>
     <div class="ed-modal-sub">Los márgenes se muestran como una guía punteada y acotan dónde se colocan los elementos nuevos. No se dibujan en el PDF.</div>
     ${camposMargenes(actual)}
     <div class="ed-modal-acciones">
       <button type="button" data-cancelar>Cancelar</button>
       <button type="button" class="primario" data-confirmar>Aplicar</button>
     </div>`,
    (raiz) => leerMargenes(raiz)
  ) as Promise<Margenes | null>;
}

export function pedirNombreArchivo(titulo: string, subtitulo: string, sugerido: string): Promise<string | null> {
  return abrir(
    `<div class="ed-modal-tit">${titulo}</div>
     <div class="ed-modal-sub">${subtitulo}</div>
     <label class="ed-lbl">Nombre del archivo</label>
     <input type="text" data-nombre value="${sugerido}" maxlength="120">
     <div class="ed-modal-acciones">
       <button type="button" data-cancelar>Cancelar</button>
       <button type="button" class="primario" data-confirmar>Guardar</button>
     </div>`,
    (raiz) => raiz.querySelector<HTMLInputElement>('[data-nombre]')!.value
  ) as Promise<string | null>;
}

export function pedirFilasColumnas(): Promise<{ filas: number; columnas: number } | null> {
  return abrir(
    `<div class="ed-modal-tit">Insertar tabla</div>
     <div class="ed-modal-sub">Elegí cuántas filas y columnas tiene. Después se puede ajustar cada fila y cada columna arrastrando sus líneas.</div>
     <div class="ed-modal-grid">
       <div><label class="ed-lbl">Filas</label><input type="number" data-filas class="mono" value="3" min="1" max="20"></div>
       <div><label class="ed-lbl">Columnas</label><input type="number" data-cols class="mono" value="3" min="1" max="10"></div>
     </div>
     <div class="ed-modal-acciones">
       <button type="button" data-cancelar>Cancelar</button>
       <button type="button" class="primario" data-confirmar>Insertar</button>
     </div>`,
    (raiz) => ({
      filas: Number(raiz.querySelector<HTMLInputElement>('[data-filas]')!.value),
      columnas: Number(raiz.querySelector<HTMLInputElement>('[data-cols]')!.value),
    })
  ) as Promise<{ filas: number; columnas: number } | null>;
}

export function pedirExportarPdf(sugerido: string): Promise<{ nombre: string; conFormulario: boolean } | null> {
  return abrir(
    `<div class="ed-modal-tit">Exportar PDF</div>
     <div class="ed-modal-sub">Se genera y descarga el PDF final del diseño.</div>
     <label class="ed-lbl">Nombre del archivo</label>
     <input type="text" data-nombre value="${sugerido}" maxlength="120">
     <label class="ed-check" style="margin-top:12px;"><input type="checkbox" data-formulario checked> Conservar campos editables (AcroForm)</label>
     <p class="nota" style="margin-top:6px;">Sin esto, los campos se dibujan aplanados con su valor por defecto y el PDF deja de ser rellenable.</p>
     <div class="ed-modal-acciones">
       <button type="button" data-cancelar>Cancelar</button>
       <button type="button" class="primario" data-confirmar>Exportar</button>
     </div>`,
    (raiz) => ({
      nombre: raiz.querySelector<HTMLInputElement>('[data-nombre]')!.value,
      conFormulario: raiz.querySelector<HTMLInputElement>('[data-formulario]')!.checked,
    })
  ) as Promise<{ nombre: string; conFormulario: boolean } | null>;
}

export function mostrarPreflight(hallazgos: { gravedad: 'error' | 'advertencia'; mensaje: string }[]): Promise<boolean> {
  const errores = hallazgos.filter((h) => h.gravedad === 'error');
  const advertencias = hallazgos.filter((h) => h.gravedad === 'advertencia');

  const lista = (items: typeof hallazgos, clase: string, icono: string) =>
    items.map((h) => `<div class="ed-pf-item ${clase}"><span>${icono}</span><span>${h.mensaje}</span></div>`).join('');

  const cuerpo = hallazgos.length
    ? `${errores.length ? `<div class="ed-pf-tit errores">✕ Errores (${errores.length})</div>${lista(errores, 'errores', '✕')}` : ''}
       ${advertencias.length ? `<div class="ed-pf-tit adv">⚠ Advertencias (${advertencias.length})</div>${lista(advertencias, 'adv', '⚠')}` : ''}`
    : '<div class="ed-pf-ok">✓ El diseño no tiene problemas.</div>';

  return abrir(
    `<div class="ed-modal-tit">Verificar diseño</div>
     <div class="ed-modal-sub">Revisión previa a exportar. Los errores conviene corregirlos; las advertencias son recomendaciones.</div>
     <div class="ed-pf-lista">${cuerpo}</div>
     <div class="ed-modal-acciones">
       <button type="button" data-cancelar>Cerrar</button>
       <button type="button" class="primario" data-confirmar>${errores.length ? 'Exportar igual' : 'Exportar'}</button>
     </div>`,
    () => true
  ).then((r) => r === true);
}

export function mostrarAyuda(titulo: string, html: string): Promise<unknown> {
  return abrir(
    `<div class="ed-modal-tit">${titulo}</div>
     <div class="ed-ayuda">${html}</div>
     <div class="ed-modal-acciones">
       <button type="button" data-cancelar style="display:none"></button>
       <button type="button" class="primario" data-confirmar>Entendido</button>
     </div>`,
    () => true
  );
}

export function confirmar(titulo: string, mensaje: string, etiquetaAceptar = 'Aceptar'): Promise<boolean> {
  return abrir(
    `<div class="ed-modal-tit">${titulo}</div>
     <div class="ed-modal-sub">${mensaje}</div>
     <div class="ed-modal-acciones">
       <button type="button" data-cancelar>Cancelar</button>
       <button type="button" class="primario" data-confirmar>${etiquetaAceptar}</button>
     </div>`,
    () => true
  ).then((r) => r === true);
}

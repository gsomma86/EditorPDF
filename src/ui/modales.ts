import { TAMANOS, type ConfigPagina, type Margenes, type Orientacion, type TamanoPagina } from '../editor/pagina';
import { t, type ClaveI18n } from './i18n';

/**
 * `alMontar` corre con el modal ya en pantalla y recibe su raíz: sirve para los que muestran algo
 * en vivo mientras se escribe, como la vista previa del campo repetible.
 */
function abrir(contenido: string, alConfirmar: (raiz: HTMLElement) => unknown, alMontar?: (raiz: HTMLElement) => void): Promise<unknown> {
  const overlay = document.createElement('div');
  overlay.className = 'ed-modal-overlay';
  overlay.innerHTML = `<div class="ed-modal">${contenido}</div>`;
  document.body.appendChild(overlay);
  alMontar?.(overlay);

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
  return (Object.keys(TAMANOS) as TamanoPagina[])
    .map((tam) => `<option value="${tam}" ${tam === actual ? 'selected' : ''}>${t(`pagina.tamano.${tam}` as ClaveI18n)}</option>`)
    .join('');
}

function camposMargenes(m: Margenes): string {
  return `<div class="ed-modal-grid">
    <div><label class="ed-lbl">${t('modal.margen.arriba')}</label><input type="number" data-mg="arriba" class="mono" value="${m.arriba}" min="0"></div>
    <div><label class="ed-lbl">${t('modal.margen.abajo')}</label><input type="number" data-mg="abajo" class="mono" value="${m.abajo}" min="0"></div>
    <div><label class="ed-lbl">${t('modal.margen.izquierda')}</label><input type="number" data-mg="izquierda" class="mono" value="${m.izquierda}" min="0"></div>
    <div><label class="ed-lbl">${t('modal.margen.derecha')}</label><input type="number" data-mg="derecha" class="mono" value="${m.derecha}" min="0"></div>
  </div>`;
}

function leerMargenes(raiz: HTMLElement): Margenes {
  const valor = (nombre: keyof Margenes) => Math.max(0, Number(raiz.querySelector<HTMLInputElement>(`[data-mg="${nombre}"]`)!.value) || 0);
  return { arriba: valor('arriba'), abajo: valor('abajo'), izquierda: valor('izquierda'), derecha: valor('derecha') };
}

export function pedirNuevoProyecto(actual: ConfigPagina): Promise<ConfigPagina | null> {
  return abrir(
    `<div class="ed-modal-tit">${t('modal.nuevoProyecto.titulo')}</div>
     <div class="ed-modal-sub">${t('modal.nuevoProyecto.sub')}</div>
     <div class="ed-modal-grid">
       <div><label class="ed-lbl">${t('modal.lbl.tamanoHoja')}</label><select data-tamano>${opcionesTamano(actual.tamano)}</select></div>
       <div><label class="ed-lbl">${t('menu.pagina.orientacion')}</label><select data-orient>
         <option value="vertical" ${actual.orientacion === 'vertical' ? 'selected' : ''}>${t('pagina.orientacion.vertical')}</option>
         <option value="horizontal" ${actual.orientacion === 'horizontal' ? 'selected' : ''}>${t('pagina.orientacion.horizontal')}</option>
       </select></div>
     </div>
     <div class="ed-sec-tit" style="margin-top:14px;">${t('modal.margenes.tit')}</div>
     ${camposMargenes(actual.margenes)}
     <div class="ed-modal-acciones">
       <button type="button" data-cancelar>${t('modal.btn.cancelar')}</button>
       <button type="button" class="primario" data-confirmar>${t('modal.nuevoProyecto.crear')}</button>
     </div>`,
    (raiz): ConfigPagina => ({
      tamano: raiz.querySelector<HTMLSelectElement>('[data-tamano]')!.value as TamanoPagina,
      orientacion: raiz.querySelector<HTMLSelectElement>('[data-orient]')!.value as Orientacion,
      margenes: leerMargenes(raiz),
      medidas: null,
    })
  ) as Promise<ConfigPagina | null>;
}

export function pedirMargenes(actual: Margenes): Promise<Margenes | null> {
  return abrir(
    `<div class="ed-modal-tit">${t('modal.margenes.titulo')}</div>
     <div class="ed-modal-sub">${t('modal.margenes.sub')}</div>
     ${camposMargenes(actual)}
     <div class="ed-modal-acciones">
       <button type="button" data-cancelar>${t('modal.btn.cancelar')}</button>
       <button type="button" class="primario" data-confirmar>${t('modal.btn.aplicar')}</button>
     </div>`,
    (raiz) => leerMargenes(raiz)
  ) as Promise<Margenes | null>;
}

export function pedirNombreArchivo(titulo: string, subtitulo: string, sugerido: string): Promise<string | null> {
  return abrir(
    `<div class="ed-modal-tit">${titulo}</div>
     <div class="ed-modal-sub">${subtitulo}</div>
     <label class="ed-lbl">${t('modal.nombreArchivo.lbl')}</label>
     <input type="text" data-nombre value="${sugerido}" maxlength="120">
     <div class="ed-modal-acciones">
       <button type="button" data-cancelar>${t('modal.btn.cancelar')}</button>
       <button type="button" class="primario" data-confirmar>${t('modal.btn.guardar')}</button>
     </div>`,
    (raiz) => raiz.querySelector<HTMLInputElement>('[data-nombre]')!.value
  ) as Promise<string | null>;
}

export function pedirFilasColumnas(): Promise<{ filas: number; columnas: number } | null> {
  return abrir(
    `<div class="ed-modal-tit">${t('modal.tabla.titulo')}</div>
     <div class="ed-modal-sub">${t('modal.tabla.sub')}</div>
     <div class="ed-modal-grid">
       <div><label class="ed-lbl">${t('modal.tabla.filas')}</label><input type="number" data-filas class="mono" value="3" min="1" max="20"></div>
       <div><label class="ed-lbl">${t('modal.tabla.columnas')}</label><input type="number" data-cols class="mono" value="3" min="1" max="10"></div>
     </div>
     <div class="ed-modal-acciones">
       <button type="button" data-cancelar>${t('modal.btn.cancelar')}</button>
       <button type="button" class="primario" data-confirmar>${t('modal.btn.insertar')}</button>
     </div>`,
    (raiz) => ({
      filas: Number(raiz.querySelector<HTMLInputElement>('[data-filas]')!.value),
      columnas: Number(raiz.querySelector<HTMLInputElement>('[data-cols]')!.value),
    })
  ) as Promise<{ filas: number; columnas: number } | null>;
}

export interface Repeticion {
  name: string;
  repComodin: string;
  repFilas: number;
  repSep: number;
}

/**
 * Convierte un campo en repetible: su ID lleva un comodín que se reemplaza por el número de fila.
 * La vista previa muestra los IDs que van a salir mientras se escribe, y no deja confirmar si el
 * ID no contiene el comodín (sin él las N filas tendrían todas el mismo nombre y en AcroForm eso
 * es un solo campo).
 */
export function pedirCampoRepetible(actual: Repeticion): Promise<Repeticion | null> {
  const leer = (raiz: HTMLElement): Repeticion => ({
    name: raiz.querySelector<HTMLInputElement>('[data-id]')!.value.trim(),
    repComodin: raiz.querySelector<HTMLInputElement>('[data-comodin]')!.value || '#',
    repFilas: Math.max(1, Math.min(50, Number(raiz.querySelector<HTMLInputElement>('[data-filas]')!.value) || 1)),
    repSep: Math.max(0, Math.min(200, Number(raiz.querySelector<HTMLInputElement>('[data-sep]')!.value) || 0)),
  });

  return abrir(
    `<div class="ed-modal-tit">${t('modal.repetible.titulo')}</div>
     <div class="ed-modal-sub">${t('modal.repetible.sub')}</div>
     <label class="ed-lbl">${t('modal.repetible.idLbl')}</label>
     <input type="text" data-id value="${actual.name}" maxlength="120">
     <div class="ed-modal-grid" style="margin-top:10px;">
       <div><label class="ed-lbl">${t('modal.repetible.comodin')}</label><input type="text" data-comodin class="mono" value="${actual.repComodin || '#'}" maxlength="3"></div>
       <div><label class="ed-lbl">${t('modal.tabla.filas')}</label><input type="number" data-filas class="mono" value="${actual.repFilas > 1 ? actual.repFilas : 7}" min="1" max="50"></div>
       <div><label class="ed-lbl">${t('modal.repetible.separacionPt')}</label><input type="number" data-sep class="mono" value="${actual.repSep}" min="0" max="200" step="0.5"></div>
     </div>
     <p class="nota ed-cr-aviso oculto" data-aviso>${t('modal.repetible.aviso')}</p>
     <div class="ed-cr-chips" data-chips></div>
     <div class="ed-modal-acciones">
       <button type="button" data-cancelar>${t('modal.btn.cancelar')}</button>
       <button type="button" class="primario" data-confirmar>${t('modal.btn.aplicar')}</button>
     </div>`,
    leer,
    (raiz) => {
      const aviso = raiz.querySelector<HTMLElement>('[data-aviso]')!;
      const chips = raiz.querySelector<HTMLElement>('[data-chips]')!;
      const confirmar = raiz.querySelector<HTMLButtonElement>('[data-confirmar]')!;

      const refrescar = () => {
        const valores = leer(raiz);
        const falta = valores.repFilas > 1 && !valores.name.includes(valores.repComodin);
        aviso.classList.toggle('oculto', !falta);
        confirmar.disabled = falta || !valores.name;

        const nombres = valores.repFilas > 1 && !falta ? Array.from({ length: Math.min(valores.repFilas, 12) }, (_, i) => valores.name.split(valores.repComodin).join(String(i + 1))) : [];
        chips.innerHTML =
          nombres.map((n) => `<span>${n}</span>`).join('') +
          (valores.repFilas > 12 && !falta ? `<span>${t('modal.repetible.masChips', { n: valores.repFilas - 12 })}</span>` : '');
      };

      raiz.querySelectorAll('input').forEach((campo) => campo.addEventListener('input', refrescar));
      refrescar();
    }
  ) as Promise<Repeticion | null>;
}

export function pedirExportarPdf(sugerido: string): Promise<{ nombre: string; conFormulario: boolean; sinApariencias: boolean } | null> {
  return abrir(
    `<div class="ed-modal-tit">${t('modal.exportar.titulo')}</div>
     <div class="ed-modal-sub">${t('modal.exportar.sub')}</div>
     <label class="ed-lbl">${t('modal.nombreArchivo.lbl')}</label>
     <input type="text" data-nombre value="${sugerido}" maxlength="120">
     <label class="ed-check" style="margin-top:12px;"><input type="checkbox" data-formulario checked> ${t('modal.exportar.conservarCampos')}</label>
     <p class="nota" style="margin-top:6px;">${t('modal.exportar.conservarCamposNota')}</p>
     <label class="ed-check" style="margin-top:10px;"><input type="checkbox" data-sinap> ${t('modal.exportar.sinApariencias')}</label>
     <p class="nota" style="margin-top:6px;">${t('modal.exportar.sinAparienciasNota')}</p>
     <div class="ed-modal-acciones">
       <button type="button" data-cancelar>${t('modal.btn.cancelar')}</button>
       <button type="button" class="primario" data-confirmar>${t('modal.btn.exportar')}</button>
     </div>`,
    (raiz) => ({
      nombre: raiz.querySelector<HTMLInputElement>('[data-nombre]')!.value,
      conFormulario: raiz.querySelector<HTMLInputElement>('[data-formulario]')!.checked,
      sinApariencias: raiz.querySelector<HTMLInputElement>('[data-sinap]')!.checked,
    })
  ) as Promise<{ nombre: string; conFormulario: boolean; sinApariencias: boolean } | null>;
}

export function mostrarPreflight(hallazgos: { gravedad: 'error' | 'advertencia'; mensaje: string }[]): Promise<boolean> {
  const errores = hallazgos.filter((h) => h.gravedad === 'error');
  const advertencias = hallazgos.filter((h) => h.gravedad === 'advertencia');

  const lista = (items: typeof hallazgos, clase: string, icono: string) =>
    items.map((h) => `<div class="ed-pf-item ${clase}"><span>${icono}</span><span>${h.mensaje}</span></div>`).join('');

  const cuerpo = hallazgos.length
    ? `${errores.length ? `<div class="ed-pf-tit errores">${t('modal.preflight.errores', { n: errores.length })}</div>${lista(errores, 'errores', '✕')}` : ''}
       ${advertencias.length ? `<div class="ed-pf-tit adv">${t('modal.preflight.advertencias', { n: advertencias.length })}</div>${lista(advertencias, 'adv', '⚠')}` : ''}`
    : `<div class="ed-pf-ok">${t('modal.preflight.ok')}</div>`;

  return abrir(
    `<div class="ed-modal-tit">${t('modal.preflight.titulo')}</div>
     <div class="ed-modal-sub">${t('modal.preflight.sub')}</div>
     <div class="ed-pf-lista">${cuerpo}</div>
     <div class="ed-modal-acciones">
       <button type="button" data-cancelar>${t('modal.btn.cerrar')}</button>
       <button type="button" class="primario" data-confirmar>${errores.length ? t('modal.preflight.exportarIgual') : t('modal.btn.exportar')}</button>
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
       <button type="button" class="primario" data-confirmar>${t('modal.btn.entendido')}</button>
     </div>`,
    () => true
  );
}

export function confirmar(titulo: string, mensaje: string, etiquetaAceptar = t('modal.btn.aceptar')): Promise<boolean> {
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

import type { Canvas, FabricObject } from 'fabric';
import { FabricImage } from 'fabric';
import { aplicarMarcas, elementoDe, moverEnLaPila, ordenarPila, reemplazarObjeto, agregarAlLienzo, generarQr, prepararFuente, sincronizarGeometria, textoParaDibujar } from '../editor/objetosFabric';
import { capaDe, capasDelDocumento } from '../editor/documento';
import { altoTotalTabla, alturaRenglonFabric, anchoTotalTabla, duplicarElemento, type Elemento } from '../editor/elemento';
import { FAMILIAS_BASE, FAMILIAS_WEB } from '../editor/fuentes';
import { registrarSnapshot } from '../editor/historial';
import type { TablaObjeto } from '../editor/tablaObjeto';
import type { LineaObjeto } from '../editor/lineaObjeto';
import type { FormaObjeto } from '../editor/formaObjeto';
import type { RectObjeto } from '../editor/rectObjeto';
import { PUNTAS_MAX, PUNTAS_MIN } from '../editor/figuras';
import { GROSOR_MINIMO_DOBLE } from '../editor/trazos';
import { confirmar, pedirCampoRepetible } from './modales';
import { aplicarIdioma, t } from './i18n';

const ETIQUETA_TIPO: Record<Elemento['clase'], Parameters<typeof t>[0]> = {
  texto: 'tipo.texto',
  linea: 'tipo.linea',
  rect: 'tipo.rect',
  forma: 'tipo.forma',
  qr: 'tipo.qr',
  tabla: 'tipo.tabla',
  imagen: 'tipo.imagen',
  campo: 'tipo.campo',
  firma: 'tipo.firma',
};

/**
 * El botón "Reemplazar imagen…" comparte un único input de archivo (como los de `main.ts`), y
 * apunta al elemento vigente en el momento del clic: no toca `x`/`y`/`w`/`h`, solo el contenido,
 * para no perder la posición y el tamaño que ya tenía en la hoja.
 */
let objetivoReemplazoImagen: { lienzo: Canvas; objeto: FabricObject; elemento: Elemento & { clase: 'imagen' }; panel: HTMLElement } | null = null;

const inputReemplazoImagen = document.createElement('input');
inputReemplazoImagen.type = 'file';
inputReemplazoImagen.accept = 'image/png,image/jpeg';
inputReemplazoImagen.style.display = 'none';
document.body.appendChild(inputReemplazoImagen);

inputReemplazoImagen.addEventListener('change', async () => {
  const archivo = inputReemplazoImagen.files?.[0];
  const objetivo = objetivoReemplazoImagen;
  if (!archivo || !objetivo) return;
  const { lienzo, objeto, elemento, panel } = objetivo;

  try {
    // Misma validación y achique que al agregar una imagen nueva (ver editor/imagen.ts).
    const { prepararImagen } = await import('../editor/imagen');
    const imagen = await prepararImagen(archivo);
    elemento.src = imagen.src;
    const img = objeto as InstanceType<typeof FabricImage>;
    await img.setSrc(imagen.src);
    img.set({ scaleX: elemento.w / (img.width || elemento.w), scaleY: elemento.h / (img.height || elemento.h) });
    lienzo.requestRenderAll();
    registrarSnapshot(lienzo);
    mostrarPropiedades(panel, lienzo, objeto);
  } catch (error) {
    await confirmar(
      t('confirmar.noSePudoImportar.titulo'),
      error instanceof Error ? error.message : t('confirmar.noSePudoImportar.generico'),
      t('modal.btn.entendido')
    );
  }
});

function bloqueTipografia(elemento: { familia: string; negrita: boolean; cursiva: boolean; subrayado: boolean; align: 'left' | 'center' | 'right' }): string {
  return `
    <div><label class="ed-lbl" data-i18n="props.familia"></label><select id="ed-p-familia">
      <optgroup data-i18n-label="props.familiaEstandar">
        ${FAMILIAS_BASE.map((f) => `<option ${f === elemento.familia ? 'selected' : ''}>${f}</option>`).join('')}
      </optgroup>
      <optgroup data-i18n-label="props.familiaWeb">
        ${FAMILIAS_WEB.map((f) => `<option ${f === elemento.familia ? 'selected' : ''}>${f}</option>`).join('')}
      </optgroup>
    </select></div>
    <div class="ed-fila-toggle">
      <button type="button" class="ed-toggle ${elemento.negrita ? 'activo' : ''}" id="ed-p-negrita" data-i18n-title="props.negritaTt"><b>N</b></button>
      <button type="button" class="ed-toggle ${elemento.cursiva ? 'activo' : ''}" id="ed-p-cursiva" data-i18n-title="props.cursivaTt"><i>K</i></button>
      <button type="button" class="ed-toggle ${elemento.subrayado ? 'activo' : ''}" id="ed-p-subrayado" data-i18n-title="props.subrayadoTt"><u>S</u></button>
    </div>
    <label class="ed-lbl" style="margin-top:8px;" data-i18n="props.alineacion"></label>
    <div class="ed-fila-toggle">
      <button type="button" class="ed-toggle ${elemento.align === 'left' ? 'activo' : ''}" id="ed-p-al-izq" data-i18n-title="props.alIzqTt">⇤</button>
      <button type="button" class="ed-toggle ${elemento.align === 'center' ? 'activo' : ''}" id="ed-p-al-centro" data-i18n-title="props.alCentroTt">≡</button>
      <button type="button" class="ed-toggle ${elemento.align === 'right' ? 'activo' : ''}" id="ed-p-al-der" data-i18n-title="props.alDerTt">⇥</button>
    </div>`;
}

function wireTipografia(
  $: <T extends HTMLElement>(id: string) => T | null,
  elemento: { familia: string; negrita: boolean; cursiva: boolean; subrayado: boolean; align: 'left' | 'center' | 'right' },
  aplicar: (props: Record<string, unknown>) => void,
  repintar: () => void
): void {
  $('#ed-p-familia')!.addEventListener('change', async (e) => {
    elemento.familia = (e.target as HTMLSelectElement).value;
    await prepararFuente(elemento.familia);
    aplicar({ fontFamily: elemento.familia });
    repintar();
  });
  const alinear = (valor: 'left' | 'center' | 'right') => {
    elemento.align = valor;
    aplicar({ textAlign: valor });
    $('#ed-p-al-izq')!.classList.toggle('activo', valor === 'left');
    $('#ed-p-al-centro')!.classList.toggle('activo', valor === 'center');
    $('#ed-p-al-der')!.classList.toggle('activo', valor === 'right');
    repintar();
  };
  $('#ed-p-al-izq')!.addEventListener('click', () => alinear('left'));
  $('#ed-p-al-centro')!.addEventListener('click', () => alinear('center'));
  $('#ed-p-al-der')!.addEventListener('click', () => alinear('right'));
  const toggle = (id: string, prop: 'negrita' | 'cursiva' | 'subrayado', props: () => Record<string, unknown>) => {
    $(id)!.addEventListener('click', () => {
      elemento[prop] = !elemento[prop];
      $(id)!.classList.toggle('activo', elemento[prop]);
      aplicar(props());
      repintar();
    });
  };
  toggle('#ed-p-negrita', 'negrita', () => ({ fontWeight: elemento.negrita ? '700' : '400' }));
  toggle('#ed-p-cursiva', 'cursiva', () => ({ fontStyle: elemento.cursiva ? 'italic' : 'normal' }));
  toggle('#ed-p-subrayado', 'subrayado', () => ({ underline: elemento.subrayado }));
}

export function mostrarSinSeleccion(panel: HTMLElement): void {
  panel.innerHTML = `
    <div class="ed-props-tit"><strong data-i18n="shell.propiedades.titulo"></strong></div>
    <div class="ed-sinsel" data-i18n="shell.sinSeleccion"></div>
  `;
  aplicarIdioma(panel);
}

type Alineacion = 'izq' | 'centroH' | 'der' | 'arriba' | 'centroV' | 'abajo';

/** El ángulo si todos los seleccionados comparten el mismo; si no, null (el campo va vacío). */
function anguloComun(objetos: FabricObject[]): number | null {
  const angulos = objetos.map((o) => elementoDe(o)?.angulo ?? 0);
  return angulos.every((a) => a === angulos[0]) ? angulos[0] : null;
}

/**
 * Panel para varios elementos a la vez. Las acciones operan sobre los objetos sueltos: primero se
 * deshace la selección (ahí Fabric escribe las coordenadas absolutas en cada uno) y después se
 * vuelve a armar, porque dentro de una selección las posiciones son relativas al grupo.
 */
export function mostrarMultiSeleccion(
  panel: HTMLElement,
  lienzo: Canvas,
  objetos: FabricObject[],
  alTerminar: (objetos: FabricObject[]) => void
): void {
  panel.innerHTML = `
    <div class="ed-props-tit"><strong data-i18n="shell.propiedades.titulo"></strong><span class="ed-chip-tipo"></span></div>
    <div class="ed-sec">
      <div class="ed-sec-tit" data-i18n="props.multi.alinearEntreSi"></div>
      <div class="ed-fila-toggle">
        <button type="button" class="ed-toggle" data-alinear="izq" data-i18n-title="props.alIzqTt">⇤</button>
        <button type="button" class="ed-toggle" data-alinear="centroH" data-i18n-title="props.multi.centroHTt">≡</button>
        <button type="button" class="ed-toggle" data-alinear="der" data-i18n-title="props.alDerTt">⇥</button>
      </div>
      <div class="ed-fila-toggle">
        <button type="button" class="ed-toggle" data-alinear="arriba" data-i18n-title="props.multi.arribaTt">⤒</button>
        <button type="button" class="ed-toggle" data-alinear="centroV" data-i18n-title="props.multi.centroVTt">⇕</button>
        <button type="button" class="ed-toggle" data-alinear="abajo" data-i18n-title="props.multi.abajoTt">⤓</button>
      </div>
    </div>
    <div class="ed-sec">
      <div class="ed-sec-tit" data-i18n="props.multi.rotacion"></div>
      <div><label class="ed-lbl" data-i18n="props.multi.angulo"></label><input type="number" id="ed-multi-angulo" class="mono" value="${anguloComun(objetos) ?? ''}" step="1" data-i18n-placeholder="props.multi.anguloPlaceholder"></div>
      <p class="nota" data-i18n="props.multi.anguloNota"></p>
    </div>
    ${
      capasDelDocumento().length > 1
        ? `<div class="ed-sec">
             <div class="ed-sec-tit" data-i18n="props.capa"></div>
             <select id="ed-multi-capa">
               <option value="" data-i18n="props.multi.capaSinCambio"></option>
               ${capasDelDocumento().map((c) => `<option value="${c.id}">${escapeHtml(c.nombre)}</option>`).join('')}
             </select>
           </div>`
        : ''
    }
    <div class="ed-acciones2">
      <button type="button" id="ed-multi-duplicar" data-i18n="props.acciones.duplicar"></button>
      <button type="button" id="ed-multi-borrar" class="peligro" data-i18n="props.acciones.borrar"></button>
      <button type="button" id="ed-multi-frente" data-i18n="props.acciones.alFrente"></button>
      <button type="button" id="ed-multi-atras" data-i18n="props.acciones.enviarAtras"></button>
    </div>
  `;
  panel.querySelector('.ed-chip-tipo')!.textContent = t('props.multi.elementos', { n: objetos.length });
  aplicarIdioma(panel);

  /** Devuelve los objetos con sus coordenadas ya absolutas, sin selección activa. */
  const soltar = (): FabricObject[] => {
    const lista = [...objetos];
    lienzo.discardActiveObject();
    lienzo.requestRenderAll();
    return lista;
  };

  // Mandar todos los seleccionados a la misma capa. Arranca en "sin cambio" porque los elegidos
  // pueden estar repartidos en varias capas y no habría un valor honesto que mostrar.
  panel.querySelector<HTMLSelectElement>('#ed-multi-capa')?.addEventListener('change', (e) => {
    const capaId = (e.target as HTMLSelectElement).value;
    if (!capaId) return;
    for (const objeto of objetos) {
      const el = elementoDe(objeto);
      if (!el) continue;
      el.capa = capaId;
      aplicarMarcas(objeto, el);
    }
    lienzo.requestRenderAll();
    registrarSnapshot(lienzo);
    document.dispatchEvent(new CustomEvent('ed-capas-cambiadas'));
  });

  panel.querySelectorAll<HTMLButtonElement>('[data-alinear]').forEach((boton) => {
    boton.addEventListener('click', async () => {
      const modo = boton.dataset.alinear as Alineacion;
      const lista = soltar();
      const cajas = lista.map((o) => o.getBoundingRect());
      const minX = Math.min(...cajas.map((c) => c.left));
      const maxX = Math.max(...cajas.map((c) => c.left + c.width));
      const minY = Math.min(...cajas.map((c) => c.top));
      const maxY = Math.max(...cajas.map((c) => c.top + c.height));

      lista.forEach((objeto, i) => {
        const caja = cajas[i];
        if (modo === 'izq') objeto.set({ left: (objeto.left ?? 0) + (minX - caja.left) });
        if (modo === 'der') objeto.set({ left: (objeto.left ?? 0) + (maxX - (caja.left + caja.width)) });
        if (modo === 'centroH') objeto.set({ left: (objeto.left ?? 0) + ((minX + maxX) / 2 - (caja.left + caja.width / 2)) });
        if (modo === 'arriba') objeto.set({ top: (objeto.top ?? 0) + (minY - caja.top) });
        if (modo === 'abajo') objeto.set({ top: (objeto.top ?? 0) + (maxY - (caja.top + caja.height)) });
        if (modo === 'centroV') objeto.set({ top: (objeto.top ?? 0) + ((minY + maxY) / 2 - (caja.top + caja.height / 2)) });
        objeto.setCoords();
      });
      // Alinear mueve los objetos de Fabric, pero lo que se guarda y lo que entra al historial es
      // el modelo: sin volcar la posición nueva, la alineación se perdía al recargar.
      for (const objeto of lista) await sincronizarGeometria(lienzo, objeto);
      alTerminar(lista);
    });
  });

  // 'change' y no 'input': cada cambio deshace y rearma la selección, así que conviene esperar a
  // que termine de escribir el valor.
  panel.querySelector<HTMLInputElement>('#ed-multi-angulo')!.addEventListener('change', (e) => {
    const angulo = Number((e.target as HTMLInputElement).value);
    if (!Number.isFinite(angulo)) return;
    const lista = soltar();
    for (const objeto of lista) {
      const elemento = elementoDe(objeto);
      if (elemento) elemento.angulo = angulo;
      objeto.set({ angle: angulo });
      objeto.setCoords();
    }
    alTerminar(lista);
  });

  panel.querySelector<HTMLButtonElement>('#ed-multi-duplicar')!.addEventListener('click', async () => {
    const lista = soltar();
    const nuevos: FabricObject[] = [];
    for (const objeto of lista) {
      const elemento = elementoDe(objeto);
      if (elemento) nuevos.push(await agregarAlLienzo(lienzo, duplicarElemento(elemento)));
    }
    alTerminar(nuevos);
  });

  panel.querySelector<HTMLButtonElement>('#ed-multi-borrar')!.addEventListener('click', () => {
    const lista = soltar();
    lienzo.remove(...lista);
    lienzo.requestRenderAll();
    alTerminar([]);
  });

  panel.querySelector<HTMLButtonElement>('#ed-multi-frente')!.addEventListener('click', () => {
    const lista = soltar();
    lista.forEach((o) => moverEnLaPila(lienzo, o, 'frente'));
    alTerminar(lista);
  });

  panel.querySelector<HTMLButtonElement>('#ed-multi-atras')!.addEventListener('click', () => {
    const lista = soltar();
    [...lista].reverse().forEach((o) => moverEnLaPila(lienzo, o, 'fondo'));
    alTerminar(lista);
  });
}

export function mostrarPropiedades(panel: HTMLElement, lienzo: Canvas, objeto: FabricObject): void {
  const elemento = elementoDe(objeto);
  if (!elemento) {
    mostrarSinSeleccion(panel);
    return;
  }

  panel.innerHTML = `
    <div class="ed-props-tit"><strong data-i18n="shell.propiedades.titulo"></strong><span class="ed-chip-tipo" data-i18n="${ETIQUETA_TIPO[elemento.clase]}"></span></div>
    ${camposPara(elemento)}
    ${seccionPosicion(elemento)}
    <div class="ed-acciones2">
      <button type="button" id="ed-p-duplicar" data-i18n="props.acciones.duplicar"></button>
      <button type="button" id="ed-p-borrar" class="peligro" data-i18n="props.acciones.borrar"></button>
      <button type="button" id="ed-p-frente" data-i18n="props.acciones.alFrente"></button>
      <button type="button" id="ed-p-atras" data-i18n="props.acciones.enviarAtras"></button>
    </div>
  `;
  aplicarIdioma(panel);

  wireCampos(panel, lienzo, objeto, elemento);
  wireAcciones(panel, lienzo, objeto, elemento);
}

function seccion(claveTitulo: Parameters<typeof t>[0], contenido: string): string {
  return `<div class="ed-sec"><div class="ed-sec-tit" data-i18n="${claveTitulo}"></div>${contenido}</div>`;
}

function seccionPosicion(elemento: Elemento): string {
  // El QR es siempre cuadrado y ya tiene su propio control "Tamaño" en campoQr(): mostrar acá
  // Ancho/Alto por separado era un segundo control para lo mismo, sin cablear y desactualizado.
  const conTamano = elemento.clase !== 'texto' && elemento.clase !== 'tabla' && elemento.clase !== 'qr';
  return seccion(
    'props.posicionTitulo',
    `<div class="ed-grid2">
      <div><label class="ed-lbl" data-i18n="props.lbl.x"></label><input type="number" id="ed-p-x" class="mono" value="${elemento.x}"></div>
      <div><label class="ed-lbl" data-i18n="props.lbl.y"></label><input type="number" id="ed-p-y" class="mono" value="${elemento.y}"></div>
      ${
        conTamano && 'w' in elemento
          ? `<div><label class="ed-lbl" data-i18n="props.lbl.ancho"></label><input type="number" id="ed-p-w" class="mono" value="${elemento.w}" min="1"></div>
             <div><label class="ed-lbl" data-i18n="props.lbl.alto"></label><input type="number" id="ed-p-h" class="mono" value="${elemento.h}" min="1"></div>`
          : ''
      }
      <div><label class="ed-lbl" data-i18n="props.multi.angulo"></label><input type="number" id="ed-p-angulo" class="mono" value="${elemento.angulo}" step="1"></div>
    </div>
    ${bloqueCapa(elemento)}`
  );
}

/**
 * A qué capa pertenece el elemento. Va acá, con el resto de lo que ubica al elemento en la hoja, y
 * solo aparece si hay más de una capa: con una sola sería un desplegable de una opción.
 */
function bloqueCapa(elemento: Elemento): string {
  const capas = capasDelDocumento();
  if (capas.length < 2) return '';
  const actual = capaDe(elemento).id;
  return `<div><label class="ed-lbl" data-i18n="props.capa"></label><select id="ed-p-capa">
    ${capas.map((c) => `<option value="${c.id}" ${c.id === actual ? 'selected' : ''}>${escapeHtml(c.nombre)}</option>`).join('')}
  </select></div>`;
}

function campoTexto(elemento: Elemento & { clase: 'texto' }): string {
  return (
    seccion(
      'comun.contenido',
      `<div><label class="ed-lbl" data-i18n="props.lbl.texto"></label>${
        elemento.multilinea
          ? `<textarea id="ed-p-texto" rows="3">${escapeHtml(elemento.text)}</textarea>`
          : `<input type="text" id="ed-p-texto" value="${escapeHtml(elemento.text)}">`
      }</div>
      <label class="ed-check"><input type="checkbox" id="ed-p-multilinea" ${elemento.multilinea ? 'checked' : ''}> <span data-i18n="props.variasLineas"></span></label>`
    ) +
    seccion(
      'comun.formato',
      `<div class="ed-row2">
        <div><label class="ed-lbl" data-i18n="comun.tamano"></label><input type="number" id="ed-p-size" class="mono" value="${elemento.size}" min="5" max="72"></div>
        <div><label class="ed-lbl" data-i18n="comun.color"></label><input type="color" id="ed-p-color" value="${elemento.color}"></div>
      </div>
      ${bloqueTipografia(elemento)}
      <label class="ed-check"><input type="checkbox" id="ed-p-vertical" ${elemento.vertical ? 'checked' : ''}> <span data-i18n="props.textoVertical"></span></label>
      <div><label class="ed-lbl" data-i18n="props.separacionPt"></label><input type="number" id="ed-p-separacion" class="mono" value="${elemento.separacion}" step="0.5"></div>`
    )
  );
}

/**
 * El panel de un campo de firma. Es corto a propósito: adentro no se escribe, así que no lleva
 * tipografía, alineación ni valor por defecto.
 */
function campoFirma(elemento: Elemento & { clase: 'firma' }): string {
  return (
    seccion(
      'comun.contenido',
      `<div><label class="ed-lbl" data-i18n="props.firma.nombre"></label><input type="text" id="ed-p-nombre" value="${escapeHtml(elemento.name)}"></div>
      <div><label class="ed-lbl" data-i18n="props.firma.leyenda"></label><input type="text" id="ed-p-leyenda" value="${escapeHtml(elemento.leyenda)}" data-i18n-placeholder="props.firma.leyendaPlaceholder"></div>
      <label class="ed-check"><input type="checkbox" id="ed-p-obligatorio" ${elemento.obligatorio ? 'checked' : ''}> <span data-i18n="props.firma.obligatorio"></span></label>
      <p class="nota" data-i18n="props.firma.nota"></p>`
    ) +
    seccion(
      'comun.formato',
      `<div class="ed-grid2">
        <div><label class="ed-lbl" data-i18n="props.campo.bordeGrosor"></label><input type="number" id="ed-p-bordegrosor" min="0" max="6" step="0.5" value="${elemento.bordeGrosor}"></div>
        <div><label class="ed-lbl" data-i18n="props.campo.bordeColor"></label><input type="color" id="ed-p-bordecolor" value="${elemento.bordeColor}"></div>
      </div>
      <label class="ed-check"><input type="checkbox" id="ed-p-confondo" ${elemento.conFondo ? 'checked' : ''}> <span data-i18n="props.campo.conFondo"></span></label>
      <div><label class="ed-lbl" data-i18n="props.campo.fondoColor"></label><input type="color" id="ed-p-fondocolor" value="${elemento.fondoColor}"></div>`
    )
  );
}

function campoCampo(elemento: Elemento & { clase: 'campo' }): string {
  return (
    seccion(
      'comun.contenido',
      `<div><label class="ed-lbl" data-i18n="props.campo.id"></label><input type="text" id="ed-p-nombre" value="${escapeHtml(elemento.name)}"></div>
      <div><label class="ed-lbl" data-i18n="props.campo.tipoDato"></label><select id="ed-p-tipodato">
        ${['Texto', 'Numero', 'Moneda', 'Fecha']
          .map((td) => `<option value="${td}" ${td === elemento.tipo ? 'selected' : ''} data-i18n="tipoDato.${td}"></option>`)
          .join('')}
      </select></div>
      <label class="ed-check"><input type="checkbox" id="ed-p-invisible" ${elemento.invisible ? 'checked' : ''}> <span data-i18n="props.campo.invisible"></span></label>
      <div><label class="ed-lbl" data-i18n="props.campo.valorDefecto"></label><input type="text" id="ed-p-default" value="${escapeHtml(elemento.defaultValue)}" data-i18n-placeholder="props.campo.valorDefectoPlaceholder"></div>
      <label class="ed-check"><input type="checkbox" id="ed-p-readonly" ${elemento.readonly ? 'checked' : ''}> <span data-i18n="props.campo.readonly"></span></label>
      <label class="ed-check"><input type="checkbox" id="ed-p-campo-multilinea" ${elemento.multilinea ? 'checked' : ''}> <span data-i18n="props.variasLineas"></span></label>
      <button type="button" id="ed-p-rep-btn" class="ed-toggle" style="width:100%;margin-top:8px;">${
        elemento.repFilas > 1 ? t('props.campo.editarRepeticion', { n: elemento.repFilas }) : t('props.campo.hacerRepetible')
      }</button>`
    ) +
    seccion(
      'comun.formato',
      `<div class="ed-row2">
        <div><label class="ed-lbl" data-i18n="comun.tamano"></label><input type="number" id="ed-p-size" class="mono" value="${elemento.size}" min="5" max="72"></div>
        <div><label class="ed-lbl" data-i18n="comun.color"></label><input type="color" id="ed-p-color" value="${elemento.color}"></div>
      </div>
      <div class="ed-row2">
        <div><label class="ed-lbl" data-i18n="comun.colorBorde"></label><input type="color" id="ed-p-campo-bordecolor" value="${elemento.bordeColor}"></div>
        <div><label class="ed-lbl" data-i18n="comun.grosorBordePt"></label><input type="number" id="ed-p-campo-bordegrosor" class="mono" value="${elemento.bordeGrosor}" min="0" step="0.5"></div>
      </div>
      <label class="ed-check"><input type="checkbox" id="ed-p-campo-fondo" ${elemento.conFondo ? 'checked' : ''}> <span data-i18n="comun.conFondo"></span></label>
      <div><label class="ed-lbl" data-i18n="comun.colorFondo"></label><input type="color" id="ed-p-campo-fondocolor" value="${elemento.fondoColor}"></div>
      ${bloqueTipografia(elemento)}`
    )
  );
}

function campoLinea(elemento: Elemento & { clase: 'linea' }): string {
  return seccion(
    'comun.formato',
    // La orientación se resuelve con el ángulo (90° = vertical), así que no hacen falta
    // botones Horizontal/Vertical aparte: eran una segunda forma de hacer lo mismo y
    // quedaban desfasados cuando la línea tenía rotación.
    // El ángulo vive en la sección Posición, junto al resto de la geometría y como en todos los
    // demás tipos: acá quedaría un segundo control con el mismo id.
    `<div><label class="ed-lbl" data-i18n="comun.color"></label><input type="color" id="ed-p-color" value="${elemento.color}"></div>
    <div><label class="ed-lbl" data-i18n="comun.estilo"></label><select id="ed-p-estilo">
      ${opcionesEstilo(elemento.estilo)}
    </select></div>
    <div><label class="ed-lbl" data-i18n="props.linea.curvatura"></label><input type="number" id="ed-p-curvatura" class="mono" value="${elemento.curvatura}" step="1"></div>`
  );
}

function campoRect(elemento: Elemento & { clase: 'rect' }): string {
  return seccion(
    'comun.formato',
    `<div class="ed-row2">
      <div><label class="ed-lbl" data-i18n="comun.grosorBordePt"></label><input type="number" id="ed-p-grosor" class="mono" value="${elemento.grosor}" min="0.5" step="0.5"></div>
      <div><label class="ed-lbl" data-i18n="comun.radioEsquinaPt"></label><input type="number" id="ed-p-radio" class="mono" value="${elemento.radio}" min="0"></div>
    </div>
    <div class="ed-row2">
      <div><label class="ed-lbl" data-i18n="comun.colorBorde"></label><input type="color" id="ed-p-color" value="${elemento.color}"></div>
      <div><label class="ed-lbl" data-i18n="comun.estilo"></label><select id="ed-p-estilo">
        ${opcionesEstilo(elemento.estilo)}
      </select></div>
    </div>
    <label class="ed-check"><input type="checkbox" id="ed-p-con-relleno" ${elemento.conRelleno ? 'checked' : ''}> <span data-i18n="props.conRelleno"></span></label>
    <div><label class="ed-lbl" data-i18n="props.colorRelleno"></label><input type="color" id="ed-p-relleno-color" value="${elemento.rellenoColor}"></div>`
  );
}

function campoForma(elemento: Elemento & { clase: 'forma' }): string {
  return seccion(
    'comun.formato',
    // Cada figura suma sus propios controles; en las demás ese `<div>` no existe y el `numero()`
    // que lo escucha en wireCampos no engancha nada (usa `?.`).
    // "Doble" no se ofrece para 'camino' (formas convertidas de un PDF, con tramos curvos libres):
    // ahí no hay un contorno de puntos al que sacarle una copia concéntrica hacia adentro y afuera.
    `${
      elemento.figura === 'estrella'
        ? `<div class="ed-row2">
             <div><label class="ed-lbl" data-i18n="props.forma.puntas"></label><input type="number" id="ed-p-puntas" class="mono" value="${elemento.puntas}" min="${PUNTAS_MIN}" max="${PUNTAS_MAX}"></div>
             <div><label class="ed-lbl" data-i18n="props.forma.hundido"></label><input type="number" id="ed-p-hundido" class="mono" value="${elemento.hundido}" min="0.05" max="0.95" step="0.05"></div>
           </div>`
        : ''
    }
    ${
      elemento.figura === 'triangulo'
        ? `<div><label class="ed-lbl" data-i18n="props.forma.verticeX"></label><input type="number" id="ed-p-verticex" class="mono" value="${elemento.verticeX}" min="0" max="1" step="0.05"></div>`
        : ''
    }
    ${
      elemento.figura === 'flecha'
        ? `<div class="ed-row2">
             <div><label class="ed-lbl" data-i18n="props.forma.grosorAsta"></label><input type="number" id="ed-p-grosorasta" class="mono" value="${elemento.grosorAsta}" min="0.05" max="0.5" step="0.05"></div>
             <div><label class="ed-lbl" data-i18n="props.forma.tamanoCabeza"></label><input type="number" id="ed-p-tamanocabeza" class="mono" value="${elemento.tamanoCabeza}" min="0.2" max="2" step="0.1"></div>
           </div>`
        : ''
    }
    <div class="ed-row2">
      <div><label class="ed-lbl" data-i18n="comun.grosorBordePt"></label><input type="number" id="ed-p-grosor" class="mono" value="${elemento.grosor}" min="0.5" step="0.5"></div>
      <div><label class="ed-lbl" data-i18n="comun.estilo"></label><select id="ed-p-estilo">
        ${opcionesEstilo(elemento.estilo, elemento.figura === 'camino' ? ['solido', 'punteado'] : ['solido', 'punteado', 'doble'])}
      </select></div>
    </div>
    <div><label class="ed-lbl" data-i18n="comun.colorBorde"></label><input type="color" id="ed-p-color" value="${elemento.color}"></div>
    <label class="ed-check"><input type="checkbox" id="ed-p-con-relleno" ${elemento.conRelleno ? 'checked' : ''}> <span data-i18n="props.conRelleno"></span></label>
    <div><label class="ed-lbl" data-i18n="props.colorRelleno"></label><input type="color" id="ed-p-relleno-color" value="${elemento.rellenoColor}"></div>`
  );
}

function campoQr(elemento: Elemento & { clase: 'qr' }): string {
  return (
    seccion(
      'comun.contenido',
      `<div><label class="ed-lbl" data-i18n="props.qr.textoUrl"></label><input type="text" id="ed-p-texto" value="${escapeHtml(elemento.texto)}"></div>
      <div><label class="ed-lbl" data-i18n="props.qr.tamanoPt"></label><input type="number" id="ed-p-size" class="mono" value="${elemento.w}" min="20"></div>
      <div id="ed-p-qr-prev" class="ed-img-prev"></div>`
    ) +
    seccion(
      'comun.formato',
      `<div><label class="ed-lbl" data-i18n="comun.color"></label><input type="color" id="ed-p-color" value="${elemento.color}"></div>
      <label class="ed-check"><input type="checkbox" id="ed-p-qr-fondo" ${elemento.conFondo ? 'checked' : ''}> <span data-i18n="comun.conFondo"></span></label>
      <div><label class="ed-lbl" data-i18n="comun.colorFondo"></label><input type="color" id="ed-p-qr-fondocolor" value="${elemento.fondoColor}"></div>
      <p class="nota" style="margin-top:8px;" data-i18n="props.qr.contraste"></p>`
    )
  );
}

function campoTabla(elemento: Elemento & { clase: 'tabla' }): string {
  return seccion(
    'comun.formato',
    `<div class="ed-row2">
      <div><label class="ed-lbl" data-i18n="modal.tabla.filas"></label><input type="number" id="ed-p-tabla-filas" class="mono" value="${elemento.rows.length}" min="1" max="20"></div>
      <div><label class="ed-lbl" data-i18n="modal.tabla.columnas"></label><input type="number" id="ed-p-tabla-cols" class="mono" value="${elemento.cols.length}" min="1" max="10"></div>
    </div>
    <p class="nota" style="margin:-4px 0 8px;" data-i18n="props.tabla.resumen"></p>
    <div class="ed-row2">
      <div><label class="ed-lbl" data-i18n="props.lbl.ancho"></label><input type="number" id="ed-p-w" class="mono" value="${Math.round(anchoTotalTabla(elemento))}" min="${elemento.cols.length * 8}"></div>
      <div><label class="ed-lbl" data-i18n="props.lbl.alto"></label><input type="number" id="ed-p-h" class="mono" value="${Math.round(altoTotalTabla(elemento))}" min="${elemento.rows.length * 6}"></div>
    </div>
    <div class="ed-row2">
      <div><label class="ed-lbl" data-i18n="props.tabla.colorContorno"></label><input type="color" id="ed-p-color" value="${elemento.color}"></div>
      <div><label class="ed-lbl" data-i18n="props.tabla.colorInterno"></label><input type="color" id="ed-p-color-interno" value="${elemento.colorInterno}"></div>
    </div>
    <div class="ed-row2">
      <div><label class="ed-lbl" data-i18n="props.tabla.estiloContorno"></label><select id="ed-p-contorno">
        ${opcionesEstilo(elemento.estiloContorno)}
      </select></div>
      <div><label class="ed-lbl" data-i18n="props.tabla.estiloInterno"></label><select id="ed-p-interno">
        ${opcionesEstilo(elemento.estiloInterno)}
      </select></div>
    </div>
    <div class="ed-row2">
      <div><label class="ed-lbl" data-i18n="props.tabla.grosorLineaPt"></label><input type="number" id="ed-p-grosor" class="mono" value="${elemento.grosor}" min="0.5" step="0.5"></div>
      <div><label class="ed-lbl" data-i18n="comun.radioEsquinaPt"></label><input type="number" id="ed-p-radio" class="mono" value="${elemento.radio}" min="0"></div>
    </div>`
  );
}

function campoImagen(elemento: Elemento & { clase: 'imagen' }): string {
  return seccion(
    'comun.formato',
    `<div id="ed-p-imagen-prev" class="ed-img-prev" style="background-image:url('${elemento.src}')"></div>
    <button type="button" id="ed-p-imagen-reemplazar" class="ed-toggle" style="width:100%;margin-bottom:10px;" data-i18n="props.imagen.reemplazar"></button>
    <label class="ed-check"><input type="checkbox" id="ed-p-proporcion" ${elemento.proporcion ? 'checked' : ''}> <span data-i18n="props.imagen.mantenerProporcion"></span></label>
    <label class="ed-lbl" style="margin-top:8px;" data-i18n="props.imagen.opacidad"></label><input type="range" id="ed-p-opacidad" min="10" max="100" value="${elemento.opacidad}">
    <label class="ed-check" style="margin-top:8px;"><input type="checkbox" id="ed-p-imagen-fondo" ${elemento.conFondo ? 'checked' : ''}> <span data-i18n="comun.conFondo"></span></label>
    <div><label class="ed-lbl" data-i18n="comun.colorFondo"></label><input type="color" id="ed-p-imagen-fondocolor" value="${elemento.fondoColor}"></div>`
  );
}

function camposPara(elemento: Elemento): string {
  switch (elemento.clase) {
    case 'texto':
      return campoTexto(elemento);
    case 'linea':
      return campoLinea(elemento);
    case 'rect':
      return campoRect(elemento);
    case 'forma':
      return campoForma(elemento);
    case 'qr':
      return campoQr(elemento);
    case 'tabla':
      return campoTabla(elemento);
    case 'imagen':
      return campoImagen(elemento);
    case 'campo':
      return campoCampo(elemento);
    case 'firma':
      return campoFirma(elemento);
  }
}

/** `cuales` acota la lista: las formas no ofrecen "doble", que no saben dibujar. */
function opcionesEstilo(actual: string, cuales?: string[]): string {
  const claves: Record<string, Parameters<typeof t>[0]> = {
    solido: 'comun.estiloSolida',
    punteado: 'comun.estiloPunteada',
    doble: 'comun.estiloDoble',
  };
  return Object.entries(claves)
    .filter(([valor]) => !cuales || cuales.includes(valor))
    .map(([valor, clave]) => `<option value="${valor}" ${valor === actual ? 'selected' : ''} data-i18n="${clave}"></option>`)
    .join('');
}

export function escapeHtml(texto: string): string {
  return texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function wireAcciones(panel: HTMLElement, lienzo: Canvas, objeto: FabricObject, elemento: Elemento): void {
  panel.querySelector<HTMLButtonElement>('#ed-p-borrar')!.addEventListener('click', () => {
    lienzo.remove(objeto);
    lienzo.discardActiveObject();
    lienzo.requestRenderAll();
    mostrarSinSeleccion(panel);
    registrarSnapshot(lienzo);
  });

  panel.querySelector<HTMLButtonElement>('#ed-p-duplicar')!.addEventListener('click', async () => {
    const clon = duplicarElemento(elemento);
    const nuevo = await agregarAlLienzo(lienzo, clon);
    mostrarPropiedades(panel, lienzo, nuevo);
    registrarSnapshot(lienzo);
  });

  panel.querySelector<HTMLButtonElement>('#ed-p-frente')!.addEventListener('click', () => {
    moverEnLaPila(lienzo, objeto, 'frente');
    lienzo.requestRenderAll();
    registrarSnapshot(lienzo);
  });

  panel.querySelector<HTMLButtonElement>('#ed-p-atras')!.addEventListener('click', () => {
    moverEnLaPila(lienzo, objeto, 'fondo');
    lienzo.requestRenderAll();
    registrarSnapshot(lienzo);
  });
}

function wireCampos(panel: HTMLElement, lienzo: Canvas, objeto: FabricObject, elemento: Elemento): void {
  const $ = <T extends HTMLElement>(id: string) => panel.querySelector<T>(id);
  const repintar = () => lienzo.requestRenderAll();

  $('#ed-p-x')!.addEventListener('input', (e) => {
    elemento.x = Number((e.target as HTMLInputElement).value);
    objeto.set({ left: elemento.x });
    objeto.setCoords();
    repintar();
  });
  // Mandar el elemento a otra capa. Puede llevarlo a una apagada o trabada, así que hay que
  // reaplicar las marcas: si no, sigue viéndose y tocándose hasta el próximo redibujado.
  $('#ed-p-capa')?.addEventListener('change', (e) => {
    elemento.capa = (e.target as HTMLSelectElement).value;
    aplicarMarcas(objeto, elemento);
    // La capa decide dónde va en el apilado —incluso de qué lado de la página del PDF—, así que el
    // cambio no termina en el modelo: hay que rehacer el orden o el objeto se queda dibujado donde
    // estaba y la lista de capas pasa a decir otra cosa.
    ordenarPila(lienzo);
    // Y al frente de su capa nueva. Sin esto cae donde lo deje el orden anterior, que depende de por
    // dónde pasó antes: mandar algo a otra capa y traerlo de vuelta lo dejaba más abajo que al
    // empezar, sin que nadie lo hubiera pedido.
    moverEnLaPila(lienzo, objeto, 'frente');
    repintar();
    registrarSnapshot(lienzo);
    document.dispatchEvent(new CustomEvent('ed-capas-cambiadas'));
  });
  $('#ed-p-angulo')!.addEventListener('input', (e) => {
    elemento.angulo = Number((e.target as HTMLInputElement).value);
    // Todos los objetos rotan alrededor de su esquina superior izquierda, que es lo que x/y
    // señalan: así el ángulo no mueve el elemento de lugar.
    objeto.set({ angle: elemento.angulo });
    objeto.setCoords();
    repintar();
  });
  $('#ed-p-y')!.addEventListener('input', (e) => {
    elemento.y = Number((e.target as HTMLInputElement).value);
    objeto.set({ top: elemento.y });
    objeto.setCoords();
    repintar();
  });

  if (elemento.clase === 'texto') {
    const redibujarTexto = () => {
      (objeto as any).set({ text: textoParaDibujar(elemento), lineHeight: alturaRenglonFabric(elemento) });
      objeto.setCoords();
      repintar();
    };
    $('#ed-p-texto')!.addEventListener('input', (e) => {
      elemento.text = (e.target as HTMLInputElement).value;
      redibujarTexto();
    });
    $('#ed-p-vertical')!.addEventListener('change', (e) => {
      elemento.vertical = (e.target as HTMLInputElement).checked;
      redibujarTexto();
      registrarSnapshot(lienzo);
    });
    $('#ed-p-separacion')!.addEventListener('input', (e) => {
      elemento.separacion = Number((e.target as HTMLInputElement).value) || 0;
      redibujarTexto();
    });
    $('#ed-p-multilinea')!.addEventListener('change', (e) => {
      elemento.multilinea = (e.target as HTMLInputElement).checked;
      // El cuadro de texto del panel cambia de una línea a varias, así que se rearma el panel.
      mostrarPropiedades(panel, lienzo, objeto);
      registrarSnapshot(lienzo);
    });
    $('#ed-p-size')!.addEventListener('input', (e) => {
      elemento.size = Number((e.target as HTMLInputElement).value);
      objeto.set({ fontSize: elemento.size } as any);
      repintar();
    });
    $('#ed-p-color')!.addEventListener('input', (e) => {
      elemento.color = (e.target as HTMLInputElement).value;
      objeto.set({ fill: elemento.color });
      repintar();
    });
    wireTipografia($, elemento, (props) => objeto.set(props as any), repintar);
    return;
  }

  if (elemento.clase === 'linea') {
    // La línea se redibuja sola desde el modelo (LineaObjeto), así que alcanza con refrescar.
    const refrescar = () => {
      (objeto as LineaObjeto).refrescarDesdeDatos();
      repintar();
    };
    $('#ed-p-w')!.addEventListener('input', (e) => {
      elemento.w = Number((e.target as HTMLInputElement).value);
      refrescar();
    });
    $('#ed-p-h')!.addEventListener('input', (e) => {
      elemento.h = Number((e.target as HTMLInputElement).value);
      refrescar();
    });
    $('#ed-p-color')!.addEventListener('input', (e) => {
      elemento.color = (e.target as HTMLInputElement).value;
      refrescar();
    });
    $('#ed-p-estilo')!.addEventListener('change', (e) => {
      elemento.estilo = (e.target as HTMLSelectElement).value as typeof elemento.estilo;
      // "Doble" son dos trazos con un espacio entre medio: con poco grosor no entran y se ve
      // igual que una línea sólida. Se sube al mínimo para que el estilo elegido sea el que
      // realmente se va a ver (y a exportar).
      if (elemento.estilo === 'doble') {
        const horizontal = elemento.w >= elemento.h;
        if ((horizontal ? elemento.h : elemento.w) < GROSOR_MINIMO_DOBLE) {
          if (horizontal) elemento.h = GROSOR_MINIMO_DOBLE;
          else elemento.w = GROSOR_MINIMO_DOBLE;
          const campo = $<HTMLInputElement>(horizontal ? '#ed-p-h' : '#ed-p-w');
          if (campo) campo.value = String(GROSOR_MINIMO_DOBLE);
        }
      }
      refrescar();
    });
    $('#ed-p-curvatura')!.addEventListener('input', (e) => {
      elemento.curvatura = Number((e.target as HTMLInputElement).value) || 0;
      refrescar();
    });
  }

  if (elemento.clase === 'rect') {
    // El recuadro se redibuja solo desde el modelo (RectObjeto).
    const refrescar = () => {
      (objeto as RectObjeto).refrescarDesdeDatos();
      repintar();
    };
    $('#ed-p-w')!.addEventListener('input', (e) => {
      elemento.w = Number((e.target as HTMLInputElement).value);
      refrescar();
    });
    $('#ed-p-h')!.addEventListener('input', (e) => {
      elemento.h = Number((e.target as HTMLInputElement).value);
      refrescar();
    });
    $('#ed-p-color')!.addEventListener('input', (e) => {
      elemento.color = (e.target as HTMLInputElement).value;
      refrescar();
    });
    $('#ed-p-estilo')!.addEventListener('change', (e) => {
      elemento.estilo = (e.target as HTMLSelectElement).value as typeof elemento.estilo;
      if (elemento.estilo === 'doble' && elemento.grosor < GROSOR_MINIMO_DOBLE) {
        elemento.grosor = GROSOR_MINIMO_DOBLE;
        const campo = $<HTMLInputElement>('#ed-p-grosor');
        if (campo) campo.value = String(GROSOR_MINIMO_DOBLE);
      }
      refrescar();
    });
    $('#ed-p-grosor')!.addEventListener('input', (e) => {
      elemento.grosor = Number((e.target as HTMLInputElement).value);
      refrescar();
    });
    $('#ed-p-radio')!.addEventListener('input', (e) => {
      elemento.radio = Number((e.target as HTMLInputElement).value);
      refrescar();
    });
    $('#ed-p-con-relleno')!.addEventListener('change', (e) => {
      elemento.conRelleno = (e.target as HTMLInputElement).checked;
      refrescar();
    });
    $('#ed-p-relleno-color')!.addEventListener('input', (e) => {
      elemento.rellenoColor = (e.target as HTMLInputElement).value;
      if (elemento.conRelleno) refrescar();
    });
  }

  if (elemento.clase === 'forma') {
    // Igual que el recuadro: la forma se redibuja sola desde el modelo (FormaObjeto).
    const refrescar = () => {
      (objeto as FormaObjeto).refrescarDesdeDatos();
      repintar();
    };
    const numero = (id: string, aplicar: (valor: number) => void) => {
      $(id)?.addEventListener('input', (e) => {
        aplicar(Number((e.target as HTMLInputElement).value));
        refrescar();
      });
    };
    numero('#ed-p-w', (v) => (elemento.w = v));
    numero('#ed-p-h', (v) => (elemento.h = v));
    numero('#ed-p-grosor', (v) => (elemento.grosor = v));
    // Cada uno de estos solo existe en el HTML de su figura; en las demás `numero` no engancha nada.
    numero('#ed-p-puntas', (v) => (elemento.puntas = Math.max(PUNTAS_MIN, Math.min(PUNTAS_MAX, Math.round(v) || 5))));
    numero('#ed-p-hundido', (v) => (elemento.hundido = Math.max(0.05, Math.min(0.95, v))));
    numero('#ed-p-verticex', (v) => (elemento.verticeX = Math.max(0, Math.min(1, v))));
    numero('#ed-p-grosorasta', (v) => (elemento.grosorAsta = Math.max(0.05, Math.min(0.5, v))));
    numero('#ed-p-tamanocabeza', (v) => (elemento.tamanoCabeza = Math.max(0.2, Math.min(2, v))));
    $('#ed-p-color')!.addEventListener('input', (e) => {
      elemento.color = (e.target as HTMLInputElement).value;
      refrescar();
    });
    $('#ed-p-estilo')!.addEventListener('change', (e) => {
      elemento.estilo = (e.target as HTMLSelectElement).value as typeof elemento.estilo;
      if (elemento.estilo === 'doble' && elemento.grosor < GROSOR_MINIMO_DOBLE) {
        elemento.grosor = GROSOR_MINIMO_DOBLE;
        const campo = $<HTMLInputElement>('#ed-p-grosor');
        if (campo) campo.value = String(GROSOR_MINIMO_DOBLE);
      }
      refrescar();
    });
    $('#ed-p-con-relleno')!.addEventListener('change', (e) => {
      elemento.conRelleno = (e.target as HTMLInputElement).checked;
      refrescar();
    });
    $('#ed-p-relleno-color')!.addEventListener('input', (e) => {
      elemento.rellenoColor = (e.target as HTMLInputElement).value;
      if (elemento.conRelleno) refrescar();
    });
  }

  if (elemento.clase === 'qr') {
    const previa = $<HTMLElement>('#ed-p-qr-prev');
    // setSrc es asincrónico: hay que esperarlo antes de repintar, o el dibujo queda con el QR
    // anterior. El contador descarta respuestas fuera de orden si se tipea rápido.
    let generacion = 0;
    const regenerar = async () => {
      const propia = ++generacion;
      const imagen = objeto as InstanceType<typeof FabricImage>;
      const dataUrl = await generarQr(elemento);
      if (propia !== generacion) return;
      await imagen.setSrc(dataUrl);
      if (propia !== generacion) return;
      imagen.set({
        scaleX: elemento.w / (imagen.width || elemento.w),
        scaleY: elemento.h / (imagen.height || elemento.h),
      });
      if (previa) previa.style.backgroundImage = `url(${dataUrl})`;
      repintar();
    };
    /**
     * Lo mismo pero con un respiro, para lo que se escribe letra por letra: un QR se rearma entero
     * en cada tecla, y de "https://recibomail.net.ar" salían veintiséis. El contador de generación
     * ya evitaba que se pisaran las respuestas, así que no era un error —solo trabajo tirado—.
     * Los colores y el fondo siguen siendo inmediatos: ahí cada cambio es uno solo.
     */
    let respiro = 0;
    const regenerarConRespiro = () => {
      clearTimeout(respiro);
      respiro = window.setTimeout(regenerar, 250);
    };

    // La vista previa del panel arranca vacía: se llena con el QR ya generado, sin tocar el
    // objeto del lienzo (que ya lo tiene) ni esperar a que se edite algo.
    generarQr(elemento).then((dataUrl) => {
      if (previa) previa.style.backgroundImage = `url(${dataUrl})`;
    });

    $('#ed-p-texto')!.addEventListener('input', (e) => {
      elemento.texto = (e.target as HTMLInputElement).value;
      regenerarConRespiro();
    });
    $('#ed-p-color')!.addEventListener('input', (e) => {
      elemento.color = (e.target as HTMLInputElement).value;
      regenerar();
    });
    $('#ed-p-qr-fondo')!.addEventListener('change', (e) => {
      elemento.conFondo = (e.target as HTMLInputElement).checked;
      regenerar();
    });
    $('#ed-p-qr-fondocolor')!.addEventListener('input', (e) => {
      elemento.fondoColor = (e.target as HTMLInputElement).value;
      if (elemento.conFondo) regenerar();
    });
    $('#ed-p-size')!.addEventListener('input', (e) => {
      const tam = Number((e.target as HTMLInputElement).value);
      elemento.w = tam;
      elemento.h = tam;
      const img = objeto as InstanceType<typeof FabricImage>;
      objeto.set({ scaleX: tam / (img.width || tam), scaleY: tam / (img.height || tam) });
      repintar();
    });
  }

  if (elemento.clase === 'tabla') {
    // La tabla se redibuja sola desde el modelo: no hace falta reconstruir el objeto
    // (reconstruirlo perdería los controles de fila/columna).
    const refrescar = () => {
      (objeto as TablaObjeto).refrescarDesdeDatos();
      repintar();
    };
    // Cambiar la CANTIDAD de filas/columnas sí reconstruye: `refrescarDesdeDatos` solo reubica los
    // controles que ya existen, no crea ni saca ninguno (`construirControles` corre una sola vez,
    // en el constructor). Se agrega/saca del final con el tamaño por defecto, sin redistribuir las
    // demás — la misma decisión, más simple, que ya se había dejado anotada acá.
    const reconstruirTabla = async () => {
      const nuevo = await reemplazarObjeto(lienzo, objeto, elemento);
      mostrarPropiedades(panel, lienzo, nuevo);
    };
    $('#ed-p-tabla-filas')!.addEventListener('change', (e) => {
      const n = Math.max(1, Math.min(20, Math.round(Number((e.target as HTMLInputElement).value)) || elemento.rows.length));
      if (n > elemento.rows.length) elemento.rows.push(...Array(n - elemento.rows.length).fill(24));
      else elemento.rows.length = n;
      registrarSnapshot(lienzo);
      reconstruirTabla();
    });
    $('#ed-p-tabla-cols')!.addEventListener('change', (e) => {
      const n = Math.max(1, Math.min(10, Math.round(Number((e.target as HTMLInputElement).value)) || elemento.cols.length));
      if (n > elemento.cols.length) elemento.cols.push(...Array(n - elemento.cols.length).fill(60));
      else elemento.cols.length = n;
      registrarSnapshot(lienzo);
      reconstruirTabla();
    });
    // Igual que escalar desde una esquina: reparte el cambio entre todas las columnas o filas,
    // proporcional a como estaban, y no dispara ningún control por separado.
    $('#ed-p-w')!.addEventListener('input', (e) => {
      const nuevo = Number((e.target as HTMLInputElement).value) || 1;
      const escala = nuevo / anchoTotalTabla(elemento);
      elemento.cols = elemento.cols.map((c) => Math.max(8, Math.round(c * escala)));
      refrescar();
    });
    $('#ed-p-h')!.addEventListener('input', (e) => {
      const nuevo = Number((e.target as HTMLInputElement).value) || 1;
      const escala = nuevo / altoTotalTabla(elemento);
      elemento.rows = elemento.rows.map((r) => Math.max(6, Math.round(r * escala)));
      refrescar();
    });
    $('#ed-p-color')!.addEventListener('input', (e) => {
      elemento.color = (e.target as HTMLInputElement).value;
      refrescar();
    });
    $('#ed-p-color-interno')!.addEventListener('input', (e) => {
      elemento.colorInterno = (e.target as HTMLInputElement).value;
      refrescar();
    });
    // Contorno e interno comparten el grosor, así que cualquiera de los dos en "doble" obliga
    // al mínimo para que los dos trazos se distingan.
    const asegurarGrosorParaDoble = () => {
      if ((elemento.estiloContorno === 'doble' || elemento.estiloInterno === 'doble') && elemento.grosor < GROSOR_MINIMO_DOBLE) {
        elemento.grosor = GROSOR_MINIMO_DOBLE;
        const campo = $<HTMLInputElement>('#ed-p-grosor');
        if (campo) campo.value = String(GROSOR_MINIMO_DOBLE);
      }
    };
    $('#ed-p-contorno')!.addEventListener('change', (e) => {
      elemento.estiloContorno = (e.target as HTMLSelectElement).value as typeof elemento.estiloContorno;
      asegurarGrosorParaDoble();
      refrescar();
    });
    $('#ed-p-interno')!.addEventListener('change', (e) => {
      elemento.estiloInterno = (e.target as HTMLSelectElement).value as typeof elemento.estiloInterno;
      asegurarGrosorParaDoble();
      refrescar();
    });
    $('#ed-p-grosor')!.addEventListener('input', (e) => {
      elemento.grosor = Number((e.target as HTMLInputElement).value);
      refrescar();
    });
    $('#ed-p-radio')!.addEventListener('input', (e) => {
      elemento.radio = Number((e.target as HTMLInputElement).value);
      refrescar();
    });
  }

  if (elemento.clase === 'imagen') {
    $('#ed-p-imagen-reemplazar')!.addEventListener('click', () => {
      objetivoReemplazoImagen = { lienzo, objeto, elemento, panel };
      inputReemplazoImagen.value = '';
      inputReemplazoImagen.click();
    });
    $('#ed-p-w')!.addEventListener('input', (e) => {
      const ancho = Number((e.target as HTMLInputElement).value);
      const relacion = elemento.h / elemento.w;
      elemento.w = ancho;
      if (elemento.proporcion) elemento.h = Math.round(ancho * relacion);
      const img = objeto as InstanceType<typeof FabricImage>;
      objeto.set({ scaleX: elemento.w / (img.width || elemento.w), scaleY: elemento.h / (img.height || elemento.h) });
      repintar();
    });
    $('#ed-p-h')!.addEventListener('input', (e) => {
      const alto = Number((e.target as HTMLInputElement).value);
      const relacion = elemento.w / elemento.h;
      elemento.h = alto;
      if (elemento.proporcion) elemento.w = Math.round(alto * relacion);
      const img = objeto as InstanceType<typeof FabricImage>;
      objeto.set({ scaleX: elemento.w / (img.width || elemento.w), scaleY: elemento.h / (img.height || elemento.h) });
      repintar();
    });
    $('#ed-p-proporcion')!.addEventListener('change', (e) => {
      elemento.proporcion = (e.target as HTMLInputElement).checked;
      lienzo.uniformScaling = elemento.proporcion;
    });
    $('#ed-p-opacidad')!.addEventListener('input', (e) => {
      elemento.opacidad = Number((e.target as HTMLInputElement).value);
      objeto.set({ opacity: elemento.opacidad / 100 });
      repintar();
    });
    $('#ed-p-imagen-fondo')!.addEventListener('change', (e) => {
      elemento.conFondo = (e.target as HTMLInputElement).checked;
      objeto.set({ backgroundColor: elemento.conFondo ? elemento.fondoColor : '' });
      repintar();
    });
    $('#ed-p-imagen-fondocolor')!.addEventListener('change', (e) => {
      elemento.fondoColor = (e.target as HTMLInputElement).value;
      if (elemento.conFondo) objeto.set({ backgroundColor: elemento.fondoColor });
      repintar();
    });
  }

  if (elemento.clase === 'firma') {
    // Es un Group armado a mano (recuadro + leyenda), sin una clase propia como campo/tabla: se
    // reconstruye entero en cada cambio, igual que 'campo' antes de que existiera el ajuste en su
    // lugar. Nada de esto pasaba por el modelo hasta ahora: el panel entero estaba sin cablear.
    const reconstruir = async () => {
      const nuevo = await reemplazarObjeto(lienzo, objeto, elemento);
      mostrarPropiedades(panel, lienzo, nuevo);
    };
    // 'change' y no 'input': reconstruir() rearma el panel entero (`mostrarPropiedades`), y con
    // 'input' eso pasaba en cada tecla — el <input> enfocado se destruye y se crea uno nuevo, el
    // foco se va al body, y la tecla siguiente (típicamente Supr/Backspace, tipeando) la agarra el
    // atajo global de "borrar el objeto seleccionado" en vez de llegar al campo de texto.
    $('#ed-p-nombre')!.addEventListener('change', (e) => {
      elemento.name = (e.target as HTMLInputElement).value;
      reconstruir();
    });
    $('#ed-p-leyenda')!.addEventListener('change', (e) => {
      elemento.leyenda = (e.target as HTMLInputElement).value;
      reconstruir();
    });
    $('#ed-p-obligatorio')!.addEventListener('change', (e) => {
      elemento.obligatorio = (e.target as HTMLInputElement).checked;
      registrarSnapshot(lienzo);
    });
    $('#ed-p-bordegrosor')!.addEventListener('change', (e) => {
      elemento.bordeGrosor = Number((e.target as HTMLInputElement).value);
      reconstruir();
    });
    $('#ed-p-bordecolor')!.addEventListener('change', (e) => {
      elemento.bordeColor = (e.target as HTMLInputElement).value;
      reconstruir();
    });
    $('#ed-p-confondo')!.addEventListener('change', (e) => {
      elemento.conFondo = (e.target as HTMLInputElement).checked;
      reconstruir();
    });
    $('#ed-p-fondocolor')!.addEventListener('change', (e) => {
      elemento.fondoColor = (e.target as HTMLInputElement).value;
      reconstruir();
    });
    $('#ed-p-w')?.addEventListener('change', (e) => {
      elemento.w = Number((e.target as HTMLInputElement).value);
      reconstruir();
    });
    $('#ed-p-h')?.addEventListener('change', (e) => {
      elemento.h = Number((e.target as HTMLInputElement).value);
      reconstruir();
    });
  }

  if (elemento.clase === 'campo') {
    // 'change' y no 'input' en los campos que reconstruyen: `mostrarPropiedades` rearma el panel
    // entero, y con 'input' eso pasaba en cada tecla — el <input> enfocado se destruye, el foco se
    // va al body, y la tecla siguiente (Supr/Backspace, tipeando) la agarra el atajo global de
    // "borrar el objeto seleccionado" en vez de llegar al campo de texto.
    const reconstruir = async () => {
      const nuevo = await reemplazarObjeto(lienzo, objeto, elemento);
      mostrarPropiedades(panel, lienzo, nuevo);
    };
    $('#ed-p-nombre')!.addEventListener('change', (e) => {
      elemento.name = (e.target as HTMLInputElement).value;
      reconstruir();
    });
    $('#ed-p-tipodato')!.addEventListener('change', (e) => {
      elemento.tipo = (e.target as HTMLSelectElement).value as typeof elemento.tipo;
    });
    $('#ed-p-campo-multilinea')!.addEventListener('change', (e) => {
      elemento.multilinea = (e.target as HTMLInputElement).checked;
      registrarSnapshot(lienzo);
    });
    $('#ed-p-rep-btn')!.addEventListener('click', async () => {
      const valores = await pedirCampoRepetible(elemento);
      if (!valores) return;
      elemento.name = valores.name;
      elemento.repComodin = valores.repComodin;
      elemento.repFilas = valores.repFilas;
      elemento.repSep = valores.repSep;
      registrarSnapshot(lienzo);
      // El objeto se rehace porque cambió el ID que muestra la etiqueta, y el panel con él.
      reconstruir();
    });
    $('#ed-p-invisible')!.addEventListener('change', (e) => {
      elemento.invisible = (e.target as HTMLInputElement).checked;
      reconstruir();
    });
    $('#ed-p-default')!.addEventListener('input', (e) => {
      elemento.defaultValue = (e.target as HTMLInputElement).value;
    });
    $('#ed-p-readonly')!.addEventListener('change', (e) => {
      elemento.readonly = (e.target as HTMLInputElement).checked;
    });
    $('#ed-p-size')!.addEventListener('change', (e) => {
      elemento.size = Number((e.target as HTMLInputElement).value);
      reconstruir();
    });
    $('#ed-p-color')!.addEventListener('change', (e) => {
      elemento.color = (e.target as HTMLInputElement).value;
      reconstruir();
    });
    $('#ed-p-campo-bordecolor')!.addEventListener('change', (e) => {
      elemento.bordeColor = (e.target as HTMLInputElement).value;
      reconstruir();
    });
    $('#ed-p-campo-bordegrosor')!.addEventListener('change', (e) => {
      elemento.bordeGrosor = Number((e.target as HTMLInputElement).value);
      reconstruir();
    });
    $('#ed-p-campo-fondo')!.addEventListener('change', (e) => {
      elemento.conFondo = (e.target as HTMLInputElement).checked;
      reconstruir();
    });
    $('#ed-p-campo-fondocolor')!.addEventListener('change', (e) => {
      elemento.fondoColor = (e.target as HTMLInputElement).value;
      reconstruir();
    });
    $('#ed-p-w')?.addEventListener('change', (e) => {
      elemento.w = Number((e.target as HTMLInputElement).value);
      reconstruir();
    });
    $('#ed-p-h')?.addEventListener('change', (e) => {
      elemento.h = Number((e.target as HTMLInputElement).value);
      reconstruir();
    });
    wireTipografia($, elemento, () => reconstruir(), repintar);
  }
}

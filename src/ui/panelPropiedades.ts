import type { Canvas, FabricObject } from 'fabric';
import { FabricImage } from 'fabric';
import { elementoDe, reemplazarObjeto, agregarAlLienzo, generarQr, prepararFuente, sincronizarGeometria, textoParaDibujar } from '../editor/objetosFabric';
import { alturaRenglonFabric, duplicarElemento, type Elemento } from '../editor/elemento';
import { FAMILIAS_BASE, FAMILIAS_WEB } from '../editor/fuentes';
import { registrarSnapshot } from '../editor/historial';
import type { TablaObjeto } from '../editor/tablaObjeto';
import type { LineaObjeto } from '../editor/lineaObjeto';
import type { RectObjeto } from '../editor/rectObjeto';
import { GROSOR_MINIMO_DOBLE } from '../editor/trazos';
import { pedirCampoRepetible } from './modales';

const ETIQUETA_TIPO: Record<Elemento['clase'], string> = {
  texto: 'Texto',
  linea: 'Línea',
  rect: 'Recuadro',
  qr: 'QR',
  tabla: 'Tabla',
  imagen: 'Imagen',
  campo: 'Campo',
};

function bloqueTipografia(elemento: { familia: string; negrita: boolean; cursiva: boolean; subrayado: boolean; align: 'left' | 'center' | 'right' }): string {
  return `
    <div><label class="ed-lbl">Familia</label><select id="ed-p-familia">
      <optgroup label="Estándar (PDF)">
        ${FAMILIAS_BASE.map((f) => `<option ${f === elemento.familia ? 'selected' : ''}>${f}</option>`).join('')}
      </optgroup>
      <optgroup label="Web (se incrustan al exportar)">
        ${FAMILIAS_WEB.map((f) => `<option ${f === elemento.familia ? 'selected' : ''}>${f}</option>`).join('')}
      </optgroup>
    </select></div>
    <div class="ed-fila-toggle">
      <button type="button" class="ed-toggle ${elemento.negrita ? 'activo' : ''}" id="ed-p-negrita" title="Negrita"><b>N</b></button>
      <button type="button" class="ed-toggle ${elemento.cursiva ? 'activo' : ''}" id="ed-p-cursiva" title="Cursiva"><i>K</i></button>
      <button type="button" class="ed-toggle ${elemento.subrayado ? 'activo' : ''}" id="ed-p-subrayado" title="Subrayado"><u>S</u></button>
    </div>
    <label class="ed-lbl" style="margin-top:8px;">Alineación</label>
    <div class="ed-fila-toggle">
      <button type="button" class="ed-toggle ${elemento.align === 'left' ? 'activo' : ''}" id="ed-p-al-izq" title="Izquierda">⇤</button>
      <button type="button" class="ed-toggle ${elemento.align === 'center' ? 'activo' : ''}" id="ed-p-al-centro" title="Centro">≡</button>
      <button type="button" class="ed-toggle ${elemento.align === 'right' ? 'activo' : ''}" id="ed-p-al-der" title="Derecha">⇥</button>
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
    <div class="ed-props-tit"><strong>Propiedades</strong></div>
    <div class="ed-sinsel">Seleccioná un elemento del lienzo. Con Ctrl o Shift agregás varios; también podés arrastrar un recuadro sobre el lienzo.</div>
  `;
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
    <div class="ed-props-tit"><strong>Propiedades</strong><span class="ed-chip-tipo">${objetos.length} elementos</span></div>
    <div class="ed-sec">
      <div class="ed-sec-tit">Alinear entre sí</div>
      <div class="ed-fila-toggle">
        <button type="button" class="ed-toggle" data-alinear="izq" title="Izquierda">⇤</button>
        <button type="button" class="ed-toggle" data-alinear="centroH" title="Centro horizontal">≡</button>
        <button type="button" class="ed-toggle" data-alinear="der" title="Derecha">⇥</button>
      </div>
      <div class="ed-fila-toggle">
        <button type="button" class="ed-toggle" data-alinear="arriba" title="Arriba">⤒</button>
        <button type="button" class="ed-toggle" data-alinear="centroV" title="Centro vertical">⇕</button>
        <button type="button" class="ed-toggle" data-alinear="abajo" title="Abajo">⤓</button>
      </div>
    </div>
    <div class="ed-sec">
      <div class="ed-sec-tit">Rotación</div>
      <div><label class="ed-lbl">Ángulo (°)</label><input type="number" id="ed-multi-angulo" class="mono" value="${anguloComun(objetos) ?? ''}" step="1" placeholder="varios"></div>
      <p class="nota">Cada elemento rota sobre su propia esquina, no alrededor del conjunto.</p>
    </div>
    <div class="ed-acciones2">
      <button type="button" id="ed-multi-duplicar">Duplicar</button>
      <button type="button" id="ed-multi-borrar" class="peligro">Borrar</button>
      <button type="button" id="ed-multi-frente">Al frente</button>
      <button type="button" id="ed-multi-atras">Enviar atrás</button>
    </div>
  `;

  /** Devuelve los objetos con sus coordenadas ya absolutas, sin selección activa. */
  const soltar = (): FabricObject[] => {
    const lista = [...objetos];
    lienzo.discardActiveObject();
    lienzo.requestRenderAll();
    return lista;
  };

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
    lista.forEach((o) => lienzo.bringObjectToFront(o));
    alTerminar(lista);
  });

  panel.querySelector<HTMLButtonElement>('#ed-multi-atras')!.addEventListener('click', () => {
    const lista = soltar();
    [...lista].reverse().forEach((o) => lienzo.sendObjectToBack(o));
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
    <div class="ed-props-tit"><strong>Propiedades</strong><span class="ed-chip-tipo">${ETIQUETA_TIPO[elemento.clase]}</span></div>
    ${camposPara(elemento)}
    ${seccionPosicion(elemento)}
    <div class="ed-acciones2">
      <button type="button" id="ed-p-duplicar">Duplicar</button>
      <button type="button" id="ed-p-borrar" class="peligro">Borrar</button>
      <button type="button" id="ed-p-frente">Al frente</button>
      <button type="button" id="ed-p-atras">Enviar atrás</button>
    </div>
  `;

  wireCampos(panel, lienzo, objeto, elemento);
  wireAcciones(panel, lienzo, objeto, elemento);
}

function seccion(titulo: string, contenido: string): string {
  return `<div class="ed-sec"><div class="ed-sec-tit">${titulo}</div>${contenido}</div>`;
}

function seccionPosicion(elemento: Elemento): string {
  const conTamano = elemento.clase !== 'texto' && elemento.clase !== 'tabla';
  return seccion(
    'Posición y tamaño (pt)',
    `<div class="ed-grid2">
      <div><label class="ed-lbl">X</label><input type="number" id="ed-p-x" class="mono" value="${elemento.x}"></div>
      <div><label class="ed-lbl">Y</label><input type="number" id="ed-p-y" class="mono" value="${elemento.y}"></div>
      ${
        conTamano && 'w' in elemento
          ? `<div><label class="ed-lbl">Ancho</label><input type="number" id="ed-p-w" class="mono" value="${elemento.w}" min="1"></div>
             <div><label class="ed-lbl">Alto</label><input type="number" id="ed-p-h" class="mono" value="${elemento.h}" min="1"></div>`
          : ''
      }
      <div><label class="ed-lbl">Ángulo (°)</label><input type="number" id="ed-p-angulo" class="mono" value="${elemento.angulo}" step="1"></div>
    </div>`
  );
}

function campoTexto(elemento: Elemento & { clase: 'texto' }): string {
  return (
    seccion(
      'Contenido',
      `<div><label class="ed-lbl">Texto</label>${
        elemento.multilinea
          ? `<textarea id="ed-p-texto" rows="3">${escapeHtml(elemento.text)}</textarea>`
          : `<input type="text" id="ed-p-texto" value="${escapeHtml(elemento.text)}">`
      }</div>
      <label class="ed-check"><input type="checkbox" id="ed-p-multilinea" ${elemento.multilinea ? 'checked' : ''}> Varias líneas</label>`
    ) +
    seccion(
      'Formato',
      `<div class="ed-row2">
        <div><label class="ed-lbl">Tamaño</label><input type="number" id="ed-p-size" class="mono" value="${elemento.size}" min="5" max="72"></div>
        <div><label class="ed-lbl">Color</label><input type="color" id="ed-p-color" value="${elemento.color}"></div>
      </div>
      ${bloqueTipografia(elemento)}
      <label class="ed-check"><input type="checkbox" id="ed-p-vertical" ${elemento.vertical ? 'checked' : ''}> Texto vertical (una letra por renglón)</label>
      <div><label class="ed-lbl">Separación (pt)</label><input type="number" id="ed-p-separacion" class="mono" value="${elemento.separacion}" step="0.5"></div>`
    )
  );
}

function campoCampo(elemento: Elemento & { clase: 'campo' }): string {
  return (
    seccion(
      'Contenido',
      `<div><label class="ed-lbl">Campo (ID)</label><input type="text" id="ed-p-nombre" value="${escapeHtml(elemento.name)}"></div>
      <div><label class="ed-lbl">Tipo de dato</label><select id="ed-p-tipodato">
        ${['Texto', 'Numero', 'Moneda', 'Fecha'].map((t) => `<option value="${t}" ${t === elemento.tipo ? 'selected' : ''}>${t}</option>`).join('')}
      </select></div>
      <label class="ed-check"><input type="checkbox" id="ed-p-invisible" ${elemento.invisible ? 'checked' : ''}> Campo invisible</label>
      <div><label class="ed-lbl">Valor por defecto</label><input type="text" id="ed-p-default" value="${escapeHtml(elemento.defaultValue)}" placeholder="Valor que aparecerá por defecto"></div>
      <label class="ed-check"><input type="checkbox" id="ed-p-readonly" ${elemento.readonly ? 'checked' : ''}> Sólo lectura (visual)</label>
      <label class="ed-check"><input type="checkbox" id="ed-p-campo-multilinea" ${elemento.multilinea ? 'checked' : ''}> Varias líneas</label>
      <button type="button" id="ed-p-rep-btn" class="ed-toggle" style="width:100%;margin-top:8px;">${
        elemento.repFilas > 1 ? `Editar repetición (×${elemento.repFilas})` : 'Hacer repetible…'
      }</button>`
    ) +
    seccion(
      'Formato',
      `<div class="ed-row2">
        <div><label class="ed-lbl">Tamaño</label><input type="number" id="ed-p-size" class="mono" value="${elemento.size}" min="5" max="72"></div>
        <div><label class="ed-lbl">Color</label><input type="color" id="ed-p-color" value="${elemento.color}"></div>
      </div>
      <div class="ed-row2">
        <div><label class="ed-lbl">Color de borde</label><input type="color" id="ed-p-campo-bordecolor" value="${elemento.bordeColor}"></div>
        <div><label class="ed-lbl">Grosor de borde (pt)</label><input type="number" id="ed-p-campo-bordegrosor" class="mono" value="${elemento.bordeGrosor}" min="0" step="0.5"></div>
      </div>
      <label class="ed-check"><input type="checkbox" id="ed-p-campo-fondo" ${elemento.conFondo ? 'checked' : ''}> Con fondo</label>
      <div><label class="ed-lbl">Color de fondo</label><input type="color" id="ed-p-campo-fondocolor" value="${elemento.fondoColor}"></div>
      ${bloqueTipografia(elemento)}`
    )
  );
}

function campoLinea(elemento: Elemento & { clase: 'linea' }): string {
  return seccion(
    'Formato',
    // La orientación se resuelve con el ángulo (90° = vertical), así que no hacen falta
    // botones Horizontal/Vertical aparte: eran una segunda forma de hacer lo mismo y
    // quedaban desfasados cuando la línea tenía rotación.
    // El ángulo vive en la sección Posición, junto al resto de la geometría y como en todos los
    // demás tipos: acá quedaría un segundo control con el mismo id.
    `<div><label class="ed-lbl">Color</label><input type="color" id="ed-p-color" value="${elemento.color}"></div>
    <div><label class="ed-lbl">Estilo</label><select id="ed-p-estilo">
      ${['solido', 'punteado', 'doble'].map((e) => `<option value="${e}" ${e === elemento.estilo ? 'selected' : ''}>${etiquetaEstilo(e)}</option>`).join('')}
    </select></div>`
  );
}

function campoRect(elemento: Elemento & { clase: 'rect' }): string {
  return seccion(
    'Formato',
    `<div class="ed-row2">
      <div><label class="ed-lbl">Grosor de borde (pt)</label><input type="number" id="ed-p-grosor" class="mono" value="${elemento.grosor}" min="0.5" step="0.5"></div>
      <div><label class="ed-lbl">Radio de esquina (pt)</label><input type="number" id="ed-p-radio" class="mono" value="${elemento.radio}" min="0"></div>
    </div>
    <div class="ed-row2">
      <div><label class="ed-lbl">Color de borde</label><input type="color" id="ed-p-color" value="${elemento.color}"></div>
      <div><label class="ed-lbl">Estilo</label><select id="ed-p-estilo">
        ${['solido', 'punteado', 'doble'].map((e) => `<option value="${e}" ${e === elemento.estilo ? 'selected' : ''}>${etiquetaEstilo(e)}</option>`).join('')}
      </select></div>
    </div>
    <label class="ed-check"><input type="checkbox" id="ed-p-con-relleno" ${elemento.conRelleno ? 'checked' : ''}> Con relleno</label>
    <div><label class="ed-lbl">Color de relleno</label><input type="color" id="ed-p-relleno-color" value="${elemento.rellenoColor}"></div>`
  );
}

function campoQr(elemento: Elemento & { clase: 'qr' }): string {
  return (
    seccion(
      'Contenido',
      `<div><label class="ed-lbl">Texto / URL</label><input type="text" id="ed-p-texto" value="${escapeHtml(elemento.texto)}"></div>
      <div><label class="ed-lbl">Tamaño (pt)</label><input type="number" id="ed-p-size" class="mono" value="${elemento.w}" min="20"></div>`
    ) +
    seccion(
      'Formato',
      `<div><label class="ed-lbl">Color</label><input type="color" id="ed-p-color" value="${elemento.color}"></div>
      <label class="ed-check"><input type="checkbox" id="ed-p-qr-fondo" ${elemento.conFondo ? 'checked' : ''}> Con fondo</label>
      <div><label class="ed-lbl">Color de fondo</label><input type="color" id="ed-p-qr-fondocolor" value="${elemento.fondoColor}"></div>
      <p class="nota" style="margin-top:8px;">Un QR necesita buen contraste entre el color y el fondo para poder leerse.</p>`
    )
  );
}

function campoTabla(elemento: Elemento & { clase: 'tabla' }): string {
  return seccion(
    'Formato',
    `<div class="nota" style="margin-bottom:8px;">${elemento.rows.length} filas × ${elemento.cols.length} columnas. Arrastrá una línea interna para ajustar esa fila/columna, o la esquina para redimensionar todo.</div>
    <div class="ed-row2">
      <div><label class="ed-lbl">Color del contorno</label><input type="color" id="ed-p-color" value="${elemento.color}"></div>
      <div><label class="ed-lbl">Color interno</label><input type="color" id="ed-p-color-interno" value="${elemento.colorInterno}"></div>
    </div>
    <div class="ed-row2">
      <div><label class="ed-lbl">Estilo del contorno</label><select id="ed-p-contorno">
        ${['solido', 'punteado', 'doble'].map((e) => `<option value="${e}" ${e === elemento.estiloContorno ? 'selected' : ''}>${etiquetaEstilo(e)}</option>`).join('')}
      </select></div>
      <div><label class="ed-lbl">Estilo interno</label><select id="ed-p-interno">
        ${['solido', 'punteado', 'doble'].map((e) => `<option value="${e}" ${e === elemento.estiloInterno ? 'selected' : ''}>${etiquetaEstilo(e)}</option>`).join('')}
      </select></div>
    </div>
    <div class="ed-row2">
      <div><label class="ed-lbl">Grosor de línea (pt)</label><input type="number" id="ed-p-grosor" class="mono" value="${elemento.grosor}" min="0.5" step="0.5"></div>
      <div><label class="ed-lbl">Radio de esquina (pt)</label><input type="number" id="ed-p-radio" class="mono" value="${elemento.radio}" min="0"></div>
    </div>`
  );
}

function campoImagen(elemento: Elemento & { clase: 'imagen' }): string {
  return seccion(
    'Formato',
    `<label class="ed-check"><input type="checkbox" id="ed-p-proporcion" ${elemento.proporcion ? 'checked' : ''}> Mantener proporción al redimensionar</label>
    <label class="ed-lbl" style="margin-top:8px;">Opacidad</label><input type="range" id="ed-p-opacidad" min="10" max="100" value="${elemento.opacidad}">`
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
    case 'qr':
      return campoQr(elemento);
    case 'tabla':
      return campoTabla(elemento);
    case 'imagen':
      return campoImagen(elemento);
    case 'campo':
      return campoCampo(elemento);
  }
}

function etiquetaEstilo(estilo: string): string {
  if (estilo === 'punteado') return 'Punteada';
  if (estilo === 'doble') return 'Doble';
  return 'Sólida';
}

function escapeHtml(texto: string): string {
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
    lienzo.bringObjectToFront(objeto);
    lienzo.requestRenderAll();
    registrarSnapshot(lienzo);
  });

  panel.querySelector<HTMLButtonElement>('#ed-p-atras')!.addEventListener('click', () => {
    lienzo.sendObjectToBack(objeto);
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

  if (elemento.clase === 'qr') {
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
      repintar();
    };

    $('#ed-p-texto')!.addEventListener('input', (e) => {
      elemento.texto = (e.target as HTMLInputElement).value;
      regenerar();
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
  }

  if (elemento.clase === 'campo') {
    const reconstruir = async () => {
      const nuevo = await reemplazarObjeto(lienzo, objeto, elemento);
      mostrarPropiedades(panel, lienzo, nuevo);
    };
    $('#ed-p-nombre')!.addEventListener('input', (e) => {
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
    $('#ed-p-size')!.addEventListener('input', (e) => {
      elemento.size = Number((e.target as HTMLInputElement).value);
      reconstruir();
    });
    $('#ed-p-color')!.addEventListener('input', (e) => {
      elemento.color = (e.target as HTMLInputElement).value;
      reconstruir();
    });
    $('#ed-p-campo-bordecolor')!.addEventListener('change', (e) => {
      elemento.bordeColor = (e.target as HTMLInputElement).value;
      reconstruir();
    });
    $('#ed-p-campo-bordegrosor')!.addEventListener('input', (e) => {
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

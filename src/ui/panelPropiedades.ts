import type { Canvas, FabricObject } from 'fabric';
import { FabricImage } from 'fabric';
import QRCode from 'qrcode';
import { elementoDe, reemplazarObjeto, agregarAlLienzo } from '../editor/objetosFabric';
import { duplicarElemento, type Elemento } from '../editor/elemento';
import { FAMILIAS_BASE, FAMILIAS_WEB, asegurarFuenteCargada } from '../editor/fuentes';
import { registrarSnapshot } from '../editor/historial';
import type { TablaObjeto } from '../editor/tablaObjeto';
import type { LineaObjeto } from '../editor/lineaObjeto';

/** Grosor mínimo para que el estilo "doble" se distinga de una línea sólida. */
const GROSOR_MINIMO_DOBLE = 5;

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
    await asegurarFuenteCargada(elemento.familia);
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
    </div>`
  );
}

function campoTexto(elemento: Elemento & { clase: 'texto' }): string {
  return (
    seccion('Contenido', `<div><label class="ed-lbl">Texto</label><input type="text" id="ed-p-texto" value="${escapeHtml(elemento.text)}"></div>`) +
    seccion(
      'Formato',
      `<div class="ed-row2">
        <div><label class="ed-lbl">Tamaño</label><input type="number" id="ed-p-size" class="mono" value="${elemento.size}" min="5" max="72"></div>
        <div><label class="ed-lbl">Color</label><input type="color" id="ed-p-color" value="${elemento.color}"></div>
      </div>
      ${bloqueTipografia(elemento)}`
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
      <label class="ed-check"><input type="checkbox" id="ed-p-readonly" ${elemento.readonly ? 'checked' : ''}> Sólo lectura (visual)</label>`
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
    `<div class="ed-row2">
      <div><label class="ed-lbl">Color</label><input type="color" id="ed-p-color" value="${elemento.color}"></div>
      <div><label class="ed-lbl">Ángulo (°)</label><input type="number" id="ed-p-angulo" class="mono" value="${elemento.angulo}" step="1"></div>
    </div>
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
  return seccion(
    'Contenido',
    `<div><label class="ed-lbl">Texto / URL</label><input type="text" id="ed-p-texto" value="${escapeHtml(elemento.texto)}"></div>
    <div><label class="ed-lbl">Tamaño (pt)</label><input type="number" id="ed-p-size" class="mono" value="${elemento.w}" min="20"></div>`
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
  $('#ed-p-y')!.addEventListener('input', (e) => {
    elemento.y = Number((e.target as HTMLInputElement).value);
    objeto.set({ top: elemento.y });
    objeto.setCoords();
    repintar();
  });

  if (elemento.clase === 'texto') {
    $('#ed-p-texto')!.addEventListener('input', (e) => {
      elemento.text = (e.target as HTMLInputElement).value;
      (objeto as any).set({ text: elemento.text });
      repintar();
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
    $('#ed-p-angulo')!.addEventListener('input', (e) => {
      elemento.angulo = Number((e.target as HTMLInputElement).value);
      refrescar();
    });
  }

  if (elemento.clase === 'rect') {
    $('#ed-p-w')!.addEventListener('input', (e) => {
      elemento.w = Number((e.target as HTMLInputElement).value);
      objeto.set({ width: elemento.w });
      objeto.setCoords();
      repintar();
    });
    $('#ed-p-h')!.addEventListener('input', (e) => {
      elemento.h = Number((e.target as HTMLInputElement).value);
      objeto.set({ height: elemento.h });
      objeto.setCoords();
      repintar();
    });
    $('#ed-p-color')!.addEventListener('input', (e) => {
      elemento.color = (e.target as HTMLInputElement).value;
      objeto.set({ stroke: elemento.color });
      repintar();
    });
    $('#ed-p-estilo')!.addEventListener('change', (e) => {
      elemento.estilo = (e.target as HTMLSelectElement).value as typeof elemento.estilo;
      objeto.set({ strokeDashArray: elemento.estilo === 'punteado' ? [4, 3] : undefined } as any);
      repintar();
    });
  }

  if (elemento.clase === 'rect') {
    $('#ed-p-grosor')!.addEventListener('input', (e) => {
      elemento.grosor = Number((e.target as HTMLInputElement).value);
      objeto.set({ strokeWidth: elemento.grosor });
      repintar();
    });
    $('#ed-p-radio')!.addEventListener('input', (e) => {
      elemento.radio = Number((e.target as HTMLInputElement).value);
      objeto.set({ rx: elemento.radio, ry: elemento.radio } as any);
      repintar();
    });
    $('#ed-p-con-relleno')!.addEventListener('change', (e) => {
      elemento.conRelleno = (e.target as HTMLInputElement).checked;
      objeto.set({ fill: elemento.conRelleno ? elemento.rellenoColor : 'transparent' });
      repintar();
    });
    $('#ed-p-relleno-color')!.addEventListener('input', (e) => {
      elemento.rellenoColor = (e.target as HTMLInputElement).value;
      if (elemento.conRelleno) {
        objeto.set({ fill: elemento.rellenoColor });
        repintar();
      }
    });
  }

  if (elemento.clase === 'qr') {
    // setSrc es asincrónico: hay que esperarlo antes de repintar, o el dibujo queda con el QR
    // anterior. El contador descarta respuestas fuera de orden si se tipea rápido.
    let generacion = 0;
    $('#ed-p-texto')!.addEventListener('input', async (e) => {
      elemento.texto = (e.target as HTMLInputElement).value;
      const propia = ++generacion;
      const imagen = objeto as InstanceType<typeof FabricImage>;
      // Un QR vacío no se puede generar; se usa un espacio como en el editor público.
      const dataUrl = await QRCode.toDataURL(elemento.texto || ' ', { margin: 0 });
      if (propia !== generacion) return;
      await imagen.setSrc(dataUrl);
      if (propia !== generacion) return;
      imagen.set({
        scaleX: elemento.w / (imagen.width || elemento.w),
        scaleY: elemento.h / (imagen.height || elemento.h),
      });
      repintar();
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
    $('#ed-p-contorno')!.addEventListener('change', (e) => {
      elemento.estiloContorno = (e.target as HTMLSelectElement).value as typeof elemento.estiloContorno;
      refrescar();
    });
    $('#ed-p-interno')!.addEventListener('change', (e) => {
      elemento.estiloInterno = (e.target as HTMLSelectElement).value as typeof elemento.estiloInterno;
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

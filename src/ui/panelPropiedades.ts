import type { Canvas, FabricObject } from 'fabric';
import { elementoDe } from '../editor/objetosFabric';
import type { Elemento, Familia } from '../editor/elemento';
import QRCode from 'qrcode';
import { FabricImage } from 'fabric';

const ETIQUETA_TIPO: Record<Elemento['clase'], string> = {
  texto: 'Texto',
  linea: 'Línea',
  rect: 'Recuadro',
  qr: 'QR',
};

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
    <div class="ed-sec">${camposPara(elemento)}</div>
    <button type="button" class="danger-btn" id="ed-p-eliminar">Eliminar</button>
  `;

  wireCampos(panel, lienzo, objeto, elemento);

  panel.querySelector<HTMLButtonElement>('#ed-p-eliminar')!.addEventListener('click', () => {
    lienzo.remove(objeto);
    lienzo.discardActiveObject();
    lienzo.requestRenderAll();
    mostrarSinSeleccion(panel);
  });
}

function campoTexto(elemento: Elemento & { clase: 'texto' }): string {
  return `
    <div><label class="ed-lbl">Texto</label><input type="text" id="ed-p-texto" value="${escapeHtml(elemento.text)}"></div>
    <div class="ed-row2">
      <div><label class="ed-lbl">Tamaño</label><input type="number" id="ed-p-size" class="mono" value="${elemento.size}" min="5" max="72"></div>
      <div><label class="ed-lbl">Color</label><input type="color" id="ed-p-color" value="${elemento.color}"></div>
    </div>
    <div class="ed-row2">
      <div><label class="ed-lbl">Familia</label><select id="ed-p-familia">
        ${['Helvetica', 'Times', 'Courier'].map((f) => `<option ${f === elemento.familia ? 'selected' : ''}>${f}</option>`).join('')}
      </select></div>
      <div><label class="ed-lbl">Alineación</label><select id="ed-p-align">
        <option value="left" ${elemento.align === 'left' ? 'selected' : ''}>Izquierda</option>
        <option value="center" ${elemento.align === 'center' ? 'selected' : ''}>Centro</option>
        <option value="right" ${elemento.align === 'right' ? 'selected' : ''}>Derecha</option>
      </select></div>
    </div>
    <div class="ed-fila-toggle">
      <button type="button" class="ed-toggle ${elemento.negrita ? 'activo' : ''}" id="ed-p-negrita">Negrita</button>
      <button type="button" class="ed-toggle ${elemento.cursiva ? 'activo' : ''}" id="ed-p-cursiva">Cursiva</button>
      <button type="button" class="ed-toggle ${elemento.subrayado ? 'activo' : ''}" id="ed-p-subrayado">Subrayado</button>
    </div>
  `;
}

function campoLinea(elemento: Elemento & { clase: 'linea' }): string {
  return `
    <div class="ed-row2">
      <div><label class="ed-lbl">Ancho (pt)</label><input type="number" id="ed-p-w" class="mono" value="${elemento.w}" min="1"></div>
      <div><label class="ed-lbl">Alto (pt)</label><input type="number" id="ed-p-h" class="mono" value="${elemento.h}" min="1"></div>
    </div>
    <div class="ed-row2">
      <div><label class="ed-lbl">Color</label><input type="color" id="ed-p-color" value="${elemento.color}"></div>
      <div><label class="ed-lbl">Estilo</label><select id="ed-p-estilo">
        ${['solido', 'punteado', 'doble'].map((e) => `<option value="${e}" ${e === elemento.estilo ? 'selected' : ''}>${etiquetaEstilo(e)}</option>`).join('')}
      </select></div>
    </div>
  `;
}

function campoRect(elemento: Elemento & { clase: 'rect' }): string {
  return `
    <div class="ed-row2">
      <div><label class="ed-lbl">Ancho (pt)</label><input type="number" id="ed-p-w" class="mono" value="${elemento.w}" min="1"></div>
      <div><label class="ed-lbl">Alto (pt)</label><input type="number" id="ed-p-h" class="mono" value="${elemento.h}" min="1"></div>
    </div>
    <div class="ed-row2">
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
    <div><label class="ed-lbl">Color de relleno</label><input type="color" id="ed-p-relleno-color" value="${elemento.rellenoColor}"></div>
  `;
}

function campoQr(elemento: Elemento & { clase: 'qr' }): string {
  return `
    <div><label class="ed-lbl">Contenido / URL</label><input type="text" id="ed-p-texto" value="${escapeHtml(elemento.texto)}"></div>
    <div><label class="ed-lbl">Tamaño (pt)</label><input type="number" id="ed-p-size" class="mono" value="${elemento.w}" min="20"></div>
  `;
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

function wireCampos(panel: HTMLElement, lienzo: Canvas, objeto: FabricObject, elemento: Elemento): void {
  const $ = <T extends HTMLElement>(id: string) => panel.querySelector<T>(id);
  const repintar = () => lienzo.requestRenderAll();

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
    $('#ed-p-familia')!.addEventListener('change', (e) => {
      elemento.familia = (e.target as HTMLSelectElement).value as Familia;
      objeto.set({ fontFamily: elemento.familia } as any);
      repintar();
    });
    $('#ed-p-align')!.addEventListener('change', (e) => {
      elemento.align = (e.target as HTMLSelectElement).value as typeof elemento.align;
      objeto.set({ textAlign: elemento.align } as any);
      repintar();
    });
    const toggle = (id: string, prop: 'negrita' | 'cursiva' | 'subrayado', aplicar: () => void) => {
      $(id)!.addEventListener('click', () => {
        elemento[prop] = !elemento[prop];
        $(id)!.classList.toggle('activo', elemento[prop]);
        aplicar();
        repintar();
      });
    };
    toggle('#ed-p-negrita', 'negrita', () => objeto.set({ fontWeight: elemento.negrita ? '700' : '400' } as any));
    toggle('#ed-p-cursiva', 'cursiva', () => objeto.set({ fontStyle: elemento.cursiva ? 'italic' : 'normal' } as any));
    toggle('#ed-p-subrayado', 'subrayado', () => objeto.set({ underline: elemento.subrayado } as any));
    return;
  }

  if (elemento.clase === 'linea' || elemento.clase === 'rect') {
    $('#ed-p-w')!.addEventListener('input', (e) => {
      elemento.w = Number((e.target as HTMLInputElement).value);
      objeto.set({ width: elemento.w });
      repintar();
    });
    $('#ed-p-h')!.addEventListener('input', (e) => {
      elemento.h = Number((e.target as HTMLInputElement).value);
      objeto.set({ height: elemento.h });
      repintar();
    });
    $('#ed-p-color')!.addEventListener('input', (e) => {
      elemento.color = (e.target as HTMLInputElement).value;
      objeto.set(elemento.clase === 'linea' ? { fill: elemento.color } : { stroke: elemento.color });
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
    $('#ed-p-texto')!.addEventListener('change', async (e) => {
      elemento.texto = (e.target as HTMLInputElement).value;
      const dataUrl = await QRCode.toDataURL(elemento.texto, { margin: 0 });
      (objeto as any).setSrc(dataUrl, { crossOrigin: 'anonymous' });
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
}

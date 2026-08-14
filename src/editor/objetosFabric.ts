import { FabricImage, FabricText, Group, Rect, type FabricObject } from 'fabric';
import QRCode from 'qrcode';
import { type Elemento } from './elemento';
import { TablaObjeto } from './tablaObjeto';
import { LineaObjeto } from './lineaObjeto';

const datosPorObjeto = new WeakMap<FabricObject, Elemento>();

export function elementoDe(objeto: FabricObject): Elemento | undefined {
  return datosPorObjeto.get(objeto);
}

function trazoDeEstilo(estilo: 'solido' | 'punteado' | 'doble'): number[] | undefined {
  if (estilo === 'punteado') return [4, 3];
  return undefined;
}

export async function crearObjetoFabric(elemento: Elemento): Promise<FabricObject> {
  switch (elemento.clase) {
    case 'texto': {
      const texto = new FabricText(elemento.text, {
        left: elemento.x,
        top: elemento.y,
        fontSize: elemento.size,
        fontFamily: elemento.familia,
        fontWeight: elemento.negrita ? '700' : '400',
        fontStyle: elemento.cursiva ? 'italic' : 'normal',
        underline: elemento.subrayado,
        fill: elemento.color,
        textAlign: elemento.align,
      });
      return texto;
    }
    case 'linea':
      return new LineaObjeto(elemento);
    case 'rect': {
      return new Rect({
        left: elemento.x,
        top: elemento.y,
        width: elemento.w,
        height: elemento.h,
        rx: elemento.radio,
        ry: elemento.radio,
        fill: elemento.conRelleno ? elemento.rellenoColor : 'transparent',
        stroke: elemento.color,
        strokeWidth: elemento.grosor,
        strokeDashArray: trazoDeEstilo(elemento.estilo),
      });
    }
    case 'qr': {
      const dataUrl = await QRCode.toDataURL(elemento.texto, { margin: 0 });
      const imagen = await FabricImage.fromURL(dataUrl);
      imagen.set({
        left: elemento.x,
        top: elemento.y,
        scaleX: elemento.w / (imagen.width || elemento.w),
        scaleY: elemento.h / (imagen.height || elemento.h),
      });
      return imagen;
    }
    case 'tabla':
      return new TablaObjeto(elemento);
    case 'campo': {
      const esInvisible = elemento.invisible;
      const fondo = new Rect({
        left: 0,
        top: 0,
        width: elemento.w,
        height: elemento.h,
        fill: esInvisible ? 'rgba(55,138,221,0.05)' : elemento.conFondo ? elemento.fondoColor : 'transparent',
        stroke: esInvisible ? '#378add' : elemento.bordeGrosor > 0 ? elemento.bordeColor : undefined,
        strokeWidth: esInvisible ? 1 : elemento.bordeGrosor,
        strokeDashArray: esInvisible ? [4, 3] : undefined,
      });
      const etiqueta = new FabricText(elemento.name, {
        left: 4,
        top: elemento.h / 2,
        originY: 'center',
        fontSize: elemento.size,
        fontFamily: elemento.familia,
        fontWeight: elemento.negrita ? '700' : '400',
        fontStyle: elemento.cursiva ? 'italic' : 'normal',
        underline: elemento.subrayado,
        fill: esInvisible ? '#185fa5' : elemento.color,
        textAlign: elemento.align,
      });
      const grupo = new Group([fondo, etiqueta]);
      grupo.set({ left: elemento.x, top: elemento.y });
      grupo.setCoords();
      return grupo;
    }
    case 'imagen': {
      const imagen = await FabricImage.fromURL(elemento.src);
      imagen.set({
        left: elemento.x,
        top: elemento.y,
        scaleX: elemento.w / (imagen.width || elemento.w),
        scaleY: elemento.h / (imagen.height || elemento.h),
        opacity: elemento.opacidad / 100,
      });
      return imagen;
    }
  }
}

export async function agregarAlLienzo(lienzo: import('fabric').Canvas, elemento: Elemento): Promise<FabricObject> {
  const objeto = await crearObjetoFabric(elemento);
  datosPorObjeto.set(objeto, elemento);
  lienzo.add(objeto);
  lienzo.setActiveObject(objeto);
  lienzo.requestRenderAll();
  return objeto;
}

/**
 * Vacía el lienzo y lo reconstruye desde cero a partir de una lista de elementos, en orden
 * (usado por deshacer/rehacer para restaurar un estado anterior completo).
 */
export async function reconstruirLienzo(lienzo: import('fabric').Canvas, elementos: Elemento[]): Promise<void> {
  lienzo.discardActiveObject();
  lienzo.remove(...lienzo.getObjects());
  for (const elemento of elementos) {
    const objeto = await crearObjetoFabric(elemento);
    datosPorObjeto.set(objeto, elemento);
    lienzo.add(objeto);
  }
  lienzo.requestRenderAll();
}

/**
 * Reconstruye por completo el objeto de Fabric (necesario para 'tabla': es un Group armado de
 * hijos que no se pueden editar in-place cuando cambia la cantidad/estilo de sus líneas internas).
 */
export async function reemplazarObjeto(lienzo: import('fabric').Canvas, viejo: FabricObject, elemento: Elemento): Promise<FabricObject> {
  const nuevo = await crearObjetoFabric(elemento);
  datosPorObjeto.set(nuevo, elemento);
  lienzo.remove(viejo);
  lienzo.add(nuevo);
  lienzo.setActiveObject(nuevo);
  lienzo.requestRenderAll();
  return nuevo;
}

/**
 * Después de mover/redimensionar un objeto arrastrando sus controles, Fabric deja el cambio como
 * una transformación (left/top/scaleX/scaleY) y no toca las medidas del modelo. Hay que volcarlo,
 * porque el modelo es la fuente de verdad para el panel, para Duplicar, para deshacer/rehacer y
 * para la futura exportación a PDF: si no, todo eso trabaja con el tamaño viejo.
 *
 * Devuelve el objeto vigente — puede ser otro si hubo que reconstruirlo (caso 'campo').
 */
export async function sincronizarGeometria(lienzo: import('fabric').Canvas, objeto: FabricObject): Promise<FabricObject> {
  const elemento = datosPorObjeto.get(objeto);
  if (!elemento) return objeto;

  if (elemento.clase === 'tabla') {
    elemento.x = Math.round(objeto.left ?? elemento.x);
    elemento.y = Math.round(objeto.top ?? elemento.y);
    // Escalar desde una esquina reparte el cambio entre todas las filas/columnas y vuelve
    // la escala a 1, para que el grosor de las líneas no se deforme.
    const escalaX = objeto.scaleX ?? 1;
    const escalaY = objeto.scaleY ?? 1;
    if (escalaX !== 1 || escalaY !== 1) {
      elemento.cols = elemento.cols.map((c) => Math.max(8, Math.round(c * escalaX)));
      elemento.rows = elemento.rows.map((r) => Math.max(6, Math.round(r * escalaY)));
      objeto.set({ scaleX: 1, scaleY: 1 });
      (objeto as TablaObjeto).refrescarDesdeDatos();
    }
    return objeto;
  }

  if (elemento.clase === 'texto') {
    elemento.x = Math.round(objeto.left ?? elemento.x);
    elemento.y = Math.round(objeto.top ?? elemento.y);
    // Estirar un texto desde una esquina equivale a cambiarle el cuerpo de la fuente.
    const escala = objeto.scaleY ?? 1;
    if (escala !== 1) {
      elemento.size = Math.max(5, Math.round(elemento.size * escala));
      objeto.set({ fontSize: elemento.size, scaleX: 1, scaleY: 1 } as Partial<FabricObject>);
    }
    return objeto;
  }

  if (elemento.clase === 'campo') {
    elemento.x = Math.round(objeto.left ?? elemento.x);
    elemento.y = Math.round(objeto.top ?? elemento.y);
    const escalaX = objeto.scaleX ?? 1;
    const escalaY = objeto.scaleY ?? 1;
    if (escalaX !== 1 || escalaY !== 1) {
      // El cuerpo de la fuente no cambia: en un campo de formulario la caja se dimensiona
      // aparte del texto, igual que en el editor público.
      elemento.w = Math.round(elemento.w * escalaX);
      elemento.h = Math.round(elemento.h * escalaY);
      return reemplazarObjeto(lienzo, objeto, elemento);
    }
    return objeto;
  }

  elemento.x = Math.round(objeto.left ?? elemento.x);
  elemento.y = Math.round(objeto.top ?? elemento.y);
  const anchoVisible = Math.round((objeto.width ?? elemento.w) * (objeto.scaleX ?? 1));
  const altoVisible = Math.round((objeto.height ?? elemento.h) * (objeto.scaleY ?? 1));

  if (elemento.clase === 'linea') {
    elemento.w = anchoVisible;
    elemento.h = altoVisible;
    elemento.angulo = Math.round(objeto.angle ?? elemento.angulo);
    objeto.set({ scaleX: 1, scaleY: 1 });
    (objeto as LineaObjeto).refrescarDesdeDatos();
  } else if (elemento.clase === 'rect') {
    elemento.w = anchoVisible;
    elemento.h = altoVisible;
    objeto.set({ width: anchoVisible, height: altoVisible, scaleX: 1, scaleY: 1 });
  } else {
    // QR e imagen: el objeto de Fabric se dimensiona con scaleX/scaleY sobre el bitmap,
    // así que la escala se conserva y solo se registran las medidas resultantes.
    elemento.w = anchoVisible;
    elemento.h = altoVisible;
  }

  return objeto;
}

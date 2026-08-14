import { FabricImage, FabricText, Rect, type FabricObject } from 'fabric';
import QRCode from 'qrcode';
import type { Elemento } from './elemento';

const datosPorObjeto = new WeakMap<FabricObject, Elemento>();

export function elementoDe(objeto: FabricObject): Elemento | undefined {
  return datosPorObjeto.get(objeto);
}

function trazoDeEstilo(estilo: 'solido' | 'punteado' | 'doble'): number[] | undefined {
  if (estilo === 'punteado') return [4, 3];
  return undefined;
}

async function crearObjetoFabric(elemento: Elemento): Promise<FabricObject> {
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
    case 'linea': {
      return new Rect({
        left: elemento.x,
        top: elemento.y,
        width: elemento.w,
        height: elemento.h,
        fill: elemento.color,
      });
    }
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

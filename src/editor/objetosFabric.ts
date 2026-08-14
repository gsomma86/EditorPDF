import { FabricImage, FabricText, Group, Path, Rect, type FabricObject } from 'fabric';
import QRCode from 'qrcode';
import { anchoTotalTabla, altoTotalTabla, type Elemento } from './elemento';

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
    case 'tabla': {
      const ancho = anchoTotalTabla(elemento);
      const alto = altoTotalTabla(elemento);

      const contorno = new Rect({
        left: 0,
        top: 0,
        width: ancho,
        height: alto,
        rx: elemento.radio,
        ry: elemento.radio,
        fill: 'transparent',
        stroke: elemento.color,
        strokeDashArray: trazoDeEstilo(elemento.estiloContorno),
      });

      let trazado = '';
      let acumX = 0;
      for (let i = 0; i < elemento.cols.length - 1; i++) {
        acumX += elemento.cols[i];
        trazado += `M ${acumX} 0 L ${acumX} ${alto} `;
      }
      let acumY = 0;
      for (let i = 0; i < elemento.rows.length - 1; i++) {
        acumY += elemento.rows[i];
        trazado += `M 0 ${acumY} L ${ancho} ${acumY} `;
      }
      // Un Path vacío (tabla 1x1) no tiene bounding box propio; lo reemplazamos por un
      // segmento invisible para que ocupe (0,0)-(ancho,alto) igual que el contorno.
      const interno = new Path(trazado || `M 0 0 L 0 0`, {
        left: 0,
        top: 0,
        fill: '',
        stroke: elemento.color,
        strokeDashArray: trazoDeEstilo(elemento.estiloInterno),
      });

      const grupo = new Group([contorno, interno], { left: elemento.x, top: elemento.y });
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
 * Después de mover/redimensionar un objeto arrastrando sus controles, Fabric.js deja el cambio
 * como una transformación (left/top/scaleX/scaleY) en vez de tocar w/h — hay que volcarlo al
 * elemento para que el panel de propiedades y la futura exportación a PDF vean el tamaño real.
 * Los grupos (tabla) quedan afuera por ahora: reconstruir cols/rows a partir de la escala es
 * una cuenta más larga que no bloquea nada todavía (no hay exportación a PDF aún).
 */
export function sincronizarGeometria(objeto: FabricObject): void {
  const elemento = datosPorObjeto.get(objeto);
  if (!elemento || elemento.clase === 'tabla' || elemento.clase === 'texto') {
    if (elemento) {
      elemento.x = Math.round(objeto.left ?? elemento.x);
      elemento.y = Math.round(objeto.top ?? elemento.y);
    }
    return;
  }

  elemento.x = Math.round(objeto.left ?? elemento.x);
  elemento.y = Math.round(objeto.top ?? elemento.y);
  const anchoVisible = Math.round((objeto.width ?? elemento.w) * (objeto.scaleX ?? 1));
  const altoVisible = Math.round((objeto.height ?? elemento.h) * (objeto.scaleY ?? 1));

  if (elemento.clase === 'rect' || elemento.clase === 'linea') {
    elemento.w = anchoVisible;
    elemento.h = altoVisible;
    objeto.set({ width: anchoVisible, height: altoVisible, scaleX: 1, scaleY: 1 });
  } else {
    elemento.w = anchoVisible;
    elemento.h = altoVisible;
  }
}

import { Control, FabricObject, controlsUtils, type TPointerEvent, type Transform } from 'fabric';
import { altoTotalTabla, anchoTotalTabla, type ElementoTabla, type EstiloLinea } from './elemento';

const MIN_COL = 8;
const MIN_ROW = 6;

function trazo(estilo: EstiloLinea): number[] {
  return estilo === 'punteado' ? [4, 3] : [];
}

/**
 * La tabla es un objeto propio del motor en vez de un Group de rectángulos y líneas.
 * Dos razones: el Group calculaba mal su caja (dejaba la tabla desalineada), y los
 * controles para redimensionar cada fila/columna tienen que ser controles nativos de
 * Fabric — así siguen a la tabla al moverla o escalarla sin recalcular nada a mano.
 */
export class TablaObjeto extends FabricObject {
  static type = 'tabla';
  declare datos: ElementoTabla;

  constructor(datos: ElementoTabla) {
    super({
      left: datos.x,
      top: datos.y,
      width: anchoTotalTabla(datos),
      height: altoTotalTabla(datos),
      strokeWidth: 0,
      objectCaching: false,
    });
    this.datos = datos;
    this.controls = construirControles(datos);
  }

  /** Recalcula el tamaño de la caja y la posición relativa de cada control desde el modelo. */
  refrescarDesdeDatos(): void {
    this.set({ width: anchoTotalTabla(this.datos), height: altoTotalTabla(this.datos) });
    ubicarControles(this, this.datos);
    this.setCoords();
    this.dirty = true;
  }

  _render(ctx: CanvasRenderingContext2D): void {
    const { datos } = this;
    const ancho = anchoTotalTabla(datos);
    const alto = altoTotalTabla(datos);
    const x0 = -ancho / 2;
    const y0 = -alto / 2;

    ctx.save();
    ctx.lineWidth = datos.grosor;

    // Contorno
    ctx.strokeStyle = datos.color;
    ctx.setLineDash(trazo(datos.estiloContorno));
    contorno(ctx, x0, y0, ancho, alto, datos.radio);
    if (datos.estiloContorno === 'doble') {
      const d = datos.grosor * 2;
      contorno(ctx, x0 + d, y0 + d, ancho - d * 2, alto - d * 2, Math.max(0, datos.radio - d));
    }

    // Divisiones internas
    ctx.strokeStyle = datos.colorInterno;
    ctx.setLineDash(trazo(datos.estiloInterno));
    const doble = datos.estiloInterno === 'doble';
    const sep = datos.grosor * 1.5;

    ctx.beginPath();
    let acumX = 0;
    for (let i = 0; i < datos.cols.length - 1; i++) {
      acumX += datos.cols[i];
      const desplazamientos = doble ? [-sep, sep] : [0];
      for (const d of desplazamientos) {
        ctx.moveTo(x0 + acumX + d, y0);
        ctx.lineTo(x0 + acumX + d, y0 + alto);
      }
    }
    let acumY = 0;
    for (let i = 0; i < datos.rows.length - 1; i++) {
      acumY += datos.rows[i];
      const desplazamientos = doble ? [-sep, sep] : [0];
      for (const d of desplazamientos) {
        ctx.moveTo(x0, y0 + acumY + d);
        ctx.lineTo(x0 + ancho, y0 + acumY + d);
      }
    }
    ctx.stroke();
    ctx.restore();
  }
}

function contorno(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radio: number): void {
  if (w <= 0 || h <= 0) return;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.min(radio, w / 2, h / 2));
  ctx.stroke();
}

/** Posición relativa (-0.5 a 0.5) del borde derecho de la columna `i`. */
function relativoColumna(datos: ElementoTabla, i: number): number {
  let acum = 0;
  for (let k = 0; k <= i; k++) acum += datos.cols[k];
  return acum / anchoTotalTabla(datos) - 0.5;
}

function relativoFila(datos: ElementoTabla, i: number): number {
  let acum = 0;
  for (let k = 0; k <= i; k++) acum += datos.rows[k];
  return acum / altoTotalTabla(datos) - 0.5;
}

function dibujarAsa(vertical: boolean) {
  return (ctx: CanvasRenderingContext2D, left: number, top: number) => {
    const largo = 14;
    const grosor = 3;
    ctx.save();
    ctx.fillStyle = '#378add';
    const w = vertical ? grosor : largo;
    const h = vertical ? largo : grosor;
    ctx.beginPath();
    ctx.roundRect(left - w / 2, top - h / 2, w, h, 1.5);
    ctx.fill();
    ctx.restore();
  };
}

function accionRedimensionar(tipo: 'col' | 'row', indice: number) {
  return (_e: TPointerEvent, transform: Transform, x: number, y: number): boolean => {
    const objeto = transform.target as TablaObjeto;
    const datos = objeto.datos;
    const local = controlsUtils.getLocalPoint(transform, 'left', 'top', x, y);

    const lista = tipo === 'col' ? datos.cols : datos.rows;
    const escala = (tipo === 'col' ? objeto.scaleX : objeto.scaleY) || 1;
    const posicionLocal = (tipo === 'col' ? local.x : local.y) / escala;

    let previas = 0;
    for (let k = 0; k < indice; k++) previas += lista[k];

    const minimo = tipo === 'col' ? MIN_COL : MIN_ROW;
    const nueva = Math.max(minimo, Math.round(posicionLocal - previas));
    if (nueva === lista[indice]) return false;

    lista[indice] = nueva;
    objeto.refrescarDesdeDatos();
    return true;
  };
}

function construirControles(datos: ElementoTabla): Record<string, Control> {
  const controles: Record<string, Control> = { ...controlsUtils.createObjectDefaultControls() };
  // Los controles laterales por defecto escalan toda la tabla y quedarían justo encima de
  // los nuestros (que redimensionan la última fila/columna), así que los sacamos.
  delete controles.ml;
  delete controles.mr;
  delete controles.mt;
  delete controles.mb;

  datos.cols.forEach((_, i) => {
    controles[`col${i}`] = new Control({
      x: relativoColumna(datos, i),
      y: 0,
      actionName: 'redimensionarColumna',
      cursorStyle: 'col-resize',
      actionHandler: accionRedimensionar('col', i),
      render: dibujarAsa(true),
    });
  });

  datos.rows.forEach((_, i) => {
    controles[`row${i}`] = new Control({
      x: 0,
      y: relativoFila(datos, i),
      actionName: 'redimensionarFila',
      cursorStyle: 'row-resize',
      actionHandler: accionRedimensionar('row', i),
      render: dibujarAsa(false),
    });
  });

  return controles;
}

function ubicarControles(objeto: TablaObjeto, datos: ElementoTabla): void {
  datos.cols.forEach((_, i) => {
    const control = objeto.controls[`col${i}`];
    if (control) control.x = relativoColumna(datos, i);
  });
  datos.rows.forEach((_, i) => {
    const control = objeto.controls[`row${i}`];
    if (control) control.y = relativoFila(datos, i);
  });
}

import { Control, FabricObject, controlsUtils, util, type Canvas, type Point, type TPointerEvent, type Transform } from 'fabric';
import { altoTotalTabla, anchoTotalTabla, type CeldaCombinada, type ElementoTabla } from './elemento';
import { internasDeTabla } from './figuras';
import { guionDe, trazarRectangulo } from './trazos';

const MIN_COL = 8;
const MIN_ROW = 6;

/**
 * La tabla es un objeto propio del motor en vez de un Group de rectángulos y líneas.
 * Dos razones: el Group calculaba mal su caja (dejaba la tabla desalineada), y los
 * controles para redimensionar cada fila/columna tienen que ser controles nativos de
 * Fabric — así siguen a la tabla al moverla o escalarla sin recalcular nada a mano.
 */
export class TablaObjeto extends FabricObject {
  static type = 'tabla';
  declare datos: ElementoTabla;

  /**
   * El bloque de celdas marcado para combinar, mientras se arrastra o después de soltar (hasta que
   * se confirme con el botón "Combinar" del panel o se pierda la selección). Vive acá y no en el
   * modelo: es un estado de edición, no algo que se guarde ni se exporte.
   */
  celdaSeleccion: CeldaCombinada | null = null;

  constructor(datos: ElementoTabla) {
    super({
      left: datos.x,
      top: datos.y,
      width: anchoTotalTabla(datos),
      height: altoTotalTabla(datos),
      angle: datos.angulo,
      strokeWidth: 0,
      objectCaching: false,
    });
    this.datos = datos;
    this.controls = construirControles(datos);
  }

  /** Recalcula el tamaño de la caja y la posición relativa de cada control desde el modelo. */
  refrescarDesdeDatos(): void {
    this.set({ width: anchoTotalTabla(this.datos), height: altoTotalTabla(this.datos), angle: this.datos.angulo });
    ubicarControles(this, this.datos);
    this.setCoords();
    this.dirty = true;
  }

  /**
   * A qué celda (fila, columna) cae un punto de la escena, o `null` si cae fuera de la tabla.
   * Usa la matriz propia del objeto para pasar de coordenadas de escena a locales, así sigue
   * funcionando igual con zoom, pan, rotación o la tabla movida — nada de esto se calcula a mano
   * en coordenadas de pantalla (la lección 1 de CLAUDE.md).
   */
  celdaEnPunto(puntoEscena: Point): { fila: number; col: number } | null {
    const inversa = util.invertTransform(this.calcTransformMatrix());
    const local = util.transformPoint(puntoEscena, inversa);
    const ancho = anchoTotalTabla(this.datos);
    const alto = altoTotalTabla(this.datos);
    const x = local.x + ancho / 2;
    const y = local.y + alto / 2;
    if (x < 0 || x > ancho || y < 0 || y > alto) return null;
    return { fila: indiceDeCelda(this.datos.rows, y), col: indiceDeCelda(this.datos.cols, x) };
  }

  _render(ctx: CanvasRenderingContext2D): void {
    const { datos } = this;
    const ancho = anchoTotalTabla(datos);
    const alto = altoTotalTabla(datos);
    const x0 = -ancho / 2;
    const y0 = -alto / 2;

    ctx.save();

    ctx.strokeStyle = datos.color;
    trazarRectangulo(ctx, x0, y0, ancho, alto, datos.radio, datos.estiloContorno, datos.grosor);

    // Divisiones internas: la geometría sale de `figuras.ts`, el mismo módulo que usa el exportador.
    ctx.strokeStyle = datos.colorInterno;
    const internas = internasDeTabla(datos);
    ctx.lineWidth = internas.grosor;
    ctx.setLineDash(guionDe(datos.estiloInterno, datos.grosor));

    ctx.beginPath();
    for (const t of internas.trazos) {
      ctx.moveTo(x0 + t.x1, y0 + t.y1);
      ctx.lineTo(x0 + t.x2, y0 + t.y2);
    }
    ctx.stroke();
    ctx.restore();

    if (this.celdaSeleccion) this.dibujarSeleccion(ctx, x0, y0);
  }

  /** El bloque que se está por combinar, resaltado — mismo estilo que la selección de Fabric. */
  private dibujarSeleccion(ctx: CanvasRenderingContext2D, x0: number, y0: number): void {
    const sel = this.celdaSeleccion!;
    const colX = prefijos(this.datos.cols);
    const rowY = prefijos(this.datos.rows);
    const x = colX[sel.colDesde];
    const y = rowY[sel.filaDesde];
    const w = colX[sel.colHasta + 1] - x;
    const h = rowY[sel.filaHasta + 1] - y;

    ctx.save();
    ctx.fillStyle = 'rgba(55,138,221,0.25)';
    ctx.strokeStyle = '#378add';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([]);
    ctx.fillRect(x0 + x, y0 + y, w, h);
    ctx.strokeRect(x0 + x, y0 + y, w, h);
    ctx.restore();
  }
}

function prefijos(medidas: number[]): number[] {
  const acumulado = [0];
  for (const m of medidas) acumulado.push(acumulado[acumulado.length - 1] + m);
  return acumulado;
}

/** En qué índice de la lista (col o fila) cae la posición `valor`, recorriendo las sumas parciales. */
function indiceDeCelda(medidas: number[], valor: number): number {
  let acumulado = 0;
  for (let i = 0; i < medidas.length; i++) {
    acumulado += medidas[i];
    if (valor <= acumulado || i === medidas.length - 1) return i;
  }
  return medidas.length - 1;
}

/**
 * Escucha el lienzo para armar el arrastre de selección de celdas: mantener Shift y arrastrar
 * sobre el cuerpo de una tabla ya seleccionada marca un bloque para combinar. Sin Shift el
 * arrastre sigue siendo el de siempre (mover la tabla), y un clic sobre un control (redimensionar
 * columna/fila, o las esquinas) tampoco se toca: Fabric ya le asignó su propia `transform` antes
 * de que este handler se entere, y acá se lo deja pasar de largo.
 *
 * Va aparte de `activarVista` porque es pura interacción de la tabla, no algo del lienzo en
 * general (cuadrícula, guías, reglas).
 */
export function activarCombinarCeldas(lienzo: Canvas): void {
  let arrastre: { tabla: TablaObjeto; inicio: { fila: number; col: number } } | null = null;

  lienzo.on('mouse:down', (opt) => {
    const activo = lienzo.getActiveObject();
    const conShift = !!opt.e.shiftKey && !opt.transform;

    if (!conShift || !(activo instanceof TablaObjeto)) {
      // No es el clic de "empezar a marcar celdas": moverla, redimensionarla, clickear otra cosa
      // o Shift sin una tabla activa abandonan cualquier selección de celdas que hubiera quedado
      // pendiente en cualquier tabla de la hoja.
      let cambio = false;
      for (const o of lienzo.getObjects()) {
        if (o instanceof TablaObjeto && o.celdaSeleccion) {
          o.celdaSeleccion = null;
          cambio = true;
        }
      }
      if (cambio) lienzo.requestRenderAll();
      return;
    }

    const celda = activo.celdaEnPunto(lienzo.getScenePoint(opt.e));
    if (!celda) return;
    arrastre = { tabla: activo, inicio: celda };
    activo.celdaSeleccion = { filaDesde: celda.fila, filaHasta: celda.fila, colDesde: celda.col, colHasta: celda.col };
    activo.dirty = true;
    lienzo.requestRenderAll();
  });

  lienzo.on('mouse:move', (opt) => {
    if (!arrastre) return;
    const celda = arrastre.tabla.celdaEnPunto(lienzo.getScenePoint(opt.e));
    if (!celda) return;
    const { inicio, tabla } = arrastre;
    tabla.celdaSeleccion = {
      filaDesde: Math.min(inicio.fila, celda.fila),
      filaHasta: Math.max(inicio.fila, celda.fila),
      colDesde: Math.min(inicio.col, celda.col),
      colHasta: Math.max(inicio.col, celda.col),
    };
    tabla.dirty = true;
    lienzo.requestRenderAll();
  });

  lienzo.on('mouse:up', () => {
    arrastre = null;
  });
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
    const esUltima = indice === lista.length - 1;

    if (esUltima) {
      // Sin vecina siguiente a la que restarle: mover este control sí cambia el ancho/alto
      // total de la tabla, a propósito.
      const nueva = Math.max(minimo, Math.round(posicionLocal - previas));
      if (nueva === lista[indice]) return false;
      lista[indice] = nueva;
    } else {
      // Reparte con la columna/fila siguiente para que la suma —y con ella el tamaño total de
      // la tabla— no cambie: si una crece, la vecina se achica lo mismo.
      const suma = lista[indice] + lista[indice + 1];
      const nueva = Math.min(suma - minimo, Math.max(minimo, Math.round(posicionLocal - previas)));
      if (nueva === lista[indice]) return false;
      lista[indice] = nueva;
      lista[indice + 1] = suma - nueva;
    }

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

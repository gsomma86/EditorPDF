export type Familia = string;
export type EstiloLinea = 'solido' | 'punteado' | 'doble';

/** Los dos factores con los que Fabric separa renglones: su `lineHeight` y su `_fontSizeMult`. */
const ALTURA_RENGLON = 1.16;
const MULTIPLICADOR_FUENTE = 1.13;

/**
 * Distancia entre renglones, en múltiplos del cuerpo de la fuente. Vive acá, en el modelo, porque
 * el exportador también la necesita —para que el texto vertical caiga con el mismo paso que en
 * pantalla— y no puede depender de Fabric.
 */
export const PASO_RENGLON = ALTURA_RENGLON * MULTIPLICADOR_FUENTE;

export interface ElementoTexto {
  clase: 'texto';
  id: number;
  x: number;
  y: number;
  angulo: number;
  text: string;
  /** Letras apiladas, una debajo de la otra, en vez de escritas de corrido. */
  vertical: boolean;
  /**
   * Puntos que se suman al paso normal entre renglones: entre las letras si el texto es vertical,
   * y entre las líneas si tiene varias. Puede ser negativo, para juntarlos.
   */
  separacion: number;
  /** Permite escribir varios renglones en el contenido. */
  multilinea: boolean;
  size: number;
  familia: Familia;
  negrita: boolean;
  cursiva: boolean;
  subrayado: boolean;
  color: string;
  align: 'left' | 'center' | 'right';
}

export interface ElementoLinea {
  clase: 'linea';
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  angulo: number;
  color: string;
  estilo: EstiloLinea;
}

export interface ElementoRect {
  clase: 'rect';
  id: number;
  x: number;
  y: number;
  angulo: number;
  w: number;
  h: number;
  color: string;
  estilo: EstiloLinea;
  grosor: number;
  radio: number;
  conRelleno: boolean;
  rellenoColor: string;
}

export interface ElementoQr {
  clase: 'qr';
  id: number;
  x: number;
  y: number;
  angulo: number;
  w: number;
  h: number;
  texto: string;
  color: string;
  conFondo: boolean;
  fondoColor: string;
}

export interface ElementoTabla {
  clase: 'tabla';
  id: number;
  x: number;
  y: number;
  angulo: number;
  color: string;
  colorInterno: string;
  grosor: number;
  estiloContorno: EstiloLinea;
  estiloInterno: EstiloLinea;
  radio: number;
  cols: number[];
  rows: number[];
}

export interface ElementoImagen {
  clase: 'imagen';
  id: number;
  x: number;
  y: number;
  angulo: number;
  w: number;
  h: number;
  src: string;
  opacidad: number;
  proporcion: boolean;
}

export type TipoDato = 'Texto' | 'Numero' | 'Moneda' | 'Fecha';

export interface ElementoCampo {
  clase: 'campo';
  id: number;
  name: string;
  x: number;
  y: number;
  angulo: number;
  w: number;
  h: number;
  tipo: TipoDato;
  size: number;
  familia: Familia;
  negrita: boolean;
  cursiva: boolean;
  subrayado: boolean;
  color: string;
  align: 'left' | 'center' | 'right';
  invisible: boolean;
  readonly: boolean;
  /** El campo del PDF acepta varios renglones en vez de uno solo. */
  multilinea: boolean;
  defaultValue: string;
  bordeGrosor: number;
  bordeColor: string;
  conFondo: boolean;
  fondoColor: string;
}

export type Elemento = ElementoTexto | ElementoLinea | ElementoRect | ElementoQr | ElementoTabla | ElementoImagen | ElementoCampo;
export type ClaseDibujo = Elemento['clase'];
export type ClaseSimple = 'texto' | 'linea' | 'rect' | 'qr';

let secuencia = 0;
let cantidadColocados = 0;
let area = { x: 10, y: 10, ancho: 575, alto: 822 };

/**
 * Al importar un proyecto hay que correr el contador por encima de los IDs que ya vienen usados,
 * o los elementos nuevos repetirían un ID existente.
 */
export function reservarIds(elementos: Elemento[]): void {
  for (const elemento of elementos) {
    if (elemento.id >= secuencia) secuencia = elemento.id + 1;
  }
}

/** El área útil (la hoja menos sus márgenes) acota dónde caen los elementos nuevos. */
export function establecerAreaUtil(
  anchoPagina: number,
  altoPagina: number,
  margenes: { arriba: number; abajo: number; izquierda: number; derecha: number }
): void {
  area = {
    x: margenes.izquierda,
    y: margenes.arriba,
    ancho: Math.max(1, anchoPagina - margenes.izquierda - margenes.derecha),
    alto: Math.max(1, altoPagina - margenes.arriba - margenes.abajo),
  };
}

function nuevaPosicion(anchoEl: number, altoEl: number): { x: number; y: number } {
  cantidadColocados += 1;
  const rangoX = Math.max(1, area.ancho - anchoEl);
  const rangoY = Math.max(1, area.alto - altoEl);
  return {
    x: area.x + ((cantidadColocados * 24) % Math.min(120, rangoX)),
    y: area.y + ((cantidadColocados * 24) % Math.min(200, rangoY)),
  };
}

export function crearElemento(clase: ClaseSimple): Elemento {
  const id = secuencia++;

  switch (clase) {
    case 'texto': {
      const { x, y } = nuevaPosicion(60, 11);
      return { clase, id, x, y, angulo: 0, text: 'Texto', vertical: false, separacion: 0, multilinea: false, size: 11, familia: 'Helvetica', negrita: false, cursiva: false, subrayado: false, color: '#111111', align: 'left' };
    }
    case 'linea': {
      const { x, y } = nuevaPosicion(200, 1);
      return { clase, id, x, y, w: 200, h: 1, angulo: 0, color: '#111111', estilo: 'solido' };
    }
    case 'rect': {
      const { x, y } = nuevaPosicion(180, 60);
      return { clase, id, x, y, angulo: 0, w: 180, h: 60, color: '#111111', estilo: 'solido', grosor: 1, radio: 0, conRelleno: false, rellenoColor: '#ffffff' };
    }
    case 'qr': {
      const { x, y } = nuevaPosicion(80, 80);
      return { clase, id, x, y, angulo: 0, w: 80, h: 80, texto: 'https://recibomail.net.ar', color: '#000000', conFondo: true, fondoColor: '#ffffff' };
    }
  }
}

export function crearElementoTabla(filas: number, columnas: number): ElementoTabla {
  const nf = Math.max(1, Math.min(20, filas || 3));
  const nc = Math.max(1, Math.min(10, columnas || 3));
  const { x, y } = nuevaPosicion(nc * 60, nf * 24);
  return {
    clase: 'tabla',
    id: secuencia++,
    x,
    y,
    angulo: 0,
    color: '#111111',
    colorInterno: '#111111',
    grosor: 1,
    estiloContorno: 'solido',
    estiloInterno: 'solido',
    radio: 0,
    cols: new Array(nc).fill(60),
    rows: new Array(nf).fill(24),
  };
}

export function crearElementoImagen(src: string, anchoNatural: number, altoNatural: number): ElementoImagen {
  const escala = Math.min(1, 150 / Math.max(anchoNatural, altoNatural));
  const w = Math.round(anchoNatural * escala) || 60;
  const h = Math.round(altoNatural * escala) || 60;
  const { x, y } = nuevaPosicion(w, h);
  return {
    clase: 'imagen',
    id: secuencia++,
    x,
    y,
    angulo: 0,
    w,
    h,
    src,
    opacidad: 100,
    proporcion: true,
  };
}

export function crearElementoCampo(nombre: string): ElementoCampo {
  const { x, y } = nuevaPosicion(150, 16);
  return {
    clase: 'campo',
    id: secuencia++,
    name: nombre,
    x,
    y,
    angulo: 0,
    w: 150,
    h: 16,
    tipo: 'Texto',
    size: 9,
    familia: 'Helvetica',
    negrita: false,
    cursiva: false,
    subrayado: false,
    color: '#000000',
    align: 'left',
    invisible: false,
    readonly: false,
    multilinea: false,
    defaultValue: '',
    bordeGrosor: 0,
    bordeColor: '#000000',
    conFondo: false,
    fondoColor: '#ffffff',
  };
}

export function duplicarElemento(elemento: Elemento): Elemento {
  const clon: Elemento = JSON.parse(JSON.stringify(elemento));
  clon.id = secuencia++;
  clon.x += 12;
  clon.y += 12;
  return clon;
}

/** Distancia real entre letras apiladas: el paso normal más la separación pedida. */
export function pasoDeRenglon(texto: ElementoTexto): number {
  return texto.size * PASO_RENGLON + texto.separacion;
}

/** El mismo paso, expresado como el `lineHeight` que hay que darle a Fabric para que lo dibuje. */
export function alturaRenglonFabric(texto: ElementoTexto): number {
  return pasoDeRenglon(texto) / (texto.size * MULTIPLICADOR_FUENTE);
}

export function anchoTotalTabla(tabla: ElementoTabla): number {
  return tabla.cols.reduce((a, b) => a + b, 0);
}

export function altoTotalTabla(tabla: ElementoTabla): number {
  return tabla.rows.reduce((a, b) => a + b, 0);
}

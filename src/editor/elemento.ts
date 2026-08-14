export type Familia = string;
export type EstiloLinea = 'solido' | 'punteado' | 'doble';

export interface ElementoTexto {
  clase: 'texto';
  id: number;
  x: number;
  y: number;
  text: string;
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
const MARGEN = 20;
let paginaAncho = 595;
let paginaAlto = 842;

export function establecerTamanoPagina(ancho: number, alto: number): void {
  paginaAncho = ancho;
  paginaAlto = alto;
}

function nuevaPosicion(anchoEl: number, altoEl: number): { x: number; y: number } {
  cantidadColocados += 1;
  const rangoX = Math.max(1, paginaAncho - MARGEN * 2 - anchoEl);
  const rangoY = Math.max(1, paginaAlto - MARGEN * 2 - altoEl);
  return {
    x: MARGEN + ((cantidadColocados * 24) % Math.min(120, rangoX)),
    y: MARGEN + ((cantidadColocados * 24) % Math.min(200, rangoY)),
  };
}

export function crearElemento(clase: ClaseSimple): Elemento {
  const id = secuencia++;

  switch (clase) {
    case 'texto': {
      const { x, y } = nuevaPosicion(60, 11);
      return { clase, id, x, y, text: 'Texto', size: 11, familia: 'Helvetica', negrita: false, cursiva: false, subrayado: false, color: '#111111', align: 'left' };
    }
    case 'linea': {
      const { x, y } = nuevaPosicion(200, 1);
      return { clase, id, x, y, w: 200, h: 1, angulo: 0, color: '#111111', estilo: 'solido' };
    }
    case 'rect': {
      const { x, y } = nuevaPosicion(180, 60);
      return { clase, id, x, y, w: 180, h: 60, color: '#111111', estilo: 'solido', grosor: 1, radio: 0, conRelleno: false, rellenoColor: '#ffffff' };
    }
    case 'qr': {
      const { x, y } = nuevaPosicion(80, 80);
      return { clase, id, x, y, w: 80, h: 80, texto: 'https://recibomail.net.ar', color: '#000000', conFondo: true, fondoColor: '#ffffff' };
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

export function anchoTotalTabla(tabla: ElementoTabla): number {
  return tabla.cols.reduce((a, b) => a + b, 0);
}

export function altoTotalTabla(tabla: ElementoTabla): number {
  return tabla.rows.reduce((a, b) => a + b, 0);
}

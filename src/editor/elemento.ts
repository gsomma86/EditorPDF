export type Familia = 'Helvetica' | 'Times' | 'Courier';
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
}

export interface ElementoTabla {
  clase: 'tabla';
  id: number;
  x: number;
  y: number;
  color: string;
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

export type Elemento = ElementoTexto | ElementoLinea | ElementoRect | ElementoQr | ElementoTabla | ElementoImagen;
export type ClaseDibujo = Elemento['clase'];
export type ClaseSimple = 'texto' | 'linea' | 'rect' | 'qr';

let secuencia = 0;
let cantidadColocados = 0;

function nuevaPosicion(): { x: number; y: number } {
  cantidadColocados += 1;
  return { x: 40 + ((cantidadColocados * 6) % 120), y: 40 + ((cantidadColocados * 6) % 200) };
}

export function crearElemento(clase: ClaseSimple): Elemento {
  const { x, y } = nuevaPosicion();
  const id = secuencia++;

  switch (clase) {
    case 'texto':
      return { clase, id, x, y, text: 'Texto', size: 11, familia: 'Helvetica', negrita: false, cursiva: false, subrayado: false, color: '#111111', align: 'left' };
    case 'linea':
      return { clase, id, x, y, w: 200, h: 1, color: '#111111', estilo: 'solido' };
    case 'rect':
      return { clase, id, x, y, w: 180, h: 60, color: '#111111', estilo: 'solido', grosor: 1, radio: 0, conRelleno: false, rellenoColor: '#ffffff' };
    case 'qr':
      return { clase, id, x, y, w: 80, h: 80, texto: 'https://recibomail.net.ar' };
  }
}

export function crearElementoTabla(filas: number, columnas: number): ElementoTabla {
  const { x, y } = nuevaPosicion();
  const nf = Math.max(1, Math.min(20, filas || 3));
  const nc = Math.max(1, Math.min(10, columnas || 3));
  return {
    clase: 'tabla',
    id: secuencia++,
    x,
    y,
    color: '#111111',
    estiloContorno: 'solido',
    estiloInterno: 'solido',
    radio: 0,
    cols: new Array(nc).fill(60),
    rows: new Array(nf).fill(24),
  };
}

export function crearElementoImagen(src: string, anchoNatural: number, altoNatural: number): ElementoImagen {
  const { x, y } = nuevaPosicion();
  const escala = Math.min(1, 150 / Math.max(anchoNatural, altoNatural));
  return {
    clase: 'imagen',
    id: secuencia++,
    x,
    y,
    w: Math.round(anchoNatural * escala) || 60,
    h: Math.round(altoNatural * escala) || 60,
    src,
    opacidad: 100,
    proporcion: true,
  };
}

export function anchoTotalTabla(tabla: ElementoTabla): number {
  return tabla.cols.reduce((a, b) => a + b, 0);
}

export function altoTotalTabla(tabla: ElementoTabla): number {
  return tabla.rows.reduce((a, b) => a + b, 0);
}

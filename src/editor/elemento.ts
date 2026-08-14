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

export type Elemento = ElementoTexto | ElementoLinea | ElementoRect | ElementoQr;
export type ClaseDibujo = Elemento['clase'];

let secuencia = 0;
let cantidadColocados = 0;

function nuevaPosicion(): { x: number; y: number } {
  cantidadColocados += 1;
  return { x: 40 + ((cantidadColocados * 6) % 120), y: 40 + ((cantidadColocados * 6) % 200) };
}

export function crearElemento(clase: ClaseDibujo): Elemento {
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

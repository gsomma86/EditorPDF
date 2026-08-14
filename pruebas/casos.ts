/** Casos compartidos por los dos arneses: uno mide el lienzo y el otro el PDF exportado. */
import type { Elemento } from '../src/editor/elemento';

export interface Caso {
  nombre: string;
  elementos: Elemento[];
  /** El texto se compara con más holgura: en Node no está la Helvetica real y los glifos cambian. */
  tolerancia?: number;
}

function campo(nombre: string, x: number, y: number, extra: Partial<Record<string, unknown>> = {}): Elemento {
  return {
    clase: 'campo',
    id: 90,
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
    defaultValue: '',
    bordeGrosor: 1,
    bordeColor: '#000000',
    conFondo: false,
    fondoColor: '#ffffff',
    ...extra,
  } as Elemento;
}

export const CASOS: Caso[] = [
  {
    nombre: 'texto-helvetica',
    tolerancia: 6,
    elementos: [
      { clase: 'texto', id: 1, x: 100, y: 200, angulo: 0, vertical: false, separacion: 0, text: 'HXEM', size: 40, familia: 'Helvetica', negrita: false, cursiva: false, subrayado: false, color: '#000000', align: 'left' },
    ],
  },
  {
    nombre: 'texto-open-sans',
    tolerancia: 6,
    elementos: [
      { clase: 'texto', id: 2, x: 100, y: 200, angulo: 0, vertical: false, separacion: 0, text: 'HXEM', size: 40, familia: 'Open Sans', negrita: true, cursiva: false, subrayado: false, color: '#000000', align: 'left' },
    ],
  },
  { nombre: 'linea-horizontal', elementos: [{ clase: 'linea', id: 3, x: 100, y: 300, w: 200, h: 2, angulo: 0, color: '#000000', estilo: 'solido' }] },
  { nombre: 'linea-45', elementos: [{ clase: 'linea', id: 4, x: 100, y: 400, w: 200, h: 2, angulo: 45, color: '#000000', estilo: 'solido' }] },
  { nombre: 'linea-doble', elementos: [{ clase: 'linea', id: 5, x: 100, y: 500, w: 200, h: 6, angulo: 0, color: '#000000', estilo: 'doble' }] },
  {
    nombre: 'rect',
    elementos: [{ clase: 'rect', id: 6, x: 80, y: 150, angulo: 0, w: 180, h: 60, color: '#000000', estilo: 'solido', grosor: 2, radio: 0, conRelleno: false, rellenoColor: '#ffffff' }],
  },
  {
    nombre: 'tabla',
    elementos: [
      {
        clase: 'tabla',
        id: 7,
        x: 90,
        y: 500,
        angulo: 0,
        color: '#000000',
        colorInterno: '#000000',
        grosor: 1,
        estiloContorno: 'solido',
        estiloInterno: 'solido',
        radio: 0,
        cols: [60, 80, 100],
        rows: [24, 30],
      },
    ],
  },
  {
    nombre: 'qr',
    elementos: [{ clase: 'qr', id: 8, x: 120, y: 600, angulo: 0, w: 80, h: 80, texto: 'https://recibomail.net.ar', color: '#000000', conFondo: true, fondoColor: '#ffffff' }],
  },
  { nombre: 'campo', tolerancia: 3, elementos: [campo('importe', 100, 250, { bordeGrosor: 1 })] },

  // Rotados: todos giran alrededor de su esquina superior izquierda, así que el ángulo no los
  // mueve de lugar. El campo va a 90° porque un widget AcroForm solo admite múltiplos de 90.
  { nombre: 'rect-30', elementos: [{ clase: 'rect', id: 10, x: 150, y: 200, angulo: 30, w: 180, h: 60, color: '#000000', estilo: 'solido', grosor: 2, radio: 0, conRelleno: false, rellenoColor: '#ffffff' }] },
  {
    nombre: 'tabla-20',
    elementos: [
      { clase: 'tabla', id: 11, x: 120, y: 400, angulo: 20, color: '#000000', colorInterno: '#000000', grosor: 1, estiloContorno: 'solido', estiloInterno: 'solido', radio: 0, cols: [60, 80], rows: [24, 30] },
    ],
  },
  { nombre: 'qr-45', elementos: [{ clase: 'qr', id: 12, x: 200, y: 600, angulo: 45, w: 80, h: 80, texto: 'https://recibomail.net.ar', color: '#000000', conFondo: true, fondoColor: '#ffffff' }] },
  {
    nombre: 'texto-25',
    tolerancia: 8,
    elementos: [
      { clase: 'texto', id: 13, x: 120, y: 300, angulo: 25, vertical: false, separacion: 0, text: 'HXEM', size: 40, familia: 'Helvetica', negrita: false, cursiva: false, subrayado: false, color: '#000000', align: 'left' },
    ],
  },
  { nombre: 'campo-90', tolerancia: 3, elementos: [campo('importe', 300, 200, { angulo: 90, bordeGrosor: 1 })] },
  {
    nombre: 'texto-vertical',
    tolerancia: 8,
    elementos: [
      { clase: 'texto', id: 14, x: 200, y: 150, angulo: 0, vertical: true, separacion: 0, text: 'HXEM', size: 30, familia: 'Helvetica', negrita: false, cursiva: false, subrayado: false, color: '#000000', align: 'left' },
    ],
  },
];

/** Campos AcroForm: se verifica la estructura del formulario, no la tinta. */
export const CASO_CAMPOS: Elemento[] = [campo('importe', 100, 250, { defaultValue: 'ABC' }), campo('importe', 100, 400), campo('fecha', 300, 250, { readonly: true })];

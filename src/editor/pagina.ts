export const TAMANOS = {
  A4: [595, 842],
  Carta: [612, 792],
  Oficio: [612, 1008],
  A5: [420, 595],
} as const;

export type TamanoPagina = keyof typeof TAMANOS;
export type Orientacion = 'vertical' | 'horizontal';

export interface Margenes {
  arriba: number;
  abajo: number;
  izquierda: number;
  derecha: number;
}

export interface ConfigPagina {
  tamano: TamanoPagina;
  orientacion: Orientacion;
  margenes: Margenes;
}

export function configPorDefecto(): ConfigPagina {
  return {
    tamano: 'A4',
    orientacion: 'vertical',
    margenes: { arriba: 10, abajo: 10, izquierda: 10, derecha: 10 },
  };
}

export function dimensionesPagina(tamano: TamanoPagina, orientacion: Orientacion): { ancho: number; alto: number } {
  const [ancho, alto] = TAMANOS[tamano];
  return orientacion === 'horizontal' ? { ancho: alto, alto: ancho } : { ancho, alto };
}

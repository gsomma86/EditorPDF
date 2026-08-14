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
  /**
   * Imagen de fondo de la hoja, como data URL, o null si va en blanco. Es una propiedad de la
   * página y no un elemento del diseño: se estira a toda la hoja, no se puede seleccionar ni
   * mover, y siempre queda por debajo de todo.
   */
  fondo: string | null;
}

export function configPorDefecto(): ConfigPagina {
  return {
    tamano: 'A4',
    orientacion: 'vertical',
    margenes: { arriba: 10, abajo: 10, izquierda: 10, derecha: 10 },
    fondo: null,
  };
}

export function dimensionesPagina(tamano: TamanoPagina, orientacion: Orientacion): { ancho: number; alto: number } {
  const [ancho, alto] = TAMANOS[tamano];
  return orientacion === 'horizontal' ? { ancho: alto, alto: ancho } : { ancho, alto };
}

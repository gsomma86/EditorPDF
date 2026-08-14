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
  /**
   * Medidas en puntos cuando la hoja no es un tamaño del catálogo: pasa al abrir un PDF, que
   * puede venir de cualquier medida. Si está, manda sobre `tamano` y `orientacion`.
   */
  medidas: { ancho: number; alto: number } | null;
}

export function configPorDefecto(): ConfigPagina {
  return {
    tamano: 'A4',
    orientacion: 'vertical',
    margenes: { arriba: 10, abajo: 10, izquierda: 10, derecha: 10 },
    fondo: null,
    medidas: null,
  };
}

export function dimensionesPagina(tamano: TamanoPagina, orientacion: Orientacion): { ancho: number; alto: number } {
  const [ancho, alto] = TAMANOS[tamano];
  return orientacion === 'horizontal' ? { ancho: alto, alto: ancho } : { ancho, alto };
}

/** El tamaño real de la hoja: sus medidas propias si las tiene, o las del catálogo. */
export function dimensionesDe(config: ConfigPagina): { ancho: number; alto: number } {
  return config.medidas ?? dimensionesPagina(config.tamano, config.orientacion);
}

/** El tamaño del catálogo que más se parece a unas medidas, para reflejarlo en la barra. */
export function tamanoParecido(ancho: number, alto: number): { tamano: TamanoPagina; orientacion: Orientacion } {
  const horizontal = ancho > alto;
  const ladoCorto = Math.min(ancho, alto);
  const ladoLargo = Math.max(ancho, alto);
  let mejor: TamanoPagina = 'A4';
  let menorDiferencia = Infinity;
  for (const nombre of Object.keys(TAMANOS) as TamanoPagina[]) {
    const [a, b] = TAMANOS[nombre];
    const diferencia = Math.abs(a - ladoCorto) + Math.abs(b - ladoLargo);
    if (diferencia < menorDiferencia) {
      menorDiferencia = diferencia;
      mejor = nombre;
    }
  }
  return { tamano: mejor, orientacion: horizontal ? 'horizontal' : 'vertical' };
}

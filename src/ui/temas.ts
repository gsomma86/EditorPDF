/**
 * Las paletas de color de la interfaz.
 *
 * Toda la aplicación se pinta desde las variables CSS de `:root` (`--fondo`, `--texto`, …), así que
 * un tema no es más que otro juego de valores para esas mismas variables: cambiarlo no toca ni una
 * regla de `style.css`. Se aplican escribiéndolas en el elemento raíz, que gana sobre `:root`.
 *
 * **El tema pinta la aplicación, no el documento.** La hoja del lienzo queda blanca en todos: es el
 * papel que se va a imprimir, y teñirla mentiría sobre cómo va a salir el PDF.
 *
 * Se recuerda en el navegador, igual que el idioma. Ojo: eso vive por navegador, así que la versión
 * de escritorio guarda el suyo aparte del de Chrome.
 */

/** Las variables que define un tema. Son las mismas que están en `:root` en `style.css`. */
export interface Paleta {
  fondo: string;
  'fondo-suave': string;
  pagina: string;
  texto: string;
  'texto-2': string;
  'texto-suave': string;
  primario: string;
  acento: string;
  'card-1': string;
  borde: string;
  'borde-fuerte': string;
  'borde-papel': string;
  'err-texto': string;
  'err-fondo': string;
  /** El degradado de la barra superior, de oscuro a claro. */
  'barra-1': string;
  'barra-2': string;
  'barra-3': string;
}

export type NombreTema = 'claro' | 'oscuro' | 'sepia' | 'bosque' | 'grafito' | 'alto' | 'rojo' | 'rosa' | 'custom';

/** El orden en que aparecen en el menú. `custom` va aparte, al final. */
export const TEMAS: Exclude<NombreTema, 'custom'>[] = ['claro', 'oscuro', 'sepia', 'bosque', 'grafito', 'alto', 'rojo', 'rosa'];

export const PALETAS: Record<Exclude<NombreTema, 'custom'>, Paleta> = {
  claro: {
    fondo: '#ffffff', 'fondo-suave': '#f5fafe', pagina: '#f3f7fb',
    texto: '#042c53', 'texto-2': '#185fa5', 'texto-suave': '#5c7c9c',
    primario: '#185fa5', acento: '#378add', 'card-1': '#eef5fc',
    borde: '#dce9f7', 'borde-fuerte': '#b5d4f4', 'borde-papel': '#cfd8e2',
    'err-texto': '#a12626', 'err-fondo': '#fcebeb',
    'barra-1': '#0c2e52', 'barra-2': '#185fa5', 'barra-3': '#2f8fe0',
  },
  oscuro: {
    fondo: '#161b22', 'fondo-suave': '#1c232c', pagina: '#0d1117',
    texto: '#e6edf3', 'texto-2': '#79b8ff', 'texto-suave': '#8b98a5',
    primario: '#2f6fb5', acento: '#58a6ff', 'card-1': '#222b35',
    borde: '#2b3440', 'borde-fuerte': '#3d4854', 'borde-papel': '#3d4854',
    'err-texto': '#ff7b72', 'err-fondo': '#3a1d1d',
    'barra-1': '#0a0d12', 'barra-2': '#161b22', 'barra-3': '#243040',
  },
  sepia: {
    fondo: '#fbf6ec', 'fondo-suave': '#f5ecdc', pagina: '#efe6d5',
    texto: '#453423', 'texto-2': '#8a6534', 'texto-suave': '#8a7a63',
    primario: '#8a6534', acento: '#b8894a', 'card-1': '#f2e8d6',
    borde: '#e6dac5', 'borde-fuerte': '#d5c3a3', 'borde-papel': '#d9cdb7',
    'err-texto': '#a12626', 'err-fondo': '#f7e4e0',
    'barra-1': '#4a3820', 'barra-2': '#6f5230', 'barra-3': '#8a6534',
  },
  bosque: {
    fondo: '#ffffff', 'fondo-suave': '#f2f8f4', pagina: '#f1f6f2',
    texto: '#12321f', 'texto-2': '#2f6b45', 'texto-suave': '#5f7a6a',
    primario: '#2f6b45', acento: '#4c9e69', 'card-1': '#eaf4ee',
    borde: '#dcebe1', 'borde-fuerte': '#b3d6c1', 'borde-papel': '#cdd8d1',
    'err-texto': '#a12626', 'err-fondo': '#fcebeb',
    'barra-1': '#10301d', 'barra-2': '#22553a', 'barra-3': '#2f6b45',
  },
  grafito: {
    fondo: '#ffffff', 'fondo-suave': '#f6f7f8', pagina: '#f4f5f6',
    texto: '#1f2328', 'texto-2': '#4a5058', 'texto-suave': '#6e7781',
    primario: '#3a3f45', acento: '#6b7684', 'card-1': '#f0f1f3',
    borde: '#e3e5e8', 'borde-fuerte': '#c7cbd1', 'borde-papel': '#d0d4d9',
    'err-texto': '#a12626', 'err-fondo': '#fcebeb',
    'barra-1': '#22262b', 'barra-2': '#3a3f45', 'barra-3': '#565c64',
  },
  // No es decorativo: es de accesibilidad. Negro puro sobre blanco y bordes marcados, para quien no
  // distingue bien los grises suaves de las demás paletas.
  alto: {
    fondo: '#ffffff', 'fondo-suave': '#ffffff', pagina: '#ffffff',
    texto: '#000000', 'texto-2': '#00308f', 'texto-suave': '#333333',
    primario: '#00308f', acento: '#0047c7', 'card-1': '#f0f0f0',
    borde: '#767676', 'borde-fuerte': '#000000', 'borde-papel': '#000000',
    'err-texto': '#b00000', 'err-fondo': '#ffe8e8',
    'barra-1': '#000000', 'barra-2': '#001b52', 'barra-3': '#00308f',
  },
  rojo: {
    fondo: '#ffffff', 'fondo-suave': '#fdf5f4', pagina: '#faf2f1',
    texto: '#3d1512', 'texto-2': '#a32b20', 'texto-suave': '#8a6360',
    primario: '#a32b20', acento: '#d24436', 'card-1': '#fbebe9',
    borde: '#f6ddda', 'borde-fuerte': '#eeb8b1', 'borde-papel': '#d9cfcd',
    'err-texto': '#8a1f16', 'err-fondo': '#fbdedb',
    'barra-1': '#4a140f', 'barra-2': '#7d201a', 'barra-3': '#a32b20',
  },
  rosa: {
    fondo: '#ffffff', 'fondo-suave': '#fdf4f8', pagina: '#faf1f6',
    texto: '#3f1329', 'texto-2': '#a83a72', 'texto-suave': '#8d6779',
    primario: '#a83a72', acento: '#d55a97', 'card-1': '#fbe9f2',
    borde: '#f8dce9', 'borde-fuerte': '#f0b6d1', 'borde-papel': '#d9ccd3',
    'err-texto': '#a12626', 'err-fondo': '#fcebeb',
    'barra-1': '#48162e', 'barra-2': '#7d2a54', 'barra-3': '#a83a72',
  },
};

/** Cómo se agrupan los colores en el editor del tema personalizado. */
export const GRUPOS: { titulo: 'temas.grupo.generales' | 'temas.grupo.texto' | 'temas.grupo.acciones' | 'temas.grupo.bordes' | 'temas.grupo.errores' | 'temas.grupo.barra'; claves: (keyof Paleta)[] }[] = [
  { titulo: 'temas.grupo.generales', claves: ['fondo', 'fondo-suave', 'pagina'] },
  { titulo: 'temas.grupo.texto', claves: ['texto', 'texto-2', 'texto-suave'] },
  { titulo: 'temas.grupo.acciones', claves: ['primario', 'acento', 'card-1'] },
  { titulo: 'temas.grupo.bordes', claves: ['borde', 'borde-fuerte', 'borde-papel'] },
  // La barra superior es un degradado de tres pasos; poniendo los tres iguales queda lisa.
  { titulo: 'temas.grupo.barra', claves: ['barra-1', 'barra-2', 'barra-3'] },
  { titulo: 'temas.grupo.errores', claves: ['err-texto', 'err-fondo'] },
];

const CLAVE_LS = 'editorpdf.tema';
const CLAVE_LS_CUSTOM = 'editorpdf.tema.custom';

let actual: NombreTema = 'claro';
let custom: Paleta = { ...PALETAS.claro };

function leerGuardado(): void {
  try {
    const guardado = localStorage.getItem(CLAVE_LS) as NombreTema | null;
    if (guardado && (guardado === 'custom' || guardado in PALETAS)) actual = guardado;
    const guardadoCustom = localStorage.getItem(CLAVE_LS_CUSTOM);
    if (guardadoCustom) custom = { ...PALETAS.claro, ...JSON.parse(guardadoCustom) };
  } catch {
    /* localStorage bloqueado o JSON roto: se sigue con el tema claro */
  }
}

export function temaActual(): NombreTema {
  return actual;
}

/** La paleta que se está viendo, sea de un tema fijo o la personalizada. */
export function paletaActual(): Paleta {
  return actual === 'custom' ? custom : PALETAS[actual];
}

export function paletaCustom(): Paleta {
  return custom;
}

/** Escribe la paleta en el elemento raíz, que gana sobre lo que declara `:root` en style.css. */
function pintar(paleta: Paleta): void {
  for (const [clave, valor] of Object.entries(paleta)) {
    document.documentElement.style.setProperty(`--${clave}`, valor);
  }
  // La sombra de las miniaturas mezcla un color de la paleta con blancos fijos, así que se rearma
  // acá: si quedara la de `style.css`, en el tema oscuro seguiría dibujando una hoja blanca detrás.
  document.documentElement.style.setProperty(
    '--sombra-papel',
    `3px 3px 0 0 ${paleta.fondo}, 3px 3px 0 1px ${paleta['borde-papel']}, 2px 3px 5px rgba(4, 44, 83, 0.13)`
  );
}

/**
 * Pinta una paleta sin guardarla ni cambiar el tema elegido. Es el vistazo en vivo del editor del
 * tema personalizado: mientras se prueban colores no tiene que quedar nada asentado, para que
 * cancelar de verdad deshaga.
 */
export function previsualizar(paleta: Paleta): void {
  pintar(paleta);
}

/** Vuelve a pintar el tema que está elegido. Deshace lo que haya dejado `previsualizar`. */
export function repintar(): void {
  pintar(paletaActual());
}

export function aplicarTema(tema: NombreTema): void {
  actual = tema;
  pintar(paletaActual());
  try {
    localStorage.setItem(CLAVE_LS, tema);
  } catch {
    /* localStorage bloqueado: el tema vale para esta sesión y no sobrevive a recargar */
  }
}

/** Guarda y aplica los colores del tema personalizado. */
export function establecerCustom(paleta: Paleta): void {
  custom = paleta;
  try {
    localStorage.setItem(CLAVE_LS_CUSTOM, JSON.stringify(paleta));
  } catch {
    /* idem */
  }
  aplicarTema('custom');
}

/** Deja el tema guardado puesto. Se llama una vez al arrancar. */
export function iniciarTema(): void {
  leerGuardado();
  pintar(paletaActual());
}

/**
 * Dónde vive cada panel: acoplado a un costado, abajo, o flotando como una ventana suelta.
 *
 * Las tres piezas —campos, propiedades y la tira de hojas— son intercambiables: cada una puede
 * estar en cualquier ranura, y por eso todas tienen la misma cabecera. Lo que las distingue es
 * dónde arrancan y qué medida usan.
 *
 * Todo pasa por escribir variables CSS en la raíz (`--ancho-izq`, `--ancho-der`, `--alto-abajo`) y
 * mover el nodo de la pieza a la ranura que le toca: el arrastre y el colapso tocan lo mismo, así
 * que no pueden quedar peleados —que es lo que pasaría si el colapso fuera una clase de CSS y el
 * arrastre un estilo en línea, porque el estilo en línea le gana siempre a la clase.
 */

const CLAVE = 'editorpdf.columnas';

/** Lo que queda a la vista de una pieza colapsada: apenas su botón para volver a abrirla. */
const RIEL = 32;
const RIEL_ABAJO = 26;
const MINIMO = 150;
const MAXIMO = 460;
const MINIMO_ABAJO = 64;
const MAXIMO_ABAJO = 320;
/** A qué distancia del borde aparece la sombra de acople mientras se arrastra una ventana. */
const IMAN = 70;

export type Lugar = 'izq' | 'der' | 'abajo' | 'flotante';
type Nombre = 'campos' | 'props' | 'hojas';

interface Pieza {
  lugar: Lugar;
  colapsado: boolean;
  /** Ancho en los costados, alto abajo. Se guarda por lugar: una tira alta no define un panel ancho. */
  ancho: number;
  alto: number;
  /** Dónde y de qué tamaño quedó la ventana suelta la última vez. */
  x: number;
  y: number;
  anchoFlotante: number;
  altoFlotante: number;
}

type Estado = Record<Nombre, Pieza>;

function piezaPorDefecto(lugar: Lugar): Pieza {
  return { lugar, colapsado: false, ancho: 210, alto: 105, x: 120, y: 120, anchoFlotante: 230, altoFlotante: 280 };
}

function leerEstado(): Estado {
  const base: Estado = {
    campos: piezaPorDefecto('izq'),
    props: { ...piezaPorDefecto('der'), ancho: 230 },
    hojas: piezaPorDefecto('abajo'),
  };
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE) ?? '{}') as Partial<Estado>;
    for (const nombre of Object.keys(base) as Nombre[]) {
      if (guardado[nombre]) base[nombre] = { ...base[nombre], ...guardado[nombre] };
    }
    // Dos piezas no pueden compartir ranura: si un guardado viejo o a medias lo pide, la segunda
    // se manda a flotar en vez de dejar una encima de la otra.
    const ocupadas = new Set<Lugar>();
    for (const nombre of Object.keys(base) as Nombre[]) {
      const lugar = base[nombre].lugar;
      if (lugar === 'flotante') continue;
      if (ocupadas.has(lugar)) base[nombre].lugar = 'flotante';
      else ocupadas.add(lugar);
    }
    return base;
  } catch {
    return base;
  }
}

export function montarPaneles(raiz: HTMLElement): void {
  const layout = raiz.querySelector<HTMLElement>('#ed-layout');
  const flotantes = raiz.querySelector<HTMLElement>('#ed-flotantes');
  const sombra = raiz.querySelector<HTMLElement>('#ed-sombra-acople');
  if (!layout || !flotantes || !sombra) return;

  const estado = leerEstado();
  const nombres = Object.keys(estado) as Nombre[];
  const piezaDe = (nombre: Nombre) => raiz.querySelector<HTMLElement>(`#ed-pieza-${nombre}`)!;
  const ranuraDe = (lugar: Lugar) => raiz.querySelector<HTMLElement>(`#ed-ranura-${lugar}`);
  const quienEsta = (lugar: Lugar) => nombres.find((n) => estado[n].lugar === lugar);

  /** Refleja el estado entero: dónde está cada pieza, su medida, su colapso y sus botones. */
  const aplicar = (): void => {
    for (const nombre of nombres) {
      const pieza = estado[nombre];
      const nodo = piezaDe(nombre);
      const ranura = ranuraDe(pieza.lugar);

      // Mover el nodo, no clonarlo: adentro viven el lienzo de campos, el panel de propiedades y la
      // tira, con sus escuchas ya enganchadas.
      const destino = pieza.lugar === 'flotante' ? flotantes : ranura;
      if (destino && nodo.parentElement !== destino) destino.appendChild(nodo);

      nodo.classList.toggle('flotante', pieza.lugar === 'flotante');
      nodo.classList.toggle('colapsado', pieza.colapsado && pieza.lugar !== 'flotante');
      nodo.classList.toggle('horizontal', pieza.lugar === 'abajo');
      nodo.dataset.lugar = pieza.lugar;

      if (pieza.lugar === 'flotante') {
        nodo.style.left = `${pieza.x}px`;
        nodo.style.top = `${pieza.y}px`;
        nodo.style.width = `${pieza.anchoFlotante}px`;
        nodo.style.height = `${pieza.altoFlotante}px`;
      } else {
        nodo.style.cssText = '';
      }

      // Flotando, colapsar no significa nada: ese botón pasa a devolver la pieza a su lugar.
      const colapsar = nodo.querySelector<HTMLElement>('[data-accion="colapsar"]')!;
      colapsar.textContent =
        pieza.lugar === 'flotante' ? '⇥' : pieza.lugar === 'abajo' ? (pieza.colapsado ? '⌃' : '⌄') : flechaDeCostado(pieza);
      nodo.querySelector<HTMLElement>('[data-accion="desacoplar"]')!.hidden = pieza.lugar === 'flotante';
    }

    // Un costado sin pieza no ocupa lugar, y su separador tampoco.
    for (const lado of ['izq', 'der'] as const) {
      const quien = quienEsta(lado);
      const medida = quien ? (estado[quien].colapsado ? RIEL : estado[quien].ancho) : 0;
      layout.style.setProperty(`--ancho-${lado}`, `${medida}px`);
      // El separador se queda en su lugar aunque el costado esté vacío: es una columna del grid, y
      // sacarlo del flujo corre todas las demás —el panel del otro lado terminaba midiendo 5 px—.
      const separador = raiz.querySelector<HTMLElement>(`#ed-separador-${lado}`)!;
      separador.classList.toggle('inerte', !quien || estado[quien].colapsado);
    }

    const abajo = quienEsta('abajo');
    raiz.style.setProperty('--alto-abajo', `${abajo ? (estado[abajo].colapsado ? RIEL_ABAJO : estado[abajo].alto) : 0}px`);
    const sepAbajo = raiz.querySelector<HTMLElement>('#ed-separador-hojas')!;
    sepAbajo.classList.toggle('inerte', !abajo || estado[abajo].colapsado);
    sepAbajo.style.display = abajo ? '' : 'none';

    localStorage.setItem(CLAVE, JSON.stringify(estado));
  };

  /** La flecha apunta hacia donde va a moverse la pieza al tocarla. */
  const flechaDeCostado = (pieza: Pieza) =>
    pieza.lugar === 'izq' ? (pieza.colapsado ? '›' : '‹') : pieza.colapsado ? '‹' : '›';

  // ---------- Botones de cada pieza ----------

  for (const nombre of nombres) {
    const nodo = piezaDe(nombre);

    nodo.querySelector('[data-accion="colapsar"]')!.addEventListener('click', () => {
      const pieza = estado[nombre];
      // Flotando, este botón devuelve la pieza a su costado. Si el que tenía está ocupado, va al
      // que esté libre; si no hay ninguno, se queda flotando.
      if (pieza.lugar === 'flotante') {
        const libre = (['izq', 'der', 'abajo'] as const).find((l) => !quienEsta(l));
        if (libre) pieza.lugar = libre;
      } else {
        pieza.colapsado = !pieza.colapsado;
      }
      aplicar();
    });

    nodo.querySelector('[data-accion="desacoplar"]')!.addEventListener('click', () => {
      const pieza = estado[nombre];
      // Aparece donde estaba, no en el centro: así no hay que buscarla con la vista.
      const caja = nodo.getBoundingClientRect();
      pieza.x = Math.max(8, caja.left);
      pieza.y = Math.max(8, caja.top);
      pieza.anchoFlotante = Math.max(180, Math.round(caja.width));
      pieza.altoFlotante = Math.max(140, Math.round(caja.height));
      pieza.lugar = 'flotante';
      pieza.colapsado = false;
      aplicar();
    });

    arrastrarVentana(nombre, nodo);
    estirarVentana(nombre, nodo);
  }

  // ---------- Arrastrar una ventana suelta ----------

  function arrastrarVentana(nombre: Nombre, nodo: HTMLElement): void {
    const agarre = nodo.querySelector<HTMLElement>('.ed-pieza-head')!;
    agarre.addEventListener('pointerdown', (e) => {
      if (estado[nombre].lugar !== 'flotante' || (e.target as HTMLElement).closest('button')) return;
      e.preventDefault();
      agarre.setPointerCapture(e.pointerId);

      const pieza = estado[nombre];
      const desde = { x: pieza.x, y: pieza.y };
      const inicio = { x: e.clientX, y: e.clientY };
      let destino: Lugar | null = null;

      const mover = (m: PointerEvent) => {
        pieza.x = desde.x + (m.clientX - inicio.x);
        pieza.y = desde.y + (m.clientY - inicio.y);
        destino = bordeCercano(m.clientX, m.clientY, nombre);
        marcarSombra(destino);
        aplicar();
      };

      const soltar = () => {
        agarre.removeEventListener('pointermove', mover);
        agarre.removeEventListener('pointerup', soltar);
        removeEventListener('keydown', cancelar);
        marcarSombra(null);
        if (destino) acoplarEn(nombre, destino);
        else acomodarDentroDeLaPantalla(pieza);
        aplicar();
      };

      // Escape cancela: la ventana vuelve de donde salió, como en cualquier arrastre.
      const cancelar = (t: KeyboardEvent) => {
        if (t.key !== 'Escape') return;
        pieza.x = desde.x;
        pieza.y = desde.y;
        destino = null;
        soltar();
      };

      agarre.addEventListener('pointermove', mover);
      agarre.addEventListener('pointerup', soltar);
      addEventListener('keydown', cancelar);
    });
  }

  /** Estirar la ventana desde su esquina de abajo a la derecha. */
  function estirarVentana(nombre: Nombre, nodo: HTMLElement): void {
    const esquina = document.createElement('div');
    esquina.className = 'ed-pieza-esquina';
    nodo.appendChild(esquina);

    esquina.addEventListener('pointerdown', (e) => {
      if (estado[nombre].lugar !== 'flotante') return;
      e.preventDefault();
      e.stopPropagation();
      esquina.setPointerCapture(e.pointerId);

      const pieza = estado[nombre];
      const inicio = { x: e.clientX, y: e.clientY, ancho: pieza.anchoFlotante, alto: pieza.altoFlotante };

      const mover = (m: PointerEvent) => {
        pieza.anchoFlotante = Math.max(180, inicio.ancho + (m.clientX - inicio.x));
        pieza.altoFlotante = Math.max(120, inicio.alto + (m.clientY - inicio.y));
        aplicar();
      };
      const soltar = () => {
        esquina.removeEventListener('pointermove', mover);
        esquina.removeEventListener('pointerup', soltar);
      };
      esquina.addEventListener('pointermove', mover);
      esquina.addEventListener('pointerup', soltar);
    });
  }

  /**
   * A qué ranura iría la ventana si se soltara acá, o null si a ninguna.
   *
   * Un costado ocupado igual acepta: las dos piezas se intercambian. Abajo no, porque la tira y un
   * panel no son equivalentes —un panel abajo sería una franja de 100 px de alto— así que ahí solo
   * entra si está libre.
   */
  function bordeCercano(x: number, y: number, nombre: Nombre): Lugar | null {
    const caja = layout!.getBoundingClientRect();
    if (y > caja.bottom - IMAN && y < caja.bottom + IMAN * 2) {
      return quienEsta('abajo') && quienEsta('abajo') !== nombre ? null : 'abajo';
    }
    if (x < caja.left + IMAN) return 'izq';
    if (x > caja.right - IMAN) return 'der';
    return null;
  }

  function marcarSombra(destino: Lugar | null): void {
    sombra!.hidden = !destino;
    if (!destino) return;
    const caja = layout!.getBoundingClientRect();
    const estilo = sombra!.style;
    if (destino === 'abajo') {
      Object.assign(estilo, { left: `${caja.left}px`, width: `${caja.width}px`, top: `${caja.bottom + 6}px`, height: '96px' });
    } else {
      const ancho = 200;
      Object.assign(estilo, {
        left: `${destino === 'izq' ? caja.left : caja.right - ancho}px`,
        width: `${ancho}px`,
        top: `${caja.top}px`,
        height: `${caja.height}px`,
      });
    }
  }

  /** Acopla una pieza; si el lugar está ocupado, las dos cambian de lado. */
  function acoplarEn(nombre: Nombre, destino: Lugar): void {
    const inquilino = quienEsta(destino);
    const veniaDe = estado[nombre].lugar;
    if (inquilino && inquilino !== nombre) {
      // El que estaba se va al lugar que deja libre la que llega. Si la que llega venía flotando
      // no hay lugar que ceder, así que se lo manda a un costado libre: sacarlo a flotar sin que
      // nadie lo pidiera se siente como que la aplicación hizo cualquier cosa.
      const libre = veniaDe === 'flotante' ? (['izq', 'der', 'abajo'] as const).find((l) => l !== destino && !quienEsta(l)) : veniaDe;
      estado[inquilino].lugar = libre ?? 'flotante';
      if (estado[inquilino].lugar === 'flotante') {
        const caja = piezaDe(inquilino).getBoundingClientRect();
        estado[inquilino].x = Math.max(8, caja.left);
        estado[inquilino].y = Math.max(8, caja.top);
      }
    }
    estado[nombre].lugar = destino;
    estado[nombre].colapsado = false;
  }

  /** Que una ventana no quede fuera de la pantalla y no se pueda recuperar más. */
  function acomodarDentroDeLaPantalla(pieza: Pieza): void {
    pieza.x = Math.min(Math.max(8 - pieza.anchoFlotante + 60, pieza.x), innerWidth - 60);
    pieza.y = Math.min(Math.max(8, pieza.y), innerHeight - 40);
  }

  // ---------- Separadores de las ranuras acopladas ----------

  const arrastrarSeparador = (separador: HTMLElement, lado: 'izq' | 'der'): void => {
    separador.addEventListener('pointerdown', (e) => {
      const quien = quienEsta(lado);
      if (!quien || estado[quien].colapsado) return;
      e.preventDefault();
      // Capturar el puntero: si no, al pasar rápido sobre el lienzo se pierden los movimientos.
      separador.setPointerCapture(e.pointerId);
      separador.classList.add('arrastrando');

      const xInicial = e.clientX;
      const anchoInicial = estado[quien].ancho;

      const mover = (m: PointerEvent) => {
        // El costado derecho crece hacia la izquierda, así que su delta va al revés.
        const delta = lado === 'izq' ? m.clientX - xInicial : xInicial - m.clientX;
        estado[quien].ancho = Math.min(MAXIMO, Math.max(MINIMO, anchoInicial + delta));
        aplicar();
      };
      const soltar = () => {
        separador.classList.remove('arrastrando');
        separador.removeEventListener('pointermove', mover);
        separador.removeEventListener('pointerup', soltar);
      };

      separador.addEventListener('pointermove', mover);
      separador.addEventListener('pointerup', soltar);
    });
  };

  arrastrarSeparador(raiz.querySelector<HTMLElement>('#ed-separador-izq')!, 'izq');
  arrastrarSeparador(raiz.querySelector<HTMLElement>('#ed-separador-der')!, 'der');

  // La ranura de abajo crece hacia arriba, así que su delta va al revés que el de un costado.
  const separadorAbajo = raiz.querySelector<HTMLElement>('#ed-separador-hojas')!;
  separadorAbajo.addEventListener('pointerdown', (e) => {
    const quien = quienEsta('abajo');
    if (!quien || estado[quien].colapsado) return;
    e.preventDefault();
    separadorAbajo.setPointerCapture(e.pointerId);
    separadorAbajo.classList.add('arrastrando');

    const yInicial = e.clientY;
    const altoInicial = estado[quien].alto;

    const mover = (m: PointerEvent) => {
      estado[quien].alto = Math.min(MAXIMO_ABAJO, Math.max(MINIMO_ABAJO, altoInicial + (yInicial - m.clientY)));
      aplicar();
    };
    const soltar = () => {
      separadorAbajo.classList.remove('arrastrando');
      separadorAbajo.removeEventListener('pointermove', mover);
      separadorAbajo.removeEventListener('pointerup', soltar);
    };

    separadorAbajo.addEventListener('pointermove', mover);
    separadorAbajo.addEventListener('pointerup', soltar);
  });

  // Achicar la ventana del navegador puede dejar una pieza flotante fuera de la pantalla.
  addEventListener('resize', () => {
    for (const nombre of nombres) {
      if (estado[nombre].lugar === 'flotante') acomodarDentroDeLaPantalla(estado[nombre]);
    }
    aplicar();
  });

  aplicar();
}

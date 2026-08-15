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

export type Lugar = 'izq' | 'der' | 'abajo' | 'flotante' | 'cerrado';
type Nombre = 'campos' | 'props' | 'hojas' | 'capas';

interface Pieza {
  lugar: Lugar;
  /** En qué mitad del costado va: arriba (1) o abajo (2). Sin sentido fuera de los costados. */
  mitad: 1 | 2;
  /** Qué porcentaje del alto del costado ocupa, cuando comparte el costado con otra. */
  altoEnElCostado: number;
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

/** Todas las ranuras acopladas, en el orden en que se busca una libre. */
const RANURAS: { lugar: Lugar; mitad: 1 | 2 }[] = [
  { lugar: 'izq', mitad: 1 },
  { lugar: 'der', mitad: 1 },
  { lugar: 'izq', mitad: 2 },
  { lugar: 'der', mitad: 2 },
  { lugar: 'abajo', mitad: 1 },
];

/** Dónde nace cada barra, y a dónde vuelve al reabrirla o al restaurarlas. */
const LUGAR_ORIGINAL: Record<Nombre, { lugar: Lugar; mitad: 1 | 2 }> = {
  campos: { lugar: 'izq', mitad: 1 },
  props: { lugar: 'der', mitad: 1 },
  capas: { lugar: 'izq', mitad: 2 },
  hojas: { lugar: 'abajo', mitad: 1 },
};

function piezaPorDefecto(lugar: Lugar): Pieza {
  return { lugar, mitad: 1, altoEnElCostado: 50, colapsado: false, ancho: 210, alto: 105, x: 120, y: 120, anchoFlotante: 230, altoFlotante: 280 };
}

function leerEstado(): Estado {
  const base: Estado = {
    campos: piezaPorDefecto('izq'),
    props: { ...piezaPorDefecto('der'), ancho: 230 },
    capas: { ...piezaPorDefecto('izq'), ancho: 210, mitad: 2 },
    hojas: piezaPorDefecto('abajo'),
  };
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE) ?? '{}') as Partial<Estado>;
    for (const nombre of Object.keys(base) as Nombre[]) {
      if (guardado[nombre]) base[nombre] = { ...base[nombre], ...guardado[nombre] };
    }
    // Dos piezas no pueden compartir ranura: si un guardado viejo o a medias lo pide, la segunda
    // se manda a flotar en vez de dejar una encima de la otra.
    const ocupadas = new Set<string>();
    for (const nombre of Object.keys(base) as Nombre[]) {
      const { lugar, mitad } = base[nombre];
      if (lugar === 'flotante' || lugar === 'cerrado') continue;
      const clave = lugar === 'abajo' ? 'abajo' : lugar + mitad;
      if (ocupadas.has(clave)) base[nombre].lugar = 'flotante';
      else ocupadas.add(clave);
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
  const ranuraDe = (lugar: Lugar, mitad: 1 | 2) =>
    raiz.querySelector<HTMLElement>(lugar === 'abajo' ? '#ed-ranura-abajo' : `#ed-ranura-${lugar}-${mitad}`);
  /** Qué barra ocupa una ranura. Abajo hay una sola, así que la mitad no cuenta. */
  const quienEsta = (lugar: Lugar, mitad: 1 | 2 = 1) =>
    nombres.find((n) => estado[n].lugar === lugar && (lugar === 'abajo' || estado[n].mitad === mitad));

  /** Refleja el estado entero: dónde está cada pieza, su medida, su colapso y sus botones. */
  const aplicar = (): void => {
    for (const nombre of nombres) {
      const pieza = estado[nombre];
      const nodo = piezaDe(nombre);
      const ranura = ranuraDe(pieza.lugar, pieza.mitad);

      // Mover el nodo, no clonarlo: adentro viven el lienzo de campos, el panel de propiedades y la
      // tira, con sus escuchas ya enganchadas.
      const destino = pieza.lugar === 'flotante' ? flotantes : ranura;
      if (destino && nodo.parentElement !== destino) destino.appendChild(nodo);

      // Cerrada no se ve en ninguna parte; se vuelve a abrir desde el menú Ver.
      nodo.hidden = pieza.lugar === 'cerrado';
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
      // Se muestra siempre y más abajo se esconde solo el de la barra de abajo de un costado
      // compartido: sin esto, una barra que pasó por ahí se quedaba sin su botón para siempre.
      colapsar.hidden = false;
      colapsar.textContent =
        pieza.lugar === 'flotante' ? '⇥' : pieza.lugar === 'abajo' ? (pieza.colapsado ? '⌃' : '⌄') : flechaDeCostado(pieza);
      nodo.querySelector<HTMLElement>('[data-accion="desacoplar"]')!.hidden = pieza.lugar === 'flotante';
    }

    // El ancho del costado lo decide la barra más ancha de las dos, y el costado se va a cero solo
    // si está vacío del todo.
    for (const lado of ['izq', 'der'] as const) {
      const arriba = quienEsta(lado, 1);
      const abajoDelLado = quienEsta(lado, 2);
      const anchoDe = (quien?: Nombre) => (quien ? (estado[quien].colapsado ? RIEL : estado[quien].ancho) : 0);
      layout.style.setProperty(`--ancho-${lado}`, `${Math.max(anchoDe(arriba), anchoDe(abajoDelLado))}px`);

      // El separador se queda en su lugar aunque el costado esté vacío: es una columna del grid, y
      // sacarlo del flujo corre todas las demás —el panel del otro lado terminaba midiendo 5 px—.
      const separador = raiz.querySelector<HTMLElement>(`#ed-separador-${lado}`)!;
      separador.classList.toggle('inerte', !arriba && !abajoDelLado);

      // Colapsar es del costado entero, no de cada barra: quedan 32 px de ancho, y ahí no entran
      // dos listas ni tiene sentido tener una abierta y la otra no. Colapsado se ve un solo riel.
      const colapsado = !!arriba && estado[arriba].colapsado;
      if (abajoDelLado) piezaDe(abajoDelLado).hidden = colapsado || estado[abajoDelLado].lugar === 'cerrado';

      // El separador de adentro solo tiene sentido con las dos mitades ocupadas y desplegadas; si
      // no, la que esté ocupa el costado entero.
      const sub = raiz.querySelector<HTMLElement>(`#ed-separador-${lado}-sub`)!;
      const partido = !!arriba && !!abajoDelLado && !colapsado;
      sub.style.display = partido ? '' : 'none';
      raiz.style.setProperty(`--alto-${lado}-1`, partido ? `${estado[arriba].altoEnElCostado}%` : arriba ? '100%' : '0%');

      // Un solo botón de colapsar por costado: el de la barra de abajo desaparece.
      if (abajoDelLado) piezaDe(abajoDelLado).querySelector<HTMLElement>('[data-accion="colapsar"]')!.hidden = !!arriba;
    }

    const abajo = quienEsta('abajo');
    raiz.style.setProperty('--alto-abajo', `${abajo ? (estado[abajo].colapsado ? RIEL_ABAJO : estado[abajo].alto) : 0}px`);
    const sepAbajo = raiz.querySelector<HTMLElement>('#ed-separador-hojas')!;
    sepAbajo.classList.toggle('inerte', !abajo || estado[abajo].colapsado);
    sepAbajo.style.display = abajo ? '' : 'none';

    // El menú Ver es la única forma de recuperar una barra cerrada, así que tiene que decir la
    // verdad aunque se haya cerrado desde su propio botón.
    for (const check of raiz.querySelectorAll<HTMLInputElement>('[data-barra]')) {
      check.checked = estado[check.dataset.barra as Nombre].lugar !== 'cerrado';
    }

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
        const libre = RANURAS.find((r) => !quienEsta(r.lugar, r.mitad));
        if (libre) {
          pieza.lugar = libre.lugar;
          pieza.mitad = libre.mitad;
        }
      } else {
        // Colapsar es del costado entero: con 32 px de ancho no tiene sentido dejar una barra
        // abierta y la otra no, así que las dos que comparten costado van juntas.
        const colapsado = !pieza.colapsado;
        for (const otro of nombres) {
          if (estado[otro].lugar === pieza.lugar) estado[otro].colapsado = colapsado;
        }
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

    nodo.querySelector('[data-accion="cerrar"]')!.addEventListener('click', () => {
      estado[nombre].lugar = 'cerrado';
      aplicar();
    });

    arrastrarVentana(nombre, nodo);
    estirarVentana(nombre, nodo);
  }

  // ---------- Menú Ver: mostrar, ocultar y restaurar las barras ----------

  /** Devuelve una barra cerrada a su lugar de siempre, o a uno libre si ese está ocupado. */
  function abrir(nombre: Nombre): void {
    const suyo = LUGAR_ORIGINAL[nombre];
    if (!quienEsta(suyo.lugar, suyo.mitad)) {
      estado[nombre].lugar = suyo.lugar;
      estado[nombre].mitad = suyo.mitad;
    } else {
      // Su lugar de siempre está tomado: se busca cualquier ranura libre, y si no hay, flota.
      const libre = RANURAS.find((r) => !quienEsta(r.lugar, r.mitad));
      estado[nombre].lugar = libre?.lugar ?? 'flotante';
      estado[nombre].mitad = libre?.mitad ?? 1;
    }
    estado[nombre].colapsado = false;
  }

  for (const check of raiz.querySelectorAll<HTMLInputElement>('[data-barra]')) {
    check.addEventListener('change', () => {
      const nombre = check.dataset.barra as Nombre;
      if (check.checked) abrir(nombre);
      else estado[nombre].lugar = 'cerrado';
      aplicar();
    });
  }

  raiz.querySelector('#ed-restaurar-barras')!.addEventListener('click', () => {
    for (const nombre of nombres) {
      const suyo = LUGAR_ORIGINAL[nombre];
      estado[nombre] = { ...piezaPorDefecto(suyo.lugar), mitad: suyo.mitad, ancho: nombre === 'campos' ? 210 : 230 };
    }
    aplicar();
  });

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
      let destino: { lugar: Lugar; mitad: 1 | 2 } | null = null;

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
  /**
   * A qué ranura iría la ventana si se soltara acá, o null si a ninguna.
   *
   * Un costado tiene dos ranuras: la mitad de arriba y la de abajo. Con una sola barra en el
   * costado, el costado entero es su ranura y soltar en cualquier mitad la reemplaza o la parte,
   * según dónde caiga el puntero. Abajo hay una sola ranura y solo entra si está libre: un panel
   * de propiedades como franja de 100 px de alto no le sirve a nadie.
   */
  function bordeCercano(x: number, y: number, nombre: Nombre): { lugar: Lugar; mitad: 1 | 2 } | null {
    const caja = layout!.getBoundingClientRect();
    if (y > caja.bottom - IMAN && y < caja.bottom + IMAN * 2) {
      const ocupa = quienEsta('abajo');
      return ocupa && ocupa !== nombre ? null : { lugar: 'abajo', mitad: 1 };
    }
    const lado = x < caja.left + IMAN ? 'izq' : x > caja.right - IMAN ? 'der' : null;
    if (!lado) return null;
    return { lugar: lado, mitad: y < caja.top + caja.height / 2 ? 1 : 2 };
  }

  function marcarSombra(destino: { lugar: Lugar; mitad: 1 | 2 } | null): void {
    sombra!.hidden = !destino;
    if (!destino) return;
    const caja = layout!.getBoundingClientRect();
    const estilo = sombra!.style;
    if (destino.lugar === 'abajo') {
      Object.assign(estilo, { left: `${caja.left}px`, width: `${caja.width}px`, top: `${caja.bottom + 6}px`, height: '96px' });
      return;
    }

    // La sombra ocupa el costado entero si va a quedar sola ahí, o la mitad que corresponda si va a
    // compartirlo: es lo que hace entender de un vistazo que el costado se parte en dos.
    const otra = quienEsta(destino.lugar, destino.mitad === 1 ? 2 : 1);
    const alto = otra ? caja.height / 2 : caja.height;
    const ancho = 200;
    Object.assign(estilo, {
      left: `${destino.lugar === 'izq' ? caja.left : caja.right - ancho}px`,
      width: `${ancho}px`,
      top: `${caja.top + (otra && destino.mitad === 2 ? caja.height / 2 : 0)}px`,
      height: `${alto}px`,
    });
  }

  /** Acopla una barra en una ranura; si está ocupada, las dos se intercambian. */
  function acoplarEn(nombre: Nombre, destino: { lugar: Lugar; mitad: 1 | 2 }): void {
    const inquilino = quienEsta(destino.lugar, destino.mitad);
    const pieza = estado[nombre];
    const veniaDe = { lugar: pieza.lugar, mitad: pieza.mitad };

    if (inquilino && inquilino !== nombre) {
      // El que estaba se va al lugar que deja libre la que llega. Si la que llega venía flotando no
      // hay lugar que ceder, así que se lo manda a una ranura libre: sacarlo a flotar sin que nadie
      // lo pidiera se siente como que la aplicación hizo cualquier cosa.
      const libre =
        veniaDe.lugar === 'flotante' || veniaDe.lugar === 'cerrado'
          ? RANURAS.find((r) => !quienEsta(r.lugar, r.mitad))
          : veniaDe;
      estado[inquilino].lugar = libre?.lugar ?? 'flotante';
      estado[inquilino].mitad = libre?.mitad ?? 1;
      if (estado[inquilino].lugar === 'flotante') {
        const caja = piezaDe(inquilino).getBoundingClientRect();
        estado[inquilino].x = Math.max(8, caja.left);
        estado[inquilino].y = Math.max(8, caja.top);
      }
    }

    pieza.lugar = destino.lugar;
    pieza.mitad = destino.mitad;
    pieza.colapsado = false;
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

  /**
   * El separador de adentro de un costado reparte su alto entre las dos barras. Va en porcentaje y
   * no en píxeles para que el reparto se mantenga al cambiar el alto de la ventana.
   */
  const repartirCostado = (lado: 'izq' | 'der'): void => {
    const separador = raiz.querySelector<HTMLElement>(`#ed-separador-${lado}-sub`)!;
    separador.addEventListener('pointerdown', (e) => {
      const arriba = quienEsta(lado, 1);
      if (!arriba || !quienEsta(lado, 2)) return;
      e.preventDefault();
      separador.setPointerCapture(e.pointerId);
      separador.classList.add('arrastrando');

      const costado = raiz.querySelector<HTMLElement>(`#ed-costado-${lado}`)!.getBoundingClientRect();

      const mover = (m: PointerEvent) => {
        const parte = ((m.clientY - costado.top) / costado.height) * 100;
        // Con topes: una barra de 3 px de alto no sirve y además no se la puede volver a agarrar.
        estado[arriba].altoEnElCostado = Math.min(85, Math.max(15, parte));
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

  repartirCostado('izq');
  repartirCostado('der');

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

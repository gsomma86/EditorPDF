/**
 * Medida y colapso de los paneles laterales y de la tira de hojas.
 *
 * Todo pasa por escribir variables CSS en la raíz (`--ancho-izq`, `--ancho-der`, `--alto-hojas`):
 * el arrastre y el colapso tocan lo mismo, así que no pueden quedar peleados —que es lo que pasaría
 * si el colapso fuera una clase de CSS y el arrastre un estilo en línea, porque el estilo en línea
 * le gana siempre a la clase.
 */

const CLAVE = 'editorpdf.columnas';
/** Lo que queda a la vista de un panel colapsado: apenas su botón para volver a abrirlo. */
const RIEL = 32;
const MINIMO = 150;
const MAXIMO = 460;
/** La tira de hojas colapsada deja solo su botón; abierta, entre una miniatura y tres. */
const RIEL_HOJAS = 22;
const MINIMO_HOJAS = 64;
const MAXIMO_HOJAS = 320;

interface Estado {
  anchoIzq: number;
  anchoDer: number;
  izqColapsado: boolean;
  derColapsado: boolean;
  altoHojas: number;
  hojasColapsado: boolean;
}

function leerEstado(): Estado {
  const guardado = {
    anchoIzq: 210,
    anchoDer: 230,
    izqColapsado: false,
    derColapsado: false,
    altoHojas: 105,
    hojasColapsado: false,
  };
  try {
    return { ...guardado, ...JSON.parse(localStorage.getItem(CLAVE) ?? '{}') };
  } catch {
    return guardado;
  }
}

export function montarColumnas(raiz: HTMLElement): void {
  const layout = raiz.querySelector<HTMLElement>('.ed-layout');
  const panelIzq = raiz.querySelector<HTMLElement>('#ed-panel-izq');
  const panelDer = raiz.querySelector<HTMLElement>('#ed-panel-der');
  const hojas = raiz.querySelector<HTMLElement>('#ed-hojas');
  if (!layout || !panelIzq || !panelDer || !hojas) return;

  const estado = leerEstado();

  const aplicar = (): void => {
    layout.style.setProperty('--ancho-izq', `${estado.izqColapsado ? RIEL : estado.anchoIzq}px`);
    layout.style.setProperty('--ancho-der', `${estado.derColapsado ? RIEL : estado.anchoDer}px`);
    // La tira va fuera del layout de columnas, así que su alto se escribe en la raíz del editor.
    raiz.style.setProperty('--alto-hojas', `${estado.hojasColapsado ? RIEL_HOJAS : estado.altoHojas}px`);
    hojas.classList.toggle('colapsado', estado.hojasColapsado);
    raiz.querySelector('#ed-toggle-hojas')!.textContent = estado.hojasColapsado ? '⌃' : '⌄';
    raiz.querySelector('#ed-separador-hojas')!.classList.toggle('inerte', estado.hojasColapsado);
    panelIzq.classList.toggle('colapsado', estado.izqColapsado);
    panelDer.classList.toggle('colapsado', estado.derColapsado);
    // La flecha apunta hacia donde va a moverse el panel al tocarla.
    raiz.querySelector('#ed-toggle-izq')!.textContent = estado.izqColapsado ? '›' : '‹';
    raiz.querySelector('#ed-toggle-der')!.textContent = estado.derColapsado ? '‹' : '›';
    raiz.querySelector('#ed-separador-izq')!.classList.toggle('inerte', estado.izqColapsado);
    raiz.querySelector('#ed-separador-der')!.classList.toggle('inerte', estado.derColapsado);
    localStorage.setItem(CLAVE, JSON.stringify(estado));
  };

  raiz.querySelector('#ed-toggle-izq')!.addEventListener('click', () => {
    estado.izqColapsado = !estado.izqColapsado;
    aplicar();
  });
  raiz.querySelector('#ed-toggle-der')!.addEventListener('click', () => {
    estado.derColapsado = !estado.derColapsado;
    aplicar();
  });
  raiz.querySelector('#ed-toggle-hojas')!.addEventListener('click', () => {
    estado.hojasColapsado = !estado.hojasColapsado;
    aplicar();
  });

  const arrastrar = (separador: HTMLElement, lado: 'izq' | 'der'): void => {
    separador.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      // Capturar el puntero: si no, al pasar rápido sobre el lienzo se pierden los movimientos.
      separador.setPointerCapture(e.pointerId);
      separador.classList.add('arrastrando');

      const xInicial = e.clientX;
      const anchoInicial = lado === 'izq' ? estado.anchoIzq : estado.anchoDer;

      const mover = (m: PointerEvent) => {
        // El panel derecho crece hacia la izquierda, así que su delta va al revés.
        const delta = lado === 'izq' ? m.clientX - xInicial : xInicial - m.clientX;
        const ancho = Math.min(MAXIMO, Math.max(MINIMO, anchoInicial + delta));
        if (lado === 'izq') estado.anchoIzq = ancho;
        else estado.anchoDer = ancho;
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

  arrastrar(raiz.querySelector<HTMLElement>('#ed-separador-izq')!, 'izq');
  arrastrar(raiz.querySelector<HTMLElement>('#ed-separador-der')!, 'der');

  // La tira crece hacia arriba, así que su delta va al revés que el de una columna.
  const separadorHojas = raiz.querySelector<HTMLElement>('#ed-separador-hojas')!;
  separadorHojas.addEventListener('pointerdown', (e) => {
    if (estado.hojasColapsado) return;
    e.preventDefault();
    separadorHojas.setPointerCapture(e.pointerId);
    separadorHojas.classList.add('arrastrando');

    const yInicial = e.clientY;
    const altoInicial = estado.altoHojas;

    const mover = (m: PointerEvent) => {
      estado.altoHojas = Math.min(MAXIMO_HOJAS, Math.max(MINIMO_HOJAS, altoInicial + (yInicial - m.clientY)));
      aplicar();
    };
    const soltar = () => {
      separadorHojas.classList.remove('arrastrando');
      separadorHojas.removeEventListener('pointermove', mover);
      separadorHojas.removeEventListener('pointerup', soltar);
    };

    separadorHojas.addEventListener('pointermove', mover);
    separadorHojas.addEventListener('pointerup', soltar);
  });

  aplicar();
}

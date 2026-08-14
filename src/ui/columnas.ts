/**
 * Ancho y colapso de los paneles laterales.
 *
 * Todo pasa por escribir dos variables CSS en el layout (`--ancho-izq` y `--ancho-der`): el
 * arrastre y el colapso tocan lo mismo, así que no pueden quedar peleados —que es lo que pasaría
 * si el colapso fuera una clase de CSS y el arrastre un estilo en línea, porque el estilo en línea
 * le gana siempre a la clase.
 */

const CLAVE = 'editorpdf.columnas';
/** Lo que queda a la vista de un panel colapsado: apenas su botón para volver a abrirlo. */
const RIEL = 32;
const MINIMO = 150;
const MAXIMO = 460;

interface Estado {
  anchoIzq: number;
  anchoDer: number;
  izqColapsado: boolean;
  derColapsado: boolean;
}

function leerEstado(): Estado {
  const guardado = { anchoIzq: 210, anchoDer: 230, izqColapsado: false, derColapsado: false };
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
  if (!layout || !panelIzq || !panelDer) return;

  const estado = leerEstado();

  const aplicar = (): void => {
    layout.style.setProperty('--ancho-izq', `${estado.izqColapsado ? RIEL : estado.anchoIzq}px`);
    layout.style.setProperty('--ancho-der', `${estado.derColapsado ? RIEL : estado.anchoDer}px`);
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

  aplicar();
}

import { t } from './i18n';

export interface PanelCampos {
  obtenerCatalogo(): string[];
  establecerCatalogo(nombres: string[]): void;
}

const CLAVE_SECCIONES = 'editorpdf.secciones';

/**
 * Secciones plegables del panel: se hace clic en el encabezado y su cuerpo se esconde.
 *
 * Con una plantilla real el catálogo tiene cientos de campos, así que poder plegarlo es lo que
 * deja las herramientas de dibujo a la vista sin tener que buscarlas con la barra de desplazamiento.
 * Cuáles quedaron plegadas se recuerda, como el ancho de las barras.
 */
function montarSecciones(panel: HTMLElement): void {
  let plegadas: string[] = [];
  try {
    plegadas = JSON.parse(localStorage.getItem(CLAVE_SECCIONES) ?? '[]');
  } catch {
    plegadas = [];
  }

  const aplicar = (): void => {
    for (const encabezado of panel.querySelectorAll<HTMLElement>('[data-seccion]')) {
      const nombre = encabezado.dataset.seccion!;
      const plegada = plegadas.includes(nombre);
      encabezado.querySelector('.ed-col-ic')!.textContent = plegada ? '+' : '−';
      const cuerpo = panel.querySelector<HTMLElement>(`[data-cuerpo="${nombre}"]`);
      if (cuerpo) cuerpo.hidden = plegada;
    }
    localStorage.setItem(CLAVE_SECCIONES, JSON.stringify(plegadas));
  };

  for (const encabezado of panel.querySelectorAll<HTMLElement>('[data-seccion]')) {
    encabezado.addEventListener('click', () => {
      const nombre = encabezado.dataset.seccion!;
      plegadas = plegadas.includes(nombre) ? plegadas.filter((n) => n !== nombre) : [...plegadas, nombre];
      aplicar();
    });
  }

  aplicar();
}

export function montarPanelCampos(panel: HTMLElement, onColocar: (nombre: string) => void): PanelCampos {
  let catalogo: string[] = [];
  montarSecciones(panel);

  const contador = panel.querySelector<HTMLElement>('.ed-col-n')!;
  const input = panel.querySelector<HTMLInputElement>('#ed-campo-nuevo')!;
  const agregarBtn = panel.querySelector<HTMLButtonElement>('#ed-campo-agregar')!;
  const lista = panel.querySelector<HTMLElement>('#ed-lista-campos')!;
  const nota = panel.querySelector<HTMLElement>('.nota')!;

  function render(): void {
    contador.textContent = String(catalogo.length);
    nota.style.display = catalogo.length ? 'none' : '';

    lista.innerHTML = catalogo
      .map(
        (nombre, i) => `
        <div class="ed-campo-fila">
          <button type="button" class="ed-chip" data-colocar="${i}">${nombre}</button>
          <button type="button" class="quitar" data-quitar="${i}" data-i18n-title="campos.quitarTt" title="${t('campos.quitarTt')}">✕</button>
        </div>`
      )
      .join('');

    lista.querySelectorAll<HTMLButtonElement>('[data-colocar]').forEach((btn) => {
      btn.addEventListener('click', () => onColocar(catalogo[Number(btn.dataset.colocar)]));
    });
    lista.querySelectorAll<HTMLButtonElement>('[data-quitar]').forEach((btn) => {
      btn.addEventListener('click', () => {
        catalogo.splice(Number(btn.dataset.quitar), 1);
        render();
      });
    });
  }

  function agregar(): void {
    const nombre = input.value.trim();
    if (!nombre || catalogo.includes(nombre)) return;
    catalogo.push(nombre);
    input.value = '';
    render();
  }

  agregarBtn.addEventListener('click', agregar);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') agregar();
  });

  render();

  return {
    obtenerCatalogo: () => [...catalogo],
    establecerCatalogo: (nombres) => {
      catalogo = [...nombres];
      render();
    },
  };
}

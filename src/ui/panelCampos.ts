export function montarPanelCampos(panel: HTMLElement, onColocar: (nombre: string) => void): void {
  const catalogo: string[] = [];

  const contHead = panel.querySelector<HTMLElement>('.ed-col-n')!;
  const input = panel.querySelector<HTMLInputElement>('#ed-campo-nuevo')!;
  const agregarBtn = panel.querySelector<HTMLButtonElement>('#ed-campo-agregar')!;
  const lista = panel.querySelector<HTMLElement>('#ed-lista-campos')!;
  const nota = panel.querySelector<HTMLElement>('.nota')!;

  function actualizarContador(): void {
    contHead.textContent = String(catalogo.length);
    nota.style.display = catalogo.length ? 'none' : '';
  }

  function renderLista(): void {
    lista.innerHTML = catalogo
      .map(
        (nombre, i) => `
        <div class="ed-campo-fila" data-i="${i}">
          <button type="button" class="ed-chip" data-colocar="${i}">${nombre}</button>
          <button type="button" class="quitar" data-quitar="${i}" title="Quitar del catálogo">✕</button>
        </div>`
      )
      .join('');

    lista.querySelectorAll<HTMLButtonElement>('[data-colocar]').forEach((btn) => {
      btn.addEventListener('click', () => onColocar(catalogo[Number(btn.dataset.colocar)]));
    });
    lista.querySelectorAll<HTMLButtonElement>('[data-quitar]').forEach((btn) => {
      btn.addEventListener('click', () => {
        catalogo.splice(Number(btn.dataset.quitar), 1);
        renderLista();
        actualizarContador();
      });
    });
  }

  function agregar(): void {
    const nombre = input.value.trim();
    if (!nombre || catalogo.includes(nombre)) return;
    catalogo.push(nombre);
    input.value = '';
    renderLista();
    actualizarContador();
  }

  agregarBtn.addEventListener('click', agregar);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') agregar();
  });

  actualizarContador();
}

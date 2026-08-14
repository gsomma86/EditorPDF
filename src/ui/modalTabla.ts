let overlay: HTMLElement | null = null;

function montar(): HTMLElement {
  if (overlay) return overlay;
  overlay = document.createElement('div');
  overlay.className = 'ed-modal-overlay oculto';
  overlay.innerHTML = `
    <div class="ed-modal">
      <div class="ed-modal-tit">Insertar tabla</div>
      <div class="ed-modal-sub">Elegí cuántas filas y columnas tiene. El tamaño de cada celda se puede ajustar después arrastrando la esquina.</div>
      <div class="ed-modal-grid">
        <div><label class="ed-lbl">Filas</label><input type="number" id="ed-gr-filas" value="3" min="1" max="20"></div>
        <div><label class="ed-lbl">Columnas</label><input type="number" id="ed-gr-cols" value="3" min="1" max="10"></div>
      </div>
      <div class="ed-modal-acciones">
        <button type="button" id="ed-gr-cancelar">Cancelar</button>
        <button type="button" id="ed-gr-aplicar" class="primario">Insertar</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  return overlay;
}

export function pedirFilasColumnas(): Promise<{ filas: number; columnas: number } | null> {
  const el = montar();
  el.classList.remove('oculto');
  const filasInput = el.querySelector<HTMLInputElement>('#ed-gr-filas')!;
  const colsInput = el.querySelector<HTMLInputElement>('#ed-gr-cols')!;
  filasInput.value = '3';
  colsInput.value = '3';

  return new Promise((resolve) => {
    const cerrar = (resultado: { filas: number; columnas: number } | null) => {
      el.classList.add('oculto');
      cancelarBtn.removeEventListener('click', onCancelar);
      aplicarBtn.removeEventListener('click', onAplicar);
      resolve(resultado);
    };
    const onCancelar = () => cerrar(null);
    const onAplicar = () => cerrar({ filas: Number(filasInput.value), columnas: Number(colsInput.value) });

    const cancelarBtn = el.querySelector<HTMLButtonElement>('#ed-gr-cancelar')!;
    const aplicarBtn = el.querySelector<HTMLButtonElement>('#ed-gr-aplicar')!;
    cancelarBtn.addEventListener('click', onCancelar);
    aplicarBtn.addEventListener('click', onAplicar);
  });
}

/**
 * El puente con la pantalla de bienvenida de la versión de escritorio.
 *
 * **La misma compilación corre en el navegador y en Tauri**, así que todo lo de acá está detrás de
 * una comprobación: fuera del escritorio no existe `window.__TAURI__` y cada función no hace nada.
 * Por eso no se importa nada de `@tauri-apps/api` —sería una dependencia que en el navegador
 * sobra— y se usa el objeto global que Tauri inyecta con `withGlobalTauri`.
 *
 * Los tiempos (mínimo, tope y desvanecido) los maneja el proceso de Tauri, en `src-tauri/src/lib.rs`:
 * acá solo se avisa en qué anda el editor y cuándo terminó.
 */

interface VentanaTauri {
  onCloseRequested(fn: (evento: { preventDefault(): void }) => void | Promise<void>): Promise<unknown>;
  destroy(): Promise<unknown>;
}

interface ApiTauri {
  core: { invoke(comando: string, args?: Record<string, unknown>): Promise<unknown> };
  event: { emit(evento: string, carga?: unknown): Promise<unknown> };
  window: { getCurrentWindow(): VentanaTauri };
}

function tauri(): ApiTauri | null {
  return (globalThis as { __TAURI__?: ApiTauri }).__TAURI__ ?? null;
}

/** Si estamos dentro de la aplicación de escritorio. */
export function enEscritorio(): boolean {
  return tauri() !== null;
}

/**
 * Marca en qué paso del arranque va, para que la bienvenida lo muestre.
 *
 * Pasa por el proceso de Tauri y no por un evento suelto: el aviso sale apenas arranca el editor, y
 * la ventana de bienvenida puede no haber terminado de registrarse a escuchar. Guardándolo del
 * lado del proceso, ella lo consulta al abrir y no depende de haber llegado a tiempo.
 */
export function pasoDeArranque(clave: 'arranque' | 'editor'): void {
  void tauri()?.core.invoke('paso_arranque', { paso: clave });
}

/**
 * Avisa que el editor ya se puede mostrar. El proceso de Tauri desvanece la bienvenida y recién
 * entonces muestra la ventana principal.
 *
 * **Hay que llamarla antes de cualquier cuadro de diálogo.** El de "¿seguir donde dejaste?" sale al
 * arrancar, y con la ventana principal todavía oculta quedaría invisible: la aplicación parecería
 * colgada detrás de la bienvenida, esperando una respuesta que nadie puede dar.
 *
 * Se espera a que termine —la promesa resuelve cuando la ventana ya está a la vista— para que lo
 * que venga después ocurra con el editor visible.
 */
export async function editorListo(): Promise<void> {
  const api = tauri();
  if (!api) return;
  try {
    await api.core.invoke('editor_listo');
  } catch {
    // Si el comando fallara, el temporizador de respaldo del proceso de Tauri muestra la ventana
    // igual: no hay que dejar que un problema acá impida arrancar.
  }
}

/**
 * Si hay trabajo hecho que todavía no se guardó en un `.json`.
 *
 * En la versión de escritorio el editor **siempre abre en blanco** —no ofrece retomar lo anterior,
 * como Word o Excel—, así que esto es lo único que separa al usuario de perder lo que hizo al
 * cerrar la ventana. En el navegador no hace falta: ahí sigue existiendo el autoguardado y la
 * pregunta de "seguir donde dejaste".
 */
let cambiosSinGuardar = false;

export function marcarCambios(): void {
  cambiosSinGuardar = true;
}

/** Se llama al guardar el proyecto: desde ese momento no hay nada pendiente. */
export function marcarGuardado(): void {
  cambiosSinGuardar = false;
}

export function hayCambiosSinGuardar(): boolean {
  return cambiosSinGuardar;
}

/**
 * Intercepta el botón de cerrar de la ventana para ofrecer guardar antes de salir.
 *
 * `alGuardar` devuelve si el guardado se completó: si el usuario cancela el cuadro del nombre de
 * archivo, **no se cierra** — habría sido peor que no preguntar, porque se perdería el trabajo
 * justo después de haber pedido guardarlo.
 *
 * Cierra con `destroy()` y no volviendo a llamar a `close()`: `close()` dispararía otra vez este
 * mismo enganche y quedaría preguntando en círculos.
 */
export function cablearCierre(alGuardar: () => Promise<boolean>): void {
  const api = tauri();
  if (!api) return;

  const ventana = api.window.getCurrentWindow();
  void ventana.onCloseRequested(async (evento) => {
    if (!cambiosSinGuardar) return;

    // Se frena el cierre en todos los casos: se decide después, ya con la respuesta.
    evento.preventDefault();

    const { preguntarAlCerrar } = await import('./modales');
    const respuesta = await preguntarAlCerrar();
    if (respuesta === 'cancelar') return;
    if (respuesta === 'guardar' && !(await alGuardar())) return;

    cambiosSinGuardar = false;
    void ventana.destroy();
  });
}

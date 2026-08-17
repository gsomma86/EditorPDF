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
  event: {
    emit(evento: string, carga?: unknown): Promise<unknown>;
    listen<T>(evento: string, fn: (e: { payload: T }) => void): Promise<() => void>;
  };
  window: { getCurrentWindow(): VentanaTauri };
}

/** Lo que avisa el proceso cuando una descarga terminó de escribirse en disco. */
interface DescargaTerminada {
  ruta: string;
  ok: boolean;
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
 * El tope para dar la descarga por perdida. No es el tiempo que se espera —se espera el aviso real
 * del proceso— sino el plazo tras el cual, si nunca llegó, se prefiere **no cerrar** y avisar.
 * Perder el trabajo justo después de haber pedido guardarlo es la peor forma de fallar que tiene
 * esto, así que ante la duda la ventana se queda abierta.
 */
const TOPE_DESCARGA = 20000;

/**
 * Espera a que la descarga que está por empezar termine de escribirse.
 *
 * El oyente se registra **antes** de largar la descarga, a propósito: al revés hay una carrera —
 * registrarlo cruza el puente de Tauri y tarda, así que el aviso puede llegar antes de que haya
 * alguien escuchando. Es el mismo error que ya se había cometido con los pasos de la bienvenida.
 */
async function esperarDescarga(api: ApiTauri): Promise<Promise<DescargaTerminada | null>> {
  let resolver!: (r: DescargaTerminada | null) => void;
  const resultado = new Promise<DescargaTerminada | null>((r) => (resolver = r));

  const dejarDeEscuchar = await api.event.listen<DescargaTerminada>('descarga-terminada', (e) => {
    resolver(e.payload);
  });

  const reloj = setTimeout(() => resolver(null), TOPE_DESCARGA);
  void resultado.finally(() => {
    clearTimeout(reloj);
    dejarDeEscuchar();
  });

  return resultado;
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

    const { preguntarAlCerrar, mostrarGuardando, mostrarAyuda } = await import('./modales');
    const { t } = await import('./i18n');
    const respuesta = await preguntarAlCerrar();
    if (respuesta === 'cancelar') return;

    if (respuesta === 'guardar') {
      // El oyente primero, la descarga después: ver `esperarDescarga`.
      const descarga = await esperarDescarga(api);

      if (!(await alGuardar())) return;

      // Guardar baja un archivo y eso lleva su tiempo. Cerrar antes lo dejaría a medio escribir,
      // así que se espera el aviso del proceso —no un plazo— con el cartel a la vista.
      const cartel = mostrarGuardando();
      const fin = await descarga;
      cartel.cerrar();

      // Sin confirmación no se cierra: es preferible una ventana que se queda abierta a un archivo
      // que nunca existió. El usuario puede volver a intentar o salir sin guardar a conciencia.
      if (!fin || !fin.ok) {
        await mostrarAyuda(t('cerrar.noSeGuardoTitulo'), `<p>${t('cerrar.noSeGuardoMensaje')}</p>`);
        return;
      }

      await mostrarAyuda(t('cerrar.guardadoTitulo'), `<p>${t('cerrar.guardadoMensaje')}</p><p><code>${fin.ruta}</code></p>`);
    }

    cambiosSinGuardar = false;
    void ventana.destroy();
  });
}

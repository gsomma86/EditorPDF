use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager};

/// Cuánto se muestra la bienvenida como mínimo. Sin esto, en una máquina rápida aparecería y
/// desaparecería de golpe, que se ve peor que no tenerla.
const MINIMO: Duration = Duration::from_millis(2000);

/// El tope: si el editor nunca avisa que está listo —porque falló algo—, igual se muestra la
/// ventana en vez de dejar la aplicación colgada para siempre detrás de la bienvenida.
const TOPE: Duration = Duration::from_millis(5000);

/// Lo que dura el desvanecido. Tiene que coincidir con la transición de `splash.html`: acá se
/// espera a que termine antes de cerrar la ventana, y si se cortara antes se vería el salto.
const DESVANECIDO: Duration = Duration::from_millis(750);

/// Estado compartido entre el aviso del editor y el temporizador de respaldo.
struct Bienvenida {
    arranque: Instant,
    /// Que no la cierren dos veces: el editor puede avisar justo cuando salta el tope.
    cerrada: AtomicBool,
    /// En qué paso del arranque va.
    ///
    /// Lo guarda el proceso y no la ventana de bienvenida a propósito: el editor avisa apenas
    /// arranca, y para entonces la ventana puede no haber terminado de registrarse a escuchar
    /// —registrar un oyente cruza el puente de Tauri y tarda—. Con el estado acá, la ventana lo
    /// consulta al abrir y no depende de haber llegado a tiempo.
    paso: Mutex<String>,
}

/// Desvanece la bienvenida y muestra el editor. Es idempotente.
async fn terminar(app: &AppHandle, estado: &Bienvenida) {
    if estado.cerrada.swap(true, Ordering::SeqCst) {
        return;
    }

    // Lo que falte para el mínimo. `saturating_sub` para el caso normal, en que ya se cumplió.
    let pasado = estado.arranque.elapsed();
    if pasado < MINIMO {
        tokio::time::sleep(MINIMO - pasado).await;
    }

    if let Some(splash) = app.get_webview_window("splash") {
        // Primero se desvanece, después se cierra: la ventana principal aparece recién al final,
        // así que nunca se ve una hoja en blanco ni un salto entre las dos.
        let _ = splash.emit("splash-desvanecer", ());
        tokio::time::sleep(DESVANECIDO).await;
        let _ = splash.close();
    }

    if let Some(principal) = app.get_webview_window("principal") {
        let _ = principal.show();
        let _ = principal.set_focus();
    }
}

/// La llama el editor al pasar de un paso del arranque al siguiente.
#[tauri::command]
fn paso_arranque(paso: String, app: AppHandle, estado: tauri::State<'_, Arc<Bienvenida>>) {
    if let Ok(mut actual) = estado.paso.lock() {
        *actual = paso.clone();
    }
    let _ = app.emit("splash-paso", paso);
}

/// La consulta la ventana de bienvenida al abrir, por si el aviso llegó antes que ella.
#[tauri::command]
fn paso_actual(estado: tauri::State<'_, Arc<Bienvenida>>) -> String {
    estado
        .paso
        .lock()
        .map(|p| p.clone())
        .unwrap_or_else(|_| "arranque".into())
}

/// La llama el editor cuando terminó de cargar y ya puede mostrarse.
///
/// Es importante que la llame **antes** de cualquier cuadro de diálogo: el de "¿seguir donde
/// dejaste?" sale al arrancar, y con la ventana principal todavía oculta quedaría invisible y la
/// aplicación parecería colgada detrás de la bienvenida.
#[tauri::command]
async fn editor_listo(app: AppHandle, estado: tauri::State<'_, Arc<Bienvenida>>) -> Result<(), ()> {
    let estado = estado.inner().clone();
    terminar(&app, &estado).await;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![editor_listo, paso_arranque, paso_actual])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            let estado = Arc::new(Bienvenida {
                arranque: Instant::now(),
                cerrada: AtomicBool::new(false),
                paso: Mutex::new("arranque".into()),
            });
            app.manage(estado.clone());

            // El respaldo por si el aviso nunca llega.
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                tokio::time::sleep(TOPE).await;
                terminar(&handle, &estado).await;
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

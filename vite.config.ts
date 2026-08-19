import { defineConfig } from 'vite';

export default defineConfig({
  // `src-tauri/target` es la salida del build de Rust: archivos que se bloquean mientras Cargo
  // compila. Vite los vigilaba igual y un `.exe` bloqueado por Windows tiraba abajo el server
  // entero con EBUSY (sin este ignore, un `cargo build` corriendo en paralelo puede repetirlo).
  server: {
    watch: {
      ignored: ['**/src-tauri/target/**'],
    },
  },
});

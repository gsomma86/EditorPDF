// Sin esto, la version de release abre ademas una ventana de consola en Windows.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
  editorpdf_lib::run();
}

# Editor PDF (nombre provisorio)

Editor de PDF real, gratuito y open source — al estilo Sejda PDF / Nitro PDF / GoPDF. Pensado para
editar PDFs preexistentes (no solo generarlos desde cero): texto, formularios AcroForm, dibujo,
líneas, tablas, texto fijo, códigos QR.

## Por qué

Nace de las limitaciones de un editor público anterior (proyecto cerrado/propietario), que solo podía
generar y anotar PDFs pero no editar el contenido real de un PDF creado en otra herramienta — esa
capacidad requiere motores con licencia AGPL, inviables en un producto cerrado. Este proyecto es open
source desde el día uno, así que esa restricción no aplica.

## Stack

- **Motor PDF**: [pdf.js](https://github.com/mozilla/pdf.js) (render/extracción) + [mupdf.js](https://github.com/ArtifexSoftware/mupdf.js) (edición real de contenido existente) + [pdf-lib](https://github.com/Hopding/pdf-lib) (operaciones de bajo nivel: AcroForm, páginas, metadata).
- **App**: TypeScript + Vite + [Fabric.js](http://fabricjs.com/) para la superficie de edición interactiva.
- **Escritorio**: empaquetado con [Tauri](https://tauri.app/) sobre el mismo frontend web, sin backend propio.

Todo corre 100% del lado del cliente (WASM en el navegador o en Tauri) — no requiere servidor.

## Estado

En desarrollo — Fase 1 (MVP) en curso. Ver [ROADMAP.md](ROADMAP.md) para el detalle de fases.

## Licencia

[AGPL-3.0](LICENSE) — heredada de `mupdf.js`. Cualquiera que reciba este software (compilado o no)
tiene derecho a pedir el código fuente completo correspondiente a esa versión.

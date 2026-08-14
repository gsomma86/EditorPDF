# Roadmap

Rondas cortas iterativas, con el objetivo final de llegar a paridad funcional con Sejda PDF / Nitro PDF /
GoPDF. Alcance de fondo: **todas las funciones del editor público de ReciboMail, más la capacidad de
editar el contenido de PDFs preexistentes** (texto y, más adelante, dibujo vectorial).

## Fase 0 — Spike de motor (listo)

- [x] Validar edición real de texto preexistente (mupdf.js: `Redact` + `applyRedaction`)
- [x] Validar edición quirúrgica de una forma existente en un PDF nacido de HTML (patch de rect en el content stream)

### Hallazgos del spike (no re-investigar)

- **Ningún motor hace "reflow" real de PDF.** Acrobat, MuPDF, PDFBox y OnlyOffice hacen todos lo
  mismo por debajo: borrar/tapar los glifos originales e insertar texto nuevo posicionado igual. La
  diferencia está en *dónde*: dentro del content stream real (MuPDF) o como capa superpuesta.
- **mupdf.js (AGPL, WASM, sin backend) es el único camino confirmado** para editar texto
  preexistente in-place. PDFium no expone edición real en sus envoltorios JS; PDFBox necesita JVM;
  pdf-lib no soporta editar texto existente.
- **Editar formas existentes es viable en PDFs nacidos de HTML.** Se verificó sobre un recibo real:
  esos PDFs dibujan cada línea/fondo como un rectángulo relleno independiente (`x y w h re` + `f`),
  así que se puede ubicar el operador exacto en el content stream, reemplazarlo y reescribir el PDF
  sin tocar el resto. Confirmado moviendo y engrosando una línea puntual entre 580 rectángulos.
  El caso general (curvas y paths compuestos, tipo Illustrator) sigue siendo incierto.
- **mupdf.js expone `Device`** (con callbacks `fillPath`, `strokePath`, `fillText`, `fillImage`),
  o sea que se puede recorrer una página objeto por objeto. Lo que **no** existe listo para usar es
  volver a serializar una forma editada dentro del content stream: eso hay que construirlo.

## Fase 1 — MVP (en curso)

Paridad con el editor público actual, mejorando sus limitaciones conocidas (rendimiento, undo/redo).

- [x] Shell de la app: encabezado, barra de menús, layout de paneles, barra de estado
- [x] Lienzo en blanco (Fabric.js) con tamaño de página real en puntos
- [x] Herramientas de dibujo: Texto, Línea, Recuadro, QR (crear, seleccionar, editar propiedades, eliminar)
- [x] Herramientas de dibujo: Tabla, Imagen
- [x] Campos AcroForm (panel izquierdo: catálogo de IDs, colocar como campo interactivo en la hoja) — falta el modo "repetible" (comodín #, expansión en filas)
- [x] Deshacer / rehacer (Ctrl+Z / Ctrl+Y)
- [ ] Modal Nuevo proyecto (tamaño, orientación, márgenes) — el modal ya existe en el mockup
- [ ] Cambiar tamaño/orientación/fondo de página desde el menú Página
- [ ] Guardar proyecto (.json) / Importar proyecto (.json)
- [ ] **Exportar PDF** (con AcroForm real, vía `pdf-lib`). Lo más importante que falta. Requiere
      `@pdf-lib/fontkit` para incrustar las fuentes web — hoy se pueden elegir y ver en pantalla,
      pero todavía no viajan al PDF.
- [ ] Selección múltiple (Ctrl/Shift y recuadro de arrastre) y sus acciones de grupo
- [ ] Menú Ver: cuadrícula, reglas, guías de alineación (los checkboxes existen, no hacen nada)
- [ ] Zoom (el control de la barra de estado existe, no hace nada)
- [ ] Autoguardado en localStorage (la barra de estado ya lo anuncia)
- [ ] Importar/exportar catálogo de campos en CSV
- [ ] Modo "Completar campos"
- [ ] Verificar diseño (preflight) y cálculo de peso del PDF
- [ ] Modales de Ayuda (guía rápida, atajos, FAQ, acerca de)
- [ ] Multiidioma ES/EN/PT (el editor público lo tiene; el selector ya está en el encabezado)
- [ ] Rendimiento con documentos grandes

## Fase 2 — Edición real de texto preexistente

- [ ] Abrir un PDF de otra herramienta (mupdf.js)
- [ ] Detectar y editar texto existente in-place (Redact + reinserción con la fuente original o de reemplazo)
- [ ] Manejo de fuentes subseteadas (fallback cuando falta un glifo)

## Fase 3 — Edición real de formas preexistentes

- [ ] Detectar formas/líneas existentes (rects del content stream, caso validado en el spike)
- [ ] UI de selección/edición sobre esas formas (mover, redimensionar, recolorear, borrar)
- [ ] Evaluar el caso general de paths/curvas complejas (mayor riesgo, no confirmado)

## Fase 4 — Avanzado

- [ ] Capas
- [ ] Multi-página real (insertar, reordenar, eliminar páginas)
- [ ] Firma digital
- [ ] Más formas geométricas

## Fase 5 — Empaquetado y distribución

- [ ] Build de escritorio con Tauri
- [ ] Explorar alternativa gratuita para evitar el cartel de SmartScreen
- [ ] Pulir README / documentación de contribución

# Roadmap

Rondas cortas iterativas, con el objetivo final de llegar a paridad funcional con Sejda PDF / Nitro PDF /
GoPDF. Alcance de fondo: **todas las funciones del editor público de ReciboMail, más la capacidad de
editar el contenido de PDFs preexistentes** (texto y, más adelante, dibujo vectorial).

## Fase 0 — Spike de motor (listo)

- [x] Validar edición real de texto preexistente (mupdf.js: `Redact` + `applyRedaction`)
- [x] Validar edición quirúrgica de una forma existente en un PDF nacido de HTML (patch de rect en el content stream)

## Fase 1 — MVP (en curso)

Paridad con el editor público actual, mejorando sus limitaciones conocidas (rendimiento, undo/redo).

- [x] Shell de la app: encabezado, barra de menús, layout de paneles, barra de estado
- [x] Lienzo en blanco (Fabric.js) con tamaño de página real en puntos
- [x] Herramientas de dibujo: Texto, Línea, Recuadro, QR (crear, seleccionar, editar propiedades, eliminar)
- [x] Herramientas de dibujo: Tabla, Imagen
- [ ] Campos AcroForm (panel izquierdo: catálogo de IDs, colocar como campo interactivo en la hoja)
- [ ] Deshacer / rehacer
- [ ] Modal Nuevo proyecto (tamaño, orientación, márgenes)
- [ ] Guardar proyecto (.json) / Importar proyecto (.json)
- [ ] Exportar PDF (con AcroForm real, vía `pdf-lib`)
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

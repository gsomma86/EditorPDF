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
- [x] Modal Nuevo proyecto (tamaño, orientación, márgenes)
- [x] Cambiar tamaño/orientación de página desde el menú Página, y márgenes visibles en la hoja
- [x] Fondo de página con **imagen**. El caso "PDF" queda para la fase 2: es en realidad su puerta
      de entrada.
- [x] Guardar proyecto (.json) / Importar proyecto (.json)
- [x] **Exportar PDF** con AcroForm real, vía `pdf-lib`. Opción de exportar aplanado. Verificado
      contra el lienzo con `npm run verificar-export`: texto, líneas (incluidas las rotadas),
      recuadros, tablas, QR y campos caen en el PDF exactamente donde se ven en pantalla.
- [ ] **Incrustar de verdad las fuentes web al exportar.** Hoy se incrusta el `.woff2` tal cual y
      un PDF no admite fuentes comprimidas: el visor las descarta y sustituye por otra. Hay que
      descomprimir a sfnt antes de embeber (los `.woff` v1 de `@fontsource` son zlib) o sumar
      `.ttf`. Ver la lección 12 en CLAUDE.md.
- [ ] Revisar la posición vertical del texto exportado: medido headless queda ~0,17 × el cuerpo
      más arriba que en el lienzo (7 pt con cuerpo 40), pero la medición usa fuentes sustituidas,
      así que falta confirmarlo en el navegador con una fuente real antes de tocar nada.
- [x] Selección múltiple (Ctrl/Shift y recuadro de arrastre) y sus acciones de grupo
- [x] Menú Ver: cuadrícula con enganche, reglas, guías de alineación
- [x] Zoom (25%–300%)
- [x] Autoguardado en localStorage, con opción de retomar al abrir
- [x] Importar/exportar catálogo de campos en CSV
- [x] Verificar diseño (preflight) y peso real del PDF
- [x] Modo "Completar campos": cada campo se vuelve una caja editable sobre la hoja para escribirle
      un valor y ver cómo queda
- [x] Modales de Ayuda (guía rápida, atajos, FAQ, acerca de), en `ui/ayuda.ts`
- [x] Campo repetible con comodín `#` (expansión en filas) — completa AcroForm
- [x] Rotación en todos los elementos, con control en el panel y en la selección múltiple
- [x] Texto vertical (una letra por renglón), separación entre renglones y texto de varias líneas
- [x] Atajos que faltaban: copiar/cortar/pegar, seleccionar todo, borrar, mover con las flechas,
      y los ítems del menú Editar cableados a las mismas funciones
- [x] Paneles laterales colapsables y de ancho ajustable con el mouse, recordado entre sesiones
- [x] Rendimiento con documentos grandes — **medido, no hace falta optimizar**. Con
      `npm run medir-rendimiento`: 1000 elementos (5 hojas A4 llenas) arman en 86 ms y redibujan
      en ~21 ms, o sea unos 48 cuadros por segundo. Una hoja llena de verdad ronda los 200.
- [x] Multiidioma ES/EN/PT — `ui/i18n.ts` (diccionario + `data-i18n*` + selector en el encabezado),
      cableado en `shell.ts`, `modales.ts`, `panelPropiedades.ts`, `panelCampos.ts`, `main.ts` y los
      textos largos de `ayuda.ts`. Falta: probar el selector en el navegador (no se probó todavía)

## Fase 2 — Edición real de texto preexistente

- [x] **Abrir un PDF de otra herramienta y verlo.** Archivo → Abrir PDF: se lee con pdf.js, la hoja
      toma las medidas de su primera página y esa página queda de fondo, así que ya se puede
      dibujar y poner campos encima. Los bytes originales quedan en memoria (`pdfExistente.ts`),
      que son la materia prima del paso siguiente. Falta: más de una página (hoy solo la primera).
- [x] **Detectar y editar texto existente in-place.** Doble clic sobre un texto del PDF: se borra
      del contenido real con una redacción de mupdf —no se tapa, `npm run verificar-pdf` lo
      comprueba— y en su lugar queda un texto del diseño, editable como cualquier otro. Al
      exportar, el PDF editado es la base, así que lo que ya traía sigue siendo vectorial.
- [ ] Afinar el reemplazo: hoy el texto nuevo se coloca estimando la ascendente en 0,75 × el
      cuerpo, y usa la tipografía elegida en el panel en vez de la original del PDF
- [ ] Manejo de fuentes subseteadas (fallback cuando falta un glifo)
- [x] Que el PDF de base no se pierda: se guarda en IndexedDB para sobrevivir a una recarga y
      viaja dentro del `.json` al guardar el proyecto, para poder seguirlo en otra computadora.

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

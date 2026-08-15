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
- [x] Fondo de página con **imagen** y con **PDF** (14/08/2026). La opción "PDF" del selector de
      fondo reusa entero el camino de Archivo → Abrir PDF, con su aviso previo si hay algo
      dibujado: no es una copia más corta a propósito, porque un PDF de fondo además de verse
      queda de base al exportar, así que lo que ya traía sigue siendo vectorial en vez de una foto.
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
      que son la materia prima del paso siguiente.
- [x] **Multipágina.** El motor trabaja sobre cualquier página, no solo la primera: la página 0
      estaba escrita a mano en cinco lugares (rasterizado, lectura de textos, redacción, lectura de
      campos, exportación) y ahora hay una sola página elegida (`paginaDelPdf()`) que usan todos.
      `abrirPdf(archivo, pagina = 0)` (segundo parámetro nuevo y opcional) y `elegirPagina(i)`
      cambian de página; el exportador dibuja sobre esa y no siempre la 0. Selector en la barra de
      estado, al lado del tamaño de hoja, visible solo si el PDF tiene más de una; si hay algo
      dibujado en la hoja, avisa antes de cambiar, porque `elegirPagina()` no toca el diseño a
      propósito (quedó puesto sobre la página anterior). Verificado con un PDF de 33 páginas: abre
      en la 1, elegir la 3 cambia fondo y textos, y al exportar la salida conserva las 33, con la
      marca solo en la 3. **Ojo con la numeración**: pdf.js cuenta desde 1; mupdf, pdf-lib y el
      módulo, desde 0. La página elegida se persiste junto al PDF (IndexedDB) y dentro del `.json`
      del proyecto, así que retomar una sesión o abrirlo en otra computadora vuelve a la misma
      página (lo guardado antes de esto se sigue leyendo, como página 0).
- [x] **Bug encontrado al cerrar el punto anterior: retomar una sesión borraba el PDF de base
      entero, justo antes de recuperarlo.** `restaurarAutoguardado` pasa por `cargarProyecto`,
      que soltaba el PDF abierto si el proyecto no traía uno adentro — correcto al *importar* un
      `.json` (ahí si no trae PDF es porque no tiene), pero el autoguardado nunca trae el PDF
      —vive aparte, en IndexedDB, porque localStorage no lo aguanta— así que en cada recarga lo
      borraba antes de que `recuperarPdfGuardado()` pudiera leerlo. `cargarProyecto` ahora recibe
      si hay que conservar el PDF vigente, y el autoguardado lo pide. Verificado con un PDF de 33
      páginas, en la página 3: antes de esto, recargar perdía el PDF, volvía a la página 1 y no
      quedaba ningún texto editable; ahora recupera el PDF, sigue en la página 3, y sus 63 textos.
- [x] **Detectar y editar texto existente in-place.** Doble clic sobre un texto del PDF: se borra
      del contenido real con una redacción de mupdf —no se tapa, `npm run verificar-pdf` lo
      comprueba— y en su lugar queda un texto del diseño, editable como cualquier otro. Al
      exportar, el PDF editado es la base, así que lo que ya traía sigue siendo vectorial.
- [x] Afinar la posición del reemplazo: la ascendente estimada en 0,75 × el cuerpo daba 2 pt de
      error contra el original; ahora se mide embebiendo la fuente igual que al exportar (misma
      cuenta en los dos lados, no se pueden desincronizar) y sin redondear — la ascendente real
      tiene decimales (28,72 pt para Helvetica 40) y redondear ya metía 1 pt de error solo
- [x] Usar la tipografía original del PDF en el reemplazo, en vez de la elegida en el panel. La
      `family` que reporta mupdf no es confiable (una Open Sans incrustada la clasifica como
      `serif`), así que se usa el nombre en cambio, pelando antes el prefijo de subconjunto, la
      variante y el número (`OpenSans-Bold-9742`, `ABCDEF+TimesNewRoman,Bold`). Para las conocidas
      sin equivalente exacto: Arial/Verdana → Helvetica, Times New Roman/Georgia → Times, Courier
      New/Consolas → Courier. Verificado con 9 casos de nombre y en el navegador de punta a punta.
- [x] Manejo de fuentes subseteadas — resuelto distinto de lo previsto: no hay error al exportar,
      los caracteres fuera del alfabeto latino salían como `?` en silencio. No se intenta sustituir
      la tipografía (ninguna de las que trae el editor cubre otros alfabetos); en cambio,
      **Verificar diseño** avisa antes de exportar cuáles caracteres no se pueden dibujar.
- [x] Que el PDF de base no se pierda: se guarda en IndexedDB para sobrevivir a una recarga y
      viaja dentro del `.json` al guardar el proyecto, para poder seguirlo en otra computadora.
- [x] **Importar los campos AcroForm de un PDF abierto** (nuevo, 14/08/2026 — reemplaza a la fase 3
      de v1, ver más abajo por qué). Al hacer Archivo → Abrir PDF, además del fondo se leen sus
      campos de formulario (nombre, posición, tamaño, tipo, color, borde, fondo) y entran ya
      colocados como elementos 'campo' del editor, listos para editar en un paso, y se suman al
      catálogo del panel izquierdo sin duplicar nombres. Lo que el editor no representa (casillas,
      listas, firmas) se avisa con el motivo. Probado contra una plantilla real: 59 campos, 0
      omitidos, coinciden en posición y tamaño con mupdf. `camposDelPdf()` en `pdfExistente.ts`.

## Fase 3 — Edición real de formas preexistentes (en pausa)

**En pausa (14/08/2026): validada contra 8 PDF reales y no tiene caso de uso hoy.** El bosquejo se
corrigió una vez (rellenos → trazos, ver historia abajo) y al medir bien —separando el contenido
real de la página de las anotaciones con `page.run()` vs. `runPageContents`— los 59 trazos que
parecían recuadros de plantilla resultaron ser **bordes de campos de formulario (AcroForm)**, no
contenido de la página. Con esa medición correcta, ninguna plantilla de ReciboMail tiene formas en
su contenido (`/Contents` ni siquiera existe en varias); el único PDF con algo son 680 rellenos de
una marca de agua rotada 30°, que tampoco son rectángulos. Construir la detección ahora sería una
función que, contra los archivos disponibles, no encuentra nada que editar. Se retoma si aparece un
PDF real con formas de verdad en su contenido — mientras tanto, ver la fase 2 de arriba: **importar
los campos AcroForm** es el reemplazo de valor real para el mismo caso (una plantilla con
recuadros que en realidad son campos).

<details>
<summary>Historia del bosquejo (por si sirve el día que se retome)</summary>

Primer intento: rectángulos *rellenos* (`re` + `f`), el caso validado en el spike de fase 0.
Corregido tras medir 8 PDF reales: ninguno usa `re` — arman las formas con `m`/`l`/`h`
(moveto/lineto/closepath) — y lo que sí abundaba eran trazos (`S`), no rellenos. Esa segunda medición
resultó estar contaminada por incluir las anotaciones (`page.run()` sin separar contenido de
widgets); al corregirla, los trazos también resultaron ser campos, no formas de página.

Dos hallazgos técnicos que siguen valiendo si se retoma:
- El recorrido de mupdf entrega rellenos/trazos en el mismo orden que los operadores del stream, así
  que el enésimo clic se mapea al enésimo operador **por posición**, no comparando coordenadas (los
  CTM no son la identidad).
- `Contents` puede ser un arreglo de streams, no siempre uno solo.
- La interacción planeada calcaba la de fase 2 (doble clic → elemento nativo con panel propio), y
  el borrado del original no puede reusar `Redact`/`applyRedactions` de mupdf —pensado para texto e
  imágenes, no formas vectoriales— así que esa parte se construye de cero.
</details>

## Fase 4 — Avanzado

- [ ] Capas
- [ ] Multi-página real (insertar, reordenar, eliminar páginas)
- [ ] Firma digital
- [ ] Más formas geométricas

## Fase 5 — Empaquetado y distribución

- [ ] Build de escritorio con Tauri
- [ ] Explorar alternativa gratuita para evitar el cartel de SmartScreen
- [ ] Pulir README / documentación de contribución

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

## Fase 1 — MVP (completa)

Paridad con el editor público actual, mejorando sus limitaciones conocidas (rendimiento, undo/redo).

- [x] Shell de la app: encabezado, barra de menús, layout de paneles, barra de estado
- [x] Lienzo en blanco (Fabric.js) con tamaño de página real en puntos
- [x] Herramientas de dibujo: Texto, Línea, Recuadro, QR (crear, seleccionar, editar propiedades, eliminar)
- [x] Herramientas de dibujo: Tabla, Imagen. Al importar una imagen (`editor/imagen.ts`,
      14/08/2026): se comprueba el formato de verdad por la firma del archivo, no por la extensión
      —un archivo que dice ser PNG y no lo es entraba sin avisar y reventaba recién al exportar—, y
      se achica a 1600 px de lado mayor si hace falta, porque una foto de teléfono entera alcanzaba
      para que el autoguardado (~5 MB en localStorage) dejara de guardar en silencio. Los PNG que
      ya entran quedan intactos, para no perder transparencia.
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
- [x] **Incrustar de verdad las fuentes web al exportar** — resuelto en `092d181`. `fuentes.ts` usa
      los `.woff` (v1) de `@fontsource`, no los `.woff2`: son zlib, así que `woffASfnt()` los
      descomprime a sfnt sin dependencias ni sumar `.ttf` al repo. Ver la lección 12 en CLAUDE.md.
      **Si esto vuelve a aparecer como roto, no es esto**: revisar antes si alguien reintrodujo un
      `.woff2` en el catálogo de fuentes.
- [x] Posición vertical del texto exportado — confirmada en el navegador con una fuente real: cae
      exactamente donde corresponde. La diferencia de ~0,17 × el cuerpo que medía el arnés headless
      era de la medición (Node sustituye la fuente por otra), no del código; no tocar por esto.
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
      textos largos de `ayuda.ts`. **Probado en el navegador en los tres idiomas (15/08/2026)**:
      al hacerlo aparecio que el barrido de `data-i18n` no alcanza lo que arma el codigo (el peso,
      las pestanas de hojas, el panel de propiedades ya dibujado). Se resolvio con un aviso de
      cambio de idioma —`alCambiarIdioma`— al que se engancha lo que dibuje texto por codigo.
- [x] **Auditoría del panel de propiedades contra el editor público** (14/08/2026), control por
      control. Faltaban 3, todos de imagen: el botón "Reemplazar imagen…" (cambia el `src` sin
      tocar posición ni tamaño, a diferencia de borrar y volver a colocarla), la miniatura de la
      imagen en el panel, y la miniatura del QR. El resto de los controles del original existen
      todos (con nombres distintos) y hay varios de más (ángulo, texto vertical, separación entre
      renglones, varias líneas, color interno de tabla).

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
- [x] **Recorrido completo con una plantilla real** (14/08/2026): abrir → editar → verificar →
      exportar, con mouse de verdad sobre `Templeate.pdf`. Funciona de punta a punta: 59 campos
      importados y colocados, mover un campo anda, el valor de ejemplo se guarda, preflight limpio,
      y el PDF exportado sale con los 59 campos, sus valores y texto propio en su lugar —**y
      vectorial, 0 imágenes en la página**, que era el riesgo grande de toda la fase 2 y quedó
      confirmado sobre un archivo real. Tres hallazgos, los tres reales y ya resueltos:
      - El fondo dibujaba los campos por duplicado (`b1c2ea6`): pdf.js rasterizaba también las
        anotaciones —los campos lo son— así que cada uno se veía dos veces, el del fondo (con su
        valor) y el nuestro encima. Lo delató que al borrar un campo "aparecía algo abajo".
      - 28 de los 59 IDs de esa plantilla son más largos que el ancho de su campo, así que su
        etiqueta se montaba sobre la del vecino y volvía ilegible media hoja (`eaf60da`): ahora se
        recorta con puntos suspensivos.
      - El aviso de PDF abierto diagnosticaba mal una plantilla sin contenido de página (todo lo
        visible eran sus campos) como si fuera un PDF escaneado (`300c951`/`90ab76a`, ver arriba).
      - Un cuarto hallazgo resultó ser falso positivo: un campo que "faltaba" en una corrida era un
        artefacto de usar eventos de mouse sintéticos para probar, no un bug — con mouse real
        vuelven a estar los 59 siempre.
      - **Lección del ciclo**: ni la auditoría de menús ni la del panel encontraron estos bugs —
        comparan contra una referencia y encuentran lo que falta. Usar la app de verdad, con un
        archivo real, encontró lo que *molesta*: un tipo de bug distinto, y complementario.

## Fase 3 — Edición real de formas preexistentes (retomada)

**Retomada (15/08/2026): la pausa se había decidido con una muestra sesgada.** Los 8 PDF medidos
entonces eran todos de ReciboMail y todos plantillas de formulario, donde lo que se ve son campos
AcroForm y no contenido. Al medir **60 PDF reales de otras fuentes** (banco, ARCA/AFIP, manuales,
facturas de proveedores) el panorama es el opuesto:

| Medición sobre 60 PDF | Resultado |
| --- | --- |
| Con al menos una forma editable en el contenido | **45** (75%) |
| Con 5 o más | 32 |
| Formas editables (rectángulos y líneas rectas) | **6132** |
| Formas fuera de alcance (curvas, rotadas) | 1173 |
| Proporción editable | **84%** |

O sea que el caso existe y es común: rectángulos de ejes rectos, mayormente. Lo que no aparece en
ningún lado es el operador `re` —las formas se arman con `m`/`l`/`h`— y hay un tercer grupo, el de
los PDF **escaneados**, donde no hay ni texto ni formas sino una sola imagen (ejemplo real: un VEP
de ARCA). Para esos no hay nada que editar y el editor ya lo diagnostica (`contenido: 'escaneada'`).

**El caso de uso concreto**, y es una plantilla de recibo de la propia empresa
(`Template recibo Argentina Napsis.pdf`): **556 rectángulos, 0 formas complejas**, más 119 líneas
de texto y 179 campos AcroForm. Sus medidas delatan qué son —`566x0`, `0x13`— **rectángulos
degenerados: las líneas y los recuadros del recibo dibujados como barras finas**. Es exactamente lo
que había encontrado el spike de fase 0, y confirma que el caso vale la pena: un PDF así se abre
hoy, se le edita el texto y se le importan los campos, pero sus líneas no se pueden ni mover ni
borrar.

<details>
<summary>Por qué había quedado en pausa (14/08/2026)</summary>

El bosquejo se
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

Hallazgos técnicos que siguen valiendo:
- El recorrido de mupdf entrega rellenos/trazos en el mismo orden que los operadores del stream, así
  que el enésimo clic se mapea al enésimo operador **por posición**, no comparando coordenadas (los
  CTM no son la identidad).
- `Contents` puede ser un arreglo de streams, no siempre uno solo.
- La interacción planeada calcaba la de fase 2 (doble clic → elemento nativo con panel propio), y
  el borrado del original no puede reusar `Redact`/`applyRedactions` de mupdf —pensado para texto e
  imágenes, no formas vectoriales— así que esa parte se construye de cero.
</details>

**Alcance de la v1**, sacado de lo medido y no de lo imaginado:

- [x] **Detectar las formas del contenido** (15/08/2026, `editor/formasPdf.ts`): rectángulos de
      ejes rectos y líneas, con su posición, color y grosor. Las líneas suelen venir como
      rectángulos degenerados (alto o ancho 0) y se clasifican como línea, que es lo que son.
- [x] **Sacar una forma del contenido, de verdad** (15/08/2026): con una **redacción de mupdf**
      sobre su rectángulo, pidiéndole que se lleve el dibujo vectorial y no toque el texto —
      `applyRedactions(false, 0, 1, 1)`, justo al revés que al borrar un texto.
      **El primer intento estuvo mal y rompía el documento**: era una cirugía a mano sobre el
      content stream, emparejando cada forma con su operador *por posición*. El recorrido de mupdf
      informa menos formas que operadores hay —saltea los que no dibujan nada visible: 556 contra
      672 en la plantilla real— así que borraba el equivocado: desaparecieron 14 renglones de texto
      y las líneas internas de las tablas.
      **La redacción se lleva todo lo que queda completamente cubierto**, así que sacar una banda
      grande arrastra las líneas que tenía adentro: en la plantilla real, una banda se lleva 19
      formas. No se pierden — se convierten en elementos **todas** las que se hayan ido, no solo la
      apuntada, así en la hoja no desaparece nada y encima quedan editables. Al revés, ese mismo
      límite es el que impide ofrecer "convertir todas las formas": sacando las 556 de una
      sobreviven 392, porque un trazo pinta más ancho que su trayectoria y no queda cubierto.

      <details><summary>El mecanismo descartado</summary>
      Se recorría el content stream ubicando cada operador que pinta y se reemplazaba por espacios
      el camino de la forma junto con su operador, buscándola **por posición** —el enésimo relleno
      del recorrido sería el enésimo del stream— porque comparar coordenadas parecía inviable: los
      CTM no son la identidad. La premisa era falsa y no hay forma barata de arreglarla; con
      redacciones el problema directamente no existe, porque se identifica por rectángulo.
      </details>
- [x] **Doble clic sobre una forma la convierte en elemento del diseño** (15/08/2026), igual que
      el texto en la fase 2: se saca del contenido del PDF y queda un recuadro o una línea común,
      con su panel, su deshacer y su exportación. Un relleno macizo se reconstruye como recuadro
      relleno sin borde; uno de contorno, al revés.
      **Los campos importados no bloquean el doble clic**: en una plantilla real tapan el 47% de la
      hoja, así que si mandaran ellos, la mitad de las líneas quedaría inalcanzable. La caja de un
      campo es un marcador, no un dibujo; lo que uno haya dibujado sí tiene prioridad, y en modo
      Completar campos tampoco se interfiere.
- [ ] Curvas, paths compuestos y formas rotadas quedan afuera: no se detectan y no se tocan.

## Fase 4 — Avanzado

- [ ] Capas
- [x] **Multi-página real (insertar, reordenar, eliminar páginas)** (15/08/2026). Un documento es
      varias hojas y el lienzo muestra una por vez; el tamaño, la orientación, los márgenes y el
      fondo son del documento entero, no de cada hoja (una decisión a propósito: hojas de distinto
      tamaño no tienen sentido para lo que hace este editor, y evitarlo saca de encima muchos casos
      raros). API en `editor/documento.ts` — `cantidadDeHojas()`/`hojaActual()` (0-index),
      `irAHoja`, `agregarHoja` (con copia opcional), `eliminarHoja` (nunca la última),
      `moverHoja` — ninguna registra el historial ni toca la interfaz, eso lo hace quien la llama.
      El historial guarda el documento entero (deshacer recupera una hoja borrada con su
      contenido); proyecto y autoguardado guardan todas las hojas y en cuál se estaba, los
      proyectos viejos se siguen abriendo como hoja única; Verificar revisa todas y dice en cuál
      está cada problema; al exportar cada hoja sale como una página del PDF.
      **Interfaz**: tira de pestañas entre el lienzo y la barra de estado (`shell.ts`/`main.ts`) —
      clic para cambiar de hoja, "+"/"⧉" para agregar o duplicar, la `×` de cada pestaña para
      borrar (oculta si solo queda una), arrastrar para reordenar (drag and drop nativo).
      Verificado con `npm run verificar-hojas` (arma tres hojas, confirma que ir y volver no
      mezcla nada, que reordenar mantiene la hoja a la vista, que deshacer recupera una borrada,
      que la última no se puede borrar, y que el PDF sale con una página por hoja).
- [ ] Firma digital
- [ ] Más formas geométricas

## Fase 5 — Empaquetado y distribución

- [ ] Build de escritorio con Tauri
- [ ] Explorar alternativa gratuita para evitar el cartel de SmartScreen
- [ ] Pulir README / documentación de contribución

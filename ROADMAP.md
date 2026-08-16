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
- [x] **La forma convertida se dibuja debajo de la página, y eso vive en el modelo** (15/08/2026).
      En el PDF estaba debajo del texto, así que al convertirla tiene que seguir ahí o tapa el
      renglón que estaba encima. Se logra con `globalCompositeOperation: 'destination-over'`, pero
      **la marca la lleva el elemento** (`debajoDeLaPagina`), no el objeto de Fabric: el objeto se
      reconstruye al deshacer, al cambiar de hoja y al recargar, y con la marca solo ahí la forma
      saltaba al frente en cualquiera de esos tres casos. Verificado midiendo píxeles: 565 oscuros
      en la banda antes de recargar, 562 después.
- [ ] Curvas, paths compuestos y formas rotadas quedan afuera: no se detectan y no se tocan.

**Repaso de diseño de la fase (15/08/2026).** Además de lo de arriba salieron tres cosas menores,
ya corregidas: claves de idioma huérfanas de la conversión masiva que se descartó (18 líneas en
ES/EN/PT), dos exportaciones sin ningún uso (`quitarFormasDelPdf`, `formasDelPdfActual`) y lógica
del motor metida en el cableado de `main.ts` — el armado del elemento a partir de una forma se mudó
a `formasPdf.ts` (`elementoDesdeForma`), que es donde vive el resto del conocimiento sobre formas.

## Fase 4 — Avanzado

- [x] **Las hojas del documento son las páginas del PDF** (15/08/2026). Corrige un problema de
      diseño de la fase 2 que se veía como "no entiendo cómo funciona esto": convivían dos nociones
      de página que no se hablaban. El selector **Página** de la barra de estado elegía el fondo del
      documento entero, mientras que el exportador apoyaba la hoja 1 en esa página, la hoja 2 en la
      siguiente y así — o sea que con tres hojas se editaban las tres viendo la página 1 de fondo y
      terminaban en las páginas 1, 2 y 3: **de la segunda en adelante se diseñaba a ciegas**.
      Ahora cada hoja lleva `paginaPdf` y su fondo propio, abrir un PDF de N páginas arma N hojas, y
      al exportar se construye un documento nuevo copiando **solo las páginas que alguna hoja siga
      usando, en el orden en que estén**: borrar una hoja saca esa página del archivo final,
      moverla lo reordena y duplicarla la repite. El selector **Página** desaparece; en su lugar la
      barra dice cuántas páginas se van a exportar.
      **Duplicar una hoja duplica su página del PDF**, no la comparte: si dos hojas apuntaran a la
      misma, borrar un texto en una lo borraría en la otra, porque la cirugía es sobre el PDF y no
      sobre la hoja. La invariante es *una hoja, una página*.
      Los fondos no se guardan en el proyecto ni en el autoguardado: se redibujan pidiéndoselos al
      PDF, que ya viaja aparte — con doce páginas, guardar las imágenes no entra en localStorage.
      **Interfaz**: la tira pasa a ser de **miniaturas** (opción elegida sobre un mockup de tres),
      con duplicar y eliminar sobre la propia miniatura, el resto de las acciones en el menú de clic
      derecho, y colapsable y redimensionable como los paneles laterales. Bajo el número se muestra
      de qué página del original viene la hoja cuando ya no coinciden.
      Verificado con `npm run verificar-hojas`: sobre un PDF de 4 páginas, borrar la segunda y
      mover la última al principio da un exportado de 3 páginas en el orden D, A, C; y duplicar la
      primera deja 5 páginas con la copia al lado del original.
- [x] **Insertar (mergear) otro PDF en una posición** (15/08/2026).
      Insertar las páginas de otro PDF dentro del documento, eligiendo dónde. **No** se hace
      sobrecargando "Abrir PDF" según dónde esté parado el cursor: esa acción reemplaza el
      documento y la nueva lo agranda, y compartir botón entre algo destructivo y algo aditivo
      termina en trabajo perdido. Van dos disparadores para la misma función: **clic derecho en la
      tira → "Insertar PDF aquí…"** (entra después de esa hoja; la posición ya está en el gesto) y
      **menú Página → "Insertar PDF…"** (después de la hoja que se está editando), porque a un menú
      de clic derecho no llega nadie solo. Arrastrar el archivo sobre la tira queda descartado por
      ahora. Lo demás ya existe: fusionar es lo mismo que `agregarHoja` hace al duplicar —copiar
      páginas dentro del PDF base, insertarlas y correr los índices de las hojas siguientes—, así
      que **no hace falta manejar dos PDFs abiertos a la vez**.
      **Antes hay que hacer el tamaño por hoja** (el punto de abajo): el caso típico es meter un
      anexo A4 en un recibo A5, y hoy el documento tiene un solo tamaño. Al exportar, las páginas se
      copian con su tamaño real, así que el archivo saldría bien pero en pantalla se verían con el
      tamaño del documento — el mismo "diseñar a ciegas" que se acaba de sacar.
      A tener en cuenta al implementarlo: campos AcroForm con el mismo nombre en los dos PDFs
      quedan como un solo campo con el mismo valor en las dos páginas, y el PDF de base pasa a
      pesar la suma de los dos (se nota en el autoguardado y en el `.json`).
- [x] **Tamaño y orientación por hoja** (15/08/2026). Hoy son del
      documento entero, una decisión a propósito de la fase 4 que el merge deja sin sostén. Cada
      hoja se acuerda de su tamaño y orientación y el lienzo cambia al pasar de una a otra; los
      márgenes siguen siendo del documento. Al insertar un PDF de otro tamaño se **avisa, sin
      bloquear**: el aviso es solo un aviso, la inserción se hace igual.
- [x] **Ocultar los campos de formulario en el lienzo** (15/08/2026).
      Un interruptor en el menú Ver para mirar el documento sin sus campos. **Es una vista y nada
      más**: no toca el modelo, no entra al historial, no se autoguarda como un cambio del diseño y
      no afecta la exportación — los campos siguen ahí y salen en el PDF. Ojo con eso, porque el
      editor guarda leyendo el lienzo (`asentarHoja`): los objetos van **invisibles pero
      presentes**, nunca borrados, o el autoguardado se lleva el trabajo puesto.
      Solo los campos: los márgenes punteados se quedan como están (se evaluó una "vista previa"
      que apagara las dos cosas y se descartó).
      Lo que hay que resolver al hacerlo:
      - `visible: false` **y** `selectable: false`, o se termina arrastrando algo que no se ve.
        Deseleccionar lo que estuviera activo al apagarlos.
      - Un aviso permanente en la barra de estado mientras dure. Es la trampa clásica: se apagan,
        uno se olvida y cree que perdió los campos.
      - **No se recuerda entre sesiones**: al recargar vuelven a verse. Es para mirar un momento,
        no una configuración.
      - Convive con "Completar campos", que es el modo opuesto: encender esto sale de ese modo, sin
        preguntar.
      - Se aplica también a lo que aparezca después —cambiar de hoja reconstruye el lienzo y un
        campo nuevo nace visible—, así que el apagado va donde se arma el objeto y no en un barrido
        de una sola vez.
      Efecto secundario bueno: los campos de una plantilla real tapan el 47% de la hoja, y con
      ellos apagados el doble clic para editar textos y formas del PDF llega a todos lados.
- [x] **Paneles laterales flotantes y reubicables** (15/08/2026). Botón
      para desacoplar un panel: pasa a ser una ventana suelta por encima del lienzo, se arrastra de
      su cabecera, se redimensiona, y al acercarla a un borde se acopla de ese lado. **Es el más
      grande de los pendientes anotados hoy.**
      Hoy el layout es una grilla de cinco columnas (panel · separador · lienzo · separador ·
      panel) y `columnas.ts` maneja ancho y colapso escribiendo variables CSS. Un panel flotando
      deja de ser una columna: la suya se va a cero y el lienzo se agranda.
      **El estado de cada panel pasa a ser `acoplado: 'izq' | 'der' | null` más su posición y
      medida cuando flota**, guardado junto a lo que ya guarda `columnas.ts`. Modelarlo así desde el
      principio es lo que hace que el resto salga solo.
      Lo caro **no es arrastrar la ventana** —eso es lo mismo que ya hace el separador—, es:
      - **La sombra de acople**: mientras se arrastra cerca de un borde hay que mostrar dónde va a
        caer. Sin eso soltar es a ciegas y la función se siente rota. Es cerca de la mitad del
        trabajo.
      - **Que la ventana no se pierda**: con un panel flotando pegado a un borde, achicar la
        ventana del navegador lo deja fuera de la pantalla para siempre. Hay que reajustarlo al
        redimensionar.
      - **El botón de colapsar no aplica flotando**: ahí pasa a ser "volver a acoplar".
      **Soltar en el borde ocupado por el otro panel los intercambia**: el que estaba se va al lado
      que quedó libre, así nunca hay dos del mismo lado ni un costado vacío, y de paso es la forma
      natural de cambiarlos de lado. Descartado apilarlos en pestañas al estilo VS Code (con dos
      paneles no aporta) y apilarlos verticalmente en el mismo costado.
      Se evaluó hacer primero un botón "mover al otro lado" —una tarde de trabajo, resuelve cambiar
      de lado sin ventanas ni arrastre— y se decidió ir directo a lo flotante completo.
      Al implementarlo, mockup antes de codear, como el resto de la interfaz.
      **Lo que apareció al probarlo**: colapsada a un costado quedan 32 px y los botones no entran
      en fila, así que se apilan; ocultar con `display:none` el separador de un costado vacío corre
      todas las columnas del grid y el panel del otro lado quedaba en 5 px; y la barra de
      Herramientas suma **cerrar**, con el menú Ver como única forma de recuperarla —de ahí la
      sección "Barras" y "Restaurar barras".
- [x] **Atajos de teclado en todas las opciones de menú** (15/08/2026). Cada uno hace clic en su
      opción, así la acción tiene una sola implementación y el atajo no puede quedar desfasado del
      menú. Qué combinación se puede usar no es cuestión de gusto: `Ctrl+N`, `Ctrl+T` y `Ctrl+W` se
      los queda el navegador y no llegan nunca; `Ctrl+R` y `F5` son recargar; y en un teclado
      latinoamericano **AltGr es Ctrl+Alt**, así que se evitan las letras que ahí producen un
      carácter. Se muestran al lado de cada opción —uno que no se ve no lo usa nadie— y la ventana
      de Atajos se arma sola desde una lista, porque a mano en tres idiomas se desfasa enseguida.
- [x] **La barra de Herramientas, con secciones plegables** (15/08/2026). Antes se llamaba "campos"
      y solo tenía el catálogo AcroForm; ahora suma arriba la sección **Dibujo** con las seis
      herramientas del menú Campos. Las dos se pliegan: con una plantilla real el catálogo tiene
      cientos de campos, y sin plegarlo las herramientas quedan fuera de la vista.
- [x] **Capas** (15/08/2026). Barra propia con la lista de capas y, dentro de cada una, sus objetos
      de adelante hacia atrás —en el lienzo el último del arreglo es el que se ve encima, así que el
      orden se invierte para mostrarlo—. Desde ahí se selecciona, se apaga y se traba uno por uno o
      la capa entera, y se crean y renombran capas. Resuelve un problema concreto: con doscientos
      elementos amontonados, a uno tapado por otro no había forma de llegar.
      **Lo apagado no se exporta**, que es la diferencia con "Ocultar campos" del menú Campos —esa
      es una vista temporal y los campos igual salen en el PDF—. La capa, el ocultar y el bloquear
      viven en el modelo (`Marcas` en `elemento.ts`), y `elementoVisible()` / `elementoBloqueado()`
      son los dos únicos lugares donde se resuelve, para que el lienzo y la exportación no puedan
      contradecirse. Las capas son del documento y no de cada hoja.
      Como era una cuarta barra para tres lugares, **los costados pasan a aceptar dos barras
      apiladas** con su separador, y el botón de colapsar salió de las cabeceras a una **lengüeta
      sobre la línea** del costado, que es donde se lee que colapsa el costado entero. Colapsado, el
      riel adelgaza a 10 px y esconde sus botones: el lienzo gana 200 px.
      **Quedó afuera**: arrastrar para reordenar o cambiar de capa, y el menú de clic derecho
      (duplicar, traer al frente, mover a la capa…). Los dos estaban en el mockup; el reordenar por
      arrastre es el que más trabajo tiene.
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
- [x] **Campo de firma** (15/08/2026). El editor prepara el recuadro donde después alguien firma;
      firmar es otra cosa —necesita un certificado— y no la hace el editor. Es un elemento propio,
      `ElementoFirma`: recuadro con borde punteado, una leyenda adentro ("Firma del empleador") y
      la marca de obligatorio. Vive en la sección **Campos AcroForm** de Herramientas, fija como el
      resto —no se puede sacar de la barra—.
      Al exportar sale como campo de firma de verdad: pdf-lib no sabe crear ninguno, así que el
      diccionario se arma a mano (`/FT /Sig`, widget anotado en la página y agregado al AcroForm,
      `/SigFlags 3` en el catálogo) y **sin `/V`**, que es lo que lo deja vacío esperando la firma.
      La leyenda no es parte del campo: se dibuja como texto de la página, para que se vea también
      en un visor que no resalte los campos vacíos. Exportando aplanado queda solo el recuadro
      dibujado: un campo de firma sin formulario no tendría dónde firmarse.
      Al abrir un PDF, los campos de firma vacíos vuelven como elementos —antes se descartaban con
      un aviso—; los que ya están firmados se siguen omitiendo, porque exportar rearma el archivo e
      invalidaría la firma. El preflight bloquea dos firmas con el mismo nombre y una firma que
      comparta nombre con un campo de texto: para el visor serían el mismo campo.
      Verificado con `npm run verificar-hojas`: el PDF exportado tiene el campo, lo ve el
      formulario, es de tipo firma, el documento se declara con `/SigFlags 3` y el campo sale vacío;
      y la vuelta completa —exportar y reabrir— lo devuelve como firma en las mismas coordenadas.
- [x] **Más formas geométricas** (15/08/2026). Elipse, triángulo, flecha y estrella. Son **un solo
      elemento** (`ElementoForma`, con un campo `figura`) y no cuatro clases: comparten caja, color,
      relleno y estilo de línea, y cada clase nueva del modelo se paga en el exportador, el panel,
      las capas y el preflight. Lo único propio es `puntas`, que solo mira la estrella.
      La geometría vive en `editor/figuras.ts` y **la usan los dos lados**: el objeto de Fabric
      (`formaObjeto.ts`) y el exportador piden los mismos puntos, así que lo que se ve y lo que baja
      al PDF no se pueden separar —al revés de la tabla, que tiene la geometría escrita dos veces—.
      En el PDF el polígono baja como camino SVG (`drawSvgPath`, que se ancla arriba a la izquierda
      y mide la Y hacia abajo, igual que los puntos) y la elipse con `drawEllipse`.
      **Interfaz**: un botón partido en la sección Dibujo —la parte ancha dibuja la última figura
      usada, la flechita abre el menú con las cuatro—, para no pasar la sección de 7 botones a 11.
      Las cuatro están también en el menú Campos. Atajos `E` (elipse) y `F` (flecha); triángulo y
      estrella no llevan, para no gastar teclas en lo que casi no se usa.
      El estilo de línea es sólido o punteado: "doble" pediría trazar dos caminos paralelos en una
      figura curva o en punta y no vale lo que cuesta, así que no se ofrece.
      Verificado con `npm run verificar-hojas` sobre el contenido del PDF exportado: cuatro caminos
      cerrados, la elipse con curvas, 17 rectas entre triángulo, flecha y estrella, y el relleno
      solo en la figura que lo pide.

## Fase 5 — Empaquetado y distribución

- [x] **Build de escritorio con Tauri 2** (15/08/2026). El editor se instala como aplicación de
      Windows sin dejar de ser la misma web: Tauri levanta **el mismo build de Vite** dentro de un
      WebView2, así que no hay una segunda versión del código que mantener. Identificador
      `ar.net.recibomail.editorpdf`, derivado del dominio como manda la convención —define la
      carpeta de datos del usuario y tiene que coincidir el día que se firme el ejecutable—.
      Se generan los dos instaladores: **NSIS** (`.exe`, modo por usuario, no pide administrador) y
      **MSI** para despliegue corporativo; los dos pesan 14 MB, con el `mupdf.wasm` de 10 MB
      adentro, y el ejecutable 20 MB. Scripts: `npm run escritorio` y `npm run escritorio-build`.
      Ícono propio: el avión de ReciboMail sobre una hoja con renglones, elegido sobre otras tres
      variantes mirándolas a 16, 32 y 48 px. El original tiene mucha estela y a 16 px el avión
      quedaba de unos 6 px, así que va recortado y agrandado; se compone con un script que usa solo
      `zlib` de Node, porque no hay ninguna librería de imágenes instalada.
      **Las descargas andan en la aplicación instalada** (probado el 15/08/2026). Era el riesgo
      abierto: Exportar PDF y Guardar proyecto bajan el archivo con un enlace `blob:`, y no estaba
      dicho que WebView2 lo tratara como un navegador. Lo trata igual, así que **no hay que meter
      el diálogo nativo de Tauri**: el mismo código sirve para la web y para el escritorio.
- [ ] Explorar alternativa gratuita para evitar el cartel de SmartScreen
- [ ] Pulir README / documentación de contribución

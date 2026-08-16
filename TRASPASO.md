# Traspaso — dónde retomar

Estado al cerrar el 15/08/2026. Todo commiteado en
[gsomma86/EditorPDF](https://github.com/gsomma86/EditorPDF) (rama `main`).

**Antes de tocar nada, leer [CLAUDE.md](CLAUDE.md)**: ahí están la regla de alcance, las
convenciones y las lecciones de bugs ya resueltos, que conviene no volver a tropezar.

## Dónde está el proyecto

**Fase 1 (MVP): completa**, incluido el multiidioma ES/EN/PT (`ui/i18n.ts`, ver el punto 1 de
abajo) y una auditoría del panel de propiedades control por control contra el editor público
(14/08/2026): faltaban el botón "Reemplazar imagen…", y las miniaturas de imagen y QR en el panel,
ya resueltos; de paso se encontró que importar una imagen no validaba nada (un archivo que decía
ser PNG y no lo era entraba sin avisar y reventaba al exportar), corregido en `editor/imagen.ts`.
Todo lo demás está hecho y probado en el navegador por Germán: dibujo, campos AcroForm con
repetibles, rotación, texto vertical y de varias líneas, completar campos, deshacer/rehacer,
guardar/importar proyecto, exportar PDF, fondo de hoja (imagen y PDF), ayuda, atajos, y paneles
colapsables de ancho ajustable.

**Fase 2 (editar PDFs ajenos): completa, y con un recorrido real de punta a punta.** Archivo →
Abrir PDF trae el PDF de fondo con sus campos AcroForm ya importados y colocados; doble clic sobre
cualquier texto lo borra del contenido real con una redacción de mupdf y lo reemplaza por un texto
del diseño, con la misma tipografía y en el mismo renglón que el original. Funciona sobre cualquier
página, no solo la primera (selector en la barra de estado), y retomar una sesión (o abrirla en
otra computadora) vuelve al PDF y a la página donde se estaba, no solo al fondo. Al exportar, el
PDF abierto es la base, así que lo que ya traía sigue siendo vectorial.

Además de la verificación pieza por pieza (navegador, `verificar-pdf`, `verificar-campos`), se hizo
un recorrido completo abrir→editar→verificar→exportar con una plantilla real de ReciboMail y mouse
de verdad (14/08/2026, ver ROADMAP.md fase 2 para el detalle). Confirmó lo importante —el PDF
exportado sale vectorial, no una foto— y encontró tres bugs reales que ni la auditoría de menús ni
la del panel habían encontrado (campos duplicados por el fondo, etiquetas desbordadas, un
diagnóstico de aviso equivocado), los tres ya resueltos. **Lección**: las auditorías comparan
contra una referencia y encuentran lo que falta; usar la app de verdad encuentra lo que molesta.

**Fase 3 (formas preexistentes): retomada** (15/08/2026) — la pausa se había decidido midiendo solo
PDFs de ReciboMail, que son todos plantillas de formulario. Sobre 60 PDF de otras fuentes, 45
tienen formas editables en su contenido. Ver el punto 3. **Cerrada con un repaso de diseño** que
encontró un bug real: la forma convertida se dibuja debajo de la página, y esa marca vivía solo en
el objeto de Fabric, así que se perdía al deshacer, al cambiar de hoja y al recargar. Ahora la
lleva el modelo (`debajoDeLaPagina`) — lección 42 de CLAUDE.md.

**Fase 4 — Multipágina real: hecha** (15/08/2026, ver el punto 4). Un documento del editor tiene
varias hojas, con su propia tira para agregar, duplicar, borrar y reordenar.

**Y las hojas pasaron a ser las páginas del PDF** (15/08/2026). Antes convivían dos nociones de
página que no se hablaban —el selector "Página" elegía el fondo del documento entero, y el
exportador ponía la hoja 1 en esa página, la hoja 2 en la siguiente— así que de la segunda hoja en
adelante se diseñaba a ciegas. Ahora cada hoja se acuerda de qué página viene, abrir un PDF de N
páginas arma N hojas, borrar una hoja saca esa página del archivo exportado, y la tira es de
miniaturas. El selector "Página" ya no existe. Ver el punto 4 del ROADMAP.

**Los cuatro puntos que seguían a eso están hechos** (15/08/2026): tamaño y orientación por hoja,
insertar (mergear) otro PDF en una posición, ocultar los campos en el lienzo, y las barras
flotantes y reubicables. Más lo que salió en el camino: atajos de teclado en todas las opciones de
menú, la barra de Herramientas con secciones plegables, y el zoom hasta 400 %. Todo detallado en la
fase 4 del ROADMAP.

**Lo próximo es la fase 5 — empaquetado con Tauri**, salvo que aparezca algo antes. De la fase 4
quedan sin empezar Capas, Firma digital y Más formas geométricas.

## Lo que falta

1. ~~Multiidioma ES/EN/PT~~ — **hecho (14/08/2026)**, en `ui/i18n.ts` (mismo patrón que `i18n.js`
   del editor público: diccionario plano, `data-i18n`/`-title`/`-placeholder`/`-label`, persistido
   en localStorage). El selector del encabezado funciona. Cableado en `shell.ts`, `modales.ts`,
   `panelPropiedades.ts`, `panelCampos.ts`, `main.ts` y los 7 bloques largos de `ui/ayuda.ts` (guía,
   atajos, CSV, repetibles, apariencias, FAQ, acerca de). **Probado en el navegador (15/08/2026)**
   en los tres idiomas: lo que estaba a medias era todo lo que arma el codigo —el peso, las
   pestanas de hojas y el panel de propiedades ya dibujado quedaban en el idioma anterior— y se
   resolvio con `alCambiarIdioma`, el aviso al que se engancha ese tipo de texto.
2. ~~Persistir la página elegida al retomar una sesión~~ — **hecho (14/08/2026)**. De paso, buscando
   esto apareció un bug más serio y ya corregido: **retomar una sesión borraba el PDF de base
   entero, justo antes de recuperarlo**. `restaurarAutoguardado` pasa por `cargarProyecto`, que
   soltaba el PDF vigente si el proyecto no traía uno adentro — correcto al *importar* un `.json`
   (ahí, si no trae PDF, es porque no tiene), pero el autoguardado nunca trae el PDF —vive aparte
   en IndexedDB, porque localStorage no lo aguanta— así que lo borraba en cada recarga antes de que
   `recuperarPdfGuardado()` pudiera leerlo. `cargarProyecto` ahora recibe si hay que conservar el
   PDF vigente. La página elegida se guarda junto al PDF (IndexedDB) y dentro del `.json`, así que
   también se retoma en otra computadora. Con esto, fase 2 queda completa de punta a punta.
3. **Fase 3 (formas preexistentes) — retomada (15/08/2026): la pausa era por una muestra sesgada.**
   Se había decidido midiendo 8 PDF, todos de ReciboMail y todos plantillas de formulario, donde lo
   que se ve son campos AcroForm y no contenido. Midiendo **60 PDF de otras fuentes** (banco,
   ARCA/AFIP, manuales, facturas), **45 tienen formas editables en su contenido**: 6132 rectángulos
   y líneas rectas contra 1173 formas complejas, o sea 84% al alcance. El caso concreto es una
   plantilla de la propia empresa (`Template recibo Argentina Napsis.pdf`): **556 rectángulos, 0
   formas complejas**, que por sus medidas (`566x0`, `0x13`) son las líneas del recibo dibujadas
   como barras finas. Hoy ese PDF se abre, se le edita el texto y se le importan los campos, pero
   sus líneas no se pueden mover ni borrar. El alcance de la v1 está en ROADMAP.md.
4. ~~Multipágina real (fase 4)~~ — **hecho (15/08/2026)**. Un documento son varias hojas; tamaño,
   orientación, márgenes y fondo son del documento entero, no de cada hoja (decisión a propósito).
   Motor en `editor/documento.ts` (`irAHoja`/`agregarHoja`/`eliminarHoja`/`moverHoja`, ninguna
   registra historial), historial/proyecto/autoguardado/preflight/exportación ya la cubren de punta
   a punta. Interfaz: tira de pestañas entre el lienzo y la barra de estado, con agregar, duplicar,
   borrar y reordenar arrastrando. Verificado con `npm run verificar-hojas`. Ver ROADMAP.md fase 4
   para el detalle completo.
5. ~~Capas~~ — **hecho (15/08/2026)**, con su propia barra (`ui/panelCapas.ts`) y el ojo/candado por
   objeto y por capa; lo oculto no se exporta.
6. ~~Tauri~~ — **hecho (15/08/2026)**, los dos instaladores salen y **las descargas andan en la
   aplicación instalada**: Exportar PDF y Guardar proyecto bajan con un enlace `blob:`, y WebView2
   lo trata igual que un navegador. No hace falta el diálogo nativo de Tauri.
7. ~~Campo de firma~~ — **hecho (15/08/2026)**. El editor prepara el recuadro; firmar necesita un
   certificado y no lo hace el editor. Detalle en ROADMAP.md fase 4.
8. ~~Más formas geométricas~~ — **hecho (15/08/2026)**: elipse, triángulo, flecha y estrella, en un
   solo elemento `forma`. Detalle en ROADMAP.md fase 4.
9. **Lo que queda**: arrastrar en el panel de capas para reordenar o cambiar de capa, la alternativa
   a SmartScreen y la documentación de contribución.

## Cómo verificar

```bash
npm run verificar-export   # el PDF exportado contra lo que dibuja el lienzo
npm run verificar-pdf      # que borrar un texto de un PDF lo borre, y no lo tape
npm run verificar-campos   # importar los campos de una plantilla real, exportar y comparar que vuelvan iguales
npm run medir-rendimiento  # 50, 200, 500 y 1000 elementos
```

Los cuatro corren sin navegador. En `verificar-export` quedan cuatro diferencias marcadas en los
casos de texto: **son de la medición, no del código** — en Node no está la Helvetica real y
node-canvas dibuja con una sustituta más ancha. Para cerrarlas habría que registrar la fuente real
en el arnés.

`verificar-campos` encontró en su momento (a mano, antes de que existiera) un bug de campos
duplicados al exportar y un crecimiento de medio punto por vuelta; conviene correrlo antes de tocar
el exportador o `camposDelPdf()`.

En el navegador: el Browser pane integrado funciona (probado el 14/08), **con la pestaña a la
vista**. Si está oculta, `requestAnimationFrame` no se dispara y abrir un PDF queda colgado sin
dar ningún error, como si fuera un bug de la app.

## Cosas que conviene saber antes de tocar

- **Los campos de formulario solo rotan en múltiplos de 90°**: es del formato PDF. Con otro ángulo,
  al exportar con campos editables se redondea y el preflight avisa; aplanado sale exacto.
- **Cambiar tamaño, orientación, márgenes o fondo no se deshace con Ctrl+Z**: el historial guarda
  los elementos del diseño, no la configuración de la página.
- **El PDF de base vive en tres lugares**: memoria mientras se trabaja, IndexedDB para sobrevivir a
  una recarga, y dentro del `.json` al guardar el proyecto. En el autoguardado no, porque
  localStorage no aguanta un PDF.
- **Las cuatro figuras son un solo elemento** (`forma`), distinguidas por `figura`. Si hay que sumar
  otra —hexágono, rombo—, alcanza con agregarla al tipo `Figura`, darle sus puntos en
  `editor/figuras.ts` y ponerla en el menú: el exportador, el panel y las capas ya la dibujan.
- **El campo de firma se arma a mano**: pdf-lib no sabe crear campos `/Sig`, así que en
  `exportarPdf.ts` se construye el diccionario del widget, se lo anota en la página, se lo agrega al
  AcroForm y se pone `/SigFlags 3` en el catálogo. Queda **sin `/V`** a propósito: eso es lo que lo
  deja vacío esperando la firma. El editor no firma —hace falta un certificado—, solo prepara el
  recuadro. Exportando aplanado no se crea ningún campo, solo el dibujo.
- **La numeración de páginas no es uniforme entre librerías**: pdf.js cuenta desde 1; mupdf,
  pdf-lib y `pdfExistente.ts` (`paginaDelPdf()`, `elegirPagina()`) cuentan desde 0. La UI (selector
  de página) muestra 1..N al usuario y convierte al llamar al módulo.

## Deudas técnicas conocidas

- **`sincronizarGeometria` para 'campo' reconstruye el objeto** en cada redimensionado. Funciona,
  pero si se nota un parpadeo conviene actualizar el grupo en su lugar.
- **Las fuentes se incrustan sin subsetear** (`subset: false`): fontkit no puede subsetear woff.
  Cada familia usada suma ~20 KB al PDF. La salida sería convertir a TTF antes de embeber.
- **Las tablas no bajan al PDF con el mismo código que las dibuja en pantalla**: `tablaObjeto.ts`
  usa canvas y `exportarPdf.ts` rehace la geometría con pdf-lib. Si se cambia una, tocar la otra.
- **El QR se regenera en cada tecla** al editar su contenido. Es correcto (hay un contador de
  generación que descarta respuestas fuera de orden) pero podría llevar un respiro.

## Fuera del código

Germán quiso conectar el proyecto a **Claude Code en la nube** y no se pudo. Del lado de GitHub la
app de Claude está instalada en `gsomma86` con los repos elegidos; del lado de Claude la lista
aparece vacía y no hay opción de GitHub en Configuración. La causa probable es que su cuenta de
Claude es la de trabajo y el GitHub es personal — en una cuenta de organización esa vinculación la
suele habilitar un administrador. **No está confirmado.** No bloquea nada: se trabaja local y se
pushea como hasta ahora.

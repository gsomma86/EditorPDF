# Traspaso — dónde retomar

Estado al cerrar el 17/08/2026. Todo commiteado y pusheado en
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

**Fase 5 (empaquetado con Tauri): completa**, y con la aplicación de escritorio terminada de pulir
(17/08/2026): pantalla de bienvenida al arrancar, siempre empieza en documento nuevo —como Word o
Excel—, y el botón de cerrar pregunta si guardar. **Guardar en escritorio no pasa por una descarga**:
lo escribe el proceso de Tauri y avisa dónde quedó, con un botón para copiar la ruta. Ver el punto
15. Probado por Germán con el `.exe` instalado.

**No queda nada funcional pendiente.** Lo único abierto es de afuera del código: la respuesta de
SignPath (punto 14) y la deuda de las fuentes sin subsetear. Ver "Por dónde seguir" al final.

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
6. ~~Tauri~~ — **hecho (15/08/2026)**, los dos instaladores salen y **exportar el PDF baja bien en
   la aplicación instalada**: sale con un enlace `blob:` y WebView2 lo trata igual que un navegador.
   Guardar el proyecto sí dejó de ser una descarga (ver el punto 15): al cerrar la ventana enseguida
   quedaba a medio escribir.
7. ~~Campo de firma~~ — **hecho (15/08/2026)**. El editor prepara el recuadro; firmar necesita un
   certificado y no lo hace el editor. Detalle en ROADMAP.md fase 4.
8. ~~Más formas geométricas~~ — **hecho (15/08/2026)**: elipse, triángulo, flecha y estrella, en un
   solo elemento `forma`. Detalle en ROADMAP.md fase 4.
9. ~~Asignar elementos a una capa~~ — **hecho (16/08/2026)**: capa destino para los nuevos, y para
    los que ya están el desplegable de Propiedades, arrastrar la fila y el clic derecho. Se puede
    borrar una capa sin perder lo que tiene adentro. Detalle en ROADMAP.md fase 4.
10. ~~README y documentación de contribución~~ — **hecho (16/08/2026)**: README reescrito (qué
    hace hoy, instalación, comandos de verificación, stack, estado real) y CONTRIBUTING.md nuevo
    —issues sí, PR solo después de charlarlo en uno—. `componerIcono.cjs` pasó del scratchpad a
    `scripts/`, documentado. Metadatos de `package.json` completos (description, license, author,
    repository, bugs).
11. ~~Formas giradas del PDF~~ y ~~menú de capas~~ y ~~temas de color~~ — **hecho (16/08/2026)**.
    Detalle en ROADMAP.md. De los tres, el que dejó deuda es ninguno; el que destapó un agujero
    viejo fue el de capas (las capas no estaban en el historial, ya corregido).
12. ~~Imágenes del PDF~~ — **hecho (16/08/2026)**: doble clic y la imagen sale del PDF y vuelve como
    imagen del diseño, con lo que se la mueve, redimensiona y borra. Lo más valioso de esta tanda no
    fue la función sino **probarla con un manual real**: destapó cuatro bugs que ningún PDF armado
    en el arnés mostraba (ruido en las matrices, imágenes espejadas, la transparencia en una máscara
    aparte, y la miniatura que nunca mostró lo dibujado). Para eso quedó
    `npm run inspeccionar -- archivo.pdf`. **Si se toca cualquier cosa que lea PDF ajeno, probar con
    archivos de verdad antes de darlo por bueno.**
13. ~~Un solo apilado, y que las capas manden~~ — **hecho (16/08/2026)**. Era el pendiente más
    grande y el único que se notaba usando la aplicación. La página del PDF pasó a ser **un objeto
    más de la pila** (antes iba de `backgroundImage`) y desapareció el `destination-over` que partía
    el orden en dos grupos incomunicados. La decisión de producto que tomó Germán: **la banda es de
    la capa, no del elemento** —el fondo ocupa un lugar en el orden de capas, y una capa entera está
    delante o detrás de la página—, así que la regla "capa 1 nunca detrás de capa 2" quedó sin
    excepciones y "Al frente"/"Enviar atrás" quedaron acotados a la capa. El panel de Capas muestra
    la página como una fila arrastrable: la lista dejó de mentir. Se fue la casilla "Debajo del
    contenido del PDF" (los proyectos viejos se migran solos al abrirlos). Detalle completo en
    ROADMAP.md, fase 4.
    **Probado a mano por Germán (16/08/2026)**, además de los arneses (`verificar-apilado`, nuevo,
    más los cinco de siempre). La lista de "Qué mirar si se toca el apilado", más abajo, queda como
    guía para el día que alguien lo toque.
14. **SmartScreen — solicitud enviada a SignPath Foundation (16/08/2026), esperando revisión.** Se
    investigó y se descartaron antes Azure Trusted Signing (no admite Argentina) y un certificado
    EV (pide empresa registrada). El camino elegido es **SignPath Foundation** (firma OV gratis
    para OSS), y ya está el CI que compila los instaladores
    (`.github/workflows/build-windows.yml`), que es el requisito previo que pide la Foundation.
    La solicitud en <https://signpath.org/apply> la mandó Germán mismo —confirma control del repo
    con su propia cuenta, no lo puede hacer un agente— con estos datos: proyecto EditorPDF
    (<https://github.com/gsomma86/EditorPDF>), AGPL-3.0, a firmar los instaladores `.exe`/`.msi` de
    Tauri, descubierto por una herramienta de IA (Claude) durante el desarrollo. El campo más débil
    de la solicitud fue "Reputation" —el proyecto es nuevo, sin cobertura ni comunidad todavía—, así
    que **puede llegar un rechazo o pedido de más pruebas** en vez de una aprobación directa; la
    revisión normal tarda de días a una semana.
    **Si aprueban**: la Foundation da credenciales para agregar un paso de firma al workflow ya
    existente (ver `signpath/github-action-submit-signing-request` en la documentación de SignPath)
    — ese paso sí lo puede terminar un agente.
    **Si rechazan por reputación**: no hay nada que hacer del lado del código; esperar a tener uso
    real (descargas, alguna mención) y volver a aplicar.
15. ~~Pulido de la aplicación de escritorio~~ — **hecho y probado con el `.exe` instalado
    (17/08/2026)**. Cuatro cosas, todas solo en escritorio (en el navegador no cambia nada):
    - **Pantalla de bienvenida** al arrancar, estilo Word/Excel: `public/splash.html` (a propósito en
      `public/`, para que se pinte antes de que cargue nada del editor), con versión clara y oscura
      según el tema del sistema. Los tiempos los maneja `src-tauri/src/lib.rs`: 2 s como mínimo, 5 s
      de tope por si el editor nunca avisa, 0,75 s de desvanecido. La ventana principal **nace
      oculta** y la muestra `terminar()`; por eso se arma en `lib.rs` y no en `tauri.conf.json`.
    - **Siempre arranca en documento nuevo**, sin ofrecer retomar lo anterior. El autoguardado y la
      pregunta de "¿seguir donde dejaste?" siguen existiendo, pero solo en el navegador.
    - **El botón de cerrar pregunta si guardar** (`cablearCierre` en `ui/bienvenida.ts`), que es lo
      único que separa al usuario de perder el trabajo ahora que no se retoma solo. Cierra con
      `destroy()` y no con `close()`: `close()` volvería a disparar el mismo enganche.
    - **Guardar el proyecto lo escribe Rust** (`guardar_en_disco`), no una descarga. Va a Descargas
      —o Documentos—, limpia el nombre, no pisa lo que ya haya (`proyecto (2).json`) y devuelve la
      ruta, que se muestra con un botón para copiarla. El porqué está en la lección 63: esperar el
      aviso de descarga del WebView **no sirve, para un `blob:` no llega nunca**.

## Cómo verificar

```bash
npm run verificar-export   # el PDF exportado contra lo que dibuja el lienzo
npm run verificar-pdf      # que borrar un texto de un PDF lo borre, y no lo tape
npm run verificar-campos   # importar los campos de una plantilla real, exportar y comparar que vuelvan iguales
npm run verificar-apilado  # el orden real del lienzo: que las capas manden y nadie cruce de capa
npm run verificar-objetos # redimensionar: que el modelo y el objeto del lienzo queden de acuerdo
npm run medir-rendimiento  # 50, 200, 500 y 1000 elementos
```

Los cinco corren sin navegador. En `verificar-export` quedan cuatro diferencias marcadas en los
casos de texto: **son de la medición, no del código** — en Node no está la Helvetica real y
node-canvas dibuja con una sustituta más ancha. Para cerrarlas habría que registrar la fuente real
en el arnés.

`verificar-campos` encontró en su momento (a mano, antes de que existiera) un bug de campos
duplicados al exportar y un crecimiento de medio punto por vuelta; conviene correrlo antes de tocar
el exportador o `camposDelPdf()`.

En el navegador: el Browser pane integrado funciona (probado el 14/08), **con la pestaña a la
vista**. Si está oculta, `requestAnimationFrame` no se dispara y abrir un PDF queda colgado sin
dar ningún error, como si fuera un bug de la app.

### Qué mirar si se toca el apilado

Con un PDF real, no con uno armado en el arnés (lección 32 y 55):

1. Doble clic en una forma del PDF → queda **debajo** del texto de la página, como antes, y aparece
   la capa "Contenido del PDF" en el panel.
2. Convertir una banda gris con líneas adentro → se conserva el apilado relativo entre las que salen
   juntas.
3. Doble clic en una **imagen** del PDF → ahora también va a esa capa (antes quedaba encima).
4. Dos capas con elementos superpuestos → "Al frente" en la de atrás **no** puede tapar la de
   adelante.
5. Arrastrar la fila "Página del PDF" entre las capas → cambia qué queda encima y qué debajo.
6. Deshacer/rehacer, cambiar de hoja y **recargar la página** → el apilado se conserva en los tres.
7. Abrir un `.json` guardado **antes** de este cambio, con formas convertidas → tienen que verse
   igual que antes (se migran solas a la capa nueva).
8. Ctrl+A → no agarra la página (no se arrastra la hoja entera con el grupo).
9. Con una hoja **vacía** y un PDF de base, abrir otro PDF → **no** debe saltar el aviso de "vas a
   perder el trabajo".
10. Entrar y salir de "Completar campos" → la página sigue ahí.
11. Hoja con fondo y hoja sin fondo → navegar entre las dos no deja la página pegada.

## Cosas que conviene saber antes de tocar

- **Los campos de formulario solo rotan en múltiplos de 90°**: es del formato PDF. Con otro ángulo,
  al exportar con campos editables se redondea y el preflight avisa; aplanado sale exacto.
- **Cambiar tamaño, orientación, márgenes o fondo no se deshace con Ctrl+Z**: el historial guarda
  los elementos del diseño, no la configuración de la página.
- **El PDF de base vive en tres lugares**: memoria mientras se trabaja, IndexedDB para sobrevivir a
  una recarga, y dentro del `.json` al guardar el proyecto. En el autoguardado no, porque
  localStorage no aguanta un PDF.
- **Las capas son del documento, no de cada hoja** (como en InDesign): una capa se apaga de una vez
  para todas las hojas. La marca de cuál recibe los elementos nuevos vive en la capa misma
  (`destino`), así se guarda con el proyecto sin agregar nada al formato.
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

## Nada pendiente de probar

Al 17/08/2026 **no queda nada esperando una prueba a mano**: Germán probó el cierre con guardado, el
splash, el arranque en blanco y el guardado desde el `.exe` instalado. El camino que costó tres
intentos quedó anotado en las lecciones 54 (permisos de Tauri que fallan en silencio), 63 (esperar
un evento que nunca llega) y 64 (un `!` que mata la línea siguiente).

**Sobre probar la aplicación de escritorio con un agente**: no se puede simular con la sesión de
Windows bloqueada — las teclas no llegan al WebView y las capturas salen de la pantalla de bloqueo,
no de la aplicación. Si la prueba parece fallar de forma rarísima, verificar primero eso antes de
sospechar del código. En la práctica, **lo de escritorio lo prueba Germán**.

## Deudas técnicas conocidas

- ~~`sincronizarGeometria` para 'campo' reconstruye el objeto~~ — **resuelto (16/08/2026)**: ahora
  ajusta el grupo que ya existe. Ojo si se lo toca: los hijos de un grupo de Fabric se ubican
  respecto de su **centro**, no de su esquina, y la etiqueta hay que volver a recortarla al ancho
  nuevo. Cubierto por `npm run verificar-objetos`.
- **Las fuentes se incrustan sin subsetear** (`subset: false`). **Medido el 16/08/2026** con
  `npm run medir-fuentes`: cada familia cuesta **~38 KB**, no los ~20 KB que se creía (un PDF con
  tres familias y una línea cada una pesa 113,8 KB).
  **El arreglo obvio no funciona.** El motivo que figuraba antes —que a fontkit se le pasaba un
  woff— ya no aplica: `bytesDeFuente` devuelve el sfnt reconstruido y fontkit lo **lee** sin
  problema. Lo que se rompe es su *subsetter*: con `subset: true` tira
  `Cannot read properties of undefined (reading 'pos')` en las tres familias probadas.
  O sea que la salida no es convertir a TTF (ya se convierte), sino averiguar qué le falta a
  nuestro sfnt para que el subsetter lo trague, o subsetear con otra herramienta. **No lo intentes
  sin medir antes**: el script ya está y deja la línea base.
- ~~Las tablas no bajan al PDF con el mismo código que las dibuja en pantalla~~ — **resuelto
  (16/08/2026)**: las líneas internas salen de `internasDeTabla` en `editor/figuras.ts`, el mismo
  módulo que ya compartían las formas. `tablaObjeto.ts` y `exportarPdf.ts` solo las trazan.
- ~~El QR se regenera en cada tecla~~ — **resuelto (16/08/2026)**: el texto lleva un respiro de
  250 ms. Los colores y el fondo siguen inmediatos, que ahí cada cambio es uno solo.

## Pedidos pendientes de Germán (anotados el 17/08/2026, sin empezar)

Dos pedidos sobre la tabla, para cuando haya crédito fresco. **No arrancar sin releer el código
actual de `tablaObjeto.ts`** — puede haber cambiado.

1. **Cambiar la cantidad de filas/columnas desde Propiedades.** Hoy, con una tabla seleccionada,
   `campoTabla()` en `panelPropiedades.ts` (línea ~508) solo muestra un resumen de solo lectura
   ("N filas × M columnas") — la cantidad se fija una sola vez, en el modal al insertarla
   (`pedirFilasColumnas`), y no se puede tocar después. Falta agregar ahí un control (dos números,
   o reabrir el mismo modal) que permita cambiarla con la tabla ya puesta en la hoja.
   **Decisión de diseño que falta tomar al implementarlo**: al subir la cantidad, ¿la fila/columna
   nueva se agrega al final con un tamaño por defecto (60pt/24pt, como al crearla), o se reparte el
   espacio existente entre todas? Al bajarla, ¿se descarta la última o la que esté vacía/más chica?
   El editor público no resuelve esto (no dejaba cambiar la cantidad después de puesta), así que no
   hay una referencia a copiar — es una decisión nueva, más simple: agregar/quitar al final con el
   tamaño por defecto, sin redistribuir las demás.

2. **Las dimensiones externas de la tabla tienen que quedar fijas al mover una línea interna.**
   Confirmado en el código actual (`accionRedimensionar` en `tablaObjeto.ts`, línea ~97): cada
   columna y cada fila tiene su propio control (`col0`, `col1`, …, incluida la última), y arrastrar
   cualquiera de ellos hoy cambia **solo** `cols[i]` (o `rows[i]`) sin tocar a sus vecinas — como el
   ancho/alto total de la tabla es la suma de todas, mover una división interna cambia el tamaño
   total de la tabla entera, que es justo lo que Germán no quiere.
   **El arreglo, ya sin ambigüedad porque la estructura de controles lo deja claro**: para toda
   columna `i` que **no** sea la última (`i < cols.length - 1`), arrastrar su control tiene que
   repartir entre `cols[i]` y `cols[i+1]` — si una crece, la vecina siguiente se achica lo mismo,
   así la suma total no cambia (con el mínimo de 8pt/6pt de siempre como piso). Mismo criterio para
   filas. **El control de la última columna/fila queda como está**: como no tiene una vecina
   siguiente a la que restarle, cambiar su tamaño ya cambia el total — y es exactamente lo que
   Germán pidió que pase ahí ("los controles de la última fila/columna" sí pueden tocar las
   dimensiones externas). Los 4 controles de las esquinas (`createObjectDefaultControls`, sin tocar
   en este archivo) siguen escalando la tabla entera como hasta ahora — no cambian con este pedido.
   Cubierto hoy por `npm run verificar-objetos`; conviene correrlo después del cambio y sumarle un
   caso que arrastre una columna que no sea la última y confirme que el ancho total no se movió.

## Fuera del código

Germán quiso conectar el proyecto a **Claude Code en la nube** y no se pudo. Del lado de GitHub la
app de Claude está instalada en `gsomma86` con los repos elegidos; del lado de Claude la lista
aparece vacía y no hay opción de GitHub en Configuración. La causa probable es que su cuenta de
Claude es la de trabajo y el GitHub es personal — en una cuenta de organización esa vinculación la
suele habilitar un administrador. **No está confirmado.** No bloquea nada: se trabaja local y se
pushea como hasta ahora.

## Por dónde seguir

**Empezá por acá si sos el agente que retoma.** El trabajo es de a uno por vez, en relevo: `git pull`
antes de tocar nada y releer CLAUDE.md, que es donde están la regla de alcance, las convenciones y
las 65 lecciones de bugs ya resueltos — y ahora también la regla de correr
`node scripts/subirVersion.cjs` antes de commitear una corrección.

Al 17/08/2026 **no hay nada funcional a medias**: el editor está completo en navegador y en
escritorio, todo commiteado y pusheado en `main` (versión 1.0.1), sin cambios sueltos en el árbol
de trabajo. Lo que queda abierto, en orden de lo que vale la pena:

1. **Los dos pedidos de tabla** (sección de arriba, "Pedidos pendientes de Germán"): editar la
   cantidad de filas/columnas desde Propiedades, y que mover una división interna no cambie el
   tamaño total de la tabla. Los más nuevos, pero los más concretos — ya están sin ambigüedad.
2. **Esperar a SignPath** (punto 14). Es lo único con una fecha ajena: si aprueban, hay que agregar
   el paso de firma a `.github/workflows/build-windows.yml` —eso sí lo puede hacer un agente— y con
   eso se va el aviso de SmartScreen al instalar. Si rechazan, no hay nada que tocar en el código.
3. **Las fuentes sin subsetear** (deudas técnicas). ~38 KB por familia, medido. **No lo intentes sin
   correr antes `npm run medir-fuentes`**, que deja la línea base: el arreglo obvio (`subset: true`)
   ya se probó y rompe.
4. **Usar la aplicación con archivos de verdad.** Es lo que más bugs encontró en todo el proyecto,
   muy por encima de las auditorías y de los arneses (ver el punto 12 y la lección 32). Para PDFs
   ajenos está `npm run inspeccionar -- archivo.pdf`.

Y lo que **no** hay que hacer sin hablarlo antes: sumar funciones nuevas. El alcance está cerrado a
propósito en CLAUDE.md, y la v1 ya hace todo lo que se propuso.

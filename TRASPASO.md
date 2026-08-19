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

Tres pedidos sobre la tabla, para cuando haya crédito fresco. **No arrancar sin releer el código
actual de `tablaObjeto.ts` y `figuras.ts`** — puede haber cambiado.

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

2. ~~Las dimensiones externas de la tabla tienen que quedar fijas al mover una línea interna.~~ —
   **hecho (19/08/2026).** `accionRedimensionar` en `tablaObjeto.ts` ahora distingue: para toda
   columna/fila que **no** sea la última, arrastrar su control reparte con la vecina siguiente (si
   una crece, la otra se achica lo mismo, con el mínimo de 8pt/6pt como piso) y la suma —el ancho o
   alto total— no cambia. El control de la última columna/fila queda igual que antes: sin vecina a
   la que restarle, mover ese sí cambia el total, que es lo que Germán pidió que pasara ahí. Los 4
   controles de las esquinas no se tocaron. Nuevo caso en `npm run verificar-objetos` que arrastra
   una columna que no es la última (confirma que el total no se mueve) y la última (confirma que sí
   cambia).

3. **Combinar celdas.** Es más manejable de lo que parece: **no hace falta tocar `cols`/`rows` ni
   los controles de arrastre para nada**, porque hoy las líneas internas se dibujan como líneas
   rectas de punta a punta (`internasDeTabla` en `figuras.ts`, compartido por pantalla y PDF) — combinar
   es, en el fondo, dejar de dibujar los tramos que caen dentro de la zona combinada. La grilla de
   abajo no cambia.
   - **Modelo**: sumar a `ElementoTabla` una lista de rangos combinados, algo como
     `combinadas: { filaDesde, filaHasta, colDesde, colHasta }[]`. Como el historial y Duplicar
     clonan el elemento entero (`JSON.parse(JSON.stringify(...))`), no hace falta tocar nada de eso.
   - **Dibujo**: `internasDeTabla` pasa de "una línea completa por división" a "un tramo por celda",
     salteando los tramos que caen dentro de un rango combinado. Como ya es el módulo que comparten
     `tablaObjeto.ts` (pantalla) y `exportarPdf.ts` (PDF), arreglándolo una vez alcanza para los dos.
   - **Selección (decidido con Germán, 17/08/2026): arrastrar sobre la tabla.** Con la tabla
     seleccionada, arrastrar el mouse sobre un bloque de celdas lo marca, y aparece un botón
     "Combinar". Se descartó la alternativa de números en el panel de Propiedades (fila/columna
     desde-hasta) por menos natural, aunque más simple de programar.
     **Ojo con la lección 1 de CLAUDE.md** (no repetirla): esto es una interacción nueva de mouse
     sobre el lienzo, y ya se intentó una vez resolver algo parecido (las guías de redimensionar
     fila/columna) con capas de HTML flotando sobre el canvas, y falló tres veces porque se
     desincronizaba con mover/zoom/escalar la tabla. La resolución que sí funcionó fue un `Control`
     nativo de Fabric — acá el arrastre no sale de un punto fijo como un `Control` normal, así que
     probablemente convenga escuchar `mouse:down`/`mouse:move`/`mouse:up` del lienzo, filtrando por
     si el clic cayó dentro del área de esta tabla (sin pisar los controles de redimensionar que ya
     existen) y dibujando la selección en el propio `_render` del objeto, no con DOM aparte.
   - Falta pensar también, al implementarlo: cómo se **deshace** una combinación ya hecha (¿un botón
     al seleccionar la zona combinada, o basta con volver a seleccionarla y "Combinar" hace toggle?).

4. ~~Controles numéricos para el tamaño total de la tabla.~~ — **hecho (19/08/2026).** Ancho y Alto
   se agregaron arriba de `campoTabla()` (no en `seccionPosicion`, que sigue saltando a la tabla) y
   reparten el cambio proporcionalmente entre `cols`/`rows`, la misma cuenta que ya hacía escalar
   desde una esquina (con el mínimo de 8pt/6pt de siempre). No dispara `registrarSnapshot` en cada
   tecla, igual que el resto de los campos numéricos en vivo.

### TEXTO

Todo esto está pendiente porque **`ElementoTexto` hoy no tiene `w`/`h` en absoluto** (se autoajusta
al contenido) — no son ajustes menores, hace falta agregarle una caja al modelo primero, y varios de
estos pedidos dependen de esa caja existiendo.

1. Mover el control de Alineación para que quede debajo del tilde "Varias líneas" (`campoTexto()` en
   `panelPropiedades.ts` — es reordenar HTML, no toca lógica).
2. **Tilde "el tamaño de fuente no cambia al redimensionar"**, antes del control Tamaño. Con la caja
   agregada (punto anterior de esta lista), redimensionar el objeto hoy solo puede leerse como "subir
   el cuerpo de la fuente" (así se resolvió cuando se agregó `w`/`h` a otros tipos). Este tilde le
   da un segundo sentido: la caja crece pero el texto adentro se queda del mismo tamaño, alineado
   como diga `align` dentro de esa caja más grande — que es, como bien dice Germán, lo único que le
   da sentido real a la alineación (con el texto ocupando siempre el 100% del ancho, alinear a la
   izquierda o al centro no se nota).
3. Color de fondo del recuadro de texto, con opción "Ninguno" (transparente, como es hoy). Mismo
   patrón que `conFondo`/`fondoColor` de campo/firma/imagen — no hay nada nuevo que inventar, es
   copiar el patrón ya usado tres veces.
4. **"La separación funciona distinto en vertical que en horizontal."** Confirmado en el modelo: un
   solo campo `separacion` cubre dos casos con semántica distinta —"entre las letras si es vertical,
   entre las líneas si es horizontal" (comentario en `elemento.ts`, campo `ElementoTexto.separacion`).
   Falta escuchar a Germán en qué anda mal exactamente: ¿la etiqueta del control no aclara cuál de
   las dos cosas está cambiando, o el número se comporta distinto de lo esperado en algún caso
   puntual (por ejemplo, con `multilinea` Y `vertical` prendidos los dos a la vez)? Probar ese
   combo antes de tocar nada — puede que el bug esté justo ahí, en la intersección de los dos.
5. Controles numéricos de Ancho/Alto del objeto texto en Propiedades — depende directo de agregar
   `w`/`h` al modelo (punto de arriba de esta lista): una vez que existan, es el mismo `seccionPosicion`
   genérico que ya usan línea/recuadro/forma/imagen/campo/firma/QR, sacando a `texto` de la
   exclusión de `conTamano`.

### TABLA — ver arriba (puntos 1 a 4 de esta sección)

### IMAGEN

1. Color de fondo del recuadro de imagen, con opción "Ninguno" (transparente, como es hoy). Mismo
   comentario que en texto: patrón ya usado en campo/firma, copiarlo tal cual.

### QR — bug confirmado

**Confirmado en el código** (`panelPropiedades.ts`): el campo "Tamaño" (`#ed-p-size`, línea ~857)
sí escribe `elemento.w`/`elemento.h` y repinta el QR — funciona. El problema es que la sección
genérica "Posición y tamaño" **también** muestra Ancho y Alto por separado (`seccionPosicion`, ya
que QR no está en la lista de exclusión), pero **no existe ningún `$('#ed-p-w')`/`$('#ed-p-h')`
para `elemento.clase === 'qr'`** en toda la función `wireCampos` — se puede confirmar buscando
`'qr'` ahí: no aparece ningún wiring de esos dos ids. Por eso:
- Tipear en Ancho/Alto no hace nada (no están escuchados).
- Cambiar Tamaño sí cambia la figura, pero como no toca el `.value` de esos dos inputs (que están
  ahí, mostrando el número viejo), se ven desactualizados hasta reseleccionar (ahí sí se
  reconstruye el panel entero desde el modelo y muestran el valor correcto).
**Arreglo**: o se sacan Ancho/Alto de la sección genérica para QR (ya que "Tamaño" los reemplaza,
al ser siempre cuadrado) y no hay dos controles para lo mismo, o se los cablea igual que en
`imagen`/`campo` y se saca el campo "Tamaño" — mejor lo primero, es menos código y evita el
control duplicado que generó la confusión.

### FIRMA — hecho (19/08/2026)

**Era solo el panel: la exportación ya estaba bien.** Al revisar `exportarPdf.ts` para el arreglo,
`el.leyenda` ya se dibujaba (línea ~351) y `el.obligatorio` ya ponía el bit `Ff: 2` del widget
(línea ~379) — el diagnóstico anterior de que la exportación tampoco los usaba estaba desactualizado
(quedó resuelto en algún commit anterior sin que TRASPASO se actualizara). Lo único roto de verdad
era que **`wireCampos` no tenía ningún bloque `if (elemento.clase === 'firma')`**, así que nada de
lo que se tipeaba en el panel llegaba al modelo.
**Arreglo**: se agregó el bloque completo en `panelPropiedades.ts`, mismo patrón que `campo` —el
grupo de Fabric se reconstruye entero en cada cambio con `reemplazarObjeto` (no tiene una clase
propia con `refrescarDesdeDatos`, como sí tienen tabla/línea/recuadro/forma)—: nombre, leyenda,
obligatorio (este no reconstruye, solo registra el snapshot: no cambia nada visual en el lienzo),
grosor y color de borde, con fondo y color de fondo, y ancho/alto. Con esto los cuatro reportes de
Germán quedan resueltos sin tocar el exportador.

**Bug encontrado al probarlo (19/08/2026) y ya resuelto**: escribir en Nombre borraba el campo al
apretar Supr/Backspace. Era `'input'` en un control que reconstruye el objeto (rearma el panel
entero y el `<input>` enfocado se destruye, el foco se va al body, y la tecla siguiente la agarra el
atajo global de borrar). Pasaba también en 'campo' (Nombre, Tamaño, Color, grosor de borde), que ya
tenía el mismo patrón desde antes. Cambiados todos a `'change'`. Ver lección 66 de CLAUDE.md.

### LÍNEA

**Curvatura, centrada siempre.** Es el pedido más grande de esta lista en términos de arquitectura:
hoy `LineaObjeto` (`editor/lineaObjeto.ts`) dibuja un segmento recto — un rectángulo angosto, no un
trazo curvo — y su `width`/`height` son directamente su caja de selección. Agregar curvatura no es
prender una opción: cambia la forma de dibujarla (de rectángulo relleno a trazo con
`ctx.quadraticCurveTo`, grosor puesto con `lineWidth`) y probablemente la caja de selección (una
línea curva ocupa más espacio perpendicular a su eje que una recta del mismo largo). También hace
falta un camino nuevo en `exportarPdf.ts` (pdf-lib puede dibujar un path SVG con curva, hoy ahí se
usa `drawLine` derecho). Guardar como campo nuevo `curvatura: number` (el desplazamiento del punto
medio, perpendicular al eje de la línea) alcanza para el modelo; lo que lleva tiempo es la parte de
dibujo y exportación, no el dato en sí.

### ELIPSE

Agregar el estilo "doble" a la línea del contorno. Ver la nota general de FLECHA/TRIÁNGULO/ESTRELLA
más abajo: es la misma revisión de una decisión ya tomada, para las cuatro figuras a la vez.

### TRIÁNGULO

1. **Que no sea siempre isósceles con el vértice centrado.** Hoy `puntosDeFigura()` en
   `figuras.ts` (caso `'triangulo'`) pone el vértice superior siempre en `x: w/2` — fijo en el
   centro. Lo que Germán describe como "que no todos sean equiláteros" es en realidad esto: mover
   ese vértice a los costados para lograr un triángulo asimétrico (escaleno), no una cuestión de
   ángulos. Se resolvería con un campo nuevo, mismo patrón que `puntas` en la estrella (que "solo
   mira" una figura): algo como `verticeX: number` de 0 a 1 (0.5 = como está hoy, centrado), con su
   control numérico en el panel.
2. Agregar el estilo "doble". Ver la nota general más abajo.

### FLECHA

1. **Controles separados para el grosor del asta y la forma de la cabeza, tipo Word.** Hoy
   `puntosDeFigura()` (`figuras.ts`, caso `'flecha'`) calcula los dos con proporciones fijas de la
   caja: `cabeza = Math.min(w/2, h)` y `cuerpo = h/4` (el asta mide un cuarto del alto, siempre) —
   no hay ningún control independiente hoy, todo sale de w/h. Se explicaste bien: es exactamente lo
   que Word deja tocar con las "palancas" amarillas de ajuste sobre la forma. Se resuelve agregando
   dos campos nuevos (algo como `grosorAsta` y `tamanoCabeza`, ambos una fracción de la caja) que
   reemplacen a esas dos constantes fijas — y ahí se puede elegir si el control va en el panel (dos
   números) o como controles arrastrables sobre la figura, igual que ya se hizo con las divisorias
   de la tabla (`tablaObjeto.ts`) — el segundo camino es más "como en Word" pero más trabajo.
2. Agregar el estilo "doble". Ver la nota general más abajo.

### ESTRELLA

1. ~~Cantidad de puntas~~ — **descartado (17/08/2026): ya existe y funciona**, Germán lo confirmó
   probándolo de nuevo en el panel. Era `ElementoForma.puntas`, ya cableado desde antes.
2. **Qué tan puntiaguda es la estrella** — esto sí falta. `HUNDIDO_ESTRELLA = 0.42` en `figuras.ts`
   es una constante fija (qué tan adentro caen los vértices interiores respecto del radio exterior)
   y no depende de nada del elemento. Mismo patrón que `puntas`: agregar un campo nuevo (por ejemplo
   `hundido: number`, 0 a 1) que reemplace la constante, con su control en el panel.
3. Agregar el estilo "doble". Ver la nota general de acá abajo.

### Nota general — "doble" en elipse/triángulo/flecha/estrella

Las cuatro piden lo mismo, y hoy está descartado a propósito: `ElementoForma.estilo` tipa
`EstiloLinea` completo (incluye `'doble'`), pero el panel solo ofrece sólido/punteado
(`opcionesEstilo(elemento.estilo, ['solido', 'punteado'])` en `campoForma()`) y el comentario en
`elemento.ts` explica por qué: *"doble necesitaría dos caminos paralelos y no vale lo que cuesta"*.
Germán ahora lo quiere, así que es revisar esa decisión vieja, no descubrir algo nuevo. Para
figuras con curvas (elipse) o vértices (triángulo/flecha/estrella) el segundo camino paralelo no es
tan directo como en un rectángulo (que es la única figura donde ya funciona, vía `trazos.ts`):
haría falta ofsetear el contorno hacia adentro en cada figura; en la elipse se resolvería más
simple, con dos radios distintos en vez de un segundo camino. Antes de arrancar, medir de nuevo si
vale la pena el costo —
la razón original para no hacerlo no cambió, solo cambió que ahora lo piden.

### CAMPOS ACROFORM — bug confirmado

**"Ocultar campos" no oculta las copias fantasma de un campo repetible.** Confirmado en el código:
`ocultarCampos()` (`objetosFabric.ts`, línea ~83) apaga el objeto de Fabric del campo **origen**,
pero las filas fantasma de un campo con `repFilas > 1` no son objetos de Fabric — se dibujan aparte,
directo en el canvas, dentro de `dibujarAdornos()` en `vista.ts` (el mismo lugar que dibuja la
cuadrícula y los márgenes). Ese bloque **no importa `camposEstanOcultos()` de `objetosFabric.ts` en
ningún lado**, así que dibuja las fantasmas sin fijarse si "Ocultar campos" está prendido.
**Arreglo**: agregar `if (camposEstanOcultos()) return;` (o el `continue` correspondiente) al
principio del bloque que dibuja las fantasmas en `vista.ts`, importando `camposEstanOcultos` de
`objetosFabric.ts`. Un cambio de una línea, ya diagnosticado del todo.

### CARGA DE PDF — sin indicador de progreso, parece colgada

**Confirmado en el código.** El handler de `input#change` en `main.ts` (línea ~1123, "Abrir un PDF
existente") corre todo de un tirón, sin ningún aviso en pantalla entre elegir el archivo y el diálogo
final "PDF abierto": `abrirPdf()` → `hojasDesdePdf()` → `camposDelPdf()` →
`colocarCamposImportados()` → recién ahí `mostrarAyuda(...)`. Con un PDF liviano no se nota; con uno
pesado (muchos objetos y/o campos AcroForm) esos pasos tardan varios segundos con la ventana sin
responder a la vista, y sin ningún cartel se lee como que la app se colgó. Germán lo reprodujo con
`Template recibo Argentina Napsis 2.pdf` (adjuntado 17/08/2026) y ya antes con
`Template recibo Argentina Napsis.pdf` (punto 3 más arriba, 556 rectángulos).
**Arreglo**: mostrar un overlay tipo "Cargando documento…" apenas se elige el archivo (antes de
`abrirPdf()`) y sacarlo recién después de `mostrarAyuda`. Ya existe el patrón de modal a reutilizar
—`.ed-modal-overlay` en `style.css` y el módulo `ui/modales.ts`—, alcanza con un overlay simple (sin
botones, solo texto o un spinner) en vez de inventar una pantalla nueva como el splash de Tauri. Ojo
con un detalle real: como todo corre en el hilo principal sin ningún `await` que ceda el control antes
de que empiece el trabajo pesado, el overlay puede no llegar a pintarse antes de que el navegador se
ponga a bloquear con el parseo — probablemente haga falta un `await new Promise(r => requestAnimationFrame(r))`
(o un `setTimeout(0)`) entre mostrar el overlay y llamar a `abrirPdf()`, para que el navegador tenga
la changa de pintarlo primero. Mismo problema aplica a "Insertar PDF" (`inputInsertar`, línea ~1051),
que hace el mismo tipo de trabajo.

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

1. **La lista grande de pedidos pendientes** (sección de arriba, "Pedidos pendientes de Germán"):
   tabla (4 puntos), texto, imagen, QR, firma, línea, elipse, triángulo, flecha, estrella, campos
   AcroForm y carga de PDF sin indicador. Adentro hay bugs ya diagnosticados del todo, sin nada de
   diseño por pensar — **empezar por esos, son los más baratos y los que más se nota que están rotos**:
   - El panel de Propiedades de **Firma no tiene ni un solo control cableado** (ni Leyenda, ni
     Obligatorio, ni Formato, ni Ancho/Alto). Sección "FIRMA" de arriba.
   - **QR** tiene Ancho/Alto sin cablear también, más un control "Tamaño" que no les actualiza el
     valor mostrado. Sección "QR" de arriba.
   - **"Ocultar campos"** no oculta las filas fantasma de un campo repetible — un `if` de una línea
     en `vista.ts`. Sección "CAMPOS ACROFORM" de arriba.
   - **Abrir/insertar un PDF pesado se ve colgado**, sin ningún indicador de carga entre elegir el
     archivo y el diálogo final. Sección "CARGA DE PDF" de arriba.
   El resto son pedidos de diseño (algunos chicos, como mover un control o agregar un color de
   fondo; otros grandes, como la curvatura de línea o separar el asta de la cabeza de la flecha).
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

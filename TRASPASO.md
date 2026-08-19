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

## Pedidos pendientes de Germán (anotados el 17/08/2026)

Los cuatro pedidos sobre la tabla (incluido "combinar celdas", el más grande de todo este lote) se
hicieron el 19/08/2026 y están detallados abajo. Lo único que sigue realmente pendiente en toda esta
sección es el punto 4 de TEXTO (separación vertical/horizontal), que necesita más detalle de
Germán, y la revisión visual de "combinar celdas" y de la curvatura de línea, que ningún arnés
headless puede cubrir.

1. ~~Cambiar la cantidad de filas/columnas desde Propiedades.~~ — **hecho (19/08/2026)**, con la
   decisión simple que ya se había anotado: agregar/quitar al final con el tamaño por defecto
   (60pt/24pt), sin redistribuir las demás. Dos inputs numéricos nuevos en `campoTabla()`, arriba de
   Ancho/Alto. A diferencia de esos —que solo reparten el cambio entre filas/columnas ya existentes—
   cambiar la CANTIDAD reconstruye el objeto entero con `reemplazarObjeto` (como campo/firma): la
   tabla tiene un control de Fabric por columna y por fila, armados una sola vez en el constructor
   (`construirControles`), y `refrescarDesdeDatos` solo reubica los que ya existen — no crea ni saca
   ninguno. Registra un paso de historial (a diferencia de los demás campos de este panel, que no lo
   hacen): agregar o sacar una fila/columna entera se sintió más parecido a duplicar o borrar un
   elemento que a cambiar un color.

2. ~~Las dimensiones externas de la tabla tienen que quedar fijas al mover una línea interna.~~ —
   **hecho (19/08/2026).** `accionRedimensionar` en `tablaObjeto.ts` ahora distingue: para toda
   columna/fila que **no** sea la última, arrastrar su control reparte con la vecina siguiente (si
   una crece, la otra se achica lo mismo, con el mínimo de 8pt/6pt como piso) y la suma —el ancho o
   alto total— no cambia. El control de la última columna/fila queda igual que antes: sin vecina a
   la que restarle, mover ese sí cambia el total, que es lo que Germán pidió que pasara ahí. Los 4
   controles de las esquinas no se tocaron. Nuevo caso en `npm run verificar-objetos` que arrastra
   una columna que no es la última (confirma que el total no se mueve) y la última (confirma que sí
   cambia).

3. ~~Combinar celdas.~~ — **hecho (19/08/2026)**, siguiendo el plan que ya estaba anotado acá, con
   la selección decidida con Germán el 17/08/2026 (arrastrar sobre la tabla, no números en el panel):
   - **Modelo**: `ElementoTabla.combinadas: CeldaCombinada[]` (`{filaDesde, filaHasta, colDesde,
     colHasta}`, índices de celda inclusive en los dos extremos). `combinarCeldas(tabla, seleccion)`
     en `elemento.ts` hace **toggle**: si la selección coincide exacto con un bloque ya combinado, lo
     separa; si se solapa a medias con uno existente, lo reemplaza entero (la grilla no admite
     bloques superpuestos); una selección de una sola celda no hace nada. `cols`/`rows` no se tocan
     para nada, como estaba previsto.
   - **Dibujo**: `internasDeTabla()` en `figuras.ts` pasa de "una línea por división" a "un tramo por
     celda" (con sumas parciales de `cols`/`rows`), salteando los tramos que caen adentro de un
     bloque combinado. Un solo cambio, compartido por `tablaObjeto.ts` y `exportarPdf.ts`, como ya
     pasaba con el resto de la geometría de la tabla.
   - **Selección — sin repetir la lección 1 de CLAUDE.md**: nada de DOM flotando sobre el canvas.
     `activarCombinarCeldas(lienzo)` (nueva, en `tablaObjeto.ts`, llamada una vez desde `main.ts`
     junto a `activarVista`) escucha `mouse:down`/`mouse:move`/`mouse:up` del lienzo entero — hace
     falta a ese nivel y no como evento propio del objeto porque un `FabricObject` común no dispara
     `mousedown`/`mouseup` sobre sí mismo (eso es algo que arma cada mixin que lo necesita, como el
     texto editable; no es gratis para cualquier subclase). **Mantener Shift** mientras se arrastra
     sobre el cuerpo de una tabla ya seleccionada arma la selección; sin Shift el arrastre sigue
     siendo el de mover la tabla, de siempre, sin ningún cambio — y un clic que ya iba a redimensionar
     una columna/fila (`opt.transform` ya seteado por Fabric) se deja pasar de largo. La selección
     vive en `TablaObjeto.celdaSeleccion` (transitoria, no en el modelo) y se dibuja en el propio
     `_render` del objeto — se abandona (vuelve a `null`) con cualquier clic sin Shift, incluida la
     confirmación del botón "Combinar" en el panel.
   - **De un clic a "qué celda es"**: `TablaObjeto.celdaEnPunto()`, nuevo, convierte el punto de la
     escena a coordenadas locales con `fabric.util.transformPoint` + `invertTransform` +
     `calcTransformMatrix()` del propio objeto — sigue funcionando con zoom, pan y rotación sin
     recalcular nada a mano. Ver la lección 69 de CLAUDE.md, que documenta esta receta para la
     próxima vez que haga falta.
   - **Deshacer una combinación**: quedó resuelto solo, era la alternativa más simple que se había
     dejado anotada — volver a marcar el mismo bloque exacto y tocar "Combinar" de nuevo lo separa
     (toggle), sin un botón aparte.
   - Botón "Combinar celdas" siempre visible en el panel de la tabla (con una nota explicando Shift
     + arrastrar); al tocarlo sin ninguna selección activa no hace nada.
   - **Probado con `verificar-objetos`** (`combinarCeldas` — toggle, solape, celda única — e
     `internasDeTabla` con un bloque combinado, todo lógica pura sin Fabric) y con el resto de los
     arneses, sin regresiones. **Lo que ningún arnés puede probar es la interacción de mouse en sí**
     (Shift + arrastrar sobre una tabla real, que el rectángulo de selección se vea bien, que el botón
     aparezca deshabilitado o con la nota correcta) — hace falta que Germán la pruebe a mano antes de
     confiar en ella, más que cualquier otra cosa de este lote.
   - **Bug real encontrado al probarlo (19/08/2026) y ya resuelto**: el Shift + arrastrar no hacía
     nada. La causa: Fabric arma una `transform` propia con `action: 'drag'` para **cualquier** clic
     sobre el cuerpo de un objeto ya seleccionado —no solo al agarrar un control—, así que
     `!opt.transform` (el chequeo original para "no es un control") daba `false` siempre y el
     `mouse:down` se descartaba de entrada. El arreglo compara `opt.transform.action === 'drag'` en
     vez de la sola presencia de `opt.transform`, y **cancela** esa transform de Fabric
     (`lienzo._currentTransform = null`, campo interno sin API pública, pero es como el propio
     `_onMouseMove` de Fabric decide si mover el objeto) para que no compita moviendo la tabla al
     mismo tiempo que se arrastra la selección de celdas. Ver la lección 70 de CLAUDE.md.

4. ~~Controles numéricos para el tamaño total de la tabla.~~ — **hecho (19/08/2026).** Ancho y Alto
   se agregaron arriba de `campoTabla()` (no en `seccionPosicion`, que sigue saltando a la tabla) y
   reparten el cambio proporcionalmente entre `cols`/`rows`, la misma cuenta que ya hacía escalar
   desde una esquina (con el mínimo de 8pt/6pt de siempre). No dispara `registrarSnapshot` en cada
   tecla, igual que el resto de los campos numéricos en vivo.

### TEXTO — 4 de 5 hechos (19/08/2026)

**Modelo**: `ElementoTexto` suma `w`, `h`, `tamanoFijo`, `conFondo`, `fondoColor`. La pieza central es
`tamanoFijo`, que decide entre dos formas de ser bien distintas — pensado así para no arriesgar nada
del texto de toda la vida, que es lo más probado y lo más delicado de todo el editor (entra en la
redacción de PDFs ajenos, en texto vertical, en multilínea, en la paridad de métricas con pdf-lib):

- **`tamanoFijo: false` (default, como siempre fue)**: el objeto de Fabric sigue siendo el mismo
  `FabricText` de antes, con el mismo código de construcción, la misma exportación
  (`case 'texto'` en `exportarPdf.ts`, sin ninguna rama nueva activa) y el mismo comportamiento al
  redimensionar (`sincronizarGeometria` sube o baja `size`). `w`/`h` son **de solo lectura, en la
  práctica**: se recalculan solos después de cada cambio (`redibujar()`/`objeto.width` en
  `panelPropiedades.ts`) para llevar la cuenta de lo último dibujado, no para mandar sobre nada. El
  fondo (`conFondo`) usa la misma propiedad `backgroundColor` nativa que ya lleva Imagen — ningún
  Group nuevo hace falta acá tampoco.
- **`tamanoFijo: true` (nuevo, opt-in)**: recién acá el texto deja de ser el objeto y pasa a ser un
  hijo de un `Group` (fondo + texto), exactamente el mismo molde que ya usa 'campo'. `w`/`h` mandan
  de verdad, el texto se posiciona adentro según `align` (horizontal, siempre centrado en vertical) y
  redimensionar cambia la caja sin tocar el cuerpo de la fuente (reconstruye con `reemplazarObjeto`,
  no hay un ajuste en su lugar como el de 'campo' — para esta primera versión no valía la pena).
  Cualquier edición que pueda afectar tamaño o posición (texto, tamaño, alineación, tipografía)
  reconstruye entero; el color no, porque no cambia nada de eso.

1. ~~Mover el control de Alineación debajo de "Varias líneas".~~ — **hecho**: `bloqueTipografia()` se
   partió en `bloqueFuente()` (familia + N/K/S) y `bloqueAlineacion()` (los tres botones), y
   `campoTexto()` pone la alineación en la sección de contenido, debajo del tilde, sin tocar cómo se
   arma el panel de 'campo' (que sigue usando las dos juntas, en el mismo orden de siempre).
2. ~~Tilde "el tamaño de fuente no cambia al redimensionar".~~ — **hecho**: es `tamanoFijo`, descrito
   arriba. Con la caja apagada (de toda la vida) el tilde de alineación sigue sin notarse — es
   exactamente lo que señalaba Germán, y ahora tiene una salida real.
3. ~~Color de fondo, con "Ninguno".~~ — **hecho**, `backgroundColor` nativo si no hay caja fija, un
   `Rect` en el grupo si la hay.
4. **"La separación funciona distinto en vertical que en horizontal."** — **sigue sin tocar**. Sigue
   haciendo falta que Germán cuente qué es lo que anda mal exactamente (¿la etiqueta no aclara cuál
   de las dos cosas cambia, o el número se comporta raro en algún combo puntual como
   `multilinea` + `vertical` juntos?) — no es algo que se pueda adivinar mirando el código, como sí
   lo fueron los otros cuatro puntos de esta lista.
5. ~~Controles numéricos de Ancho/Alto en Propiedades.~~ — **hecho, pero solo quedan visibles con
   `tamanoFijo` prendido** (sin caja fija no hay nada que el usuario pueda mandar: se decidió
   ocultarlos en vez de mostrarlos deshabilitados, mismo criterio que QR con "Tamaño"). No se tocó
   `seccionPosicion()` para esto — los inputs de ancho/alto de texto viven en `campoTexto()`, aparte
   del bloque genérico que sigue excluyendo a `'texto'` como siempre.

**Probado con los arneses** (`verificar-export`, `verificar-pdf`, `verificar-campos`, `verificar-hojas`,
`verificar-objetos`, todos verdes con la misma base de siempre —los 4 "problemas" conocidos de fuente
sustituta, nada nuevo—) y un caso nuevo en `verificar-objetos` para el redimensionado con caja fija.
**Falta la prueba visual de Germán**, sobre todo: texto con `tamanoFijo` y alineación centro/derecha
(en pantalla y en el PDF exportado), y que el texto de toda la vida (`tamanoFijo` apagado) seguga
viéndose exactamente igual que antes en todos los casos ya probados (vertical, multilínea, redacción
de un PDF ajeno).

**Hallazgo al costado, no corregido**: la exportación de un texto sin caja fija **nunca usó `align`**
— cada renglón se dibuja siempre pegado a `x=0` (`exportarPdf.ts`, caso `'texto'`), mientras que en
pantalla Fabric sí reparte los renglones más cortos según `textAlign` cuando hay varios de distinto
ancho (multilínea o vertical). Es un desvío preexistente entre lienzo y PDF, más angosto que este
pedido y fuera de su alcance — se aplicó el offset de alineación solo a la rama nueva
(`tamanoFijo: true`), sin tocar el camino de siempre. Vale la pena una tarea aparte el día que a
alguien le importe.

### TABLA — ver arriba (puntos 1 a 4 de esta sección)

### IMAGEN — hecho (19/08/2026)

Color de fondo, con "Con fondo" + color, igual que campo/firma/QR. A diferencia de esos —que son un
`Group` con un `Rect` de fondo aparte—, la imagen es un solo `FabricImage`: se usa la propiedad
`backgroundColor` que trae todo objeto de Fabric (pinta detrás del objeto entero, así se nota con
transparencia real como un PNG), sin tener que convertirla en Group. En la exportación se dibuja un
rectángulo relleno antes que la imagen, con `dibujarRectangulo` (mismo camino que usa firma).

### QR — hecho (19/08/2026)

Era justo lo que decía el diagnóstico anterior: dos controles para lo mismo. `seccionPosicion()`
ahora excluye a `'qr'` de `conTamano` (como ya hacía con texto y tabla), así que Ancho/Alto genéricos
dejaron de mostrarse — el campo "Tamaño" de `campoQr()`, que ya estaba cableado y funcionando, queda
como el único control de tamaño. No hizo falta tocar `wireCampos` para nada.

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

### LÍNEA — hecho (19/08/2026)

**Curvatura, centrada siempre.** Nuevo campo `ElementoLinea.curvatura` (puntos, default 0 = recta;
positivo o negativo curva hacia un lado u otro). `LineaObjeto._render` usa `ctx.quadraticCurveTo` en
vez de `ctx.lineTo` cuando `curvatura !== 0`, reutilizando el mismo cierre `segmento()` que ya
armaba el trazo sólido/punteado/doble — el control del cuadrático va al **doble** de la curvatura
pedida, porque en un bezier cuadrático el punto medio real (lo que se ve) cae en la mitad de la
distancia al punto de control, no en el punto de control mismo.

**Control del panel: numérico, no "tipo radio" como pedía el mensaje original.** Se decidió así para
quedar consistente con el resto de los controles de geometría agregados en este mismo lote (puntas,
hundido, vértice, asta/cabeza), todos numéricos — un radio de 2-3 opciones fijas daba menos control
y no aportaba nada a cambio. **Si a Germán no le convence, es un cambio chico** (cambiar el
`<input type="number">` por un grupo de radios con 2-3 valores preseteados de curvatura).

**La caja de selección crece con la curvatura (19/08/2026, a pedido de Germán tras probarlo).**
Primera versión: se dejó `width`/`height` sin tocar a propósito, por el riesgo de meterse con
`x`/`y`. Germán probó una curvatura grande y confirmó que el pico quedaba fuera del rectángulo de
selección, y pidió que lo abrace. Se implementó: `cajaDeLinea()` (nueva, en `lineaObjeto.ts`) calcula
`left`/`top`/`width`/`height` agrandando el eje corto en `|curvatura|` puntos, **corriendo `left` o
`top` según haga falta** para que el eje recto de la línea —lo que `x`/`y` siempre significaron— no
se mueva de lugar; solo se corre hacia el lado del bulto (si la curvatura hace crecer hacia abajo, el
tope no se toca; si crece hacia arriba, el tope se corre). `_render` compensa ese mismo corrimiento
al dibujar (resta `curvatura/2` a las coordenadas), así que el resultado visual no cambia, solo la
caja que lo rodea. **`sincronizarGeometria` necesitó su propio caso para 'linea'** (antes cerraba con
rect/forma en una rama compartida): la caja de Fabric ya no es un espejo directo de `w`/`h`, así que
al arrastrar un control de esquina la escala se aplica a `elemento.w`/`h` guardados (no a
`objeto.width`/`height`, que ahora traen el relleno de la curvatura), y la curvatura **no escala** —
queda fija en puntos absolutos, no proporcional al tamaño. Dos casos nuevos en `verificar-objetos`
(curvatura positiva y negativa) confirman la caja y la recuperación de `x`/`y` tras un arrastre.

**Control del panel: numérico, no "tipo radio" como pedía el mensaje original.** Se decidió así para
quedar consistente con el resto de los controles de geometría agregados en este mismo lote (puntas,
hundido, vértice, asta/cabeza), todos numéricos — un radio de 2-3 opciones fijas daba menos control
y no aportaba nada a cambio. **Si a Germán no le convence, es un cambio chico** (cambiar el
`<input type="number">` por un grupo de radios con 2-3 valores preseteados de curvatura).

**Exportación**: `exportarPdf.ts` dibuja la misma curva como un path SVG (`pathLineaCurva`, nueva)
cuando hay curvatura, con el mismo cálculo del punto de control; sin curvatura sigue usando
`drawLine` recto, sin cambios. El exportador nunca supo nada de la caja agrandada —trabaja siempre
con `el.x`/`el.y`/`el.w`/`el.h` del modelo, ajenos a esto— así que no hizo falta tocarlo de nuevo.
**Falta que Germán confirme en el navegador** que la caja se ve bien con distintas curvaturas
(positiva, negativa, chica, grande) y que moverla/duplicarla/deshacerla no la desubica.

### ELIPSE

~~Agregar el estilo "doble" a la línea del contorno.~~ — **hecho (19/08/2026)**. Ver la nota
general más abajo.

### TRIÁNGULO

1. ~~Que no sea siempre isósceles con el vértice centrado.~~ — **hecho (19/08/2026)**: nuevo campo
   `ElementoForma.verticeX` (0 a 1, default 0.5 = como antes), con su control numérico en el panel
   solo para esta figura. `puntosDeFigura()` en `figuras.ts` ahora arma el vértice en `w * verticeX`.
2. ~~Agregar el estilo "doble".~~ — **hecho (19/08/2026)**. Ver la nota general más abajo.

### FLECHA

1. ~~Controles separados para el grosor del asta y la forma de la cabeza, tipo Word.~~ — **hecho
   (19/08/2026), con la versión barata: dos números en el panel**, no palancas arrastrables sobre la
   figura (la otra opción que se había dejado anotada, más trabajo). Dos campos nuevos en
   `ElementoForma`: `grosorAsta` (fracción del alto, default 0.25 = el `h/4` de antes) y
   `tamanoCabeza` (fracción del alto, default 1 = el `Math.min(w/2, h)` de antes). `puntosDeFigura()`
   ya no tiene las dos constantes fijas.
2. ~~Agregar el estilo "doble".~~ — **hecho (19/08/2026)**. Ver la nota general más abajo — es la
   figura donde el resultado es menos exacto, por lo asimétrica que es la forma.

### ESTRELLA

1. ~~Cantidad de puntas~~ — **descartado (17/08/2026): ya existe y funciona**, Germán lo confirmó
   probándolo de nuevo en el panel. Era `ElementoForma.puntas`, ya cableado desde antes.
2. ~~Qué tan puntiaguda es la estrella~~ — **hecho (19/08/2026)**: nuevo campo `hundido` (0 a 1,
   default 0.42 = la constante `HUNDIDO_ESTRELLA` que reemplaza), con su control en el panel.
3. ~~Agregar el estilo "doble".~~ — **hecho (19/08/2026)**. Ver la nota general de acá abajo.

### Nota general — "doble" en elipse/triángulo/flecha/estrella — hecho (19/08/2026)

Se revisó la decisión vieja (descrita antes acá mismo) y se implementó con el camino que esa misma
nota dejaba anotado como el más barato: para la elipse, dos radios distintos (`rx`/`ry` ± un tercio
del grosor) — exacto. Para las otras tres, **no** un offset real del polígono (que para vértices
cóncavos o muy agudos puede autointersectarse): en cambio, el mismo contorno de `puntosDeFigura()`
escalado dos veces desde el centro de la caja (`dobleDeFigura()` en `figuras.ts`, nuevo, compartido
por el lienzo y el exportador). No da un ancho de trazo perfectamente constante en los bordes —se
nota más en la flecha, que es la figura más asimétrica de las cuatro—, pero con el grosor fino que
usa "doble" la diferencia no debería notarse a simple vista. **Falta que Germán lo mire en el
navegador**, sobre todo la flecha: si el efecto no convence ahí, la alternativa es un offset real de
polígono (más caro, sin problema de autointersección) en vez de este escalado.

### CAMPOS ACROFORM — hecho (19/08/2026)

`vista.ts` importa ahora `camposEstanOcultos` de `objetosFabric.ts` y el bucle que dibuja las
fantasmas en `dibujarAdornos()` las salta si está prendido — exactamente el cambio de una línea que
ya estaba diagnosticado.

### CARGA DE PDF — hecho (19/08/2026)

`mostrarCargando()`, nueva en `ui/modales.ts` (mismo patrón que `mostrarGuardando`: overlay sin
botones, lo cierra quien lo abrió), se muestra apenas se elige el archivo tanto en "Abrir PDF" como
en "Insertar PDF" (`main.ts`), y se cierra en un `finally` para que quede sacado también si el
`try` corta antes (el `return` temprano de "Insertar PDF" cuando el PDF no trae páginas, o cualquier
error). Como todo el trabajo pesado corre en el hilo principal sin ningún `await` que ceda el
control, hacía falta un `await new Promise((r) => requestAnimationFrame(r))` entre mostrar el
overlay y arrancar `abrirPdf()`/`insertarPdf()` — si no, el navegador nunca llegaba a pintarlo antes
de ponerse a bloquear con el parseo. Sin arnés propio (es puramente de UI, no hay forma de medirlo
sin abrir el navegador); probado por Germán con `Template recibo Argentina Napsis 2.pdf`, el mismo
PDF pesado que reprodujo el bug.

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
las 69 lecciones de bugs ya resueltos — y ahora también la regla de correr
`node scripts/subirVersion.cjs` antes de commitear una corrección.

Al 19/08/2026 **no hay nada funcional a medias**: el editor está completo en navegador y en
escritorio, todo commiteado y pusheado en `main`, sin cambios sueltos en el árbol de trabajo. Lo que
queda abierto, en orden de lo que vale la pena:

1. **Confirmación visual de Germán sobre lo hecho el 19/08/2026** — nada de esto tiene arnés
   headless posible, así que es lo más importante para cerrar de verdad este lote:
   - **Combinar celdas** de la tabla (Shift + arrastrar sobre una tabla seleccionada, botón
     "Combinar" en el panel) — es la interacción de mouse más nueva y grande de todo el proyecto.
   - **Curvatura de línea**, sobre todo con la caja de selección agrandada (pedido después de que
     Germán viera el primer resultado): que no se desubique al mover/duplicar/deshacer.
   - **Texto con `tamanoFijo`**, en particular alineación centro/derecha, en pantalla y en el PDF
     exportado — y que el texto de toda la vida (`tamanoFijo` apagado) siga viéndose exactamente
     igual que antes en los casos ya probados (vertical, multilínea, redacción de un PDF ajeno).
   - El resto de los controles de forma agregados (vértice del triángulo, asta/cabeza de la flecha,
     filo de la estrella, "doble" en las cuatro figuras).
2. **El punto 4 de TEXTO** ("la separación funciona distinto en vertical que en horizontal") sigue
   sin tocar — hace falta que Germán cuente qué anda mal exactamente, no es algo que se pueda
   adivinar mirando el código.
3. **Esperar a SignPath** (punto 14). Es lo único con una fecha ajena: si aprueban, hay que agregar
   el paso de firma a `.github/workflows/build-windows.yml` —eso sí lo puede hacer un agente— y con
   eso se va el aviso de SmartScreen al instalar. Si rechazan, no hay nada que tocar en el código.
4. **Las fuentes sin subsetear** (deudas técnicas). ~38 KB por familia, medido. **No lo intentes sin
   correr antes `npm run medir-fuentes`**, que deja la línea base: el arreglo obvio (`subset: true`)
   ya se probó y rompe.
5. **Usar la aplicación con archivos de verdad.** Es lo que más bugs encontró en todo el proyecto,
   muy por encima de las auditorías y de los arneses (ver el punto 12 y la lección 32). Para PDFs
   ajenos está `npm run inspeccionar -- archivo.pdf`.

Y lo que **no** hay que hacer sin hablarlo antes: sumar funciones nuevas. El alcance está cerrado a
propósito en CLAUDE.md, y la v1 ya hace todo lo que se propuso.

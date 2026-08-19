# EditorPDF — guía para agentes

> **¿Retomás el proyecto?** Leé primero [TRASPASO.md](TRASPASO.md): dice exactamente dónde se dejó,
> qué falta probar, qué falta implementar y las deudas técnicas conocidas.

Editor de PDF real, gratuito y open source (AGPL-3.0), al estilo Sejda PDF / Nitro PDF.
Repo: [gsomma86/EditorPDF](https://github.com/gsomma86/EditorPDF). Autor: Germán Somma.

## Regla: mantener esta documentación al día

Germán trabaja con **un agente por vez**, pero no siempre el mismo: cuando se le corta el crédito le
pasa una tarea puntual a otro. Estos archivos son la única fuente de verdad entre uno y el
siguiente, que llega sin haber visto la conversación anterior. Al cerrar cada tanda de trabajo,
antes de dar el tema por terminado y sin esperar a que te lo pidan:

- Tildar en [ROADMAP.md](ROADMAP.md) lo que quedó listo, y agregar lo que se descubrió que falta.
- Si apareció una decisión de arquitectura, una convención nueva o un bug con causa no obvia,
  anotarlo acá (en "Lecciones aprendidas" o donde corresponda) para que el próximo agente no lo
  vuelva a tropezar.
- Commitear esos cambios junto con el código.

Documentación desactualizada es peor que no tener documentación: manda al próximo agente en la
dirección equivocada.

## Regla: subir la versión en cada corrección

Cada vez que se corrige algo (un bug, no una charla o una lectura), correr antes de commitear:

```bash
node scripts/subirVersion.cjs
```

Sube el parche (`1.0.0` → `1.0.1`) en los **cinco** lugares donde vive el número de versión —
`package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, el splash de escritorio
(`public/splash.html`) y el menú Ayuda › Acerca de (`src/ui/ayuda.ts`, una vez por idioma) — todos
de una sola vez, así no queda ninguno desincronizado. Para una feature nueva, `node
scripts/subirVersion.cjs minor`; para un cambio que rompe compatibilidad, `major`. El script avisa
si alguno de los cinco no se pudo actualizar (por ejemplo si el texto ya no coincide porque alguien
lo redactó distinto): no commitear hasta que los cinco queden en verde.

## Regla de alcance (la más importante)

**El objetivo es tener TODAS las funciones del editor público de ReciboMail, MÁS la capacidad de
editar el contenido de PDFs preexistentes.** No es un reemplazo recortado: cualquier función que
exista en el editor público y falte acá es una regresión, no una simplificación.

El editor público original está en:

```
C:\Users\gsomma\Documents\WEB PDF2\ReciboMail\src\ReciboMail.Web\wwwroot\editor\
  index.html    (~68 KB — estructura, menús, modales, paneles)
  editor.css    (~28 KB — la paleta y todos los componentes)
  editor.js     (~125 KB — toda la lógica)
```

**Al implementar o mockear cualquier pantalla, releer el archivo original correspondiente** en vez
de reconstruirlo de memoria o de un resumen. Germán ya corrigió varias veces ítems faltantes
(el "Acerca de..." del menú Ayuda, "Importar/Exportar campos (CSV)", "Completar campos") que se
habían omitido por no volver a mirar el original. Antes de dar por cerrado un menú o panel, listar
ítem por ítem contra el original.

## Por qué existe este proyecto

El editor público es parte de un producto cerrado, así que solo podía usar librerías con licencia
permisiva (pdf.js, pdf-lib) — que permiten generar y superponer, pero **no editar el contenido real
de un PDF hecho en otra herramienta**. Eso requiere motores AGPL como MuPDF, imposibles en un
producto propietario. Este proyecto es open source desde el día uno, así que esa puerta se abre.

Consecuencia práctica: **el proyecto es AGPL-3.0 y debe seguir siéndolo** mientras use `mupdf`.
Cualquiera que reciba el software puede exigir el código fuente completo.

## Stack

| Pieza | Qué hace |
|---|---|
| `fabric` v7 | Superficie de edición interactiva (el lienzo y sus objetos) |
| `pdfjs-dist` | Dibuja la página del PDF abierto para verla de fondo mientras se edita |
| `mupdf` | Lee y edita el contenido real de un PDF existente (redacción + reinserción) |
| `@cantoo/pdf-lib` | Genera el PDF final: dibujo, AcroForm, fuentes incrustadas |
| `qrcode` | Generación de QR |
| `@fontsource/*` | 8 familias tipográficas OFL, cargadas on-demand |
| Vite + TypeScript | Build |

Todo corre 100% del lado del cliente. **No hay ni debe haber backend.** A futuro se empaqueta con
Tauri para escritorio (fase 5), reusando el mismo frontend.

## Comandos

```bash
npm run dev              # servidor de desarrollo en http://localhost:5173
npm run build            # build de producción
npx tsc --noEmit         # chequeo de tipos (correr siempre antes de commitear)
npm run verificar-export # compara el PDF exportado contra lo que dibuja el lienzo (headless)
npm run verificar-pdf    # borra un texto de un PDF real y comprueba que no quedó tapado
npm run verificar-campos # importa los campos de una plantilla real, exporta y compara que vuelvan iguales
npm run verificar-apilado # el orden real del lienzo: que las capas manden y nadie cruce de capa
npm run verificar-objetos # redimensionar: que el modelo y el objeto del lienzo queden de acuerdo
npm run medir-rendimiento # cuánto tarda el lienzo con 50, 200, 500 y 1000 elementos
```

`verificar-export` es la red de seguridad del exportador y **conviene correrlo ante cualquier
cambio de geometría, del exportador o de cómo se crean los objetos de Fabric**. Dibuja cada caso
en un lienzo de Fabric en Node, exporta el mismo caso a PDF, rasteriza los dos a 72 dpi (1 punto =
1 píxel) y compara las cajas de tinta: responde la única pregunta que importa al exportar, que es
si el PDF se ve donde se ve en pantalla. Vive en `pruebas/` (los casos, en `pruebas/casos.ts`).
El texto se compara con holgura porque en Node no están las fuentes reales y los glifos cambian.

`verificar-campos` es la red de fase 2: importa los campos AcroForm de una plantilla real
(`camposDelPdf`), los exporta de nuevo y compara que vuelvan idénticos. Encontró en su momento un
bug de campos duplicados al exportar y un crecimiento de medio punto por vuelta — bugs que antes
solo aparecían probando a mano. **Conviene correrlo antes de tocar el exportador o la importación
de campos**, sobre todo con más de un agente cambiando ese código a la vez.

## Estructura

```
src/
  main.ts                 Punto de entrada: arma el espacio de trabajo, cablea eventos del
                          lienzo, el menú Campos, la carga de imágenes y los atajos de teclado.
  style.css               Todos los estilos. Copia fiel de la paleta del editor público.
  editor/
    elemento.ts           EL MODELO. Tipos de cada elemento (texto/linea/rect/forma/qr/tabla/
                          imagen/campo/firma), sus constructores con valores por defecto, y el
                          área útil que acota dónde caen los elementos nuevos.
    figuras.ts            La geometría que comparten el lienzo y el exportador, en coordenadas
                          locales: las formas (elipse, triángulo, flecha, estrella, camino) y las
                          líneas internas de la tabla. Una sola definición para lo que se ve y lo
                          que baja al PDF — cuando cada lado calculaba la suya, tocar uno y
                          olvidarse del otro dejaba pantalla y PDF distintos.
    ../ui/temas.ts        Las paletas de color. Un tema es otro juego de valores para las mismas
                          variables CSS de :root, escritas en el elemento raíz. El papel queda
                          blanco en todos: el tema pinta la aplicación, no el documento.
    objetosFabric.ts      Traduce modelo -> objeto de Fabric. Mantiene el WeakMap objeto->modelo
                          (`elementoDe`), reconstruye el lienzo y sincroniza geometría. También
                          genera el QR (`generarQr`), compartido con el exportador.
    lineaObjeto.ts        \
    rectObjeto.ts          | Clases propias de Fabric que se dibujan desde el modelo. Existen
    tablaObjeto.ts        /  porque una forma de Fabric traza su borde una sola vez y el estilo
                          "doble" necesita dos. La tabla además lleva controles nativos por fila
                          y columna. Ver "Lecciones aprendidas".
    trazos.ts             Trazado de bordes compartido por los tres (sólido/punteado/doble) y el
                          grosor mínimo para que "doble" se distinga.
    pagina.ts             Tamaños de hoja (A4/Carta/Oficio/A5), orientación y márgenes.
    documento.ts          Config de página vigente y su aplicación al lienzo.
    vista.ts              Zoom, cuadrícula con enganche, reglas y guías de alineación. Dibuja los
                          adornos que no son parte del documento (cuadrícula, márgenes, guías) en
                          'after:render', no como objetos, para que no se puedan seleccionar ni
                          entren al historial ni al PDF.
    historial.ts          Deshacer/rehacer por snapshots del documento completo.
    autoguardado.ts       Guardado en localStorage con un respiro, y restauración al abrir.
    proyecto.ts           Serializar/leer el .json del proyecto (página + elementos + catálogo).
    csvCampos.ts          Importar/exportar el catálogo de campos en CSV.
    preflight.ts          Verificación previa a exportar y peso real del PDF.
    exportarPdf.ts        Genera el PDF con pdf-lib. Se carga con import dinámico desde main.ts
                          porque pesa ~1,5 MB y solo hace falta al exportar.
    fuentes.ts            Catálogo de fuentes: carga on-demand para la pantalla y bytes para
                          incrustar en el PDF.
    lienzo.ts             Crea el canvas de Fabric con el tamaño de página en puntos.
  ui/
    shell.ts              Encabezado, barra de menús, layout de 3 columnas, barra de estado.
    panelPropiedades.ts   Panel derecho: campos por tipo de elemento, acciones (duplicar, borrar,
                          al frente, enviar atrás) y el panel de selección múltiple.
    panelCampos.ts        Panel izquierdo: catálogo de IDs de campos AcroForm.
    modales.ts            Todos los modales (nuevo proyecto, márgenes, nombre de archivo,
                          filas × columnas, campo repetible, exportar, preflight, ayuda,
                          confirmación). Usar `abrir()` de acá para cualquier modal nuevo en
                          vez de armar otro sistema; su tercer parámetro corre con el modal ya
                          en pantalla, para los que muestran algo en vivo al escribir.
    ayuda.ts              Los textos del menú Ayuda, separados del mecanismo a propósito: es
                          el archivo a traducir cuando se sume el multiidioma.
    columnas.ts           Ancho y colapso de los paneles laterales, guardados en el navegador.
pruebas/                  Arneses headless, fuera del build. `casos.ts` tiene los casos: uno
                          los dibuja con Fabric y el otro los exporta a PDF, y se comparan.
```

**Arquitectura**: el modelo (`elemento.ts`) es la fuente de verdad; los objetos de Fabric son su
representación visual. `datosPorObjeto` (WeakMap en `objetosFabric.ts`) los vincula. El historial
serializa el modelo, no el canvas.

## Diseño acordado

El UX/UI está cerrado y validado con un mockup interactivo de las 5 pantallas clave (landing,
espacio de trabajo, nuevo proyecto, guardar/exportar, carga y error al abrir un PDF):
<https://claude.ai/code/artifact/e3b739f1-f47c-4260-8165-c39f16b73ab1> (privado de Germán).

Dos conceptos se separaron a propósito respecto del editor público, donde estaban confusos:

- **Guardar proyecto (.json)** ≠ **Exportar PDF**. En el original, "Guardar" descargaba el PDF y no
  tenía relación con guardar el trabajo en curso.
- **Abrir PDF** ≠ **Importar proyecto (.json)**, como dos entradas distintas del menú Archivo.

Regla general: validar UX/UI con mockups antes de codear cualquier pantalla nueva.

## Convenciones

- **Todo en español**: nombres de variables, funciones, comentarios y mensajes de commit.
- Comentarios solo donde el *por qué* no es obvio (una decisión, un workaround, un bug evitado).
  No comentar lo que el código ya dice.
- Los IDs del DOM replican los del editor público (`ed-p-*`, `ed-col`, `ed-chip`, …) para que las
  clases CSS y la comparación contra el original sean directas.
- Commits: mensaje explicando el *porqué*, no solo el qué. Si se corrigió un bug, describir la
  causa real.

## Lecciones aprendidas (bugs reales ya resueltos — no repetirlos)

1. **No dibujar UI sobre el lienzo con elementos HTML posicionados a mano.** Se intentó con las
   guías de redimensionar filas/columnas de la tabla y falló tres veces: se desfasaban al mover la
   tabla, no acompañaban el zoom ni la escala. La solución correcta son **controles nativos de
   Fabric** (`Control` con posición relativa), que viven en el sistema de coordenadas del objeto.
   Ver `tablaObjeto.ts`.
2. **Un `Group` de Fabric calcula mal su caja** cuando mezcla formas de distinto tipo (daba 181×73
   para una tabla de 180×72, y apretaba el contenido en una esquina). Para formas compuestas,
   conviene una subclase de `FabricObject` con `_render` propio.
3. **`backgroundColor` en el constructor de `Canvas` no se aplica**: hay que asignarlo como
   propiedad y llamar a `renderAll()`.
4. **`canvas.uniformScaling`** es lo que controla si arrastrar un vértice mantiene la proporción.
   El checkbox "Mantener proporción" tiene que escribir esa propiedad; no alcanza con guardarla
   en el modelo.
5. **Al arrastrar controles, Fabric no toca las medidas: deja `scaleX`/`scaleY`.** Hay que volcar
   eso al modelo en `sincronizarGeometria`, y cada tipo lo absorbe distinto: texto → sube el cuerpo
   de la fuente; línea/recuadro → `w`/`h` con escala de vuelta a 1; tabla → reparte entre filas y
   columnas; campo → `w`/`h` sin tocar la fuente (la caja se dimensiona aparte, como en el
   original); QR/imagen → conservan la escala porque así se dimensiona el bitmap.
   **El modelo es la fuente de verdad de todo lo demás** (panel, Duplicar, deshacer/rehacer,
   exportación). Si un tipo nuevo no absorbe su escala, el síntoma aparece lejos: por ejemplo,
   agrandar un texto arrastrando y después duplicarlo daba una copia con el tamaño viejo.
6. **Los estilos tienen que ir a `src/style.css`**, no quedarse en un mockup descartable. Pasó con
   `.ed-toggle`, `.ed-row2`, `.ed-sec` y `.mono`: los botones se veían sin estilo porque las clases
   nunca habían llegado al CSS real.
7. **Nombres internos del editor público ≠ nombres nuevos**: la tabla se llamaba `grilla` en el
   original. Un `data-dib="grilla"` contra un código que buscaba `"tabla"` hizo que el ítem de menú
   no hiciera nada.
8. **Fuentes subseteadas**: los PDFs suelen embeber solo los glifos que usan. Al editar texto
   preexistente (fase 2) hay que prever un fallback cuando el usuario escriba un carácter que la
   fuente original no trae.
9. **Verdana, Arial, Georgia y demás fuentes de Microsoft/Apple no se pueden redistribuir.** Usar
   equivalentes OFL (Noto Sans en lugar de Verdana, PT Serif en lugar de Georgia).
10. **Varias APIs de Fabric devuelven una promesa y hay que esperarlas.** `FabricImage.setSrc()` es
    la que ya mordió: sin `await`, el repintado corre antes de que la imagen nueva cargue y el
    lienzo se queda con la anterior (pasó con el QR al cambiarle el texto). Si además el handler
    se dispara por tecla, agregar un contador de generación para descartar respuestas fuera de
    orden.
11. **El relleno y el contorno son cosas distintas.** Una forma dibujada con `fill` ignora
    `strokeDashArray` y `stroke`: la línea se dibujaba como rectángulo relleno y por eso los
    estilos punteado/doble no hacían nada. Cuando un estilo de trazo tiene que verse, la forma
    tiene que estar trazada, no rellena.
12. **Un `.woff2` NO sirve para incrustar en un PDF, aunque `embedFont` no se queje.** Esta lección
    decía lo contrario y estaba mal: fontkit *parsea* woff2, así que `embedFont(bytes)` pasa sin
    error, pero con `subset: false` pdf-lib incrusta los bytes originales — el contenedor
    comprimido — y un PDF solo admite fuentes sfnt (TTF/OTF). El visor descarta la fuente y
    sustituye por otra. Se ve corriendo `npm run verificar-export`: mupdf avisa
    "unknown file format ... attempting to load system font". Y no hay salida por el lado del
    subseteo: fontkit no puede subsetear fuentes comprimidas (falla con "Index out of range").
    Para que las fuentes web salgan de verdad hay que **descomprimir a sfnt antes de embeber**
    (los `.woff` v1 de `@fontsource` son zlib, así que se descomprimen sin dependencias nuevas)
    o sumar `.ttf` al repo. **Ya implementado** (`woffASfnt()` en `fuentes.ts`, catálogo en `.woff`
    v1, cero `.woff2`): si el visor vuelve a sustituir una fuente, revisar antes si algo reintrodujo
    un `.woff2`, no reabrir esto desde cero.
13. **Un mismo ID de campo colocado varias veces es UN campo AcroForm con varias apariencias.**
    `form.createTextField(nombre)` tira error si el nombre ya existe: hay que crearlo una vez y
    llamar `addToPage` por cada posición. Repetir un campo es una función del panel, no un caso
    raro.
14. **El PDF mide la Y desde abajo y el lienzo desde arriba.** Toda coordenada hay que espejarla
    (`y.pdf = altoPagina − y.lienzo − altoElemento`), y para el texto la Y del PDF es la línea de
    base, no el tope de la caja. `drawLine` tampoco acepta rotación: los extremos de una línea
    con ángulo hay que girarlos a mano alrededor de su centro.
15. **Las formas de Fabric trazan su borde una sola vez**, así que el estilo "doble" no se puede
    expresar con `strokeDashArray` ni con ninguna propiedad: hay que dibujar dos trazos. Por eso
    línea, recuadro y tabla son objetos propios con `_render`, y el trazado vive compartido en
    `trazos.ts` — si se agrega otra forma con estilos de borde, usar ese helper y no reinventarlo.
    "Doble" además necesita un grosor mínimo (`GROSOR_MINIMO_DOBLE`): por debajo, los dos trazos
    y su separación no entran y se ve idéntico a sólida, así que el panel sube el grosor solo.
16. **Fabric 7 posiciona los objetos por su centro** (`originX`/`originY` vienen en `'center'`),
    pero acá `x`/`y` es la esquina superior izquierda: así lo entienden el modelo, el panel, los
    márgenes, el enganche, las guías y el exportador. Sin corregirlo, todo se dibuja corrido media
    caja hacia arriba y a la izquierda de lo que dice el panel, y el PDF sale distinto del lienzo.
    El valor por defecto se cambia una sola vez en `objetosFabric.ts`, así que un tipo de objeto
    nuevo lo hereda; **no hace falta ponerlo objeto por objeto, pero sí no pisarlo**.
17. **La línea rota alrededor de su esquina superior izquierda, no de su centro** (es consecuencia
    de la lección anterior). `extremosLinea` en `exportarPdf.ts` hace exactamente eso; si algún
    día se cambia el origen de los objetos, esa función hay que revisarla junto.
18. **Los adornos de edición van en el lienzo y nunca en el modelo.** El contorno azul de los
    campos AcroForm existe solo para poder verlos y agarrarlos mientras se edita; no llega al PDF
    porque el exportador lee el modelo, no el lienzo. Es el mismo criterio que la cuadrícula, los
    márgenes y los fantasmas de un campo repetible (ver `vista.ts`).
19. **Mover un objeto de Fabric no es cambiar el diseño: hay que volcarlo al modelo.** Lo que se
    guarda, lo que entra al historial y lo que se exporta sale del modelo, así que un `objeto.set()`
    suelto se pierde al recargar. Ya pasó dos veces: alinear una selección múltiple y rotar dentro
    de un grupo. Después de mover objetos a mano, llamar a `sincronizarGeometria`.
20. **Lo que se toca en el panel de propiedades tampoco pasa por ningún evento del lienzo.** El
    autoguardado se dispara desde `main.ts`, que escucha `input`/`change`/`click` sobre el panel
    entero —los eventos burbujean— justamente para no tener que acordarse en cada handler. Si se
    agrega otro panel, necesita el mismo enganche.
21. **Fabric separa los renglones por `lineHeight` (1,16) POR `_fontSizeMult` (1,13).** Usar solo
    el primero deja el texto de varias líneas más comprimido en el PDF que en pantalla. El factor
    vive en `PASO_RENGLON` (`elemento.ts`), en el modelo, porque el exportador no puede depender
    de Fabric.
22. **`asUint8Array()` de mupdf no devuelve bytes propios: es una vista sobre su memoria**, que se
    reutiliza en cuanto se le pide cualquier otra cosa. Guardar esa vista deja el PDF convertido en
    basura un rato después —la cabecera `%PDF-` pasa a ser cualquier cosa— y el error recién
    aparece lejos, al exportar, como "No PDF header found" de pdf-lib. Hay que copiarla en el
    momento: `new Uint8Array(...asUint8Array())`. Vale para cualquier buffer que venga de mupdf.
    No se ve en Node si los bytes se usan enseguida; apareció recién probando en el navegador.
23. **mupdf mide la Y desde ARRIBA, al revés que el PDF crudo.** Vale para el texto estructurado
    *y* para el rectángulo de una redacción. Invertirla —el reflejo natural viniendo de pdf-lib,
    donde la Y va desde abajo— hace que la redacción se aplique sobre la zona espejada: no borra
    nada, no da ningún error y encima deja el recuadro negro puesto, así que parece que funcionó.
    Costó un rato encontrarlo. Se cubre con `npm run verificar-pdf`.
    Además: `applyRedactions(false, 0, 0, 0)` = sin recuadro negro y quitando el texto de verdad;
    con los valores por defecto pinta el recuadro encima.
24. **Un estilo en línea le gana siempre a una clase de CSS.** Por eso el ancho y el colapso de los
    paneles pasan los dos por las mismas variables CSS (`columnas.ts`): si el colapso fuera una
    clase y el arrastre un estilo en línea, colapsar dejaría de andar después del primer arrastre.
    Vale para cualquier cosa que se pueda cambiar por dos caminos.
25. **Si un ítem de menú está dibujado, tiene que hacer algo.** Ya pasó dos veces que existía solo
    el atajo de teclado y el ítem del menú era texto muerto (Ayuda, y Copiar/Pegar/Seleccionar
    todo). Cablear los dos al MISMA función, nunca duplicar la lógica.
26. **Un campo de formulario solo puede rotar en múltiplos de 90°.** El PDF guarda su recuadro
    siempre derecho y la rotación aparte, en la apariencia (`/MK /R`); pdf-lib directamente tira
    error con cualquier otro ángulo. Se redondea al más cercano y el preflight lo avisa. Aplanado
    no tiene esa limitación, porque ahí se dibuja como cualquier otra forma.
27. **Un elemento con `data-i18n*` que después se sobreescribe a mano con texto calculado queda con
    una trampa activa.** `aplicarIdioma()` recorre TODO el documento con ese atributo cada vez que
    se cambia de idioma, así que si el código pisa el `textContent` de un elemento tageado (el botón
    de peso del PDF una vez calculado, el estado "PDF recuperado", tamaño/orientación en la barra de
    estado) sin tocar el atributo, un cambio de idioma posterior vuelve a pisarlo con la traducción
    genérica del atributo viejo — no rompe nada visible en el momento, así que es fácil no notarlo.
    Dos salidas válidas: sacar `data-i18n` con `removeAttribute` cuando el texto pasa a depender de
    un valor en tiempo de ejecución (peso, PDF recuperado), o actualizar el atributo junto con el
    texto si el valor sigue siendo una de las claves del diccionario (tamaño/orientación de página,
    en `reflejarPagina()` de `main.ts`). Ver `src/ui/i18n.ts` y los usos en `main.ts`.
28. **Una función compartida entre "importar" y "autoguardado" no puede asumir la misma regla para
    los dos.** `cargarProyecto` soltaba el PDF vigente si el `.json` no traía uno adentro —correcto
    al importar, donde "sin PDF" significa que no tiene—, pero `restaurarAutoguardado` pasa por la
    misma función y el autoguardado NUNCA lleva el PDF adentro (vive aparte, en IndexedDB, porque
    localStorage no lo aguanta). Resultado: cada recarga de página borraba el PDF de base un
    instante antes de que `recuperarPdfGuardado()` pudiera leerlo, y el síntoma parecía estar en la
    recuperación, no en la carga. La función ahora recibe explícitamente si hay que conservar el
    PDF vigente, en vez de inferirlo de si el proyecto trae uno.
29. **Al probar IndexedDB a mano, `indexedDB.deleteDatabase()` con la página todavía abierta no
    borra al toque: queda pendiente y se ejecuta recién al recargar**, llevándose de paso cualquier
    cosa que se haya guardado en el medio. Dio un falso negativo verificando la persistencia del PDF
    de base: parecía que el arreglo no servía, cuando el borrado tardío de una prueba anterior era
    la causa. Para limpiar el estado antes de una prueba, cerrar la conexión o recargar antes de
    seguir, no encadenar un `deleteDatabase()` y continuar en la misma página.
30. **Rasterizar una página con pdf.js dibuja sus anotaciones por defecto**, y un campo de
    formulario es una anotación. Como los campos AcroForm también se importan como elementos del
    diseño, cada uno se veía dos veces: el del fondo (con su valor ya cargado) y el nuestro encima.
    El síntoma delator fue que al borrar un campo "aparecía algo abajo" —el del fondo, que seguía
    ahí— y daba la sensación de que el borrado no había funcionado. Se corrige pasándole
    `annotationMode: pdfjs.AnnotationMode.DISABLE` a `page.render()`, en `rasterizar()` de
    `pdfExistente.ts`.
31. **En el lienzo de Fabric el texto no se recorta solo a su caja**, a diferencia del editor
    público (HTML + CSS, donde el navegador lo hace gratis). La etiqueta de un campo con un ID más
    largo que su ancho se salía de la caja y se montaba sobre la del campo vecino — con una
    plantilla real (una grilla de conceptos con varios campos angostos por fila) volvía ilegible
    media hoja. Hay que medir con un `FabricText` temporal (mismo cuerpo y tipografía que el que se
    va a dibujar) e ir sacando caracteres hasta que entre, agregando `…`. Ver `recortarAlAncho` en
    `objetosFabric.ts`.
32. **Las auditorías contra una referencia y usar la app de verdad encuentran bugs distintos, y
    ninguna reemplaza a la otra.** Dos auditorías completas (menús contra el editor público, panel
    de propiedades control por control) no encontraron los bugs de las lecciones 30 y 31: comparan
    contra una referencia y detectan lo que *falta*. Un recorrido real —abrir una plantilla de
    verdad y editarla con mouse, no eventos sintéticos— encontró ambos en minutos, porque encuentra
    lo que *molesta* al usarlo. Antes de dar una función por probada, conviene además usarla de
    punta a punta con un caso real, no solo auditarla contra una referencia.
33. **Hay dos navegadores de "página" en la interfaz y son cosas distintas, a propósito.** El
    selector de la barra de estado (fase 2) elige qué página del **PDF de fondo** se ve —
    `elegirPagina`/`paginaDelPdf` en `pdfExistente.ts`, 0-index como pdf.js/mupdf. La tira de
    pestañas (fase 4) elige en qué **hoja del documento propio** se dibuja — `irAHoja`/`hojaActual`
    en `documento.ts`, también 0-index pero un contador completamente aparte. Un documento con
    varias hojas puede además tener un PDF de fondo de varias páginas: las dos cosas conviven sin
    relación entre sí. No confundir una API con la otra al tocar cualquiera de las dos.

34. **Traducir con `data-i18n` alcanza solo para lo que está escrito en el HTML.** Todo lo que arma
    texto por código —el peso del PDF, las pestañas de hojas, el panel de propiedades, que se
    dibuja al seleccionar— queda en el idioma anterior al cambiar de idioma, porque el barrido no
    tiene qué recorrer y nada lo vuelve a dibujar. Para eso está `alCambiarIdioma` en `ui/i18n.ts`:
    **al agregar cualquier texto generado por código, engancharlo ahí**. Lo mismo vale para un
    texto que dependa de un valor calculado (el peso muestra "Peso: 1.8 KB"): hay que guardar el
    último estado —qué clave y qué valor— para poder reescribirlo en el idioma nuevo, porque el
    valor ya no se puede deducir del DOM.
35. **El atributo `hidden` no oculta nada si el CSS le da un `display` propio.** `hidden` se aplica
    con una regla del navegador (`[hidden] { display: none }`) que pierde contra cualquier regla de
    la hoja de estilos, así que un `.algo { display: flex }` lo anula sin avisar: el código pone
    `hidden = true`, nadie se queja, y el elemento se sigue viendo. Le pasó al selector de página,
    que aparecía vacío en la barra de estado sin ningún PDF abierto. En `style.css` hay un
    `[hidden] { display: none !important }` que lo cubre para todos los casos — pero conviene
    saberlo igual, porque es un bug que no deja rastro en la consola.
36. **Una decisión de producto vale lo que vale su muestra.** La fase 3 (editar formas de un PDF)
    se pausó porque, midiendo 8 PDF, ninguno tenía formas en su contenido. Los 8 eran de
    ReciboMail y todos plantillas de formulario: lo que se ve en ellas son campos AcroForm, no
    contenido de página. Midiendo 60 PDF de otras fuentes, 45 sí tienen formas — y una plantilla de
    la propia empresa tiene 556 rectángulos y ninguna forma compleja. La medición anterior no
    estaba mal hecha; estaba hecha sobre una muestra que no representaba el problema. **Antes de
    descartar una función por falta de casos de uso, revisar de dónde salieron los casos.**
37. **Los campos importados de un PDF tapan casi la mitad de la hoja.** En una plantilla real
    (`Template recibo Argentina Napsis.pdf`) los 179 campos cubren el 47% de la superficie. Eso
    convierte en inútil cualquier interacción con el contenido del PDF que se corte al encontrar un
    objeto encima: el doble clic para editar una forma no llegaba a la mitad de las líneas. La regla
    que quedó: **un campo no bloquea el acceso al dibujo del PDF** —los dos vienen del mismo
    archivo y la caja del campo es un marcador, no un dibujo—, pero lo que el usuario dibujó sí
    tiene prioridad. Vale la pena tenerlo en cuenta antes de agregar cualquier gesto sobre el
    lienzo que dependa de "si hay un objeto abajo".
38. **Una forma sacada del PDF va debajo de la página, no arriba.** Al convertirla en elemento, lo
    natural sería agregarla como cualquier elemento nuevo: al frente. Pero en el PDF esa forma
    estaba *debajo* —el texto se dibujaba encima de ella— así que al frente tapa ese texto. Hoy eso
    se resuelve con **su capa**: lo convertido cae en "Contenido del PDF"
    (`capaDelContenidoDelPdf()`), que está detrás de la página en el orden de capas — ver la
    lección 41. Siguen haciendo falta las otras dos piezas, y hay que mantenerlas juntas: la página
    se rasteriza con **fondo transparente** (`background: 'transparent'` en pdf.js, que si no
    rellena de blanco) y el lienzo **no tiene color de fondo** (lo pone `.canvas-container` en el
    CSS). Si alguna se rompe, la forma desaparece detrás de un blanco opaco.
39. **El recorrido de mupdf informa menos formas que operadores tiene el content stream**: saltea
    los que no dibujan nada visible, y en una plantilla real son 556 contra 672. Así que emparejar
    "la enésima forma que veo" con "el enésimo operador que pinta" está mal y borra lo que no es —
    en la prueba se llevó puesto 14 renglones de texto y las líneas internas de las tablas, y no se
    notó hasta mirar el resultado. Para sacar dibujo vectorial se usa una **redacción de mupdf**
    sobre el rectángulo de la forma: `applyRedactions(false, 0, 1, 1)` = sin recuadros negros,
    imágenes intactas, line art fuera si queda cubierto, y **texto sin tocar** (borrar un texto es
    al revés: `(false, 0, 0, 0)`). Su límite: solo se lleva lo que queda *completamente* cubierto,
    así que sacar muchas de una deja bastantes atrás y un recuadro grande puede llevarse una línea
    de adentro.
40. **Sacar una forma del PDF puede llevarse otras, y hay que convertirlas también.** La redacción
    de mupdf se lleva todo el dibujo que quede *completamente cubierto* por el rectángulo, así que
    sacar una banda gris arrastra las líneas que tenía adentro: en la plantilla real, una banda se
    lleva 19 formas. Si se convierte en elemento solo la apuntada, las otras 18 desaparecen de la
    hoja sin que nadie las haya pedido — y se nota como "las líneas internas se borraron". Por eso
    `quitarFormaDelPdf` devuelve **todas** las que se fueron (compara la lista de formas antes y
    después) y quien llama las convierte a todas. Vale para cualquier operación futura sobre el
    contenido: **comparar antes y después, y no dar por sentado que se fue solo lo que se pidió**.
41. **Hay UN solo apilado, y las capas mandan.** Esta lección decía lo contrario y era una trampa:
    antes lo convertido de un PDF se dibujaba con `globalCompositeOperation: 'destination-over'`
    —cada objeto detrás de lo ya dibujado— para quedar bajo la página, que iba de `backgroundImage`.
    Eso partía el orden en **dos grupos que "Al frente" y "Enviar atrás" no podían cruzar**, invertía
    el apilado de uno de ellos respecto del arreglo, y dejaba al panel de Capas prometiendo un orden
    único que el lienzo no respetaba. Se rehízo entero (16/08/2026):
    - La página del PDF es **un objeto más de la pila** (`aplicarFondo` en `documento.ts`), fijo y
      fuera del modelo: no se registra en `datosPorObjeto`, así lo saltean `elementosDelLienzo`, el
      historial y el panel de Capas sin que haya que filtrarlo en cada lugar. Se lo reconoce con
      `esPaginaFija()`.
    - El orden sale de **una sola función**, `ordenarPila()` en `objetosFabric.ts`: las capas de
      atrás hacia adelante, con la página intercalada donde diga `capasSobreElFondo`. Hay que
      llamarla después de cualquier cosa que cambie quién está en qué capa o el orden de las capas.
    - `moverEnLaPila()` quedó **acotada a la capa** del objeto: "Al frente" nunca puede sacar algo de
      su capa, porque eso rompería el orden que muestra el panel. Para cruzar de capa está el
      desplegable, que es otra decisión.
    - Cuidado con `getObjects()` en crudo: la página también es un objeto. Contarla hacía saltar el
      aviso de "vas a perder el trabajo" con la hoja vacía, y metida en un `ActiveSelection` de
      Ctrl+A se arrastraba con todo lo demás (dentro de un grupo, el `evented: false` de un hijo ya
      no lo protege). Filtrar por `elementoDe` o por `esPaginaFija`.
    Se cubre con `npm run verificar-apilado`, que mide el orden real del arreglo — un apilado mal
    ordenado no da ningún error, solo tapa algo, así que a ojo se descubre tarde.
42. **Cómo se dibuja un elemento es parte del modelo, no del objeto de Fabric.** El caso que lo
    enseñó: las formas sacadas de un PDF van *debajo* de la página. Dejar esa marca solo en el
    objeto de Fabric parecía andar —se veía bien recién convertida— pero el objeto se reconstruye al
    deshacer, al cambiar de hoja y al recargar, y en los tres la forma saltaba al frente y tapaba el
    texto. Hoy eso lo decide `elemento.capa`, que vive en el modelo y viaja en el proyecto, el
    historial y el autoguardado. Regla general: **si algo tiene que sobrevivir a deshacer, a cambiar
    de hoja o a recargar, tiene que estar en el modelo**; el objeto de Fabric es una vista
    descartable.
43. **Dos hojas no pueden compartir una página del PDF.** Editar el contenido —borrar un texto,
    sacar una forma— es cirugía sobre el PDF, no sobre la hoja: si dos hojas apuntan a la misma
    página, lo que se borre en una desaparece en la otra, en los dos sentidos. Por eso duplicar una
    hoja **inserta una copia de su página** en el PDF y corre los índices de las hojas siguientes
    (`duplicarPaginaDelPdf`). La invariante es *una hoja, una página*, y conviene sostenerla en
    cualquier operación nueva sobre hojas.
44. **Un menú propio que se cierra con `pointerdown` tiene que atender sus opciones con
    `pointerdown`.** El listener que cierra el menú al hacer clic afuera se dispara antes que el
    `click` de la opción, así que para cuando el `click` iba a llegar el menú ya estaba fuera del
    documento y ninguna opción hacía nada — se veía como "los botones no hacen lo que dicen".
45. **Una miniatura vacía necesita un ancho calculado, no un `aspect-ratio`.** `aspect-ratio` sobre
    una caja sin contenido y sin ancho de referencia no da nada: las hojas en blanco salían como una
    línea fina mientras las que tenían imagen se veían bien, porque el ancho se lo daba la imagen.
    El ancho de la miniatura sale del alto de la tira por la proporción de la hoja.
46. **Renombrar una clase de CSS deja huérfanas las reglas que la usan como ancestro.** Al pasar
    `.ed-panel` a `.ed-pieza` se renombraron las reglas propias pero no `.ed-panel select` ni
    `.ed-panel input`, y todos los controles de los paneles se quedaron sin ancho: se veía en un
    solo lugar (el campo de ID salido de la barra) pero estaba roto en todo el panel de
    propiedades. Al renombrar, buscar la clase **con espacio detrás**, no solo pegada.
47. **En un grid de columnas fijas, ocultar una con `display:none` corre todas las demás.** El
    separador de un costado vacío se ocultaba así y el panel del otro lado terminaba midiendo 5 px
    —el ancho de la columna del separador—. Para que el grid no se corra, el elemento se queda y
    solo se vuelve inerte.
48. **Qué atajo de teclado se puede usar no es cuestión de gusto.** `Ctrl+N`, `Ctrl+T` y `Ctrl+W`
    se los queda el navegador y no llegan nunca; `Ctrl+R` y `F5` son recargar y pelearles es
    perder; y en un teclado latinoamericano **AltGr es Ctrl+Alt**, así que `Ctrl+Alt+letra` choca
    con las letras que ahí producen un carácter (Q, E, 2…). Antes de elegir uno, probarlo en el
    navegador: que llegue se comprueba mirando si el evento queda `defaultPrevented`.
49. **Reflejar un estado tiene que poder deshacer lo que hizo, no solo hacerlo.** Varias veces la
    función que aplica el estado escondía algo (`hidden = true`, `display: none`) sin volver a
    mostrarlo en la pasada siguiente, y el elemento quedaba escondido para siempre: le pasó al
    botón de colapsar de la tira de hojas y a la segunda barra de un costado. Al escribir una de
    estas funciones, cada propiedad que se toca se calcula **siempre**, aunque el valor sea el de
    por defecto.
50. **Dos cosas parecidas necesitan nombres distintos y una regla clara de qué hace cada una.**
    Conviven dos "ocultar": el del menú Campos es una vista temporal de todos los campos y **sí**
    salen en el PDF; el de la barra de Capas es una propiedad del objeto y **no** sale. Se sostiene
    porque `elementoVisible()` es el único lugar donde se decide qué se dibuja y qué se exporta.
51. **Cambiar el ícono no alcanza con regenerarlo: hay que forzar la recompilación.** `tauri icon`
    reescribe `src-tauri/icons/icon.ico`, pero cargo no vuelve a ejecutar `build.rs` —que es quien
    lo incrusta— porque no ve cambios propios, así que el `.exe` sale con el ícono anterior aunque
    el `.ico` sea más nuevo. Se arregla tocando `build.rs` antes de `tauri build`. Para comprobar
    que quedó, extraer el ícono **del ejecutable**, no mirar el explorador de archivos, que además
    cachea íconos: `[System.Drawing.Icon]::ExtractAssociatedIcon($exe)`.
52. **Buscar texto suelto dentro de un PDF da negativo aunque el dato esté.** Al verificar el campo
    de firma, `/SigFlags 3` no aparecía en los bytes del archivo: pdf-lib guarda con *object
    streams*, así que la mayoría de los diccionarios viajan comprimidos y no hay nada que grepear.
    El campo estaba bien puesto —se veía cargando el documento y mirando el diccionario—. **Las
    comprobaciones sobre un PDF se hacen sobre los objetos, nunca sobre los bytes**; si un arnés
    busca una cadena en el archivo, el resultado no significa lo que parece.
53. **Un panel que se refresca por eventos del lienzo se queda viejo cuando el cambio no pasa por el
    lienzo.** El panel de capas se redibujaba en `object:added`/`object:removed`, que alcanza
    mientras haya elementos entrando y saliendo. Al recuperar la sesión de un diseño **sin
    elementos**, no se dispara ninguno: las capas guardadas estaban bien en el modelo, pero la lista
    seguía mostrando las de antes, y recién aparecían al crear una capa nueva —que sí redibuja—. Lo
    mismo con "Nuevo proyecto", que vaciaba las hojas pero se olvidaba las capas. **Todo lo que
    reemplaza el documento entero —restaurar, importar, empezar de nuevo— tiene que refrescar cada
    panel a mano**, no esperar que un evento lo haga.
54. **En Tauri, una ventana que no figura en `capabilities/` no puede usar las APIs del núcleo — y
    falla en silencio.** Al agregar la pantalla de bienvenida, las ventanas pasaron a llamarse
    `principal` y `splash`, pero `src-tauri/capabilities/default.json` seguía dando permisos a una
    llamada `main`. Resultado: `onCloseRequested` no registraba nada, sin error ni aviso, así que
    el botón de cerrar no preguntaba si guardar. **Lo que hace difícil de encontrar a este bug es
    que los comandos propios —los de `lib.rs`— NO pasan por ese control**: seguían funcionando, la
    bienvenida se cerraba bien y todo parecía correcto salvo lo que no andaba. Al tocar las
    etiquetas de las ventanas, revisar siempre ese archivo. Y ojo con `core:default`, que **no**
    incluye todo: `allow-destroy`, por ejemplo, hay que pedirlo aparte.
55. **Un tema de color destapa cada color escrito a mano.** La interfaz se pintaba entera desde las
    variables de `:root`… salvo una docena de lugares con el hex puesto directo: el degradado de la
    barra superior, los menús flotantes, el fondo de los `select`, el resaltado de la capa destino y
    del objeto seleccionado. Con el tema claro nadie los notaba porque coincidían; con el oscuro
    quedaban blancos. **Antes de sumar un tema, buscar los colores literales** (`grep` de `#` en el
    CSS) y decidir uno por uno: casi todos van a variable, pero algunos son deliberados —el papel de
    la hoja y de las miniaturas queda blanco siempre, porque representa lo que se va a imprimir—.
    Lo mismo vale para cualquier valor compuesto que mezcle una variable con un color fijo, como la
    sombra de las miniaturas: hay que rearmarlo desde el tema, no dejarlo en el CSS.
56. **Las matrices de un PDF real llegan con ruido, así que los épsilon van en proporción, no en
    valor absoluto.** Detectar imágenes andaba con PDFs armados en el arnés y fallaba con un manual
    de verdad: los íconos traían `b = 0,00002` y `c = -0,000013` donde debería haber ceros —resto de
    redondeos del generador— y el corte fijo en `1e-6` los leía como sesgo y los descartaba. Ese
    desvío es de centésimas de milésima de punto sobre una caja de 24: no existe para el ojo. La
    tolerancia ahora se compara **contra la escala de la propia matriz** (`1e-3` relativo ≈ 0,06°).
    Junto con esto apareció el otro: **la escala Y puede venir negativa** —la imagen entra
    espejada— y entonces el ancla no es la esquina (0,0) del cuadrado unidad sino la de abajo; dando
    por sentado que era (0,0), las imágenes quedaban un alto más abajo de donde están. Las dos cosas
    se descubrieron **probando con un archivo real**, no con los del arnés: para todo lo que lea PDF
    ajeno, un PDF fabricado en la prueba comprueba la lógica pero no el mundo. Hay
    `npm run inspeccionar -- archivo.pdf` justamente para eso.
57. **La transparencia de una imagen de PDF no está en la imagen.** Vive en una *soft mask* aparte
    —otra imagen, en grises, donde 0 es transparente y 255 opaco— así que `toPixmap()` sola devuelve
    negro opaco donde debería no haber nada: los íconos de un manual aparecían sobre un cuadrado
    negro. Hay que pedir `getMask()` y combinarlas. Ojo con el segundo caso: **la base puede venir
    sin canal alfa** (RGB puro, con toda la transparencia en la máscara), y entonces no hay dónde
    escribir el alfa — hay que armar un pixmap nuevo con alfa y copiar color + máscara.
58. **Una caché que nadie invalida miente con cara de estar bien.** La miniatura de la hoja se
    guardaba por página del PDF y `refrescarPaginaDibujada` no la borraba, así que la tira seguía
    mostrando el texto o la imagen recién sacados. Al invalidarla apareció el problema de fondo, que
    la caché venía tapando por accidente: **la miniatura se dibujaba solo desde la página del PDF**
    y nunca mostró nada de lo dibujado encima. Moraleja doble: si algo se ve bien por una caché
    vieja, no está bien; y una miniatura tiene que salir de lo mismo que ve el usuario —el lienzo—
    y no de una de sus partes.
59. **Una prueba cuyos casos dan todos el mismo resultado no está probando nada.** Escribiendo
    `verificar-apilado`, el caso de "cambiar un elemento de capa" comparaba tres estados que daban
    los tres `["b1","x"]`: pasaba en verde y habría pasado igual con el código roto. Al armar el caso
    para que el movimiento se notara —un testigo en cada capa— apareció un problema real: devolver
    un elemento a su capa original lo dejaba **más abajo** de donde estaba, porque `ordenarPila`
    conserva el orden del arreglo y ese orden ya había cambiado al pasar por la otra capa. Se
    arregló mandándolo al frente de su capa nueva al cambiarlo de capa. Antes de dar por buena una
    prueba, mirar si sus casos **pueden** fallar: si el valor esperado es el mismo antes y después
    de la operación, la prueba no la está mirando.
60. **Un valor que indexa una lista tiene que sostenerse cuando la lista cambia.**
    `capasSobreElFondo` dice cuántas capas van delante de la página, así que crear, borrar, duplicar
    o reordenar una capa lo corre: al borrar una capa de adelante hay que restarle uno, al crear
    sumarle, y al reemplazar la lista entera recortarlo a la nueva longitud (lo hace
    `establecerCapas`). Sin eso, la página termina apuntando a un lugar que ya no existe y salta al
    fondo sin que nadie lo haya pedido. La alternativa —una marca por capa— se descartó porque
    permite el estado imposible de explicar: capas de los dos lados de la página, intercaladas.
61. **Entre dos reglas de CSS con la misma especificidad gana la que está más abajo en el archivo, y
    el síntoma es que el cambio no hace NADA.** Es la variante de la lección 24 que más cuesta ver.
    El botón de plegar una capa lleva dos clases (`class="ed-obj-btn ed-capa-plegar"`); se le puso
    `font-size: 15px` en `.ed-capa-plegar` (línea 1447) y siguió viéndose de 9px, porque
    `.ed-obj-btn` (línea 1575) define el mismo `font-size` y **las dos valen 0,1,0**. Lo delator es
    que se veía *exactamente igual*, no un poco más chico: cuando un cambio de CSS no mueve un
    píxel, sospechar de la cascada antes de tocar el valor —subirlo de 15 a 20 no habría servido de
    nada—. La salida es **especificidad, no orden**: `.ed-obj-btn.ed-capa-plegar` o
    `.ed-capa-head .ed-obj-btn`, que ganan estén donde estén. Reordenar el archivo también
    "funciona" pero deja la trampa armada para el próximo que agregue una regla abajo.
62. **Un emoji se dibuja mucho más grande que un carácter geométrico del mismo `font-size`.** Los
    botones de la cabecera de capa son 👁 y 🔒 a 9px y se ven bien; el `▾` de plegar al mismo cuerpo
    quedaba de unos cuatro píxeles. No hay un número que sirva para los dos: en esa cabecera conviven
    12px para los emoji y 15px para el triángulo, y **se ven del mismo tamaño**. Al mezclar los dos
    tipos de glifo en una fila, calibrarlos por separado y no buscar el valor único que los empareje,
    porque no existe.
63. **Cuando algo no se puede confirmar, a veces la salida es no necesitar la confirmación.** Guardar
    en escritorio bajaba un `blob:` y cerrar la ventana enseguida cortaba la escritura. El primer
    intento fue esperar un plazo; el segundo, esperar el aviso real de Tauri (`on_download`, evento
    `Finished`) — que **para descargas `blob:` no llega nunca**, así que la aplicación quedaba
    trabada avisando que no podía confirmar: peor que el bug original. Lo que lo resolvió fue
    cambiar el mecanismo, no afinar la espera: en escritorio el archivo lo escribe el proceso de
    Tauri (`guardar_en_disco`), de forma sincrónica, y devuelve la ruta. **Si hace falta un evento
    que no controlamos para saber si algo terminó, conviene preguntarse si se puede reemplazar por
    una operación que termine cuando vuelve.**
64. **Un `!` sobre un elemento que puede no estar rompe todo lo que viene después, no solo esa
    línea.** `abrir()` en `modales.ts` enganchaba primero el botón de cancelar con `querySelector(…)!`
    y después el de confirmar. En un cuadro que solo avisa algo —una sola salida, sin cancelar— la
    primera línea tiraba `TypeError` y **la segunda nunca corría**: el botón "Entendido" quedaba
    muerto y el cuadro no se podía cerrar. El síntoma no señalaba al culpable en absoluto. Que había
    trampa se veía desde antes: `mostrarAyuda` llevaba un botón de cancelar escondido con
    `display:none`, puesto para esquivarla en vez de arreglarla. **Cuando algo lleva un parche así,
    el arreglo es el parche que falta.**
65. **Un `return` temprano puede tapar una feature entera, no solo el resto de la función.** En
    `vista.ts`, `object:moving` ajustaba la posición a la cuadrícula y hacía `return` antes de
    llegar al cálculo de las guías rojas de alineación: con la cuadrícula prendida, las guías no se
    calculaban nunca, aunque `estado.guias` siguiera en `true`. El arreglo no es elegir una u otra:
    la cuadrícula sigue mandando en la posición final (si no, temblarían entre dos ajustes
    compitiendo), pero la guía se marca igual cuando la posición ya cuadriculada coincide con una
    referencia — son dos cosas distintas (dónde cae el objeto vs. qué se le muestra al usuario) y
    conviene no fusionarlas en un solo `if`/`return`.
66. **Un control del panel que reconstruye el objeto (`reemplazarObjeto` + `mostrarPropiedades`) no
    puede escuchar `'input'`, tiene que ser `'change'`.** `mostrarPropiedades` rearma el panel entero
    con `panel.innerHTML = ...`; con `'input'` eso pasaba en cada tecla, y al destruirse el `<input>`
    enfocado el foco saltaba al `body`. La tecla siguiente —tipeando, típicamente Supr o Backspace—
    ya no la agarraba el campo de texto sino el atajo global de "borrar el objeto seleccionado" en
    `main.ts` (que solo mira si `e.target` es INPUT/TEXTAREA/SELECT). Pasaba en 'campo' (Nombre,
    Tamaño, Color, grosor de borde) y de arranque en 'firma' (todos sus campos, que se agregaron con
    el mismo patrón). Los controles que solo llaman `refrescar()`/`repintar()` —sin tocar
    `panel.innerHTML`— no tienen este problema y pueden seguir en `'input'`.
67. **Para agregar un comportamiento opcional a un objeto muy probado, conviene bifurcar en vez de
    generalizar.** Al sumarle una caja fija opcional al texto (`ElementoTexto.tamanoFijo`), la
    tentación era hacer que el `FabricText` de siempre supiera todo lo nuevo. En cambio: con
    `tamanoFijo: false` el objeto sigue siendo el mismo `FabricText` de antes, con el mismo código de
    construcción, exportación y redimensionado —cero líneas nuevas activas en ese camino—, y solo con
    `tamanoFijo: true` aparece un objeto distinto (`Group` de fondo + texto, igual que 'campo'). El
    texto es lo más probado de todo el editor (redacción de PDFs ajenos, vertical, multilínea,
    paridad de métricas con pdf-lib); bifurcar así deja **cero riesgo** de romper ese camino por una
    función que ni se usa. Confirmado con los seis arneses después del cambio: mismo resultado que
    antes, ni un delta nuevo.

## Cómo verificar cambios

**Germán verifica siempre él mismo en el navegador.** El flujo por defecto es: terminar el cambio,
correr `npx tsc --noEmit` y `npm run build`, commitear, y avisarle qué probar. No abrir el navegador
salvo que lo pida o que haya una duda técnica concreta que no se pueda resolver leyendo el código.

Si toca verificar en el navegador: **con la pestaña a la vista**. Si el panel está oculto, el
navegador no compone cuadros y `requestAnimationFrame` no se dispara nunca; como el render de
pdf.js depende de eso, abrir un PDF queda colgado sin fallar ni dar ningún error, y parece un bug
de la app. Pasó: se fue un buen rato en encontrarlo. Con `document.visibilityState` se confirma en
un segundo. Truco útil: las coordenadas exactas de los controles de un objeto de Fabric están
en `objeto.oCoords`; sumarles el `getBoundingClientRect()` del canvas da la posición en pantalla, y
es mucho más confiable que estimar coordenadas mirando una captura.

# EditorPDF — guía para agentes

> **¿Retomás el proyecto?** Leé primero [TRASPASO.md](TRASPASO.md): dice exactamente dónde se dejó,
> qué falta probar, qué falta implementar y las deudas técnicas conocidas.

Editor de PDF real, gratuito y open source (AGPL-3.0), al estilo Sejda PDF / Nitro PDF.
Repo: [gsomma86/EditorPDF](https://github.com/gsomma86/EditorPDF). Autor: Germán Somma.

## Regla: mantener esta documentación al día

Germán trabaja este proyecto con **varios agentes en paralelo**, y estos archivos son la única
fuente de verdad compartida entre ellos. Al cerrar cada tanda de trabajo, antes de dar el tema por
terminado y sin esperar a que te lo pidan:

- Tildar en [ROADMAP.md](ROADMAP.md) lo que quedó listo, y agregar lo que se descubrió que falta.
- Si apareció una decisión de arquitectura, una convención nueva o un bug con causa no obvia,
  anotarlo acá (en "Lecciones aprendidas" o donde corresponda) para que el próximo agente no lo
  vuelva a tropezar.
- Commitear esos cambios junto con el código.

Documentación desactualizada es peor que no tener documentación: manda al próximo agente en la
dirección equivocada.

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
    elemento.ts           EL MODELO. Tipos de cada elemento (texto/linea/rect/qr/tabla/imagen/
                          campo), sus constructores con valores por defecto, y el área útil que
                          acota dónde caen los elementos nuevos.
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
    o sumar `.ttf` al repo.
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

## Estado y próximos pasos

Ver [ROADMAP.md](ROADMAP.md). Resumen: **fase 1 (MVP) casi terminada**. Están el espacio de
trabajo, todas las herramientas de dibujo, los campos AcroForm completos (repetibles incluidos),
deshacer/rehacer, guardar/importar proyecto, exportar PDF verificado contra el lienzo, fondo de
hoja, ayuda y rendimiento medido. **Falta solo el multiidioma ES/EN/PT**, que conviene hacer
último porque toca cada texto de la interfaz.

Fases 2 y 3 (editar texto y formas de PDFs preexistentes) tienen una prueba de concepto ya
validada — ver la sección Fase 0 del roadmap.

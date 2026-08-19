# Traspaso — dónde retomar

Estado al cerrar el 19/08/2026. Todo commiteado y pusheado en
[gsomma86/EditorPDF](https://github.com/gsomma86/EditorPDF) (rama `main`).

**Antes de tocar nada, leer [CLAUDE.md](CLAUDE.md)**: ahí están la regla de alcance, las
convenciones y las 70 lecciones de bugs ya resueltos, que conviene no volver a tropezar. El
detalle fase por fase de todo lo construido —incluida la Fase 6, el lote grande de pedidos de
Germán cerrado el 19/08/2026— vive en [ROADMAP.md](ROADMAP.md).

## Dónde está el proyecto

**Las seis fases del ROADMAP están completas.** El editor tiene paridad con el editor público de
ReciboMail, edita contenido de PDFs ajenos (texto y formas), es multipágina, empaqueta como
aplicación de escritorio con Tauri, y el lote grande de refinamientos que pidió Germán sobre todo
eso (tabla, texto, línea, formas, y varios bugs) se cerró el 19/08/2026.

**No hay nada funcional a medias.** Lo único abierto es:

1. **Confirmación visual de Germán sobre la Fase 6** — nada de esto tiene arnés headless posible:
   - **Combinar celdas** de la tabla — la interacción de mouse más nueva de todo el proyecto.
   - **Curvatura de línea**, con la caja de selección agrandada — que no se desubique al
     mover/duplicar/deshacer.
   - **Texto con `tamanoFijo`**, sobre todo alineación centro/derecha en pantalla y en el PDF — y
     que el texto de toda la vida (`tamanoFijo` apagado) siga viéndose igual que siempre.
   - El resto de los controles de forma (vértice, asta/cabeza, filo, "doble" en las cuatro figuras).
2. **Un reporte de Germán sin diagnosticar**: "la separación funciona distinto en vertical que en
   horizontal" (control `separacion` del texto). Necesita que Germán cuente qué es lo que anda mal
   exactamente — no es algo que se pueda adivinar mirando el código.
3. **SmartScreen**: solicitud enviada a SignPath Foundation, esperando revisión (ver "Fuera del
   código" más abajo).
4. **Fuentes sin subsetear** (deuda técnica, ver esa sección).

## Cómo verificar

```bash
npm run verificar-export   # el PDF exportado contra lo que dibuja el lienzo
npm run verificar-pdf      # que borrar un texto de un PDF lo borre, y no lo tape
npm run verificar-campos   # importar los campos de una plantilla real, exportar y comparar que vuelvan iguales
npm run verificar-apilado  # el orden real del lienzo: que las capas manden y nadie cruce de capa
npm run verificar-objetos  # redimensionar: que el modelo y el objeto del lienzo queden de acuerdo
npm run verificar-hojas    # multipágina, formas convertidas, campo de firma
npm run medir-rendimiento  # 50, 200, 500 y 1000 elementos
```

Todos corren sin navegador. En `verificar-export` quedan cuatro diferencias marcadas en los casos
de texto: **son de la medición, no del código** — en Node no está la Helvetica real y node-canvas
dibuja con una sustituta más ancha.

En el navegador: el Browser pane integrado funciona, **con la pestaña a la vista**. Si está oculta,
`requestAnimationFrame` no se dispara y abrir un PDF queda colgado sin dar ningún error, como si
fuera un bug de la app.

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
- **`ElementoTexto.tamanoFijo` decide entre dos objetos de Fabric distintos**: apagado (default) es
  el `FabricText` de siempre; prendido es un `Group` (fondo + texto), como 'campo'. Cualquier cambio
  a `campoTexto()`/`wireCampos` tiene que pensar los dos caminos por separado (ver lección 67).
- **La tabla tiene una interacción de mouse propia** (`activarCombinarCeldas` en `tablaObjeto.ts`,
  llamada desde `main.ts` junto a `activarVista`): Shift + arrastrar sobre una tabla ya seleccionada
  marca celdas para combinar. Ojo con la lección 70 si se toca: `opt.transform` en un `mouse:down`
  no significa "se agarró un control", Fabric arma una transform para cualquier clic sobre el
  cuerpo de un objeto ya seleccionado.

## Deudas técnicas conocidas

- **Las fuentes se incrustan sin subsetear** (`subset: false`). Medido con `npm run medir-fuentes`:
  cada familia cuesta **~38 KB**. El arreglo obvio (`subset: true`) tira
  `Cannot read properties of undefined (reading 'pos')` en fontkit — no lo intentes sin correr el
  arnés antes, que deja la línea base.
- **La exportación de un texto sin caja fija nunca usó `align`**: cada renglón se dibuja siempre
  pegado a `x=0` en `exportarPdf.ts`, mientras que en pantalla Fabric sí reparte los renglones más
  cortos según `textAlign` cuando hay varios de distinto ancho (multilínea o vertical). Es un desvío
  preexistente entre lienzo y PDF — se aplicó el offset de alineación solo a la rama nueva
  (`tamanoFijo: true`), sin tocar el camino de siempre. Vale la pena una tarea aparte el día que a
  alguien le importe.
- **"Doble" en triángulo/flecha/estrella es aproximado** (escala el mismo contorno desde el centro,
  no un offset real de polígono): no da un ancho de trazo perfectamente constante en los bordes,
  más notorio en la flecha por lo asimétrica que es. Si a Germán no le convence al verlo, la
  alternativa es un offset real de polígono (más caro, sin problema de autointersección).

## Fuera del código

**SmartScreen**: solicitud enviada a SignPath Foundation (16/08/2026, firma OV gratis para OSS),
esperando revisión — el campo más débil fue "Reputation" (proyecto nuevo, sin uso más allá del
propio autor), así que puede volver un pedido de más pruebas en vez de una aprobación directa. Si
aprueban, falta agregar el paso de firma a `.github/workflows/build-windows.yml` con las
credenciales que dé la Foundation — eso sí lo puede terminar un agente. Si rechazan, no hay nada que
tocar en el código; esperar a tener uso real y volver a aplicar.

**Claude Code en la nube**: Germán quiso conectarlo y no se pudo — su cuenta de Claude es la de
trabajo y el GitHub (`gsomma86`) es personal, y esa vinculación en una cuenta de organización la
suele habilitar un administrador. No confirmado, no bloquea nada: se trabaja local y se pushea.

## Por dónde seguir

**Empezá por acá si sos el agente que retoma.** El trabajo es de a uno por vez, en relevo: `git pull`
antes de tocar nada, releer CLAUDE.md (regla de alcance, convenciones, lecciones) y correr
`node scripts/subirVersion.cjs` antes de commitear cualquier corrección.

En orden de lo que vale la pena:

1. **Nada que programar** — lo que sigue es que Germán confirme visualmente la Fase 6 (arriba) y
   cuente el detalle del reporte de "separación" pendiente. No hay tarea de código lista para
   arrancar sin eso.
2. **Esperar a SignPath.** Es lo único con una fecha ajena.
3. **Las fuentes sin subsetear**, si en algún momento el peso del PDF se vuelve un problema real.
4. **Usar la aplicación con archivos de verdad** sigue siendo lo que más bugs encuentra en todo el
   proyecto, muy por encima de los arneses. Para PDFs ajenos está `npm run inspeccionar -- archivo.pdf`.

Y lo que **no** hay que hacer sin hablarlo antes: sumar funciones nuevas. El alcance está cerrado a
propósito en CLAUDE.md, y el editor ya hace todo lo que se propuso más el lote de refinamientos.

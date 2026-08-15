# Traspaso — dónde retomar

Estado al cerrar el 14/08/2026. Todo commiteado en
[gsomma86/EditorPDF](https://github.com/gsomma86/EditorPDF) (rama `main`).

**Antes de tocar nada, leer [CLAUDE.md](CLAUDE.md)**: ahí están la regla de alcance, las
convenciones y las lecciones de bugs ya resueltos, que conviene no volver a tropezar.

## Dónde está el proyecto

**Fase 1 (MVP): completa**, incluido el multiidioma ES/EN/PT (`ui/i18n.ts`, ver el punto 1 de
abajo). Todo lo demás está hecho y probado en el navegador por Germán: dibujo, campos AcroForm con
repetibles, rotación, texto vertical y de varias líneas, completar campos, deshacer/rehacer,
guardar/importar proyecto, exportar PDF, fondo de hoja (imagen y PDF), ayuda, atajos, y paneles
colapsables de ancho ajustable.

**Fase 2 (editar PDFs ajenos): completa salvo un detalle chico (ver el punto 2).** Archivo → Abrir
PDF trae el PDF de fondo con sus campos AcroForm ya importados y colocados; doble clic sobre
cualquier texto lo borra del contenido real con una redacción de mupdf y lo reemplaza por un texto
del diseño, con la misma tipografía y en el mismo renglón que el original. Funciona sobre
cualquier página, no solo la primera (selector en la barra de estado). Al exportar, el PDF abierto
es la base, así que lo que ya traía sigue siendo vectorial. Todo verificado de punta a punta en el
navegador, más los arneses `verificar-pdf` y `verificar-campos` (ver más abajo).

**Fase 3 (formas preexistentes): en pausa**, sin caso de uso en los PDF reales disponibles — ver
el punto 3.

## Lo que falta

1. ~~Multiidioma ES/EN/PT~~ — **hecho (14/08/2026)**, en `ui/i18n.ts` (mismo patrón que `i18n.js`
   del editor público: diccionario plano, `data-i18n`/`-title`/`-placeholder`/`-label`, persistido
   en localStorage). El selector del encabezado funciona. Cableado en `shell.ts`, `modales.ts`,
   `panelPropiedades.ts`, `panelCampos.ts`, `main.ts` y los 7 bloques largos de `ui/ayuda.ts` (guía,
   atajos, CSV, repetibles, apariencias, FAQ, acerca de). **Falta probarlo en el navegador** — no se
   verificó todavía que el selector cambie todo correctamente ni que un PDF con texto en otro
   idioma se vea bien.
2. **Único pendiente real de fase 2**: `recuperarPdfGuardado()` no persiste sobre qué página se
   estaba trabajando (`paginaElegida`), así que al recargar la sesión vuelve a la página 0 del PDF
   aunque el diseño (ya restaurado bien, con su fondo correcto) haya quedado sobre otra. No afecta
   lo que se ve al retomar, sí a doble clic sobre texto de esa sesión (usaría los textos de la
   página 0). Todo lo demás de fase 2 está resuelto: posición y tipografía del reemplazo de texto,
   fuentes subseteadas (ver ROADMAP.md — se avisa por Verificar, no hay fallback de sustitución),
   PDF de base persistente, importar campos AcroForm, multipágina, y fondo de hoja tipo PDF.
3. **Fase 3 (formas preexistentes) — en pausa.** Bosquejada y validada dos veces contra PDFs
   reales (14/08/2026, ver ROADMAP.md para la historia completa): primero se corrigió de rellenos a
   trazos, y al medir bien esos trazos —separando contenido real de anotaciones— resultaron ser
   bordes de campos de formulario, no formas de página. Ningún PDF real disponible tiene formas
   editables en su contenido, así que se pausa hasta que aparezca uno; mientras tanto, importar
   campos AcroForm (arriba) cubre el mismo caso de uso (una plantilla con "recuadros" que en
   realidad son campos).
4. **Fases 4 y 5**: capas y multipágina real (de diseño, no solo de PDF de fondo), y empaquetado
   con Tauri.

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

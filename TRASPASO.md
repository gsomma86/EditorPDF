# Traspaso — dónde retomar

Estado al cerrar el 14/08/2026. Todo commiteado en
[gsomma86/EditorPDF](https://github.com/gsomma86/EditorPDF) (rama `main`).

**Antes de tocar nada, leer [CLAUDE.md](CLAUDE.md)**: ahí están la regla de alcance, las
convenciones y las lecciones de bugs ya resueltos, que conviene no volver a tropezar.

## Dónde está el proyecto

**Fase 1 (MVP): completa salvo el multiidioma.** Todo lo demás está hecho y probado en el
navegador por Germán: dibujo, campos AcroForm con repetibles, rotación, texto vertical y de varias
líneas, completar campos, deshacer/rehacer, guardar/importar proyecto, exportar PDF, fondo de hoja,
ayuda, atajos, y paneles colapsables de ancho ajustable.

**Fase 2 (editar PDFs ajenos): funcionando en lo básico.** Archivo → Abrir PDF, doble clic sobre
cualquier texto: el original se borra del contenido real con una redacción de mupdf y en su lugar
queda un texto del diseño. Al exportar, el PDF abierto es la base, así que lo que ya traía sigue
siendo vectorial. Verificado de punta a punta en el navegador: el PDF exportado tiene el texto
nuevo como texto extraíble, y el viejo ya no está.

## Lo que falta

1. **Multiidioma ES/EN/PT** — implementado el 14/08/2026 en `ui/i18n.ts` (mismo patrón que
   `i18n.js` del editor público: diccionario plano, `data-i18n`/`-title`/`-placeholder`/`-label`,
   persistido en localStorage). El selector del encabezado ya funciona. Cableado en `shell.ts`,
   `modales.ts`, `panelPropiedades.ts`, `panelCampos.ts`, `main.ts` y los 7 bloques largos de
   `ui/ayuda.ts` (guía, atajos, CSV, repetibles, apariencias, FAQ, acerca de). **Falta probarlo en
   el navegador** — no se verificó todavía que el selector cambie todo correctamente ni que un
   PDF con texto en otro idioma se vea bien.
2. **Afinar el reemplazo de texto de la fase 2** — resuelta la posición (14/08/2026): la ascendente
   ya no se estima en 0,75 × el cuerpo, se mide embebiendo la fuente igual que al exportar, sin
   redondear. Queda pendiente:
   - El texto nuevo usa la tipografía elegida en el panel, no la que tenía el PDF.
   - Solo se abre la primera página.
3. **Fondo de hoja de tipo PDF** — la otra puerta de entrada de la fase 2.
4. **Fases 3 a 5**: editar formas preexistentes, capas y multipágina real, y empaquetado con Tauri.

## Cómo verificar

```bash
npm run verificar-export   # el PDF exportado contra lo que dibuja el lienzo
npm run verificar-pdf      # que borrar un texto de un PDF lo borre, y no lo tape
npm run medir-rendimiento  # 50, 200, 500 y 1000 elementos
```

Los tres corren sin navegador. En `verificar-export` quedan cuatro diferencias marcadas en los
casos de texto: **son de la medición, no del código** — en Node no está la Helvetica real y
node-canvas dibuja con una sustituta más ancha. Para cerrarlas habría que registrar la fuente real
en el arnés.

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

# Traspaso — dónde retomar

Estado al cerrar la sesión del 14/08/2026, segunda tanda. Todo commiteado en
[gsomma86/EditorPDF](https://github.com/gsomma86/EditorPDF) (rama `main`).

**Antes de tocar nada, leer [CLAUDE.md](CLAUDE.md)**: ahí están la regla de alcance, las
convenciones, y la lista de bugs ya resueltos que conviene no repetir.

## Lo primero: verificar

Germán **verifica siempre él mismo** en el navegador (`npm run dev`). De la primera pasada
salieron cuatro bugs, ya arreglados, que conviene volver a mirar en pantalla:

1. **Zoom**: no existía el atajo Ctrl+rueda, y al acercar el canvas empujaba el layout y se comía
   el panel de Propiedades.
2. **Posición de todo lo dibujado**: Fabric 7 posiciona por el centro y el editor entiende x/y
   como esquina superior izquierda, así que cada objeto caía corrido media caja (lección 16).
   Es el arreglo más profundo de la tanda: conviene probar mover, redimensionar, rotar, duplicar,
   deshacer/rehacer y el enganche a la cuadrícula.
3. **Campos AcroForm**: ahora llevan siempre el contorno azul de ayuda; antes, sin borde propio,
   eran invisibles en la hoja.
4. **Panel de propiedades**: las dos columnas quedaban desalineadas cuando una etiqueta ocupaba
   dos renglones.

Sin probar todavía en el navegador: zoom/cuadrícula/reglas/guías, autoguardado, selección
múltiple, catálogo de campos en CSV, y preflight/peso del PDF.

La **exportación a PDF** ya está verificada de forma automática con `npm run verificar-export`:
compara el PDF contra lo que dibuja el lienzo y hoy da diferencia cero en texto, líneas (incluida
la de 45°), recuadros, tablas, QR y campos, con el ID repetido resolviéndose en un solo campo con
dos apariencias. Quedan dos pendientes reales que esa corrida dejó a la vista:

- **Las fuentes web no se incrustan de verdad**: se embebe el `.woff2` tal cual y el PDF no admite
  fuentes comprimidas, así que el visor sustituye por otra. Ver la lección 12 de CLAUDE.md.
- **Posición vertical del texto**: medido headless queda ~0,17 × el cuerpo más arriba que en el
  lienzo (7 pt con cuerpo 40). La medición usa fuentes sustituidas, así que **hay que confirmarlo
  en el navegador con una fuente real antes de tocar la fórmula** de `exportarPdf.ts`.

## Estado al 14/08, tercera tanda

De la Fase 1 **falta solo el multiidioma**. En esta tanda entraron, además de los cuatro bugs de
arriba: rotación en todos los elementos (con control en el panel y en la selección múltiple),
texto vertical con separación regulable, texto y campos de varias líneas, campo repetible con
comodín, modo "Completar campos", modales de Ayuda, fondo de hoja con imagen, los atajos que
faltaban (copiar/cortar/pegar, seleccionar todo, borrar, mover con flechas) y el peso del PDF
recalculándose solo.

El rendimiento ya está medido y **no hace falta optimizar nada**: `npm run medir-rendimiento` da
1000 elementos armando en 86 ms y redibujando en ~21 ms (unos 48 cuadros por segundo), contra los
~200 elementos que tiene una hoja A4 bien llena.

Dos cosas que conviene tener presentes al probar:

- **Los campos de formulario solo rotan en múltiplos de 90°.** Es del formato PDF, no nuestro. Con
  otro ángulo, al exportar con campos editables se redondea y el preflight avisa; aplanado sale
  con el ángulo exacto.
- **Cambiar tamaño, orientación, márgenes o fondo no se deshace con Ctrl+Z**: el historial guarda
  los elementos del diseño, no la configuración de la página.

## Lo que falta de la Fase 1

**Multiidioma ES/EN/PT**, y nada más. Es el más grande porque toca cada texto de la interfaz, y
por eso se dejó último: recién ahora dejaron de agregarse strings nuevos. El selector de idioma ya
está en el encabezado pero no hace nada. El original tiene su diccionario en `i18n.js`, que puede
servir de base para no traducir todo de cero. Los textos largos (guía, atajos, preguntas
frecuentes, acerca de) están juntos en `ui/ayuda.ts`, así que esa parte es un archivo solo.

Después de eso, la Fase 1 queda cerrada y sigue la **fase 2**: abrir un PDF hecho en otra
herramienta y editar su texto. El ítem "Abrir PDF…" ya existe en el menú Archivo pero todavía no
hace nada, y el fondo de hoja de tipo PDF es su otra puerta de entrada.

## Deudas técnicas conocidas

- **`sincronizarGeometria` para 'campo' reconstruye el objeto** en cada redimensionado. Funciona,
  pero si se nota un parpadeo conviene actualizar el grupo en su lugar.
- **Las fuentes se incrustan sin subsetear** (`subset: false` en `exportarPdf.ts`) porque fontkit
  no puede subsetear woff/woff2. Cada familia usada suma ~20 KB al PDF. Aceptable, pero si algún
  día molesta, la salida sería convertir a TTF antes de embeber.
- **El QR se regenera en cada tecla** al editar su contenido. Hay un contador de generación que
  descarta respuestas fuera de orden, así que es correcto, pero podría llevar un respiro como el
  autoguardado si se nota lento.
- **Las tablas no bajan al PDF con el mismo código que las dibuja en pantalla**: `tablaObjeto.ts`
  usa canvas y `exportarPdf.ts` rehace la geometría con pdf-lib. Si se cambia una, hay que tocar
  la otra. Unificarlo no es trivial (son APIs distintas) pero conviene tenerlo presente.

## Fuera del código

Germán quiso conectar el proyecto a **Claude Code en la nube** y no se pudo. Diagnóstico:

- Del lado de GitHub está correcto: la app de Claude está instalada en `gsomma86` con ReciboMail y
  EditorPDF seleccionados (quedó guardado en esta sesión).
- Del lado de Claude la lista de repos aparece **vacía**, y en Configuración no existe ninguna
  opción de GitHub.
- La causa probable: su cuenta de Claude es la **de trabajo** (`gsomma@napsislatam.com`, org
  Napsislatam) y el GitHub es su cuenta **personal**. En una cuenta de organización esa vinculación
  la suele habilitar un administrador. **No está confirmado.**

No bloquea nada: se trabaja local y se pushea a GitHub como hasta ahora.

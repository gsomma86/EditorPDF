# Traspaso — dónde retomar

Estado al cerrar la sesión del 14/08/2026. Todo está commiteado y pusheado a
[gsomma86/EditorPDF](https://github.com/gsomma86/EditorPDF) (rama `main`, último commit `c170325`).

**Antes de tocar nada, leer [CLAUDE.md](CLAUDE.md)**: ahí están la regla de alcance, las
convenciones, y la lista de bugs ya resueltos que conviene no repetir.

## Lo primero: verificar

Germán **verifica siempre él mismo** en el navegador (`npm run dev`). Las últimas tres tandas se
entregaron compiladas pero **él todavía no las probó**:

1. Zoom, cuadrícula, reglas y guías de alineación.
2. Autoguardado, selección múltiple, catálogo de campos en CSV.
3. Verificar diseño (preflight) y peso del PDF.

Tampoco probó a fondo la **exportación a PDF**, que es la pieza más nueva y la más delicada.
Puntos donde es más probable que aparezca un problema, por orden:

- **Posición vertical del texto exportado.** El PDF mide desde abajo y usa la línea de base, no el
  tope de la caja; es lo más fácil que quede corrido unos puntos respecto del lienzo.
- **Líneas con ángulo**: los extremos se giran a mano (`extremosLinea` en `exportarPdf.ts`) porque
  `drawLine` no acepta rotación.
- **Campos AcroForm**: exportar con y sin el tilde de "Conservar campos editables" y abrir ambos.
- **Fuentes web** contra las estándar.

Si algo de eso falla, arreglarlo antes de sumar funciones nuevas.

## Lo que falta de la Fase 1

En orden sugerido, de menor a mayor esfuerzo. El detalle completo está en [ROADMAP.md](ROADMAP.md).

1. **Modo "Completar campos"** — el checkbox existe en el menú Campos (`#ed-completar`) pero no
   está cableado. En el editor público, al activarlo cada campo del lienzo se vuelve un input
   donde se puede escribir un valor de ejemplo. Sirve para previsualizar cómo va a quedar.
2. **Modales de Ayuda** — los seis ítems del menú Ayuda no hacen nada. Ya existe el helper
   `mostrarAyuda(titulo, html)` en `ui/modales.ts` con su CSS (`.ed-ayuda`), listo para usar:
   solo falta escribir los contenidos y cablear los clics. Los textos del original están en
   `index.html` del editor público (buscar `ed-modal-ayuda-*`).
3. **Campo repetible (comodín `#`)** — es la única función de campos AcroForm que falta. En el
   original, un campo cuyo ID contiene `#` se expande en N filas (`concepto_1`, `concepto_2`, …)
   separadas por un paso configurable, y se dibujan "fantasmas" en el lienzo para verlas. Ver
   `repFilas` / `repSep` en el `editor.js` original.
4. **Fondo de página (imagen)** — el menú Página del original tiene "Fondo: hoja en blanco /
   imagen / PDF". La parte de **imagen** entra en fase 1; la de **PDF** es en realidad la puerta
   de entrada de la fase 2, así que no mezclar.
5. **Rendimiento con documentos grandes** — todavía sin medir. Probar con un diseño de 200+
   elementos antes de decidir si hace falta optimizar algo.
6. **Multiidioma ES/EN/PT** — el más grande: toca cada texto de la interfaz. Conviene hacerlo
   **último**, cuando ya no se agreguen strings nuevos. El selector de idioma ya está en el
   encabezado pero no hace nada. El original tiene su diccionario en `i18n.js`, que puede servir
   de base para no traducir todo de cero.

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

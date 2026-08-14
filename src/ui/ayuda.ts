import { mostrarAyuda } from './modales';

/**
 * Contenidos del menú Ayuda. Están acá y no en `modales.ts` para no mezclar el mecanismo con el
 * texto: los modales son el cómo, esto es el qué. Cuando se sume el multiidioma, este archivo es
 * el que hay que traducir.
 */

const GUIA = `
  <h4>1 · Preparar la hoja</h4>
  <p>En el menú <b>Página</b> se elige tamaño (A4, Carta, Oficio, A5), orientación y márgenes. Los
  márgenes se dibujan punteados en la hoja y son la referencia de dónde conviene poner las cosas:
  no recortan nada.</p>

  <h4>2 · Poner elementos</h4>
  <p>Desde el menú <b>Campos</b> se agregan texto, línea, recuadro, tabla, imagen y QR. Cada uno se
  ajusta en el panel de la derecha: posición y tamaño en puntos, ángulo, colores y tipografía.
  Con <b>Ver → Cuadrícula</b> los elementos se enganchan a una grilla al moverlos.</p>

  <h4>3 · Campos del formulario</h4>
  <p>En el panel de la izquierda se anota el catálogo de IDs (<code>legajo</code>,
  <code>importe</code>…) y con un clic se colocan en la hoja. Un mismo ID se puede poner varias
  veces: en el PDF es un solo campo que se muestra en varios lugares. Si el ID lleva un comodín
  (<code>concepto_#</code>), el botón <b>Hacer repetible</b> lo baja en varias filas numeradas.</p>
  <p>El tilde <b>Completar campos</b> del menú Campos deja escribir un valor de ejemplo dentro de
  cada campo, sobre la hoja, para ver cómo va a quedar con datos reales.</p>

  <h4>4 · Guardar y exportar (son dos cosas distintas)</h4>
  <ul>
    <li><b>Guardar proyecto</b> baja un <code>.json</code> con el diseño para seguir editándolo
    después, acá o en otra computadora.</li>
    <li><b>Exportar PDF</b> genera el PDF final. Es el archivo que se usa; no se puede volver a
    editar acá.</li>
  </ul>
  <p>Además, el trabajo se autoguarda en este navegador, así que si se cierra la pestaña por error
  se ofrece retomarlo al volver.</p>
`;

const ATAJOS = `
  <table class="ed-atajos">
    <tbody>
      <tr><td><kbd>Ctrl</kbd> + <kbd>Z</kbd> / <kbd>Ctrl</kbd> + <kbd>Y</kbd></td><td>Deshacer / Rehacer</td></tr>
      <tr><td><kbd>Ctrl</kbd> + <kbd>C</kbd> / <kbd>Ctrl</kbd> + <kbd>V</kbd></td><td>Copiar / Pegar</td></tr>
      <tr><td><kbd>Ctrl</kbd> + <kbd>X</kbd></td><td>Cortar</td></tr>
      <tr><td><kbd>Ctrl</kbd> + <kbd>A</kbd></td><td>Seleccionar todo lo que hay en la hoja</td></tr>
      <tr><td><kbd>Supr</kbd> / <kbd>Delete</kbd></td><td>Borrar lo seleccionado</td></tr>
      <tr><td><kbd>Flechas</kbd></td><td>Mover 1 pt</td></tr>
      <tr><td><kbd>Shift</kbd> + <kbd>Flechas</kbd></td><td>Mover 10 pt</td></tr>
      <tr><td><kbd>Ctrl</kbd> + rueda del mouse</td><td>Acercar / alejar</td></tr>
      <tr><td><kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>Z</kbd></td><td>Rehacer (igual que Ctrl+Y)</td></tr>
      <tr><td><kbd>Escape</kbd></td><td>Cerrar el cuadro que esté abierto</td></tr>
    </tbody>
  </table>
  <p>Para seleccionar varios elementos: <kbd>Ctrl</kbd> o <kbd>Shift</kbd> mientras se hace clic, o
  arrastrar un recuadro sobre la hoja.</p>
`;

const FAQ = `
  <h4>¿Se sube algo a un servidor?</h4>
  <p>No. Todo corre en el navegador: no hay backend y nada del diseño sale de la máquina. El
  autoguardado usa el almacenamiento local del propio navegador.</p>

  <h4>¿Cómo sigo un diseño en otra computadora?</h4>
  <p><b>Archivo → Guardar proyecto</b> baja un <code>.json</code>. En la otra máquina,
  <b>Archivo → Importar proyecto</b> lo abre tal como estaba.</p>

  <h4>¿Los campos quedan editables en Acrobat o Edge?</h4>
  <p>Sí: se exportan como AcroForm estándar. Al exportar se puede destildar <b>Conservar campos
  editables</b> para que en lugar de campos se dibuje su valor por defecto, y el PDF quede fijo.</p>

  <h4>¿Puedo abrir un PDF hecho en otra herramienta y editarlo?</h4>
  <p>Todavía no. Es el objetivo del proyecto y está en desarrollo: hoy el editor genera PDFs
  propios, pero no modifica el contenido de uno existente.</p>

  <h4>¿Por qué el texto que exporto no se ve igual que en pantalla?</h4>
  <p>Las tipografías web se incrustan en el PDF, así que deberían verse iguales. Si algo no cuadra,
  <b>Verificar</b> (en la barra de abajo) revisa el diseño y avisa lo que puede dar problemas antes
  de exportar.</p>

  <h4>¿Qué pasa si un elemento se sale de la hoja?</h4>
  <p><b>Verificar</b> lo marca como error. Fuera de los márgenes es solo una advertencia: entra en
  el PDF igual.</p>
`;

const CSV = `
  <p>El catálogo de IDs del panel izquierdo se puede llevar y traer como CSV, para no cargarlo a
  mano cuando ya existe en otro lado.</p>

  <h4>Formato</h4>
  <p>Un ID por línea. La primera línea puede ser un encabezado —se descarta si dice algo como
  <code>id</code> o <code>campo</code>— y si hay varias columnas se toma la primera.</p>
  <p>Ejemplo:</p>
  <pre><code>legajo
apellido_nombre
importe_neto
fecha_pago</code></pre>

  <h4>Al importar</h4>
  <ul>
    <li>Los IDs que ya estaban <b>no se duplican</b>.</li>
    <li>Los campos ya colocados en la hoja <b>no se tocan</b>: el CSV solo llena el catálogo.</li>
  </ul>
  <p>Está en <b>Campos → Importar campos (CSV)</b> y <b>Exportar campos (CSV)</b>.</p>
`;

const REPETIBLES = `
  <p>Sirve para lo que se repite fila por fila —los conceptos de un recibo, los ítems de una
  factura— sin tener que colocar el campo veinte veces a mano.</p>

  <h4>Cómo se usa</h4>
  <ol>
    <li>Colocá un campo en la hoja y seleccionalo.</li>
    <li>En el panel, tocá <b>Hacer repetible</b>.</li>
    <li>Poné un ID que contenga el comodín, por ejemplo <code>concepto_#</code>, y decí cuántas
    filas y cuánta separación entre ellas.</li>
  </ol>
  <p>En el PDF eso baja como <code>concepto_1</code>, <code>concepto_2</code>, … un campo por fila,
  cada uno separado del anterior por el alto del campo más la separación que hayas puesto.</p>

  <h4>Qué esperar</h4>
  <ul>
    <li>En la hoja, las filas 2 en adelante se dibujan punteadas: son una previsualización, no se
    pueden seleccionar ni mover por separado. Se mueven con el campo.</li>
    <li>El ID <b>tiene que</b> contener el comodín: si no, todas las filas se llamarían igual y en
    el PDF serían un solo campo.</li>
    <li><b>Verificar</b> avisa si las últimas filas se caen de la hoja.</li>
  </ul>
`;

const APARIENCIAS = `
  <p>Es una opción del cuadro de <b>Exportar PDF</b>, pensada para los campos marcados como
  invisibles.</p>

  <h4>Qué hace</h4>
  <p>Borra del PDF la <i>apariencia</i> guardada de cada campo (la entrada <code>/AP</code>, que es
  el dibujo ya resuelto de cómo se ve). Un campo invisible lleva una bandera de oculto, pero hay
  visores que la ignoran y dibujan igual esa apariencia: sin ella, no tienen qué dibujar.</p>

  <h4>Cuándo usarla</h4>
  <ul>
    <li><b>Sí</b>: si tenés campos invisibles y el PDF va a abrirse en visores variados, o si al
    probarlo aparecen campos que deberían estar ocultos.</li>
    <li><b>No</b>: si no usás campos invisibles. Sin apariencias, algunos visores dibujan los campos
    con su estilo propio en vez del que definiste.</li>
  </ul>
  <p><b>No se puede deshacer</b> en el PDF exportado. El diseño no se toca: alcanza con exportar de
  nuevo sin la opción.</p>
`;

const ACERCA = `
  <p><b>EditorPDF</b> — editor de PDF libre y de código abierto, sin servidor: todo se procesa en
  el navegador.</p>
  <ul>
    <li>Versión 0.1.0 (en desarrollo)</li>
    <li>Autor: Germán Somma</li>
    <li>Licencia: <b>AGPL-3.0</b> — cualquiera que reciba este programa puede pedir su código
    fuente completo.</li>
    <li>Código: <code>github.com/gsomma86/EditorPDF</code></li>
  </ul>
  <h4>Construido con</h4>
  <ul>
    <li><b>Fabric.js</b> para la superficie de edición</li>
    <li><b>pdf-lib</b> y <b>fontkit</b> para generar el PDF y sus formularios</li>
    <li><b>pdf.js</b> y <b>mupdf</b> para leer y editar PDFs existentes</li>
    <li><b>qrcode</b> para los códigos QR, y tipografías de <b>Fontsource</b> con licencia OFL</li>
  </ul>
`;

/** Deja los ítems del menú Ayuda funcionando. Devuelve el modal de atajos para el atajo Ctrl+/. */
export function cablearAyuda(): { verAtajos: () => void } {
  const items: [string, string, string][] = [
    ['ed-ayuda-guia', '🚀 Guía rápida', GUIA],
    ['ed-ayuda-atajos', '⌨️ Atajos de teclado', ATAJOS],
    ['ed-ayuda-csv', '📄 Cargar campos desde CSV', CSV],
    ['ed-ayuda-repetibles', '🔁 Campos repetibles (#)', REPETIBLES],
    ['ed-ayuda-apariencias', '🧾 Eliminar apariencias', APARIENCIAS],
    ['ed-ayuda-faq', '❓ Preguntas frecuentes', FAQ],
    ['ed-ayuda-acerca', 'ℹ️ Acerca de EditorPDF', ACERCA],
  ];

  for (const [id, titulo, contenido] of items) {
    document.getElementById(id)?.addEventListener('click', () => void mostrarAyuda(titulo, contenido));
  }

  return { verAtajos: () => void mostrarAyuda('⌨️ Atajos de teclado', ATAJOS) };
}

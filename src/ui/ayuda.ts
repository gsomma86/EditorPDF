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
    ['ed-ayuda-faq', '❓ Preguntas frecuentes', FAQ],
    ['ed-ayuda-acerca', 'ℹ️ Acerca de EditorPDF', ACERCA],
  ];

  for (const [id, titulo, contenido] of items) {
    document.getElementById(id)?.addEventListener('click', () => void mostrarAyuda(titulo, contenido));
  }

  return { verAtajos: () => void mostrarAyuda('⌨️ Atajos de teclado', ATAJOS) };
}

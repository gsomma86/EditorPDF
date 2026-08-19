import { mostrarAyuda } from './modales';
import { idiomaActual, t, type Idioma } from './i18n';

/**
 * Contenidos del menú Ayuda. Están acá y no en `modales.ts` para no mezclar el mecanismo con el
 * texto: los modales son el cómo, esto es el qué. Es el archivo a traducir para el multiidioma:
 * cada bloque tiene sus tres variantes (ES/EN/PT) y se elige la vigente al abrir el modal, no hace
 * falta re-render en caliente porque estos modales son transitorios.
 */

const GUIA: Record<Idioma, string> = {
  es: `
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
`,
  en: `
  <h4>1 · Set up the sheet</h4>
  <p>In the <b>Page</b> menu you choose the size (A4, Letter, Legal, A5), orientation and margins.
  Margins are drawn as a dotted guide on the sheet and are just a reference for where things
  should go: they don't crop anything.</p>

  <h4>2 · Add elements</h4>
  <p>From the <b>Fields</b> menu you add text, line, box, table, image and QR. Each one is adjusted
  in the panel on the right: position and size in points, angle, colors and typography.
  With <b>View → Grid</b> elements snap to a grid as you move them.</p>

  <h4>3 · Form fields</h4>
  <p>The panel on the left keeps the catalog of IDs (<code>employee_id</code>,
  <code>amount</code>…) and a click places them on the sheet. The same ID can be placed several
  times: in the PDF it's a single field shown in several places. If the ID carries a wildcard
  (<code>item_#</code>), the <b>Make repeatable</b> button lays it out in several numbered rows.</p>
  <p>The <b>Fill in fields</b> checkbox in the Fields menu lets you type a sample value inside each
  field, right on the sheet, to preview how it'll look with real data.</p>

  <h4>4 · Save and export (two different things)</h4>
  <ul>
    <li><b>Save project</b> downloads a <code>.json</code> with the design to keep editing it
    later, here or on another computer.</li>
    <li><b>Export PDF</b> generates the final PDF. It's the file that gets used; it can't be
    edited here again.</li>
  </ul>
  <p>The work is also auto-saved in this browser, so if the tab closes by accident you'll be
  offered to resume it when you come back.</p>
`,
  pt: `
  <h4>1 · Preparar a folha</h4>
  <p>No menu <b>Página</b> você escolhe o tamanho (A4, Carta, Ofício, A5), a orientação e as
  margens. As margens são desenhadas como um guia pontilhado na folha e servem apenas de
  referência de onde colocar as coisas: não recortam nada.</p>

  <h4>2 · Colocar elementos</h4>
  <p>No menu <b>Campos</b> você adiciona texto, linha, retângulo, tabela, imagem e QR. Cada um se
  ajusta no painel da direita: posição e tamanho em pontos, ângulo, cores e tipografia.
  Com <b>Exibir → Grade</b> os elementos se encaixam em uma grade ao movê-los.</p>

  <h4>3 · Campos do formulário</h4>
  <p>No painel da esquerda fica o catálogo de IDs (<code>matricula</code>,
  <code>valor</code>…) e um clique os coloca na folha. O mesmo ID pode ser colocado várias vezes:
  no PDF é um único campo que aparece em vários lugares. Se o ID tiver um coringa
  (<code>item_#</code>), o botão <b>Tornar repetível</b> o distribui em várias linhas numeradas.</p>
  <p>A opção <b>Preencher campos</b> do menu Campos permite digitar um valor de exemplo dentro de
  cada campo, na própria folha, para ver como vai ficar com dados reais.</p>

  <h4>4 · Salvar e exportar (são duas coisas diferentes)</h4>
  <ul>
    <li><b>Salvar projeto</b> baixa um <code>.json</code> com o modelo para continuar editando
    depois, aqui ou em outro computador.</li>
    <li><b>Exportar PDF</b> gera o PDF final. É o arquivo que se usa; não pode ser editado aqui de
    novo.</li>
  </ul>
  <p>Além disso, o trabalho é salvo automaticamente neste navegador, então se a aba fechar por
  engano você poderá retomá-lo ao voltar.</p>
`,
};

/**
 * La tabla de atajos se arma sola desde esta lista: son muchos, y mantenerlos escritos a mano en
 * tres idiomas se desfasa de la aplicación a la primera de cambio.
 */
const FILAS_ATAJOS: { teclas: string[]; que: Record<Idioma, string> }[] = [
  { teclas: ['Ctrl', 'Alt', 'N'], que: { es: 'Nuevo proyecto', en: 'New project', pt: 'Novo projeto' } },
  { teclas: ['Ctrl', 'O'], que: { es: 'Abrir PDF', en: 'Open PDF', pt: 'Abrir PDF' } },
  { teclas: ['Ctrl', 'Shift', 'O'], que: { es: 'Importar proyecto', en: 'Import project', pt: 'Importar projeto' } },
  { teclas: ['Ctrl', 'S'], que: { es: 'Guardar proyecto', en: 'Save project', pt: 'Salvar projeto' } },
  { teclas: ['Ctrl', 'E'], que: { es: 'Exportar PDF', en: 'Export PDF', pt: 'Exportar PDF' } },
  { teclas: ['Ctrl', 'Alt', 'V'], que: { es: 'Verificar diseño', en: 'Verify design', pt: 'Verificar design' } },
  { teclas: ['Ctrl', 'Alt', 'I'], que: { es: 'Insertar PDF', en: 'Insert PDF', pt: 'Inserir PDF' } },
  { teclas: ['Ctrl', 'Alt', 'M'], que: { es: 'Configurar márgenes', en: 'Set up margins', pt: 'Configurar margens' } },
  { teclas: ['Ctrl', 'Z'], que: { es: 'Deshacer', en: 'Undo', pt: 'Desfazer' } },
  { teclas: ['Ctrl', 'Y'], que: { es: 'Rehacer (también Ctrl+Shift+Z)', en: 'Redo (also Ctrl+Shift+Z)', pt: 'Refazer (também Ctrl+Shift+Z)' } },
  { teclas: ['Ctrl', 'A'], que: { es: 'Seleccionar todo lo que hay en la hoja', en: 'Select everything on the sheet', pt: 'Selecionar tudo o que há na folha' } },
  { teclas: ['Ctrl', 'X'], que: { es: 'Cortar', en: 'Cut', pt: 'Recortar' } },
  { teclas: ['Ctrl', 'C'], que: { es: 'Copiar', en: 'Copy', pt: 'Copiar' } },
  { teclas: ['Ctrl', 'V'], que: { es: 'Pegar', en: 'Paste', pt: 'Colar' } },
  { teclas: ['Supr'], que: { es: 'Borrar lo seleccionado', en: 'Delete the selection', pt: 'Excluir a seleção' } },
  { teclas: ['Flechas'], que: { es: 'Mover 1 pt', en: 'Move 1 pt', pt: 'Mover 1 pt' } },
  { teclas: ['Shift', 'Flechas'], que: { es: 'Mover 10 pt', en: 'Move 10 pt', pt: 'Mover 10 pt' } },
  { teclas: ['T'], que: { es: 'Dibujar un texto', en: 'Draw a text', pt: 'Desenhar um texto' } },
  { teclas: ['L'], que: { es: 'Dibujar una línea', en: 'Draw a line', pt: 'Desenhar uma linha' } },
  { teclas: ['R'], que: { es: 'Dibujar un recuadro', en: 'Draw a box', pt: 'Desenhar um retângulo' } },
  { teclas: ['E'], que: { es: 'Dibujar una elipse', en: 'Draw an ellipse', pt: 'Desenhar uma elipse' } },
  { teclas: ['F'], que: { es: 'Dibujar una flecha', en: 'Draw an arrow', pt: 'Desenhar uma seta' } },
  { teclas: ['B'], que: { es: 'Dibujar una tabla', en: 'Draw a table', pt: 'Desenhar uma tabela' } },
  { teclas: ['I'], que: { es: 'Insertar una imagen', en: 'Insert an image', pt: 'Inserir uma imagem' } },
  { teclas: ['Q'], que: { es: 'Insertar un QR', en: 'Insert a QR code', pt: 'Inserir um QR' } },
  { teclas: ['F2'], que: { es: 'Completar campos', en: 'Fill in fields', pt: 'Preencher campos' } },
  { teclas: ['F3'], que: { es: 'Bloquear todo menos los campos', en: 'Lock everything but the fields', pt: 'Bloquear tudo menos os campos' } },
  { teclas: ['F4'], que: { es: 'Ocultar campos en el lienzo', en: 'Hide fields on the canvas', pt: 'Ocultar campos na tela' } },
  { teclas: ['Ctrl', 'Alt', 'C'], que: { es: 'Importar campos (CSV)', en: 'Import fields (CSV)', pt: 'Importar campos (CSV)' } },
  { teclas: ['Ctrl', 'Alt', 'X'], que: { es: 'Exportar campos (CSV)', en: 'Export fields (CSV)', pt: 'Exportar campos (CSV)' } },
  { teclas: ['Ctrl', "'"], que: { es: 'Cuadrícula', en: 'Grid', pt: 'Grade' } },
  { teclas: ['Ctrl', 'Alt', 'R'], que: { es: 'Reglas', en: 'Rulers', pt: 'Réguas' } },
  { teclas: ['Ctrl', ';'], que: { es: 'Guías de alineación', en: 'Alignment guides', pt: 'Guias de alinhamento' } },
  { teclas: ['Ctrl', 'Alt', 'B'], que: { es: 'Restaurar las barras', en: 'Reset the bars', pt: 'Restaurar as barras' } },
  { teclas: ['Ctrl', '+'], que: { es: 'Acercar (también Ctrl + rueda del mouse)', en: 'Zoom in (also Ctrl + mouse wheel)', pt: 'Aproximar (também Ctrl + roda do mouse)' } },
  { teclas: ['Ctrl', '−'], que: { es: 'Alejar', en: 'Zoom out', pt: 'Afastar' } },
  { teclas: ['Ctrl', '0'], que: { es: 'Volver al 100 %', en: 'Back to 100%', pt: 'Voltar a 100 %' } },
  { teclas: ['F1'], que: { es: 'Guía rápida', en: 'Quick guide', pt: 'Guia rápido' } },
  { teclas: ['Ctrl', '/'], que: { es: 'Esta ventana', en: 'This window', pt: 'Esta janela' } },
  { teclas: ['Escape'], que: { es: 'Cerrar el cuadro que esté abierto', en: 'Close whatever dialog is open', pt: 'Fechar a caixa que estiver aberta' } },
];

const CIERRE_ATAJOS: Record<Idioma, string> = {
  es: 'Para seleccionar varios elementos: <kbd>Ctrl</kbd> o <kbd>Shift</kbd> mientras se hace clic, o arrastrar un recuadro sobre la hoja. Las teclas sueltas (T, L, R…) no hacen nada mientras se escribe en un campo.',
  en: 'To select several elements: <kbd>Ctrl</kbd> or <kbd>Shift</kbd> while clicking, or drag a box over the sheet. Single-letter shortcuts (T, L, R…) do nothing while typing in a field.',
  pt: 'Para selecionar vários elementos: <kbd>Ctrl</kbd> ou <kbd>Shift</kbd> enquanto clica, ou arraste um retângulo sobre a folha. As teclas soltas (T, L, R…) não fazem nada enquanto se escreve num campo.',
};

function tablaDeAtajos(idioma: Idioma): string {
  const filas = FILAS_ATAJOS.map(
    (fila) => `<tr><td>${fila.teclas.map((tecla) => `<kbd>${tecla}</kbd>`).join(' + ')}</td><td>${fila.que[idioma]}</td></tr>`
  ).join('');
  return `<table class="ed-atajos"><tbody>${filas}</tbody></table><p>${CIERRE_ATAJOS[idioma]}</p>`;
}

const ATAJOS: Record<Idioma, string> = { es: tablaDeAtajos('es'), en: tablaDeAtajos('en'), pt: tablaDeAtajos('pt') };

const FAQ: Record<Idioma, string> = {
  es: `
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
  <p>Sí. <b>Archivo → Abrir PDF</b> lo trae de fondo con sus campos AcroForm ya importados, listos
  para editar. Con <b>doble clic</b> sobre cualquier texto del PDF, el original se borra del
  contenido real —no se tapa— y en su lugar queda un texto del diseño, con la misma tipografía y
  tamaño. Si tiene varias páginas, un selector en la barra de estado deja elegir cuál.</p>

  <h4>¿Por qué el texto que exporto no se ve igual que en pantalla?</h4>
  <p>Las tipografías web se incrustan en el PDF, así que deberían verse iguales. Si algo no cuadra,
  <b>Verificar</b> (en la barra de abajo) revisa el diseño y avisa lo que puede dar problemas antes
  de exportar.</p>

  <h4>¿Qué pasa si un elemento se sale de la hoja?</h4>
  <p><b>Verificar</b> lo marca como error. Fuera de los márgenes es solo una advertencia: entra en
  el PDF igual.</p>

  <h4>¿Funciona con cualquier alfabeto?</h4>
  <p>El editor trabaja con alfabeto latino. Un carácter que ninguna de sus tipografías sabe
  dibujar —cirílico, chino, árabe…— sale como <code>?</code> en el PDF; <b>Verificar</b> avisa
  antes de exportar cuáles caracteres no se van a poder dibujar.</p>
`,
  en: `
  <h4>Does anything get uploaded to a server?</h4>
  <p>No. Everything runs in the browser: there's no backend and nothing about the design leaves
  the machine. Auto-save uses the browser's own local storage.</p>

  <h4>How do I continue a design on another computer?</h4>
  <p><b>File → Save project</b> downloads a <code>.json</code>. On the other machine,
  <b>File → Import project</b> opens it exactly as it was.</p>

  <h4>Do fields stay editable in Acrobat or Edge?</h4>
  <p>Yes: they're exported as standard AcroForm. When exporting you can uncheck <b>Keep fields
  editable</b> so their default value is drawn in place of the fields, and the PDF stays fixed.</p>

  <h4>Can I open a PDF made in another tool and edit it?</h4>
  <p>Yes. <b>File → Open PDF</b> brings it in as the background with its AcroForm fields already
  imported, ready to edit. <b>Double-click</b> any text in the PDF and the original is removed from
  the actual content —not covered up— replaced by a design text with the same font and size. If it
  has several pages, a selector in the bottom bar lets you pick which one.</p>

  <h4>Why doesn't the exported text look the same as on screen?</h4>
  <p>Web fonts are embedded in the PDF, so they should look the same. If something's off,
  <b>Verify</b> (in the bottom bar) reviews the design and flags anything that could cause trouble
  before exporting.</p>

  <h4>What happens if an element falls outside the sheet?</h4>
  <p><b>Verify</b> flags it as an error. Outside the margins is only a warning: it still goes into
  the PDF.</p>

  <h4>Does it work with any alphabet?</h4>
  <p>The editor works with the Latin alphabet. A character none of its fonts can draw —Cyrillic,
  Chinese, Arabic…— comes out as <code>?</code> in the PDF; <b>Verify</b> warns before exporting
  which characters won't be drawable.</p>
`,
  pt: `
  <h4>Alguma coisa é enviada para um servidor?</h4>
  <p>Não. Tudo roda no navegador: não há backend e nada do modelo sai da máquina. O salvamento
  automático usa o armazenamento local do próprio navegador.</p>

  <h4>Como continuo um modelo em outro computador?</h4>
  <p><b>Arquivo → Salvar projeto</b> baixa um <code>.json</code>. No outro computador,
  <b>Arquivo → Importar projeto</b> o abre exatamente como estava.</p>

  <h4>Os campos ficam editáveis no Acrobat ou no Edge?</h4>
  <p>Sim: são exportados como AcroForm padrão. Ao exportar você pode desmarcar <b>Manter campos
  editáveis</b> para que, em vez de campos, seja desenhado o valor padrão, e o PDF fique fixo.</p>

  <h4>Posso abrir um PDF feito em outra ferramenta e editá-lo?</h4>
  <p>Sim. <b>Arquivo → Abrir PDF</b> traz ele como fundo com seus campos AcroForm já importados,
  prontos para editar. Com <b>duplo clique</b> em qualquer texto do PDF, o original é removido do
  conteúdo real —não é coberto— e em seu lugar fica um texto do modelo, com a mesma tipografia e
  tamanho. Se tiver várias páginas, um seletor na barra de baixo permite escolher qual.</p>

  <h4>Por que o texto exportado não fica igual ao da tela?</h4>
  <p>As tipografias web são incorporadas ao PDF, então deveriam ficar iguais. Se algo não bater,
  <b>Verificar</b> (na barra de baixo) revisa o modelo e avisa o que pode dar problema antes de
  exportar.</p>

  <h4>O que acontece se um elemento sair da folha?</h4>
  <p><b>Verificar</b> marca isso como erro. Fora das margens é apenas um aviso: entra no PDF do
  mesmo jeito.</p>

  <h4>Funciona com qualquer alfabeto?</h4>
  <p>O editor trabalha com o alfabeto latino. Um caractere que nenhuma das suas tipografias sabe
  desenhar —cirílico, chinês, árabe…— sai como <code>?</code> no PDF; <b>Verificar</b> avisa antes
  de exportar quais caracteres não vão poder ser desenhados.</p>
`,
};

const CSV: Record<Idioma, string> = {
  es: `
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
`,
  en: `
  <p>The ID catalog on the left panel can be brought in and taken out as CSV, so you don't have to
  type it by hand when it already exists somewhere else.</p>

  <h4>Format</h4>
  <p>One ID per line. The first line can be a header —it's discarded if it says something like
  <code>id</code> or <code>field</code>— and if there are several columns, the first one is used.</p>
  <p>Example:</p>
  <pre><code>employee_id
last_first_name
net_amount
payment_date</code></pre>

  <h4>On import</h4>
  <ul>
    <li>IDs that were already there <b>aren't duplicated</b>.</li>
    <li>Fields already placed on the sheet <b>aren't touched</b>: the CSV only fills the catalog.</li>
  </ul>
  <p>It's under <b>Fields → Import fields (CSV)</b> and <b>Export fields (CSV)</b>.</p>
`,
  pt: `
  <p>O catálogo de IDs do painel esquerdo pode ser levado e trazido como CSV, para não ter que
  digitá-lo à mão quando já existe em outro lugar.</p>

  <h4>Formato</h4>
  <p>Um ID por linha. A primeira linha pode ser um cabeçalho —é descartada se disser algo como
  <code>id</code> ou <code>campo</code>— e, se houver várias colunas, a primeira é usada.</p>
  <p>Exemplo:</p>
  <pre><code>matricula
sobrenome_nome
valor_liquido
data_pagamento</code></pre>

  <h4>Ao importar</h4>
  <ul>
    <li>Os IDs que já existiam <b>não são duplicados</b>.</li>
    <li>Os campos já colocados na folha <b>não são alterados</b>: o CSV só preenche o catálogo.</li>
  </ul>
  <p>Está em <b>Campos → Importar campos (CSV)</b> e <b>Exportar campos (CSV)</b>.</p>
`,
};

const REPETIBLES: Record<Idioma, string> = {
  es: `
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
`,
  en: `
  <p>It's for whatever repeats row by row —the line items of a receipt, the items of an
  invoice— without having to place the field twenty times by hand.</p>

  <h4>How to use it</h4>
  <ol>
    <li>Place a field on the sheet and select it.</li>
    <li>In the panel, tap <b>Make repeatable</b>.</li>
    <li>Set an ID that contains the wildcard, for example <code>item_#</code>, and say how many
    rows and how much spacing between them.</li>
  </ol>
  <p>In the PDF that goes in as <code>item_1</code>, <code>item_2</code>, … one field per row, each
  one separated from the previous by the field's height plus the spacing you set.</p>

  <h4>What to expect</h4>
  <ul>
    <li>On the sheet, rows 2 onward are drawn dotted: they're a preview, they can't be selected or
    moved separately. They move along with the field.</li>
    <li>The ID <b>must</b> contain the wildcard: otherwise every row would be named the same and in
    the PDF they'd be a single field.</li>
    <li><b>Verify</b> warns if the last rows fall off the sheet.</li>
  </ul>
`,
  pt: `
  <p>Serve para o que se repete linha por linha —os itens de um recibo, os itens de uma
  nota fiscal— sem ter que colocar o campo vinte vezes à mão.</p>

  <h4>Como se usa</h4>
  <ol>
    <li>Coloque um campo na folha e selecione-o.</li>
    <li>No painel, toque em <b>Tornar repetível</b>.</li>
    <li>Defina um ID que contenha o coringa, por exemplo <code>item_#</code>, e diga quantas
    linhas e qual o espaçamento entre elas.</li>
  </ol>
  <p>No PDF isso desce como <code>item_1</code>, <code>item_2</code>, … um campo por linha, cada um
  separado do anterior pela altura do campo mais o espaçamento definido.</p>

  <h4>O que esperar</h4>
  <ul>
    <li>Na folha, as linhas a partir da 2ª são desenhadas pontilhadas: são uma pré-visualização,
    não podem ser selecionadas nem movidas separadamente. Se movem junto com o campo.</li>
    <li>O ID <b>precisa</b> conter o coringa: caso contrário, todas as linhas teriam o mesmo nome
    e no PDF seriam um único campo.</li>
    <li><b>Verificar</b> avisa se as últimas linhas caírem fora da folha.</li>
  </ul>
`,
};

const APARIENCIAS: Record<Idioma, string> = {
  es: `
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
`,
  en: `
  <p>It's an option in the <b>Export PDF</b> dialog, meant for fields marked as invisible.</p>

  <h4>What it does</h4>
  <p>It removes each field's stored <i>appearance</i> from the PDF (the <code>/AP</code> entry,
  which is the already-resolved drawing of what it looks like). An invisible field carries a
  hidden flag, but some viewers ignore it and draw that appearance anyway: without it, they have
  nothing to draw.</p>

  <h4>When to use it</h4>
  <ul>
    <li><b>Yes</b>: if you have invisible fields and the PDF will be opened in a variety of
    viewers, or if fields that should be hidden show up when you test it.</li>
    <li><b>No</b>: if you don't use invisible fields. Without appearances, some viewers draw
    fields with their own style instead of the one you set.</li>
  </ul>
  <p>It <b>cannot be undone</b> in the exported PDF. The design itself isn't touched: exporting
  again without the option is enough.</p>
`,
  pt: `
  <p>É uma opção da caixa de <b>Exportar PDF</b>, pensada para campos marcados como invisíveis.</p>

  <h4>O que faz</h4>
  <p>Remove do PDF a <i>aparência</i> salva de cada campo (a entrada <code>/AP</code>, que é o
  desenho já resolvido de como ele se parece). Um campo invisível carrega uma marca de oculto, mas
  há visualizadores que a ignoram e desenham essa aparência mesmo assim: sem ela, não têm o que
  desenhar.</p>

  <h4>Quando usar</h4>
  <ul>
    <li><b>Sim</b>: se você tem campos invisíveis e o PDF vai ser aberto em visualizadores
    variados, ou se ao testá-lo aparecem campos que deveriam estar ocultos.</li>
    <li><b>Não</b>: se você não usa campos invisíveis. Sem aparências, alguns visualizadores
    desenham os campos com seu próprio estilo em vez do que você definiu.</li>
  </ul>
  <p><b>Não pode ser desfeito</b> no PDF exportado. O modelo em si não é alterado: basta exportar
  de novo sem a opção.</p>
`,
};

const ACERCA: Record<Idioma, string> = {
  es: `
  <p><b>EditorPDF</b> — editor de PDF libre y de código abierto, sin servidor: todo se procesa en
  el navegador.</p>
  <ul>
    <li>Versión 1.0.9</li>
    <li>Autor: Germán Ezequiel Somma — <a href="mailto:sommagerman@gmail.com">sommagerman@gmail.com</a></li>
  </ul>
  <h4>Construido con</h4>
  <ul>
    <li><b>Fabric.js</b> para la superficie de edición</li>
    <li><b>pdf-lib</b> y <b>fontkit</b> para generar el PDF y sus formularios</li>
    <li><b>pdf.js</b> y <b>mupdf</b> para leer y editar PDFs existentes</li>
    <li><b>qrcode</b> para los códigos QR, y tipografías de <b>Fontsource</b></li>
  </ul>
`,
  en: `
  <p><b>EditorPDF</b> — a free, open-source PDF editor with no server: everything runs in the
  browser.</p>
  <ul>
    <li>Version 1.0.9</li>
    <li>Author: Germán Ezequiel Somma — <a href="mailto:sommagerman@gmail.com">sommagerman@gmail.com</a></li>
  </ul>
  <h4>Built with</h4>
  <ul>
    <li><b>Fabric.js</b> for the editing surface</li>
    <li><b>pdf-lib</b> and <b>fontkit</b> to generate the PDF and its forms</li>
    <li><b>pdf.js</b> and <b>mupdf</b> to read and edit existing PDFs</li>
    <li><b>qrcode</b> for QR codes, and <b>Fontsource</b> typefaces</li>
  </ul>
`,
  pt: `
  <p><b>EditorPDF</b> — editor de PDF livre e de código aberto, sem servidor: tudo é processado no
  navegador.</p>
  <ul>
    <li>Versão 1.0.9</li>
    <li>Autor: Germán Ezequiel Somma — <a href="mailto:sommagerman@gmail.com">sommagerman@gmail.com</a></li>
  </ul>
  <h4>Construído com</h4>
  <ul>
    <li><b>Fabric.js</b> para a superfície de edição</li>
    <li><b>pdf-lib</b> e <b>fontkit</b> para gerar o PDF e seus formulários</li>
    <li><b>pdf.js</b> e <b>mupdf</b> para ler e editar PDFs existentes</li>
    <li><b>qrcode</b> para os códigos QR, e tipografias do <b>Fontsource</b></li>
  </ul>
`,
};

/** Deja los ítems del menú Ayuda funcionando. Devuelve el modal de atajos para el atajo Ctrl+/. */
export function cablearAyuda(): { verAtajos: () => void } {
  const items: [string, Parameters<typeof t>[0], Record<Idioma, string>][] = [
    ['ed-ayuda-guia', 'ayuda.menu.guia', GUIA],
    ['ed-ayuda-atajos', 'ayuda.menu.atajos', ATAJOS],
    ['ed-ayuda-csv', 'ayuda.menu.csv', CSV],
    ['ed-ayuda-repetibles', 'ayuda.menu.repetibles', REPETIBLES],
    ['ed-ayuda-apariencias', 'ayuda.menu.apariencias', APARIENCIAS],
    ['ed-ayuda-faq', 'ayuda.menu.faq', FAQ],
    ['ed-ayuda-acerca', 'ayuda.menu.acerca', ACERCA],
  ];

  for (const [id, claveTitulo, contenido] of items) {
    document.getElementById(id)?.addEventListener('click', () => void mostrarAyuda(t(claveTitulo), contenido[idiomaActual()]));
  }

  return { verAtajos: () => void mostrarAyuda(t('ayuda.menu.atajos'), ATAJOS[idiomaActual()]) };
}

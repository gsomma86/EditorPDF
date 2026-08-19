import { cache, FabricImage, FabricObject, FabricText, Group, Rect, Textbox, type Canvas } from 'fabric';
import QRCode from 'qrcode';
import { alturaRenglonFabric, PASO_RENGLON, type Elemento, type ElementoQr } from './elemento';
import {
  capaDe,
  capaDestino,
  capasDelDocumento,
  capasSobreElFondoDelDocumento,
  elementoBloqueado,
  elementoVisible,
} from './documento';
import { asegurarFuenteCargada } from './fuentes';
import { TablaObjeto } from './tablaObjeto';
import { LineaObjeto } from './lineaObjeto';
import { FormaObjeto } from './formaObjeto';
import { RectObjeto } from './rectObjeto';

/**
 * Fabric 7 posiciona los objetos por su centro, pero acá x/y es la esquina superior izquierda:
 * así lo entienden el modelo, el panel de propiedades, los márgenes, el enganche y el exportador.
 * Sin esto, cada objeto se dibuja corrido media caja hacia arriba y a la izquierda respecto de
 * donde dice el modelo, y el PDF sale distinto de lo que se ve en el lienzo.
 * Va sobre el valor por defecto, en el módulo que traduce modelo -> Fabric, para que cualquier
 * tipo de objeto que se agregue en el futuro lo herede sin tener que acordarse.
 */
FabricObject.ownDefaults.originX = 'left';
FabricObject.ownDefaults.originY = 'top';

const datosPorObjeto = new WeakMap<FabricObject, Elemento>();

/**
 * El fondo de la hoja —la página del PDF, o su imagen suelta— es **un objeto más del apilado**, no
 * el `backgroundImage` del lienzo. Así hay un solo orden: las capas de adelante quedan encima de la
 * página y las de atrás, debajo, sin el truco de `globalCompositeOperation` que partía el apilado
 * en dos grupos que los botones "Al frente" y "Enviar atrás" no podían cruzar.
 *
 * Se lo reconoce por este conjunto y no por "es una imagen sin elemento": el resto del código ya
 * filtra por `elementoDe`, y una heurística repetida en cada lugar es una que se rompe en uno solo.
 */
const paginasFijas = new WeakSet<FabricObject>();

export function marcarPaginaFija(objeto: FabricObject): void {
  paginasFijas.add(objeto);
}

export function esPaginaFija(objeto: FabricObject): boolean {
  return paginasFijas.has(objeto);
}

/**
 * Modo "Completar campos": en vez del chip con el ID, cada campo se dibuja como una caja de texto
 * editable sobre la hoja para escribirle un valor de ejemplo y ver cómo va a quedar. Es un modo
 * del lienzo, no del modelo, así que vive acá y los objetos se rearman al prenderlo o apagarlo.
 */
let modoCompletar = false;

export function activarModoCompletar(valor: boolean): void {
  modoCompletar = valor;
}

export function enModoCompletar(): boolean {
  return modoCompletar;
}

/**
 * Campos apagados: se dejan de ver en el lienzo para mirar el documento sin ellos.
 *
 * Es **solo una vista**. Los objetos quedan invisibles pero presentes: el editor autoguarda
 * leyendo el lienzo (`asentarHoja`), así que sacarlos se llevaría los campos puestos. Tampoco
 * entra al historial ni cambia la exportación: los campos siguen saliendo en el PDF.
 *
 * Vive acá, junto al modo Completar, porque se aplica **donde se arma cada objeto**: cambiar de
 * hoja reconstruye el lienzo y un campo nuevo nace visible, así que un barrido de una sola vez se
 * quedaría corto.
 */
let camposApagados = false;

export function camposEstanOcultos(): boolean {
  return camposApagados;
}

/** Prende o apaga los campos y lo aplica a lo que ya está en el lienzo. */
export function ocultarCampos(lienzo: Canvas, valor: boolean): void {
  camposApagados = valor;
  if (valor) lienzo.discardActiveObject();
  for (const objeto of lienzo.getObjects()) {
    if (elementoDe(objeto)?.clase === 'campo') aplicarVisibilidadDeCampo(objeto);
  }
  lienzo.requestRenderAll();
}

/**
 * Un campo apagado además no se puede seleccionar: si no, se termina arrastrando algo que no se ve.
 */
function aplicarVisibilidadDeCampo(objeto: FabricObject): void {
  objeto.set({ visible: !camposApagados, selectable: !camposApagados, evented: !camposApagados });
}

/**
 * Modo "Solo campos": todo lo que no sea un campo de formulario queda trabado.
 *
 * Es el inverso de "Ocultar campos" —aquel esconde los campos para mirar el documento; este traba
 * el documento para trabajar solo en los campos—. Sirve cuando la plantilla ya está terminada y lo
 * único que falta es acomodar el formulario: sin esto, cualquier clic de más mueve una línea o un
 * texto del diseño y no se nota hasta que sale mal el PDF.
 *
 * Traba el dibujo del diseño **y el contenido del PDF**: con esto puesto, el doble clic no convierte
 * ni textos ni formas ni imágenes de la página.
 *
 * Es solo una vista, como los otros dos modos: no toca el modelo, no entra al historial y no cambia
 * en nada lo que se exporta.
 */
let soloCampos = false;

export function estaBloqueadoElContenido(): boolean {
  return soloCampos;
}

/** Un campo de formulario: los dos que bajan al PDF como AcroForm. */
function esCampoDeFormulario(elemento: Elemento | undefined): boolean {
  return elemento?.clase === 'campo' || elemento?.clase === 'firma';
}

/** Prende o apaga el modo y lo aplica a lo que ya está en el lienzo. */
export function bloquearContenido(lienzo: Canvas, valor: boolean): void {
  soloCampos = valor;
  if (valor) lienzo.discardActiveObject();
  for (const objeto of lienzo.getObjects()) {
    const elemento = elementoDe(objeto);
    if (elemento) aplicarMarcas(objeto, elemento);
  }
  lienzo.requestRenderAll();
}

export function elementoDe(objeto: FabricObject): Elemento | undefined {
  return datosPorObjeto.get(objeto);
}


/**
 * Genera la imagen del QR. Vive acá para que el lienzo y el panel de propiedades usen
 * exactamente la misma configuración. Un texto vacío no se puede codificar: se manda un
 * espacio, igual que en el editor público.
 */
export function generarQr(elemento: ElementoQr): Promise<string> {
  return QRCode.toDataURL(elemento.texto || ' ', {
    margin: 0,
    color: {
      dark: elemento.color,
      light: elemento.conFondo ? elemento.fondoColor : '#00000000',
    },
  });
}

/**
 * Deja la familia lista antes de medir un texto. Si la fuente recién llegó, además se tira la
 * caché de anchos de Fabric: guarda las medidas por familia, así que un texto que ya se midió con
 * la fuente de reemplazo seguiría dibujándose fuera de su caja aunque la real ya esté disponible.
 */
export async function prepararFuente(familia: string): Promise<void> {
  if (await asegurarFuenteCargada(familia)) cache.clearFontCache(familia);
}

/**
 * Un texto vertical es el mismo texto con cada letra en su propio renglón: así lo dibuja Fabric
 * y así baja al PDF, sin necesitar un modo de escritura aparte. Los espacios se conservan como
 * renglón en blanco, que es lo que se espera al apilar palabras.
 */
export function textoParaDibujar(elemento: Elemento & { clase: 'texto' }): string {
  return elemento.vertical ? [...elemento.text].join('\n') : elemento.text;
}

/**
 * Recorta el ID que muestra un campo para que entre en su caja, con puntos suspensivos.
 *
 * Hace falta con los campos angostos: el ID suele ser más largo que el ancho del campo y, al
 * dibujarlo entero, se sale de su caja y se monta sobre la etiqueta del campo de al lado. Con una
 * plantilla real —una grilla de conceptos con varios campos por fila— el bloque entero queda
 * ilegible. El editor público no lo sufre porque ahí la etiqueta es HTML y el navegador la recorta.
 */
function recortarAlAncho(texto: string, campo: { w: number; size: number; familia: string; negrita: boolean; cursiva: boolean }): string {
  const disponible = campo.w - 8;
  if (disponible <= 0) return '';

  const medir = (t: string) =>
    new FabricText(t, {
      fontSize: campo.size,
      fontFamily: campo.familia,
      fontWeight: campo.negrita ? '700' : '400',
      fontStyle: campo.cursiva ? 'italic' : 'normal',
    }).width;

  if (medir(texto) <= disponible) return texto;

  let corto = texto;
  while (corto.length > 1 && medir(`${corto}…`) > disponible) corto = corto.slice(0, -1);
  return `${corto}…`;
}

/**
 * Rehace el apilado entero del lienzo desde el modelo. **Es la única definición del orden**: las
 * capas mandan, y el fondo de la hoja se intercala donde diga `capasSobreElFondo`.
 *
 * De atrás hacia adelante: las capas que van debajo de la página, el fondo, y las que van encima.
 * Dentro de cada capa se conserva el orden que ya tenían, que es lo que mueven "Al frente" y
 * "Enviar atrás".
 *
 * Hay que llamarla después de **cualquier** cosa que cambie quién está en qué capa o el orden de
 * las capas: agregar un elemento, cambiarlo de capa, reordenar capas, reconstruir el lienzo. Si no,
 * el lienzo y la lista de capas dicen cosas distintas, y la lista es la que parece mentir.
 */
/**
 * Corre algo que reordena la pila **sin perder la selección**.
 *
 * Reordenar se hace sacando objetos y volviéndolos a insertar, y `remove()` de Fabric descarta el
 * objeto activo y dispara `selection:cleared` — que en `main.ts` vacía el panel de propiedades. Sin
 * esto, apretar "Al frente" deselecciona: no se puede apretar dos veces seguidas y se pierde de
 * vista con qué se estaba trabajando.
 */
function conservandoSeleccion(lienzo: Canvas, reordenar: () => void): void {
  // Fuera del navegador el lienzo es un doble que no tiene selección (ver la lección 53): no hay
  // nada que conservar, y dar por sentado que estos métodos existen ya rompió un arnés antes.
  const activo = lienzo.getActiveObject?.();
  reordenar();
  // Una selección de varios no figura en `getObjects()` —sus miembros sí— y Fabric no la descarta,
  // porque el activo es el grupo y no ellos: por eso alcanza con comprobar los objetos sueltos.
  if (activo && lienzo.getObjects().includes(activo)) lienzo.setActiveObject(activo);
  lienzo.requestRenderAll?.();
}

export function ordenarPila(lienzo: Canvas): void {
  conservandoSeleccion(lienzo, () => reordenarPila(lienzo));
}

function reordenarPila(lienzo: Canvas): void {
  const capas = capasDelDocumento();
  const objetos = [...lienzo.getObjects()];
  const fondo = objetos.find((o) => esPaginaFija(o));

  const deLaCapa = (id: string): FabricObject[] =>
    objetos.filter((o) => {
      const elemento = elementoDe(o);
      return elemento ? capaDe(elemento).id === id : false;
    });

  // De la última capa a la primera: la primera de la lista es la que se ve más adelante, tal como
  // se la muestra en el panel.
  const corte = Math.min(Math.max(0, capasSobreElFondoDelDocumento()), capas.length);
  const debajo = capas.slice(corte).reverse().flatMap((c) => deLaCapa(c.id));
  const encima = capas.slice(0, corte).reverse().flatMap((c) => deLaCapa(c.id));

  const ordenados = [...debajo, ...(fondo ? [fondo] : []), ...encima];
  if (ordenados.length !== objetos.length) {
    // Un objeto sin capa reconocible se perdería al reordenar. No debería pasar —`capaDe` cae en la
    // primera capa— pero perder algo del dibujo es mucho peor que un orden imperfecto.
    const faltantes = objetos.filter((o) => !ordenados.includes(o));
    ordenados.push(...faltantes);
  }

  // De una sola vez y no con `moveObjectTo` objeto por objeto: su índice se aplica sobre el arreglo
  // **ya sin** el objeto movido, y esa aritmética es la forma más fácil de introducir un bug acá.
  lienzo.remove(...objetos);
  lienzo.insertAt(0, ...ordenados);
}

/**
 * Mueve un objeto al frente o al fondo **dentro de su capa**, sin salirse de ella.
 *
 * El orden de las capas manda sobre el apilado: algo de la capa 1 nunca puede quedar detrás de algo
 * de la capa 2. Por eso esto no puede ser `bringObjectToFront`/`sendObjectToBack` a secas, que
 * saltan por encima de todo el lienzo y rompen ese orden en el primer clic. Para cruzar de capa
 * está el desplegable de capa, que es una decisión distinta y se toma en otro lado.
 */
export function moverEnLaPila(lienzo: Canvas, objeto: FabricObject, hacia: 'frente' | 'fondo'): void {
  conservandoSeleccion(lienzo, () => moverDentroDeSuCapa(lienzo, objeto, hacia));
}

function moverDentroDeSuCapa(lienzo: Canvas, objeto: FabricObject, hacia: 'frente' | 'fondo'): void {
  const elemento = elementoDe(objeto);
  if (!elemento) return;

  const objetos = [...lienzo.getObjects()];
  const miCapa = capaDe(elemento).id;
  const indices = objetos
    .map((o, i) => ({ o, i }))
    .filter(({ o }) => {
      const suyo = elementoDe(o);
      return suyo ? capaDe(suyo).id === miCapa : false;
    });
  if (indices.length < 2) return;

  const desde = indices[0].i;
  const resto = indices.map(({ o }) => o).filter((o) => o !== objeto);
  const nuevos = hacia === 'frente' ? [...resto, objeto] : [objeto, ...resto];

  // El mismo tramo de la pila, reescrito: los de la capa ocupan índices contiguos porque
  // `ordenarPila` los dejó así, y se los devuelve al mismo lugar en el orden nuevo.
  lienzo.remove(...indices.map(({ o }) => o));
  lienzo.insertAt(desde, ...nuevos);
}

export async function crearObjetoFabric(elemento: Elemento): Promise<FabricObject> {
  const objeto = await construirObjeto(elemento);
  // Con los campos apagados, los que nazcan después también tienen que nacer apagados: se crean al
  // cambiar de hoja, al deshacer y al colocar uno nuevo.
  if (elemento.clase === 'campo' && camposApagados) aplicarVisibilidadDeCampo(objeto);
  aplicarMarcas(objeto, elemento);
  return objeto;
}

/**
 * Lleva al objeto lo que dice el modelo sobre su capa: si se ve y si se puede tocar. Se aplica acá,
 * donde se arma cada objeto, para que valga también al deshacer, cambiar de hoja y recargar.
 */
export function aplicarMarcas(objeto: FabricObject, elemento: Elemento): void {
  // El modo "Solo campos" se suma a lo que diga la capa: traba, nunca destraba. Un elemento que ya
  // estaba bloqueado por su capa sigue bloqueado aunque sea un campo.
  const bloqueado = elementoBloqueado(elemento) || (soloCampos && !esCampoDeFormulario(elemento));
  objeto.set({
    visible: elementoVisible(elemento),
    selectable: !bloqueado,
    evented: !bloqueado,
  });
}

async function construirObjeto(elemento: Elemento): Promise<FabricObject> {
  switch (elemento.clase) {
    case 'texto': {
      await prepararFuente(elemento.familia);
      const texto = new FabricText(textoParaDibujar(elemento), {
        left: elemento.x,
        top: elemento.y,
        angle: elemento.angulo,
        fontSize: elemento.size,
        lineHeight: alturaRenglonFabric(elemento),
        fontFamily: elemento.familia,
        fontWeight: elemento.negrita ? '700' : '400',
        fontStyle: elemento.cursiva ? 'italic' : 'normal',
        underline: elemento.subrayado,
        fill: elemento.color,
        textAlign: elemento.align,
      });

      // Con `tamanoFijo` en false —de toda la vida— el texto es el objeto: se dibuja solo, del
      // tamaño de su contenido, y `w`/`h` del modelo lo siguen sin mandar (`sincronizarGeometria`
      // los deja al día para que el panel no muestre un número viejo).
      if (!elemento.tamanoFijo) {
        elemento.w = Math.round(texto.width);
        elemento.h = Math.round(texto.height);
        texto.set({ backgroundColor: elemento.conFondo ? elemento.fondoColor : '' });
        return texto;
      }

      // Con `tamanoFijo` la caja manda: puede ser más grande que el contenido, así que el texto
      // pasa a ser un hijo posicionado adentro según `align` (horizontal) y siempre centrado
      // verticalmente — recién ahí la alineación tiene sentido, como pidió Germán.
      // Los hijos van en coordenadas 0..w/0..h, igual que el campo: Fabric recentra el grupo solo
      // al armarlo, así que no hay que restar la mitad a mano (y equivocarse, como la lección 42).
      const fondo = new Rect({
        left: 0,
        top: 0,
        width: elemento.w,
        height: elemento.h,
        fill: elemento.conFondo ? elemento.fondoColor : 'transparent',
      });
      texto.set({
        left: elemento.align === 'right' ? elemento.w - texto.width : elemento.align === 'center' ? (elemento.w - texto.width) / 2 : 0,
        top: (elemento.h - texto.height) / 2,
      });
      const grupo = new Group([fondo, texto]);
      grupo.set({ left: elemento.x, top: elemento.y, angle: elemento.angulo });
      grupo.setCoords();
      return grupo;
    }
    case 'linea':
      return new LineaObjeto(elemento);
    case 'rect':
      return new RectObjeto(elemento);
    case 'forma':
      return new FormaObjeto(elemento);
    case 'qr': {
      const dataUrl = await generarQr(elemento);
      const imagen = await FabricImage.fromURL(dataUrl);
      imagen.set({
        left: elemento.x,
        top: elemento.y,
        angle: elemento.angulo,
        scaleX: elemento.w / (imagen.width || elemento.w),
        scaleY: elemento.h / (imagen.height || elemento.h),
      });
      return imagen;
    }
    case 'tabla':
      return new TablaObjeto(elemento);
    case 'firma': {
      // El recuadro con el símbolo y la leyenda adentro, para reconocerlo sin seleccionarlo. Va
      // punteado como los campos: es un lugar que alguien completa después, no algo dibujado.
      const caja = new Rect({
        left: 0,
        top: 0,
        width: elemento.w,
        height: elemento.h,
        fill: elemento.conFondo ? elemento.fondoColor : 'rgba(55,138,221,0.05)',
        stroke: elemento.bordeColor,
        strokeWidth: Math.max(1, elemento.bordeGrosor),
        strokeDashArray: [5, 3],
        rx: 3,
        ry: 3,
      });

      const leyenda = new FabricText(`✍  ${elemento.leyenda || elemento.name}`, {
        fontSize: Math.min(11, elemento.h / 4),
        fontFamily: 'Helvetica',
        fill: elemento.color,
        originX: 'center',
        originY: 'center',
        left: elemento.w / 2,
        top: elemento.h / 2,
      });

      return new Group([caja, leyenda], { left: elemento.x, top: elemento.y, angle: elemento.angulo });
    }

    case 'campo': {
      await prepararFuente(elemento.familia);

      if (modoCompletar) {
        // Se edita con el propio editor de texto de Fabric: sabe dibujar el cursor y la selección
        // en las coordenadas del lienzo, con su zoom y su rotación. Poner un <input> de HTML
        // encima del canvas se probó para otra cosa y siempre terminaba desfasado (lección 1).
        const caja = new Textbox(elemento.defaultValue, {
          left: elemento.x,
          // Centrado vertical dentro de la caja del campo, igual que el PDF aplanado.
          top: elemento.y + Math.max(0, (elemento.h - elemento.size * PASO_RENGLON) / 2),
          angle: elemento.angulo,
          width: elemento.w,
          fontSize: elemento.size,
          fontFamily: elemento.familia,
          fontWeight: elemento.negrita ? '700' : '400',
          fontStyle: elemento.cursiva ? 'italic' : 'normal',
          underline: elemento.subrayado,
          fill: elemento.color,
          textAlign: elemento.align,
          backgroundColor: 'rgba(55,138,221,0.10)',
          // En este modo solo se completa: mover o redimensionar es para el modo de diseño.
          lockMovementX: true,
          lockMovementY: true,
          lockRotation: true,
          lockScalingX: true,
          lockScalingY: true,
          hasControls: false,
        });
        return caja;
      }

      const esInvisible = elemento.invisible;

      // La apariencia de verdad: el borde y el fondo que el campo va a tener en el PDF.
      const fondo = new Rect({
        left: 0,
        top: 0,
        width: elemento.w,
        height: elemento.h,
        fill: elemento.conFondo ? elemento.fondoColor : 'transparent',
        stroke: elemento.bordeGrosor > 0 ? elemento.bordeColor : undefined,
        strokeWidth: elemento.bordeGrosor,
      });

      // Contorno de ayuda, solo para editar: sin esto un campo sin borde propio es invisible en
      // la hoja y no se puede agarrar. No llega al PDF porque el exportador lee el modelo, no el
      // lienzo. Igual que en el editor público: sólido para un campo normal, punteado si el
      // campo está marcado como invisible.
      const ayuda = new Rect({
        left: 0,
        top: 0,
        width: elemento.w,
        height: elemento.h,
        fill: elemento.conFondo ? 'transparent' : esInvisible ? 'rgba(55,138,221,0.05)' : 'rgba(55,138,221,0.10)',
        stroke: '#378add',
        strokeWidth: 1,
        strokeDashArray: esInvisible ? [4, 3] : undefined,
      });
      const etiqueta = new FabricText(recortarAlAncho(elemento.name, elemento), {
        // La etiqueta se ancla en el lado que marca la alineación del campo, para que se vea en
        // pantalla dónde va a quedar el texto. `textAlign` no alcanza: solo reparte los renglones
        // dentro de la caja del texto, que acá mide lo mismo que la etiqueta.
        left: elemento.align === 'right' ? elemento.w - 4 : elemento.align === 'center' ? elemento.w / 2 : 4,
        originX: elemento.align === 'right' ? 'right' : elemento.align === 'center' ? 'center' : 'left',
        top: elemento.h / 2,
        originY: 'center',
        fontSize: elemento.size,
        fontFamily: elemento.familia,
        fontWeight: elemento.negrita ? '700' : '400',
        fontStyle: elemento.cursiva ? 'italic' : 'normal',
        underline: elemento.subrayado,
        fill: esInvisible ? '#185fa5' : elemento.color,
        textAlign: elemento.align,
      });
      const grupo = new Group([fondo, ayuda, etiqueta]);
      grupo.set({ left: elemento.x, top: elemento.y, angle: elemento.angulo });
      grupo.setCoords();
      return grupo;
    }
    case 'imagen': {
      const imagen = await FabricImage.fromURL(elemento.src);
      imagen.set({
        left: elemento.x,
        top: elemento.y,
        angle: elemento.angulo,
        scaleX: elemento.w / (imagen.width || elemento.w),
        scaleY: elemento.h / (imagen.height || elemento.h),
        opacity: elemento.opacidad / 100,
        // Todo objeto de Fabric sabe pintar un fondo detrás suyo con esta propiedad: sirve tal
        // cual para que se note el color debajo de una imagen con transparencia (un PNG, un logo).
        backgroundColor: elemento.conFondo ? elemento.fondoColor : '',
      });
      return imagen;
    }
  }
}

export async function agregarAlLienzo(lienzo: import('fabric').Canvas, elemento: Elemento): Promise<FabricObject> {
  // Un elemento nuevo cae en la capa marcada como destino. Si ya trae una anotada se respeta: los
  // que llegan de deshacer, de pegar o de importar un proyecto vienen con la suya.
  elemento.capa ??= capaDestino().id;
  const objeto = await crearObjetoFabric(elemento);
  datosPorObjeto.set(objeto, elemento);
  lienzo.add(objeto);
  // `add` lo deja al frente de **todo**, que es el lugar equivocado si su capa no es la primera: el
  // elemento nuevo taparía capas que van por encima de la suya.
  ordenarPila(lienzo);
  lienzo.setActiveObject(objeto);
  lienzo.requestRenderAll();
  return objeto;
}

/**
 * Vacía el lienzo y lo reconstruye desde cero a partir de una lista de elementos, en orden
 * (usado por deshacer/rehacer para restaurar un estado anterior completo).
 *
 * Se lleva puesto también el objeto del fondo, que es uno más de la pila. Lo repone `aplicarFondo`,
 * que corre justo después en los cuatro caminos que llegan acá (cambiar de hoja, agregar, eliminar
 * y reemplazar las hojas), así que no hay que reponerlo desde acá.
 */
export async function reconstruirLienzo(lienzo: import('fabric').Canvas, elementos: Elemento[]): Promise<void> {
  lienzo.discardActiveObject();
  lienzo.remove(...lienzo.getObjects());
  for (const elemento of elementos) {
    const objeto = await crearObjetoFabric(elemento);
    datosPorObjeto.set(objeto, elemento);
    lienzo.add(objeto);
  }
  ordenarPila(lienzo);
  lienzo.requestRenderAll();
}

/**
 * Reconstruye por completo el objeto de Fabric (necesario para 'tabla': es un Group armado de
 * hijos que no se pueden editar in-place cuando cambia la cantidad/estilo de sus líneas internas).
 */
export async function reemplazarObjeto(lienzo: import('fabric').Canvas, viejo: FabricObject, elemento: Elemento): Promise<FabricObject> {
  const nuevo = await crearObjetoFabric(elemento);
  datosPorObjeto.set(nuevo, elemento);
  lienzo.remove(viejo);
  lienzo.add(nuevo);
  lienzo.setActiveObject(nuevo);
  lienzo.requestRenderAll();
  return nuevo;
}

/**
 * Lleva un campo a sus medidas nuevas **sin rehacer el objeto**.
 *
 * El campo es un grupo de tres hijos: el fondo, el contorno de ayuda y la etiqueta con su ID. Los
 * hijos de un grupo de Fabric se ubican respecto de su **centro**, no de su esquina, así que lo que
 * al construirlo va de 0 a w/h acá va de -w/2 a w/2. Es la parte fácil de equivocar.
 *
 * La etiqueta se vuelve a recortar: entra un ID más largo o más corto según el ancho nuevo, y sin
 * esto un campo que se achica queda con el texto saliéndose de su caja.
 */
function reajustarCampo(grupo: Group, elemento: Elemento & { clase: 'campo' }): void {
  const [fondo, ayuda, etiqueta] = grupo.getObjects();
  if (!fondo || !ayuda || !etiqueta) return;

  const { w, h } = elemento;

  for (const rect of [fondo, ayuda]) {
    rect.set({ left: -w / 2, top: -h / 2, width: w, height: h });
    rect.setCoords();
  }

  etiqueta.set({
    text: recortarAlAncho(elemento.name, elemento),
    // El mismo anclaje que al construirlo, corrido al sistema del grupo.
    left: (elemento.align === 'right' ? w - 4 : elemento.align === 'center' ? w / 2 : 4) - w / 2,
    top: 0,
  } as Partial<FabricObject>);
  etiqueta.setCoords();

  // La escala vuelve a 1 y las medidas pasan a la caja: si quedara escalado, el borde y la etiqueta
  // se deformarían con ella, que es justo lo que un campo no tiene que hacer.
  grupo.set({ width: w, height: h, scaleX: 1, scaleY: 1 });
  grupo.setCoords();
  grupo.dirty = true;
}

/**
 * Después de mover/redimensionar un objeto arrastrando sus controles, Fabric deja el cambio como
 * una transformación (left/top/scaleX/scaleY) y no toca las medidas del modelo. Hay que volcarlo,
 * porque el modelo es la fuente de verdad para el panel, para Duplicar, para deshacer/rehacer y
 * para la futura exportación a PDF: si no, todo eso trabaja con el tamaño viejo.
 *
 * Devuelve el objeto vigente — puede ser otro si hubo que reconstruirlo (caso 'campo').
 */
export async function sincronizarGeometria(lienzo: import('fabric').Canvas, objeto: FabricObject): Promise<FabricObject> {
  const elemento = datosPorObjeto.get(objeto);
  if (!elemento) return objeto;

  // El ángulo se vuelca igual para todos: rotar es lo único que no depende de cómo cada tipo
  // absorbe la escala. Sin esto, rotar con el tirador se ve en pantalla pero no queda en el
  // modelo, así que se pierde al guardar, al duplicar y al exportar.
  elemento.angulo = Math.round(objeto.angle ?? elemento.angulo);

  if (elemento.clase === 'tabla') {
    elemento.x = Math.round(objeto.left ?? elemento.x);
    elemento.y = Math.round(objeto.top ?? elemento.y);
    // Escalar desde una esquina reparte el cambio entre todas las filas/columnas y vuelve
    // la escala a 1, para que el grosor de las líneas no se deforme.
    const escalaX = objeto.scaleX ?? 1;
    const escalaY = objeto.scaleY ?? 1;
    if (escalaX !== 1 || escalaY !== 1) {
      elemento.cols = elemento.cols.map((c) => Math.max(8, Math.round(c * escalaX)));
      elemento.rows = elemento.rows.map((r) => Math.max(6, Math.round(r * escalaY)));
      objeto.set({ scaleX: 1, scaleY: 1 });
      (objeto as TablaObjeto).refrescarDesdeDatos();
    }
    return objeto;
  }

  if (elemento.clase === 'texto') {
    elemento.x = Math.round(objeto.left ?? elemento.x);
    elemento.y = Math.round(objeto.top ?? elemento.y);

    if (elemento.tamanoFijo) {
      // Con la caja fija, redimensionar cambia el tamaño de la caja y no el cuerpo de la fuente:
      // la escala se vuelca a w/h y se reconstruye el grupo (fondo + texto) con las medidas
      // nuevas, para que el texto quede bien centrado adentro y no solo estirado.
      const escalaX = objeto.scaleX ?? 1;
      const escalaY = objeto.scaleY ?? 1;
      if (escalaX !== 1 || escalaY !== 1) {
        elemento.w = Math.max(10, Math.round(elemento.w * escalaX));
        elemento.h = Math.max(10, Math.round(elemento.h * escalaY));
        return reemplazarObjeto(lienzo, objeto, elemento);
      }
      return objeto;
    }

    // Sin caja fija: estirar el texto equivale a cambiarle el cuerpo de la fuente, como siempre.
    const escala = objeto.scaleY ?? 1;
    if (escala !== 1) {
      elemento.size = Math.max(5, Math.round(elemento.size * escala));
      objeto.set({ fontSize: elemento.size, scaleX: 1, scaleY: 1 } as Partial<FabricObject>);
    }
    elemento.w = Math.round((objeto as FabricText).width);
    elemento.h = Math.round((objeto as FabricText).height);
    return objeto;
  }

  if (elemento.clase === 'campo') {
    elemento.x = Math.round(objeto.left ?? elemento.x);
    elemento.y = Math.round(objeto.top ?? elemento.y);
    const escalaX = objeto.scaleX ?? 1;
    const escalaY = objeto.scaleY ?? 1;
    if (escalaX !== 1 || escalaY !== 1) {
      // El cuerpo de la fuente no cambia: en un campo de formulario la caja se dimensiona
      // aparte del texto, igual que en el editor público.
      elemento.w = Math.round(elemento.w * escalaX);
      elemento.h = Math.round(elemento.h * escalaY);
      // En su lugar, sin rehacer el objeto: reemplazarlo lo saca y lo vuelve a poner en el lienzo
      // —con un `await` en el medio para la tipografía— y eso, en cada tirón del control, se ve
      // como un parpadeo. En modo Completar el objeto es un `Textbox` y no un grupo, así que ahí
      // se sigue rehaciendo, que es un caso donde ni siquiera se puede redimensionar.
      if (!modoCompletar && objeto instanceof Group) {
        reajustarCampo(objeto, elemento);
        return objeto;
      }
      return reemplazarObjeto(lienzo, objeto, elemento);
    }
    return objeto;
  }

  elemento.x = Math.round(objeto.left ?? elemento.x);
  elemento.y = Math.round(objeto.top ?? elemento.y);
  const anchoVisible = Math.round((objeto.width ?? elemento.w) * (objeto.scaleX ?? 1));
  const altoVisible = Math.round((objeto.height ?? elemento.h) * (objeto.scaleY ?? 1));

  if (elemento.clase === 'linea') {
    elemento.w = anchoVisible;
    elemento.h = altoVisible;
    objeto.set({ scaleX: 1, scaleY: 1 });
    (objeto as LineaObjeto).refrescarDesdeDatos();
  } else if (elemento.clase === 'rect') {
    elemento.w = anchoVisible;
    elemento.h = altoVisible;
    objeto.set({ scaleX: 1, scaleY: 1 });
    (objeto as RectObjeto).refrescarDesdeDatos();
  } else if (elemento.clase === 'forma') {
    elemento.w = anchoVisible;
    elemento.h = altoVisible;
    objeto.set({ scaleX: 1, scaleY: 1 });
    (objeto as FormaObjeto).refrescarDesdeDatos();
  } else {
    // QR e imagen: el objeto de Fabric se dimensiona con scaleX/scaleY sobre el bitmap,
    // así que la escala se conserva y solo se registran las medidas resultantes.
    elemento.w = anchoVisible;
    elemento.h = altoVisible;
  }

  return objeto;
}

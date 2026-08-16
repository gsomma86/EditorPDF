/**
 * Verifica la invariante del apilado: **las capas mandan**.
 *
 * Es la red de seguridad del cambio que unificó el orden del lienzo (agosto 2026). Antes convivían
 * dos órdenes que no se hablaban —la página del PDF iba de `backgroundImage` y lo convertido se
 * dibujaba con `destination-over`— y "Al frente" no podía cruzar de uno al otro. Ahora la página es
 * un objeto más de la pila y su lugar sale del orden de capas.
 *
 * Lo que se comprueba es lo que no se ve mirando la pantalla: en qué posición del arreglo de Fabric
 * quedó cada objeto. Un apilado mal ordenado no da ningún error —solo tapa algo— así que sin esto
 * se descubre tarde y a ojo.
 */
import { StaticCanvas } from 'fabric';
import { agregarAlLienzo, elementoDe, marcarPaginaFija, moverEnLaPila, ordenarPila } from '../src/editor/objetosFabric';
import {
  capasDelDocumento,
  capasSobreElFondoDelDocumento,
  establecerCapas,
  establecerCapasSobreElFondo,
  type Capa,
} from '../src/editor/documento';
import { crearElemento } from '../src/editor/elemento';
import { Rect } from 'fabric';

(globalThis as any).document ??= { fonts: { load: async () => [] } };

let fallos = 0;

function comprobar(caso: string, que: string, obtenido: unknown, esperado: unknown): void {
  const a = JSON.stringify(obtenido);
  const b = JSON.stringify(esperado);
  if (a === b) {
    console.log(`OK   ${caso.padEnd(24)} ${que.padEnd(34)} ${a}`);
  } else {
    fallos++;
    console.log(`FALLA ${caso.padEnd(23)} ${que.padEnd(34)} obtenido ${a} — esperado ${b}`);
  }
}

const capa = (id: string, nombre = id): Capa => ({ id, nombre, visible: true, bloqueada: false });

/** Un lienzo nuevo con las capas dadas y la página en la posición pedida. */
function preparar(capas: Capa[], sobreElFondo: number): StaticCanvas {
  establecerCapas(capas.map((c) => ({ ...c })));
  establecerCapasSobreElFondo(sobreElFondo);
  const lienzo = new StaticCanvas(undefined, { width: 595, height: 842 }) as any;
  // `StaticCanvas` es la variante sin interacción y no tiene selección; agregar un elemento la usa
  // para dejarlo seleccionado. Acá se mide el orden, no la selección: alcanza con que no falte.
  lienzo.setActiveObject = () => lienzo;
  lienzo.discardActiveObject = () => lienzo;
  return lienzo;
}

/** Agrega un elemento de una capa y devuelve su objeto. El nombre es para poder leer el orden. */
async function poner(lienzo: StaticCanvas, capaId: string, nombre: string) {
  const elemento = crearElemento('rect');
  elemento.capa = capaId;
  elemento.nombre = nombre;
  return agregarAlLienzo(lienzo as never, elemento);
}

/** Pone la página del PDF, como hace `aplicarFondo`: un objeto más, pero fuera del modelo. */
function ponerPagina(lienzo: StaticCanvas) {
  const pagina = new Rect({ left: 0, top: 0, width: 595, height: 842, selectable: false, evented: false });
  marcarPaginaFija(pagina);
  lienzo.add(pagina);
  ordenarPila(lienzo as never);
  return pagina;
}

/** El apilado tal como se lee: de atrás hacia adelante, con la página señalada. */
function pila(lienzo: StaticCanvas): string[] {
  return lienzo.getObjects().map((o) => elementoDe(o)?.nombre ?? 'PAGINA');
}

// ---------- 1. El orden de las capas manda ----------
{
  // capas[0] es la de más adelante, como la muestra el panel.
  const lienzo = preparar([capa('a', 'Capa A'), capa('b', 'Capa B')], 2);
  await poner(lienzo, 'b', 'b1');
  await poner(lienzo, 'a', 'a1');
  await poner(lienzo, 'b', 'b2');

  // Aunque b2 se haya agregado último, va detrás de a1: su capa está más atrás.
  comprobar('orden de capas', 'la capa de adelante queda arriba', pila(lienzo), ['b1', 'b2', 'a1']);
}

// ---------- 2. "Al frente" no se sale de su capa ----------
{
  const lienzo = preparar([capa('a', 'Capa A'), capa('b', 'Capa B')], 2);
  const b1 = await poner(lienzo, 'b', 'b1');
  await poner(lienzo, 'b', 'b2');
  await poner(lienzo, 'a', 'a1');

  moverEnLaPila(lienzo as never, b1, 'frente');
  // b1 sube dentro de su capa, pero no puede pasar a a1: eso rompería el orden de capas.
  comprobar('al frente', 'sube dentro de su capa', pila(lienzo), ['b2', 'b1', 'a1']);

  // Y por más veces que se insista, no cruza.
  moverEnLaPila(lienzo as never, b1, 'frente');
  moverEnLaPila(lienzo as never, b1, 'frente');
  comprobar('al frente', 'no cruza a la capa de arriba', pila(lienzo), ['b2', 'b1', 'a1']);
}

// ---------- 3. "Enviar atrás" tampoco ----------
{
  const lienzo = preparar([capa('a', 'Capa A'), capa('b', 'Capa B')], 2);
  await poner(lienzo, 'b', 'b1');
  const a1 = await poner(lienzo, 'a', 'a1');
  await poner(lienzo, 'a', 'a2');

  moverEnLaPila(lienzo as never, a1, 'fondo');
  moverEnLaPila(lienzo as never, a1, 'fondo');
  comprobar('enviar atrás', 'no cruza a la capa de abajo', pila(lienzo), ['b1', 'a1', 'a2']);
}

// ---------- 4. La página se intercala donde diga el corte ----------
{
  // Tres capas y la página entre la primera y la segunda: A encima, B y C debajo.
  const lienzo = preparar([capa('a', 'Capa A'), capa('b', 'Capa B'), capa('c', 'Capa C')], 1);
  await poner(lienzo, 'a', 'a1');
  await poner(lienzo, 'b', 'b1');
  await poner(lienzo, 'c', 'c1');
  ponerPagina(lienzo);

  comprobar('página intercalada', 'lo de atrás queda bajo la página', pila(lienzo), ['c1', 'b1', 'PAGINA', 'a1']);
}

// ---------- 5. Mover la página cambia qué queda encima ----------
{
  const lienzo = preparar([capa('a', 'Capa A'), capa('b', 'Capa B')], 2);
  await poner(lienzo, 'a', 'a1');
  await poner(lienzo, 'b', 'b1');
  ponerPagina(lienzo);
  comprobar('mover la página', 'al fondo, todo encima', pila(lienzo), ['PAGINA', 'b1', 'a1']);

  // La página al frente de todo: ahora tapa las dos capas.
  establecerCapasSobreElFondo(0);
  ordenarPila(lienzo as never);
  comprobar('mover la página', 'al frente, todo debajo', pila(lienzo), ['b1', 'a1', 'PAGINA']);

  // Y en el medio.
  establecerCapasSobreElFondo(1);
  ordenarPila(lienzo as never);
  comprobar('mover la página', 'en el medio', pila(lienzo), ['b1', 'PAGINA', 'a1']);
}

// ---------- 6. Un elemento nuevo no se cuela al frente de todo ----------
{
  // El bug que tenía `agregarAlLienzo`: `lienzo.add` deja el objeto al frente de **todo**, así que
  // uno nacido en una capa de atrás tapaba las de adelante hasta el próximo reordenamiento.
  const lienzo = preparar([capa('a', 'Capa A'), capa('b', 'Capa B')], 2);
  await poner(lienzo, 'a', 'a1');
  await poner(lienzo, 'b', 'b1');
  comprobar('elemento nuevo', 'nace en el lugar de su capa', pila(lienzo), ['b1', 'a1']);
}

// ---------- 7. Cambiar de capa cambia el lugar en la pila ----------
{
  // Con un testigo en cada capa, para que el movimiento se note: si `x` cambia de capa tiene que
  // cruzar a `a1`, no quedarse donde estaba.
  const lienzo = preparar([capa('a', 'Capa A'), capa('b', 'Capa B')], 2);
  await poner(lienzo, 'b', 'b1');
  await poner(lienzo, 'a', 'a1');
  const x = await poner(lienzo, 'a', 'x');
  comprobar('cambiar de capa', 'antes, sobre a1', pila(lienzo), ['b1', 'a1', 'x']);

  // La misma secuencia que corre la interfaz al elegir otra capa: reordenar y dejarlo al frente de
  // la capa nueva. Lo segundo es lo que hace que el resultado no dependa de por dónde pasó antes.
  const cambiarDeCapa = (objeto: (typeof x), capaId: string) => {
    elementoDe(objeto)!.capa = capaId;
    ordenarPila(lienzo as never);
    moverEnLaPila(lienzo as never, objeto, 'frente');
  };

  // A la capa de atrás: ahora tiene que quedar debajo de a1, que no se movió.
  cambiarDeCapa(x, 'b');
  comprobar('cambiar de capa', 'a la de atrás, baja bajo a1', pila(lienzo), ['b1', 'x', 'a1']);

  // Y de vuelta: tiene que volver a quedar sobre a1, donde estaba. Sin el "al frente" quedaba
  // debajo, arrastrando el lugar que había ocupado en la otra capa.
  cambiarDeCapa(x, 'a');
  comprobar('cambiar de capa', 'vuelve sobre a1', pila(lienzo), ['b1', 'a1', 'x']);
}

// ---------- 8. Reordenar capas arrastra sus objetos ----------
{
  const lienzo = preparar([capa('a', 'Capa A'), capa('b', 'Capa B')], 2);
  await poner(lienzo, 'a', 'a1');
  await poner(lienzo, 'b', 'b1');
  comprobar('reordenar capas', 'antes', pila(lienzo), ['b1', 'a1']);

  // B pasa a ser la primera: sus objetos tienen que pasar adelante con ella.
  const capas = capasDelDocumento();
  establecerCapas([capas[1], capas[0]]);
  ordenarPila(lienzo as never);
  comprobar('reordenar capas', 'después', pila(lienzo), ['a1', 'b1']);
}

// ---------- 9. El corte no se sale de rango ----------
{
  preparar([capa('a'), capa('b')], 2);
  establecerCapasSobreElFondo(99);
  comprobar('corte', 'no pasa de la cantidad de capas', capasSobreElFondoDelDocumento(), 2);
  establecerCapasSobreElFondo(-5);
  comprobar('corte', 'no baja de cero', capasSobreElFondoDelDocumento(), 0);

  // Al quedar menos capas que el corte, se recorta solo: si no, la página apuntaría a un lugar que
  // ya no existe y quedaría al fondo sin que nadie lo pidiera.
  establecerCapasSobreElFondo(2);
  establecerCapas([capa('a')]);
  comprobar('corte', 'se recorta al achicar la lista', capasSobreElFondoDelDocumento(), 1);
}

// ---------- Un proyecto guardado antes del apilado único ----------

// Es el caso que más caro sale si falla, porque le pasa a un archivo que ya existe y que el usuario
// no puede arreglar: antes "ir debajo de la página" era una marca de cada elemento
// (`debajoDeLaPagina`) y ahora es el lugar de su capa. Si la migración no corre, las formas
// convertidas de un PDF aparecen de golpe **encima** de la página, tapando el texto que las cubría.
{
  const { cargarProyecto } = await import('../src/editor/proyecto');
  const { hojasDelDocumento, CAPA_CONTENIDO_PDF } = await import('../src/editor/documento');

  const convertidoViejo = { clase: 'rect', id: 1, x: 10, y: 10, w: 50, h: 20, angulo: 0, color: '#111111', estilo: 'solido', grosor: 1, radio: 0, conRelleno: false, rellenoColor: '#ffffff', debajoDeLaPagina: true };
  const propioViejo = { clase: 'texto', id: 2, x: 10, y: 40, angulo: 0, text: 'encima', vertical: false, separacion: 0, multilinea: false, size: 11, familia: 'Helvetica', negrita: false, cursiva: false, subrayado: false, color: '#111111', align: 'left' };

  const viejo = {
    version: 1,
    pagina: { tamano: 'A4', orientacion: 'vertical', margenes: { arriba: 10, abajo: 10, izquierda: 10, derecha: 10 } },
    // Un proyecto de esa época traía las hojas como listas de elementos sueltas.
    hojas: [[convertidoViejo, propioViejo]],
    elementos: [convertidoViejo, propioViejo],
    hoja: 0,
    campos: [],
  };

  // Sin capas propias: un proyecto viejo no las traía, así que se arranca con la de siempre.
  const lienzo = preparar([capa('base', 'Capa 1')], 1);
  await cargarProyecto(lienzo as never, JSON.parse(JSON.stringify(viejo)) as never, false);

  const elementos = hojasDelDocumento(lienzo).flatMap((h: { elementos: unknown[] }) => h.elementos) as { clase: string; capa?: string; debajoDeLaPagina?: boolean }[];
  const convertido = elementos.find((e) => e.clase === 'rect')!;
  const propio = elementos.find((e) => e.clase === 'texto')!;

  comprobar('proyecto viejo', 'lo marcado va a la capa del contenido', convertido.capa, CAPA_CONTENIDO_PDF);
  comprobar('proyecto viejo', 'se le saca la marca vieja', convertido.debajoDeLaPagina, undefined);
  comprobar('proyecto viejo', 'lo que no estaba marcado no se toca', propio.capa !== CAPA_CONTENIDO_PDF, true);

  // Y lo que importa de verdad: que siga viéndose igual que antes, con el convertido detrás de la
  // página y el texto propio delante.
  const pagina = new Rect({ width: 10, height: 10 });
  marcarPaginaFija(pagina);
  lienzo.add(pagina);
  ordenarPila(lienzo);

  const orden = lienzo.getObjects();
  const iPagina = orden.indexOf(pagina);
  const iConvertido = orden.findIndex((o) => elementoDe(o)?.clase === 'rect');
  const iPropio = orden.findIndex((o) => elementoDe(o)?.clase === 'texto');
  comprobar('proyecto viejo', 'lo convertido queda detrás de la página', iConvertido < iPagina, true);
  comprobar('proyecto viejo', 'lo propio queda delante', iPropio > iPagina, true);
}

console.log(
  fallos === 0
    ? '\nEl apilado es uno solo y las capas mandan.'
    : `\n${fallos} PROBLEMA(S) en el apilado.`
);
process.exit(fallos === 0 ? 0 : 1);

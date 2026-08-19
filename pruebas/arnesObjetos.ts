/**
 * Arnés de los objetos del lienzo: que arrastrar un control deje el modelo y el objeto de acuerdo.
 *
 * Fabric no toca las medidas al redimensionar: deja el cambio como una escala (`scaleX`/`scaleY`) y
 * es `sincronizarGeometria` la que lo vuelca al modelo, cada tipo a su manera —un texto cambia de
 * cuerpo, una tabla reparte el cambio entre sus filas y columnas, un campo agranda su caja—. Nada
 * de eso da error si sale mal: queda un elemento con las medidas viejas, y se descubre recién al
 * exportar o al guardar.
 *
 * Existe sobre todo por el campo, que es un grupo de tres hijos y desde agosto de 2026 se ajusta
 * **en su lugar** en vez de rehacerse (rehacerlo en cada tirón del control se veía como un
 * parpadeo). Ajustar un grupo a mano es fácil de dejar a medias, y a ojo no se nota.
 */
import { StaticCanvas, Group } from 'fabric';
import { agregarAlLienzo, elementoDe, sincronizarGeometria } from '../src/editor/objetosFabric';
import { anchoTotalTabla, crearElemento, crearElementoCampo, crearElementoTabla } from '../src/editor/elemento';

(globalThis as any).document ??= { fonts: { load: async () => [] } };

let fallos = 0;

function comprobar(caso: string, que: string, obtenido: unknown, esperado: unknown): void {
  const ok = JSON.stringify(obtenido) === JSON.stringify(esperado);
  if (!ok) fallos++;
  console.log(
    `${ok ? 'OK  ' : 'MAL '} ${caso.padEnd(24)} ${que.padEnd(34)} ${JSON.stringify(obtenido)}` +
      (ok ? '' : `  (se esperaba ${JSON.stringify(esperado)})`)
  );
}

function nuevoLienzo(): any {
  const lienzo = new StaticCanvas(undefined, { width: 595, height: 842 }) as any;
  // `StaticCanvas` no tiene selección y agregar un elemento la usa para dejarlo seleccionado.
  lienzo.setActiveObject = () => lienzo;
  lienzo.discardActiveObject = () => lienzo;
  return lienzo;
}

// ---------- Un campo se ajusta en su lugar ----------

{
  const lienzo = nuevoLienzo();
  const campo = crearElementoCampo('un_nombre_de_campo_bastante_largo');
  campo.w = 200;
  campo.h = 30;
  const objeto = await agregarAlLienzo(lienzo, campo);
  const textoAntes = (objeto as Group).getObjects()[2] as unknown as { text: string };
  const recorteAntes = textoAntes.text;

  // Lo que deja Fabric después de arrastrar un control: la escala cambiada y las medidas intactas.
  objeto.set({ scaleX: 0.5, scaleY: 2 });
  const devuelto = await sincronizarGeometria(lienzo, objeto);

  comprobar('campo', 'no rehace el objeto', devuelto === objeto, true);
  comprobar('campo', 'el modelo toma las medidas', { w: campo.w, h: campo.h }, { w: 100, h: 60 });
  comprobar('campo', 'la escala vuelve a 1', { x: objeto.scaleX, y: objeto.scaleY }, { x: 1, y: 1 });
  comprobar('campo', 'la caja del grupo acompaña', { w: objeto.width, h: objeto.height }, { w: 100, h: 60 });

  const hijos = (objeto as Group).getObjects();
  comprobar('campo', 'el fondo mide lo mismo', { w: hijos[0].width, h: hijos[0].height }, { w: 100, h: 60 });
  // Los hijos de un grupo se ubican respecto de su centro, no de su esquina: es lo más fácil de
  // equivocar al ajustarlo a mano, y no se nota hasta que el borde queda corrido.
  comprobar('campo', 'y queda centrado en el grupo', { x: hijos[0].left, y: hijos[0].top }, { x: -50, y: -30 });
  comprobar('campo', 'el contorno de ayuda también', { w: hijos[1].width, h: hijos[1].height }, { w: 100, h: 60 });
  // Al angostarse a la mitad entra menos ID; sin volver a recortarlo, el texto se sale de la caja.
  comprobar('campo', 'la etiqueta se vuelve a recortar', (hijos[2] as unknown as { text: string }).text !== recorteAntes, true);
}

// ---------- Y sigue estando bien después de varios tirones ----------

// Un ajuste en su lugar puede ir acumulando error, cosa que rehacer el objeto no hacía: se le dan
// tres cambios seguidos y se comprueba que el grupo siga midiendo lo que dice el modelo.
{
  const lienzo = nuevoLienzo();
  const campo = crearElementoCampo('acumula');
  campo.w = 120;
  campo.h = 24;
  const objeto = await agregarAlLienzo(lienzo, campo);

  for (const escala of [1.5, 0.8, 2]) {
    objeto.set({ scaleX: escala, scaleY: escala });
    await sincronizarGeometria(lienzo, objeto);
  }

  comprobar('campo, tres tirones', 'el grupo mide lo que el modelo', { w: objeto.width, h: objeto.height }, { w: campo.w, h: campo.h });
  const hijos = (objeto as Group).getObjects();
  comprobar('campo, tres tirones', 'y sus hijos también', { w: hijos[0].width, h: hijos[0].height }, { w: campo.w, h: campo.h });
  comprobar('campo, tres tirones', 'sin escala pegada', { x: objeto.scaleX, y: objeto.scaleY }, { x: 1, y: 1 });
}

// ---------- Los otros tipos, que ya andaban: que sigan andando ----------

{
  const lienzo = nuevoLienzo();

  const texto = crearElemento('texto') as any;
  texto.size = 10;
  const objTexto = await agregarAlLienzo(lienzo, texto);
  objTexto.set({ scaleX: 2, scaleY: 2 });
  await sincronizarGeometria(lienzo, objTexto);
  // Estirar un texto equivale a cambiarle el cuerpo, no a deformarlo.
  comprobar('texto', 'cambia el cuerpo', elementoDe(objTexto)!.clase === 'texto' && (elementoDe(objTexto) as any).size, 20);
  comprobar('texto', 'sin escala pegada', { x: objTexto.scaleX, y: objTexto.scaleY }, { x: 1, y: 1 });

  const tabla = crearElementoTabla(2, 2);
  const objTabla = await agregarAlLienzo(lienzo, tabla);
  const anchoCol = tabla.cols[0];
  objTabla.set({ scaleX: 2, scaleY: 1 });
  await sincronizarGeometria(lienzo, objTabla);
  // La escala se reparte entre las columnas, para que el grosor de las líneas no se deforme.
  comprobar('tabla', 'reparte el ancho entre columnas', tabla.cols[0], anchoCol * 2);
  comprobar('tabla', 'sin escala pegada', { x: objTabla.scaleX, y: objTabla.scaleY }, { x: 1, y: 1 });

  // Arrastrar una división interna que no es la última reparte con su vecina: el ancho total
  // de la tabla no se mueve. El control de la última columna, en cambio, sí lo cambia.
  const tabla2 = crearElementoTabla(2, 2);
  const objTabla2 = await agregarAlLienzo(lienzo, tabla2);
  const anchoAntes = anchoTotalTabla(tabla2);
  const controles2 = (objTabla2 as any).controls;

  controles2.col0.actionHandler({}, { target: objTabla2, corner: 'col0' }, (objTabla2.left ?? 0) + 80, 0);
  comprobar('tabla, división interna', 'reparte con la columna vecina', tabla2.cols, [80, 40]);
  comprobar('tabla, división interna', 'el ancho total no cambia', anchoTotalTabla(tabla2), anchoAntes);

  controles2.col1.actionHandler({}, { target: objTabla2, corner: 'col1' }, (objTabla2.left ?? 0) + 140, 0);
  comprobar('tabla, última columna', 'sí cambia el ancho total', anchoTotalTabla(tabla2), anchoAntes + 20);

  const rect = crearElemento('rect') as any;
  const objRect = await agregarAlLienzo(lienzo, rect);
  const anchoRect = rect.w;
  objRect.set({ scaleX: 3, scaleY: 1 });
  await sincronizarGeometria(lienzo, objRect);
  comprobar('recuadro', 'toma el ancho nuevo', rect.w, anchoRect * 3);
}

console.log(
  fallos === 0
    ? '\nRedimensionar deja el modelo y el objeto de acuerdo.'
    : `\n${fallos} PROBLEMA(S) al redimensionar.`
);
process.exit(fallos === 0 ? 0 : 1);

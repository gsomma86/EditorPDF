import { PDFDocument, StandardFonts, TextAlignment, degrees, rgb, type PDFFont, type PDFPage, type PDFTextField, type RGB } from '@cantoo/pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import type { Canvas } from 'fabric';
import {
  anchoTotalTabla,
  altoTotalTabla,
  nombresDeCampo,
  pasoDeRenglon,
  pasoRepeticion,
  PASO_RENGLON,
  type Elemento,
  type ElementoLinea,
  type ElementoTabla,
  type EstiloLinea,
} from './elemento';
import { elementoDe } from './objetosFabric';
import { configActual } from './documento';
import { dimensionesPagina } from './pagina';
import { bytesDeFuente } from './fuentes';
import { generarQr } from './objetosFabric';

export interface OpcionesExportar {
  /** Los campos AcroForm quedan como formulario rellenable; si no, se dibujan aplanados. */
  conFormulario: boolean;
}

function color(hex: string): RGB {
  const limpio = hex.replace('#', '');
  const n = parseInt(limpio.length === 3 ? limpio.split('').map((c) => c + c).join('') : limpio.slice(0, 6), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

function guion(estilo: EstiloLinea, grosor: number): number[] | undefined {
  return estilo === 'punteado' ? [Math.max(4, grosor * 3), Math.max(3, grosor * 2)] : undefined;
}

/** Fuente estándar del PDF equivalente a una familia base. */
function fuenteEstandar(familia: string, negrita: boolean, cursiva: boolean): StandardFonts {
  if (familia === 'Times') {
    if (negrita && cursiva) return StandardFonts.TimesRomanBoldItalic;
    if (negrita) return StandardFonts.TimesRomanBold;
    if (cursiva) return StandardFonts.TimesRomanItalic;
    return StandardFonts.TimesRoman;
  }
  if (familia === 'Courier') {
    if (negrita && cursiva) return StandardFonts.CourierBoldOblique;
    if (negrita) return StandardFonts.CourierBold;
    if (cursiva) return StandardFonts.CourierOblique;
    return StandardFonts.Courier;
  }
  if (negrita && cursiva) return StandardFonts.HelveticaBoldOblique;
  if (negrita) return StandardFonts.HelveticaBold;
  if (cursiva) return StandardFonts.HelveticaOblique;
  return StandardFonts.Helvetica;
}

/** Resuelve y cachea las fuentes: las web se incrustan, las estándar ya viven en el PDF. */
function creadorDeFuentes(doc: PDFDocument) {
  const cache = new Map<string, Promise<PDFFont>>();
  return (familia: string, negrita: boolean, cursiva: boolean): Promise<PDFFont> => {
    const clave = `${familia}|${negrita}|${cursiva}`;
    let pedido = cache.get(clave);
    if (!pedido) {
      pedido = (async () => {
        const bytes = await bytesDeFuente(familia, negrita, cursiva);
        // Sin subset: fontkit no puede subsetear fuentes comprimidas (woff/woff2) y revienta con
        // "Index out of range". Tampoco hace falta: los archivos de @fontsource ya vienen
        // separados por alfabeto, así que el "latin" pesa ~20 KB.
        if (bytes) return doc.embedFont(bytes, { subset: false });
        return doc.embedFont(fuenteEstandar(familia, negrita, cursiva));
      })();
      cache.set(clave, pedido);
    }
    return pedido;
  };
}

/**
 * Puente entre el lienzo y el PDF para un elemento.
 *
 * Adentro de un elemento se razona en coordenadas locales: desde su esquina superior izquierda y
 * con la Y creciendo hacia abajo, igual que en pantalla. `punto()` las lleva al PDF, que mide la
 * Y desde abajo, aplicando además la rotación — todos los objetos rotan alrededor de esa esquina,
 * que es la que marcan x/y (ver la lección 16 de CLAUDE.md).
 *
 * `grados` es el mismo ángulo para pdf-lib: negado, porque en el lienzo los ángulos crecen en el
 * sentido de las agujas del reloj y en el PDF al revés.
 */
function ubicador(el: { x: number; y: number; angulo: number }, altoPagina: number) {
  const radianes = (el.angulo * Math.PI) / 180;
  const cos = Math.cos(radianes);
  const sen = Math.sin(radianes);
  return {
    grados: degrees(-el.angulo),
    /** La esquina del elemento en coordenadas del lienzo, que es sobre la que gira. */
    origen: { x: el.x, y: el.y },
    punto(lx: number, ly: number) {
      return {
        x: el.x + lx * cos - ly * sen,
        y: altoPagina - (el.y + lx * sen + ly * cos),
      };
    },
    /** Otro ubicador con el origen corrido, en coordenadas locales: las filas de un repetible. */
    corrido(lx: number, ly: number) {
      return ubicador({ x: el.x + lx * cos - ly * sen, y: el.y + lx * sen + ly * cos, angulo: el.angulo }, altoPagina);
    },
  };
}

type Ubicador = ReturnType<typeof ubicador>;

/**
 * Dibuja un rectángulo dado en coordenadas locales del elemento (lx, ly = su esquina superior
 * izquierda). pdf-lib ancla el rectángulo en su esquina inferior izquierda y rota alrededor de
 * ese ancla, así que se le pasa esa esquina —local (lx, ly + alto)— ya rotada.
 */
function dibujarRectangulo(
  pagina: PDFPage,
  ubi: Ubicador,
  lx: number,
  ly: number,
  ancho: number,
  alto: number,
  el: { color: string; estilo: EstiloLinea; grosor: number; conRelleno?: boolean; rellenoColor?: string }
): void {
  const caja = (dx: number, dy: number, w: number, h: number) => {
    const ancla = ubi.punto(lx + dx, ly + dy + h);
    return { x: ancla.x, y: ancla.y, width: w, height: h, rotate: ubi.grados };
  };

  const comun = {
    borderColor: color(el.color),
    borderDashArray: guion(el.estilo, el.grosor),
  };

  if (el.conRelleno && el.rellenoColor) {
    pagina.drawRectangle({ ...comun, ...caja(0, 0, ancho, alto), borderWidth: 0, color: color(el.rellenoColor) });
  }

  if (el.estilo === 'doble') {
    const fino = Math.max(0.5, el.grosor / 3);
    pagina.drawRectangle({ ...comun, ...caja(-fino, -fino, ancho + fino * 2, alto + fino * 2), borderWidth: fino });
    pagina.drawRectangle({ ...comun, ...caja(fino, fino, ancho - fino * 2, alto - fino * 2), borderWidth: fino });
    return;
  }

  pagina.drawRectangle({ ...comun, ...caja(0, 0, ancho, alto), borderWidth: el.grosor });
}

function dibujarTabla(pagina: PDFPage, el: ElementoTabla, alturaPagina: number): void {
  const ubi = ubicador(el, alturaPagina);
  const ancho = anchoTotalTabla(el);
  const alto = altoTotalTabla(el);

  dibujarRectangulo(pagina, ubi, 0, 0, ancho, alto, { color: el.color, estilo: el.estiloContorno, grosor: el.grosor });

  const doble = el.estiloInterno === 'doble';
  const fino = doble ? Math.max(0.5, el.grosor / 3) : el.grosor;
  const desplazamientos = doble ? [-fino, fino] : [0];
  const comun = { thickness: fino, color: color(el.colorInterno), dashArray: guion(el.estiloInterno, el.grosor) };

  // Las líneas internas se describen en coordenadas de la tabla y se rotan con ella; `drawLine`
  // no acepta rotación, pero tampoco hace falta: los dos extremos ya salen girados.
  let acumX = 0;
  for (let i = 0; i < el.cols.length - 1; i++) {
    acumX += el.cols[i];
    for (const d of desplazamientos) {
      pagina.drawLine({ ...comun, start: ubi.punto(acumX + d, 0), end: ubi.punto(acumX + d, alto) });
    }
  }
  let acumY = 0;
  for (let i = 0; i < el.rows.length - 1; i++) {
    acumY += el.rows[i];
    for (const d of desplazamientos) {
      pagina.drawLine({ ...comun, start: ubi.punto(0, acumY + d), end: ubi.punto(ancho, acumY + d) });
    }
  }
}

/**
 * Extremos de una línea en coordenadas del PDF. El segmento corre por el medio del eje largo del
 * elemento; el eje corto es su grosor. `desplazamientoPerp` corre el trazo perpendicularmente,
 * que es como se dibuja el estilo doble.
 */
function extremosLinea(el: ElementoLinea, ubi: Ubicador, desplazamientoPerp: number) {
  const horizontal = el.w >= el.h;
  return horizontal
    ? { start: ubi.punto(0, el.h / 2 + desplazamientoPerp), end: ubi.punto(el.w, el.h / 2 + desplazamientoPerp) }
    : { start: ubi.punto(el.w / 2 + desplazamientoPerp, 0), end: ubi.punto(el.w / 2 + desplazamientoPerp, el.h) };
}

async function dibujarImagen(doc: PDFDocument, pagina: PDFPage, dataUrl: string, ubi: Ubicador, ancho: number, alto: number, opacidad = 1): Promise<void> {
  const bytes = await fetch(dataUrl).then((r) => r.arrayBuffer());
  const esPng = dataUrl.startsWith('data:image/png');
  const imagen = esPng ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
  // Como el rectángulo: pdf-lib ancla la imagen en su esquina inferior izquierda y rota ahí.
  const ancla = ubi.punto(0, alto);
  pagina.drawImage(imagen, { ...ancla, width: ancho, height: alto, opacity: opacidad, rotate: ubi.grados });
}

export async function exportarPdf(lienzo: Canvas, opciones: OpcionesExportar): Promise<Uint8Array> {
  const config = configActual();
  const { ancho: anchoPagina, alto: altoPagina } = dimensionesPagina(config.tamano, config.orientacion);

  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const pagina = doc.addPage([anchoPagina, altoPagina]);
  const obtenerFuente = creadorDeFuentes(doc);
  const formulario = doc.getForm();
  const camposCreados = new Map<string, PDFTextField>();

  // El fondo va primero, estirado a toda la hoja, para que todo lo demás quede encima.
  if (config.fondo) {
    const bytes = await fetch(config.fondo).then((r) => r.arrayBuffer());
    const imagen = config.fondo.startsWith('data:image/png') ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
    pagina.drawImage(imagen, { x: 0, y: 0, width: anchoPagina, height: altoPagina });
  }

  const elementos = lienzo
    .getObjects()
    .map((o) => elementoDe(o))
    .filter((e): e is Elemento => !!e);

  for (const el of elementos) {
    const ubi = ubicador(el, altoPagina);

    switch (el.clase) {
      case 'texto': {
        const fuente = await obtenerFuente(el.familia, el.negrita, el.cursiva);
        // En el PDF la Y del texto es su línea de base, no el tope de la caja: en coordenadas del
        // elemento, la base está a una ascendente de su borde de arriba.
        const ascendente = fuente.heightAtSize(el.size, { descender: false });
        // Vertical = una letra por renglón. Se dibuja renglón por renglón en vez de mandarle el
        // texto con saltos de línea a `drawText`, que los espacia con su propio criterio: así el
        // paso entre letras es el mismo que usa Fabric en pantalla (1,16 × el cuerpo).
        const renglones = el.vertical ? [...el.text] : el.text.split('\n');
        const paso = pasoDeRenglon(el);

        renglones.forEach((renglon, i) => {
          const base = ubi.punto(0, ascendente + i * paso);
          pagina.drawText(renglon, { ...base, size: el.size, font: fuente, color: color(el.color), rotate: ubi.grados });
          if (el.subrayado) {
            const anchoRenglon = fuente.widthOfTextAtSize(renglon, el.size);
            const ySub = ascendente + i * paso + el.size * 0.12;
            pagina.drawLine({
              start: ubi.punto(0, ySub),
              end: ubi.punto(anchoRenglon, ySub),
              thickness: Math.max(0.5, el.size * 0.05),
              color: color(el.color),
            });
          }
        });
        break;
      }

      case 'linea': {
        const grosor = Math.max(0.5, el.w >= el.h ? el.h : el.w);
        const trazos = el.estilo === 'doble' ? [-grosor / 3, grosor / 3] : [0];
        const anchoTrazo = el.estilo === 'doble' ? Math.max(0.5, grosor / 3) : grosor;

        for (const d of trazos) {
          pagina.drawLine({
            ...extremosLinea(el, ubi, d),
            thickness: anchoTrazo,
            color: color(el.color),
            dashArray: guion(el.estilo, grosor),
          });
        }
        break;
      }

      case 'rect':
        dibujarRectangulo(pagina, ubi, 0, 0, el.w, el.h, el);
        break;

      case 'tabla':
        dibujarTabla(pagina, el, altoPagina);
        break;

      case 'qr':
        await dibujarImagen(doc, pagina, await generarQr(el), ubi, el.w, el.h);
        break;

      case 'imagen':
        await dibujarImagen(doc, pagina, el.src, ubi, el.w, el.h, el.opacidad / 100);
        break;

      case 'campo': {
        const fuente = await obtenerFuente(el.familia, el.negrita, el.cursiva);
        // Un campo repetible baja una vez por fila: cada una con su ID —el comodín reemplazado
        // por el número— y corrida hacia abajo su alto más la separación pedida.
        const nombres = nombresDeCampo(el);
        const paso = pasoRepeticion(el);

        for (const [fila, nombre] of nombres.entries()) {
          // La repetición se mide en coordenadas del campo, así que acompaña su rotación.
          const ubiFila = fila === 0 ? ubi : ubi.corrido(0, fila * paso);

          if (!opciones.conFormulario) {
            // Aplanado: se dibuja la apariencia, sin campo interactivo.
            if (el.invisible) continue;
            if (el.conFondo) {
              dibujarRectangulo(pagina, ubiFila, 0, 0, el.w, el.h, { color: el.fondoColor, estilo: 'solido', grosor: 0, conRelleno: true, rellenoColor: el.fondoColor });
            }
            if (el.bordeGrosor > 0) {
              dibujarRectangulo(pagina, ubiFila, 0, 0, el.w, el.h, { color: el.bordeColor, estilo: 'solido', grosor: el.bordeGrosor });
            }
            if (el.defaultValue) {
              // Multilínea: los renglones arrancan arriba; si es de una sola línea, va centrado.
              const renglones = el.multilinea ? el.defaultValue.split('\n') : [el.defaultValue];
              const pasoTexto = el.size * PASO_RENGLON;
              const primero = el.multilinea ? el.size : (el.h + el.size) / 2;
              renglones.forEach((renglon, i) => {
                const anchoRenglon = fuente.widthOfTextAtSize(renglon, el.size);
                const izquierda = el.align === 'right' ? el.w - anchoRenglon - 2 : el.align === 'center' ? (el.w - anchoRenglon) / 2 : 2;
                const linea = ubiFila.punto(izquierda, primero + i * pasoTexto);
                pagina.drawText(renglon, { ...linea, size: el.size, font: fuente, color: color(el.color), rotate: ubiFila.grados });
              });
            }
            continue;
          }

          // Un mismo ID se puede colocar varias veces en la hoja: en AcroForm eso es UN campo con
          // varias apariencias, así que se crea una sola vez y se le agregan las demás posiciones.
          let campo = camposCreados.get(nombre);
          if (!campo) {
            campo = formulario.createTextField(nombre);
            campo.setAlignment(el.align === 'right' ? TextAlignment.Right : el.align === 'center' ? TextAlignment.Center : TextAlignment.Left);
            if (el.multilinea) campo.enableMultiline();
            if (el.defaultValue) campo.setText(el.defaultValue);
            if (el.readonly) campo.enableReadOnly();
            camposCreados.set(nombre, campo);
          }
          // Un campo de formulario solo puede rotar en múltiplos de 90°: el PDF guarda su recuadro
          // siempre derecho y la rotación aparte, en la apariencia. Con cualquier otro ángulo se
          // redondea al múltiplo más cercano (el preflight lo avisa antes de exportar).
          const anguloCampo = Math.round(el.angulo / 90) * 90;
          const ancla = ubicador({ ...ubiFila.origen, angulo: anguloCampo }, altoPagina).punto(0, el.h);

          campo.addToPage(pagina, {
            x: ancla.x,
            y: ancla.y,
            rotate: degrees(-anguloCampo),
            width: el.w,
            height: el.h,
            font: fuente,
            textColor: color(el.color),
            backgroundColor: el.conFondo ? color(el.fondoColor) : undefined,
            borderColor: el.bordeGrosor > 0 ? color(el.bordeColor) : undefined,
            borderWidth: el.bordeGrosor,
            hidden: el.invisible,
          });
          campo.setFontSize(el.size);
        }
        break;
      }
    }
  }

  return doc.save();
}

export function descargarPdf(bytes: Uint8Array, nombre: string): void {
  const limpio = nombre.trim().replace(/[\\/:*?"<>|]/g, '') || 'documento';
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = `${limpio}.pdf`;
  enlace.click();
  URL.revokeObjectURL(url);
}

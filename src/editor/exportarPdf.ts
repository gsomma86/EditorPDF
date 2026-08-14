import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type PDFTextField, type RGB } from '@cantoo/pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import type { Canvas } from 'fabric';
import { anchoTotalTabla, altoTotalTabla, type Elemento, type ElementoLinea, type ElementoTabla, type EstiloLinea } from './elemento';
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
 * El lienzo mide desde arriba y el PDF desde abajo, así que toda coordenada Y hay que espejarla.
 * `alto` es el alto del elemento porque en el PDF la Y indica su base, no su tope.
 */
function y(alturaPagina: number, yLienzo: number, altoElemento: number): number {
  return alturaPagina - yLienzo - altoElemento;
}

function dibujarRectangulo(
  pagina: PDFPage,
  x: number,
  yBase: number,
  ancho: number,
  alto: number,
  el: { color: string; estilo: EstiloLinea; grosor: number; conRelleno?: boolean; rellenoColor?: string }
): void {
  const comun = {
    x,
    y: yBase,
    width: ancho,
    height: alto,
    borderColor: color(el.color),
    borderDashArray: guion(el.estilo, el.grosor),
  };

  if (el.conRelleno && el.rellenoColor) {
    pagina.drawRectangle({ ...comun, borderWidth: 0, color: color(el.rellenoColor) });
  }

  if (el.estilo === 'doble') {
    const fino = Math.max(0.5, el.grosor / 3);
    pagina.drawRectangle({ ...comun, x: x - fino, y: yBase - fino, width: ancho + fino * 2, height: alto + fino * 2, borderWidth: fino });
    pagina.drawRectangle({ ...comun, x: x + fino, y: yBase + fino, width: ancho - fino * 2, height: alto - fino * 2, borderWidth: fino });
    return;
  }

  pagina.drawRectangle({ ...comun, borderWidth: el.grosor });
}

function dibujarTabla(pagina: PDFPage, el: ElementoTabla, alturaPagina: number): void {
  const ancho = anchoTotalTabla(el);
  const alto = altoTotalTabla(el);
  const x = el.x;
  const yBase = y(alturaPagina, el.y, alto);

  dibujarRectangulo(pagina, x, yBase, ancho, alto, { color: el.color, estilo: el.estiloContorno, grosor: el.grosor });

  const doble = el.estiloInterno === 'doble';
  const fino = doble ? Math.max(0.5, el.grosor / 3) : el.grosor;
  const desplazamientos = doble ? [-fino, fino] : [0];
  const comun = { thickness: fino, color: color(el.colorInterno), dashArray: guion(el.estiloInterno, el.grosor) };

  let acumX = 0;
  for (let i = 0; i < el.cols.length - 1; i++) {
    acumX += el.cols[i];
    for (const d of desplazamientos) {
      pagina.drawLine({ ...comun, start: { x: x + acumX + d, y: yBase }, end: { x: x + acumX + d, y: yBase + alto } });
    }
  }
  let acumY = 0;
  for (let i = 0; i < el.rows.length - 1; i++) {
    acumY += el.rows[i];
    for (const d of desplazamientos) {
      // acumY crece hacia abajo en el lienzo; en el PDF se mide desde la base de la tabla.
      const yLinea = yBase + alto - acumY + d;
      pagina.drawLine({ ...comun, start: { x, y: yLinea }, end: { x: x + ancho, y: yLinea } });
    }
  }
}

/**
 * Extremos de una línea ya rotados y pasados a coordenadas del PDF. `drawLine` no acepta
 * rotación, así que hay que girar los puntos a mano: como en el lienzo, alrededor del centro
 * del elemento. `desplazamientoPerp` corre el trazo perpendicularmente (para el estilo doble).
 */
function extremosLinea(el: ElementoLinea, altoPagina: number, desplazamientoPerp: number) {
  const horizontal = el.w >= el.h;
  const largo = horizontal ? el.w : el.h;
  const radianes = (el.angulo * Math.PI) / 180;
  const cos = Math.cos(radianes);
  const sen = Math.sin(radianes);
  const girar = (px: number, py: number) => ({ x: px * cos - py * sen, y: px * sen + py * cos });

  const centro = girar(el.w / 2, el.h / 2);
  const cx = el.x + centro.x;
  const cy = el.y + centro.y;

  const ex = horizontal ? largo / 2 : 0;
  const ey = horizontal ? 0 : largo / 2;
  const px = horizontal ? 0 : desplazamientoPerp;
  const py = horizontal ? desplazamientoPerp : 0;

  const desde = girar(-ex + px, -ey + py);
  const hasta = girar(ex + px, ey + py);
  return {
    start: { x: cx + desde.x, y: altoPagina - (cy + desde.y) },
    end: { x: cx + hasta.x, y: altoPagina - (cy + hasta.y) },
  };
}

async function dibujarImagen(doc: PDFDocument, pagina: PDFPage, dataUrl: string, x: number, yBase: number, ancho: number, alto: number, opacidad = 1): Promise<void> {
  const bytes = await fetch(dataUrl).then((r) => r.arrayBuffer());
  const esPng = dataUrl.startsWith('data:image/png');
  const imagen = esPng ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
  pagina.drawImage(imagen, { x, y: yBase, width: ancho, height: alto, opacity: opacidad });
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

  const elementos = lienzo
    .getObjects()
    .map((o) => elementoDe(o))
    .filter((e): e is Elemento => !!e);

  for (const el of elementos) {
    switch (el.clase) {
      case 'texto': {
        const fuente = await obtenerFuente(el.familia, el.negrita, el.cursiva);
        // En el PDF la Y del texto es su línea de base, no el tope de la caja.
        const base = altoPagina - el.y - fuente.heightAtSize(el.size, { descender: false });
        pagina.drawText(el.text, { x: el.x, y: base, size: el.size, font: fuente, color: color(el.color) });
        if (el.subrayado) {
          const anchoTexto = fuente.widthOfTextAtSize(el.text, el.size);
          const ySub = base - el.size * 0.12;
          pagina.drawLine({
            start: { x: el.x, y: ySub },
            end: { x: el.x + anchoTexto, y: ySub },
            thickness: Math.max(0.5, el.size * 0.05),
            color: color(el.color),
          });
        }
        break;
      }

      case 'linea': {
        const grosor = Math.max(0.5, el.w >= el.h ? el.h : el.w);
        const trazos = el.estilo === 'doble' ? [-grosor / 3, grosor / 3] : [0];
        const anchoTrazo = el.estilo === 'doble' ? Math.max(0.5, grosor / 3) : grosor;

        for (const d of trazos) {
          pagina.drawLine({
            ...extremosLinea(el, altoPagina, d),
            thickness: anchoTrazo,
            color: color(el.color),
            dashArray: guion(el.estilo, grosor),
          });
        }
        break;
      }

      case 'rect':
        dibujarRectangulo(pagina, el.x, y(altoPagina, el.y, el.h), el.w, el.h, el);
        break;

      case 'tabla':
        dibujarTabla(pagina, el, altoPagina);
        break;

      case 'qr':
        await dibujarImagen(doc, pagina, await generarQr(el), el.x, y(altoPagina, el.y, el.h), el.w, el.h);
        break;

      case 'imagen':
        await dibujarImagen(doc, pagina, el.src, el.x, y(altoPagina, el.y, el.h), el.w, el.h, el.opacidad / 100);
        break;

      case 'campo': {
        const yBase = y(altoPagina, el.y, el.h);
        const fuente = await obtenerFuente(el.familia, el.negrita, el.cursiva);

        if (!opciones.conFormulario) {
          // Aplanado: se dibuja la apariencia, sin campo interactivo.
          if (el.invisible) break;
          if (el.conFondo) pagina.drawRectangle({ x: el.x, y: yBase, width: el.w, height: el.h, color: color(el.fondoColor) });
          if (el.bordeGrosor > 0) {
            pagina.drawRectangle({ x: el.x, y: yBase, width: el.w, height: el.h, borderWidth: el.bordeGrosor, borderColor: color(el.bordeColor) });
          }
          if (el.defaultValue) {
            pagina.drawText(el.defaultValue, { x: el.x + 2, y: yBase + (el.h - el.size) / 2, size: el.size, font: fuente, color: color(el.color) });
          }
          break;
        }

        // Un mismo ID se puede colocar varias veces en la hoja: en AcroForm eso es UN campo con
        // varias apariencias, así que se crea una sola vez y se le agregan las demás posiciones.
        let campo = camposCreados.get(el.name);
        if (!campo) {
          campo = formulario.createTextField(el.name);
          if (el.defaultValue) campo.setText(el.defaultValue);
          if (el.readonly) campo.enableReadOnly();
          camposCreados.set(el.name, campo);
        }
        campo.addToPage(pagina, {
          x: el.x,
          y: yBase,
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

import type { Canvas } from 'fabric';
import { anchoTotalTabla, altoTotalTabla, nombresDeCampo, pasoRepeticion, type Elemento } from './elemento';
import { elementoDe } from './objetosFabric';
import { configActual } from './documento';
import { dimensionesDe } from './pagina';
import { caracteresNoRepresentables } from './fuentes';

/** Un texto largo se corta para que quepa en el aviso. */
function recortar(texto: string, largo = 24): string {
  return texto.length > largo ? `${texto.slice(0, largo)}…` : texto;
}

export interface Hallazgo {
  gravedad: 'error' | 'advertencia';
  mensaje: string;
}

function medidas(el: Elemento): { ancho: number; alto: number } {
  if (el.clase === 'tabla') return { ancho: anchoTotalTabla(el), alto: altoTotalTabla(el) };
  if (el.clase === 'texto') return { ancho: el.text.length * el.size * 0.5, alto: el.size };
  return { ancho: el.w, alto: el.h };
}

function nombreDe(el: Elemento): string {
  if (el.clase === 'campo') return `el campo "${el.name}"`;
  if (el.clase === 'texto') return `el texto "${el.text.slice(0, 20)}"`;
  const etiquetas: Record<string, string> = { linea: 'una línea', rect: 'un recuadro', tabla: 'una tabla', qr: 'un QR', imagen: 'una imagen' };
  return etiquetas[el.clase] ?? 'un elemento';
}

/** Revisión previa a exportar: errores bloquean, advertencias son recomendaciones. */
export function verificarDiseno(lienzo: Canvas): Hallazgo[] {
  const elementos = lienzo
    .getObjects()
    .map((o) => elementoDe(o))
    .filter((e): e is Elemento => !!e);

  const hallazgos: Hallazgo[] = [];
  const config = configActual();
  const { ancho: anchoPagina, alto: altoPagina } = dimensionesDe(config);
  const m = config.margenes;

  if (!elementos.length) {
    hallazgos.push({ gravedad: 'error', mensaje: 'El diseño está vacío: no hay nada para exportar.' });
    return hallazgos;
  }

  // Caracteres que las tipografías del editor no saben dibujar. No dan error al exportar: el PDF
  // los escribe como '?' sin avisar, así que el aviso tiene que llegar antes.
  for (const elemento of elementos) {
    const texto = elemento.clase === 'texto' ? elemento.text : elemento.clase === 'campo' ? elemento.defaultValue : '';
    if (!texto) continue;
    const fuera = caracteresNoRepresentables(texto);
    if (!fuera.length) continue;
    const donde = elemento.clase === 'campo' ? `El valor del campo «${elemento.name}»` : `El texto «${recortar(texto)}»`;
    hallazgos.push({
      gravedad: 'advertencia',
      mensaje: `${donde} tiene caracteres que la tipografía no puede representar (${fuera.join(' ')}): en el PDF van a salir como «?».`,
    });
  }

  const campos = elementos.filter((e): e is Elemento & { clase: 'campo' } => e.clase === 'campo');
  const vistos = new Map<string, number>();

  for (const campo of campos) {
    if (!campo.name.trim()) {
      hallazgos.push({ gravedad: 'error', mensaje: 'Hay un campo sin ID: no se puede exportar como formulario.' });
    }
    // El PDF guarda el recuadro de un campo siempre derecho y la rotación aparte, y solo admite
    // múltiplos de 90. Con otro ángulo el campo editable se endereza al más cercano; el diseño
    // aplanado sí respeta el ángulo exacto.
    if (campo.angulo % 90 !== 0) {
      hallazgos.push({
        gravedad: 'advertencia',
        mensaje: `${nombreDe(campo)} está rotado ${campo.angulo}°. Un campo de formulario solo puede rotar en múltiplos de 90°: al exportar con campos editables va a quedar en ${Math.round(campo.angulo / 90) * 90}°.`,
      });
    }
    if (campo.repFilas > 1) {
      if (!campo.name.includes(campo.repComodin)) {
        hallazgos.push({
          gravedad: 'error',
          mensaje: `${nombreDe(campo)} se repite ${campo.repFilas} veces pero su ID no tiene el comodín "${campo.repComodin}": las filas quedarían todas con el mismo nombre y serían un solo campo.`,
        });
      }
      const ultimaFila = campo.y + (campo.repFilas - 1) * pasoRepeticion(campo) + campo.h;
      if (ultimaFila > altoPagina) {
        hallazgos.push({
          gravedad: 'error',
          mensaje: `${nombreDe(campo)} se repite ${campo.repFilas} veces y las últimas filas caen fuera de la hoja (llegan hasta ${Math.round(ultimaFila)} pt de ${altoPagina}).`,
        });
      }
    }
    for (const nombre of nombresDeCampo(campo)) {
      vistos.set(nombre, (vistos.get(nombre) ?? 0) + 1);
    }
  }

  for (const [nombre, veces] of vistos) {
    if (veces > 1) {
      hallazgos.push({
        gravedad: 'advertencia',
        mensaje: `El campo "${nombre}" está colocado ${veces} veces. En el PDF será un único campo: al completarlo, todas las copias muestran el mismo valor.`,
      });
    }
  }

  for (const el of elementos) {
    const { ancho, alto } = medidas(el);

    if (el.x < 0 || el.y < 0 || el.x + ancho > anchoPagina || el.y + alto > altoPagina) {
      hallazgos.push({ gravedad: 'error', mensaje: `${nombreDe(el)} se sale de la hoja y va a quedar cortado.` });
    } else if (el.x < m.izquierda || el.y < m.arriba || el.x + ancho > anchoPagina - m.derecha || el.y + alto > altoPagina - m.abajo) {
      hallazgos.push({ gravedad: 'advertencia', mensaje: `${nombreDe(el)} queda fuera de los márgenes.` });
    }

    if ((el.clase === 'campo' || el.clase === 'rect' || el.clase === 'qr' || el.clase === 'imagen') && (el.w < 4 || el.h < 4)) {
      hallazgos.push({ gravedad: 'advertencia', mensaje: `${nombreDe(el)} es muy chico (${Math.round(el.w)}×${Math.round(el.h)} pt) y puede no verse.` });
    }

    if (el.clase === 'qr' && !el.texto.trim()) {
      hallazgos.push({ gravedad: 'advertencia', mensaje: 'Hay un QR sin contenido.' });
    }
  }

  return hallazgos;
}

/** Peso real del PDF: se genera de verdad y se mide, en vez de estimarlo. */
export async function pesoDelPdf(lienzo: Canvas): Promise<number> {
  const { exportarPdf } = await import('./exportarPdf');
  const bytes = await exportarPdf(lienzo, { conFormulario: true });
  return bytes.length;
}

export function formatearPeso(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

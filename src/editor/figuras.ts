/**
 * La geometría de las formas, en un solo lugar.
 *
 * El lienzo y el exportador dibujan **el mismo camino**: los dos piden acá los puntos y solo se
 * diferencian en cómo los trazan (canvas de un lado, pdf-lib del otro). Es a propósito, para no
 * repetir el problema de la tabla, que tiene la geometría escrita dos veces y hay que acordarse de
 * tocar las dos.
 *
 * Los puntos vienen en coordenadas locales de la caja: (0,0) es su esquina superior izquierda y la
 * Y crece hacia abajo, como en pantalla. Quien dibuje se encarga de llevarlos a donde van.
 */
import type { ElementoForma } from './elemento';

export interface Punto {
  x: number;
  y: number;
}

/** Cuántas puntas admite una estrella: menos de 3 no cierra y más de 20 no se distingue. */
export const PUNTAS_MIN = 3;
export const PUNTAS_MAX = 20;

/** Qué tan adentro caen los vértices interiores de la estrella, sobre el radio de los exteriores. */
const HUNDIDO_ESTRELLA = 0.42;

/**
 * El contorno de la figura como polígono cerrado, o `null` para la elipse, que no es un polígono:
 * ahí cada lado usa su primitiva (`ctx.ellipse` en el lienzo, `drawEllipse` en el PDF).
 */
export function puntosDeFigura(el: ElementoForma): Punto[] | null {
  const { w, h } = el;

  switch (el.figura) {
    case 'elipse':
      return null;

    case 'triangulo':
      return [
        { x: w / 2, y: 0 },
        { x: w, y: h },
        { x: 0, y: h },
      ];

    case 'flecha': {
      // La cabeza no puede comerse la flecha entera ni desaparecer: como mucho, la mitad del largo.
      const cabeza = Math.min(w / 2, h);
      const cuerpo = h / 4; // media altura del asta
      const medio = h / 2;
      const base = w - cabeza;
      return [
        { x: 0, y: medio - cuerpo },
        { x: base, y: medio - cuerpo },
        { x: base, y: 0 },
        { x: w, y: medio },
        { x: base, y: h },
        { x: base, y: medio + cuerpo },
        { x: 0, y: medio + cuerpo },
      ];
    }

    case 'estrella': {
      const n = Math.max(PUNTAS_MIN, Math.min(PUNTAS_MAX, Math.round(el.puntas) || 5));
      const puntos: Punto[] = [];
      // Los radios son los de la caja, así que la estrella se estira con ella en vez de quedar
      // siempre redonda. La primera punta va hacia arriba: es como se espera ver una estrella.
      for (let i = 0; i < n * 2; i++) {
        const angulo = -Math.PI / 2 + (i * Math.PI) / n;
        const escala = i % 2 === 0 ? 1 : HUNDIDO_ESTRELLA;
        puntos.push({
          x: w / 2 + Math.cos(angulo) * (w / 2) * escala,
          y: h / 2 + Math.sin(angulo) * (h / 2) * escala,
        });
      }
      return puntos;
    }
  }
}

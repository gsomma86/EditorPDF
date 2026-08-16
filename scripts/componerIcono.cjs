/**
 * Arma el ícono de la aplicación: una hoja blanca con renglones y, encima, el avión de ReciboMail.
 *
 * Se hace acá y no con una librería de imágenes porque no hay ninguna instalada y el trabajo es
 * acotado: leer un PNG RGBA, recortarlo, escalarlo y componerlo sobre un lienzo. Todo lo que hace
 * falta —inflate y deflate— ya viene con Node.
 *
 * Uso:
 *   node scripts/componerIcono.cjs <origen.png> <salida.png> [solo-avion]
 *
 *   <origen.png>   El avión de ReciboMail en RGBA de 8 bits (icono.png en la raíz del repo).
 *   <salida.png>   Dónde escribir el ícono compuesto, 1024×1024.
 *   solo-avion     Recorta y centra solo el avión, sin hoja ni renglones, en 128×128 — se usó
 *                  para probar el recorte antes de fijar los valores de RECORTE/destino de abajo.
 *
 * Después de generar la salida, `npx tauri icon <salida.png>` (desde src-tauri/) regenera todos
 * los tamaños e íconos de plataforma en src-tauri/icons/. Cargo no vuelve a incrustarlo solo —
 * ver la lección 51 de CLAUDE.md— así que hay que tocar src-tauri/build.rs antes de `tauri build`.
 */
const fs = require('fs');
const zlib = require('zlib');

// ---------- Leer un PNG a RGBA ----------

function leerPng(ruta) {
  const bytes = fs.readFileSync(ruta);
  const ancho = bytes.readUInt32BE(16);
  const alto = bytes.readUInt32BE(20);
  const profundidad = bytes[24];
  const tipoColor = bytes[25];
  if (profundidad !== 8 || tipoColor !== 6) throw new Error(`Solo se admite RGBA de 8 bits (vino ${profundidad}/${tipoColor})`);

  // Los datos pueden venir partidos en varios trozos IDAT: se juntan antes de descomprimir.
  const trozos = [];
  let i = 8;
  while (i < bytes.length) {
    const largo = bytes.readUInt32BE(i);
    const tipo = bytes.toString('ascii', i + 4, i + 8);
    if (tipo === 'IDAT') trozos.push(bytes.subarray(i + 8, i + 8 + largo));
    if (tipo === 'IEND') break;
    i += largo + 12;
  }

  const crudo = zlib.inflateSync(Buffer.concat(trozos));
  const pixeles = Buffer.alloc(ancho * alto * 4);

  // Deshacer los filtros por línea, que es como el PNG guarda las diferencias entre píxeles.
  const bpp = 4;
  const anchoLinea = ancho * bpp;
  for (let y = 0; y < alto; y++) {
    const filtro = crudo[y * (anchoLinea + 1)];
    const entrada = crudo.subarray(y * (anchoLinea + 1) + 1, (y + 1) * (anchoLinea + 1));
    const linea = pixeles.subarray(y * anchoLinea, (y + 1) * anchoLinea);
    const arriba = y > 0 ? pixeles.subarray((y - 1) * anchoLinea, y * anchoLinea) : null;

    for (let x = 0; x < anchoLinea; x++) {
      const a = x >= bpp ? linea[x - bpp] : 0;
      const b = arriba ? arriba[x] : 0;
      const c = arriba && x >= bpp ? arriba[x - bpp] : 0;
      let valor = entrada[x];
      if (filtro === 1) valor += a;
      else if (filtro === 2) valor += b;
      else if (filtro === 3) valor += (a + b) >> 1;
      else if (filtro === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        valor += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      linea[x] = valor & 255;
    }
  }
  return { ancho, alto, pixeles };
}

// ---------- Escribir un PNG desde RGBA ----------

function escribirPng(ruta, img) {
  const anchoLinea = img.ancho * 4;
  const crudo = Buffer.alloc((anchoLinea + 1) * img.alto);
  for (let y = 0; y < img.alto; y++) {
    crudo[y * (anchoLinea + 1)] = 0; // sin filtro: el archivo pesa un poco más y el código es claro
    img.pixeles.copy(crudo, y * (anchoLinea + 1) + 1, y * anchoLinea, (y + 1) * anchoLinea);
  }

  const trozo = (tipo, datos) => {
    const salida = Buffer.alloc(datos.length + 12);
    salida.writeUInt32BE(datos.length, 0);
    salida.write(tipo, 4, 'ascii');
    datos.copy(salida, 8);
    salida.writeInt32BE(crc(Buffer.concat([Buffer.from(tipo, 'ascii'), datos])), datos.length + 8);
    return salida;
  };

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(img.ancho, 0);
  ihdr.writeUInt32BE(img.alto, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;

  fs.writeFileSync(
    ruta,
    Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      trozo('IHDR', ihdr),
      trozo('IDAT', zlib.deflateSync(crudo, { level: 9 })),
      trozo('IEND', Buffer.alloc(0)),
    ])
  );
}

const TABLA_CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc(buf) {
  let c = -1;
  for (const b of buf) c = TABLA_CRC[(c ^ b) & 255] ^ (c >>> 8);
  return c ^ -1;
}

// ---------- Componer ----------

const leer = (img, x, y) => {
  if (x < 0 || y < 0 || x >= img.ancho || y >= img.alto) return [0, 0, 0, 0];
  const i = (y * img.ancho + x) * 4;
  return [img.pixeles[i], img.pixeles[i + 1], img.pixeles[i + 2], img.pixeles[i + 3]];
};

/** Color de un punto con interpolación entre los cuatro vecinos: al achicar queda liso. */
function muestrear(img, fx, fy) {
  const x0 = Math.floor(fx), y0 = Math.floor(fy);
  const dx = fx - x0, dy = fy - y0;
  const p = [leer(img, x0, y0), leer(img, x0 + 1, y0), leer(img, x0, y0 + 1), leer(img, x0 + 1, y0 + 1)];
  const pesos = [(1 - dx) * (1 - dy), dx * (1 - dy), (1 - dx) * dy, dx * dy];
  const salida = [0, 0, 0, 0];
  for (let c = 0; c < 4; c++) for (let k = 0; k < 4; k++) salida[c] += p[k][c] * pesos[k];
  return salida;
}

function pintar(destino, x, y, [r, g, b, a]) {
  if (x < 0 || y < 0 || x >= destino.ancho || y >= destino.alto || a <= 0) return;
  const i = (y * destino.ancho + x) * 4;
  const alfa = a / 255;
  const restante = 1 - alfa;
  destino.pixeles[i] = r * alfa + destino.pixeles[i] * restante;
  destino.pixeles[i + 1] = g * alfa + destino.pixeles[i + 1] * restante;
  destino.pixeles[i + 2] = b * alfa + destino.pixeles[i + 2] * restante;
  destino.pixeles[i + 3] = Math.min(255, a + destino.pixeles[i + 3] * restante);
}

const SOLO_AVION = process.argv[4] === 'solo-avion';
const LADO = SOLO_AVION ? 128 : 1024;
const lienzo = { ancho: LADO, alto: LADO, pixeles: Buffer.alloc(LADO * LADO * 4) };

// La hoja: un rectángulo blanco de esquinas redondeadas, con el borde suavizado a mano.
const RADIO = LADO * 0.14;
const MARGEN = LADO * 0.045;
function dentroDeLaHoja(x, y) {
  const izq = MARGEN, der = LADO - MARGEN, arr = MARGEN, aba = LADO - MARGEN;
  const cx = Math.min(Math.max(x, izq + RADIO), der - RADIO);
  const cy = Math.min(Math.max(y, arr + RADIO), aba - RADIO);
  const distancia = Math.hypot(x - cx, y - cy);
  if (x < izq || x > der || y < arr || y > aba) return 0;
  return Math.min(1, Math.max(0, RADIO + 1 - distancia));
}

for (let y = 0; y < (SOLO_AVION ? 0 : LADO); y++) {
  for (let x = 0; x < LADO; x++) {
    const cobertura = dentroDeLaHoja(x, y);
    if (cobertura <= 0) continue;
    // Cerca del borde se pinta el contorno; adentro, el papel.
    const borde = cobertura < 1 || dentroDeLaHoja(x + 3, y) < 1 || dentroDeLaHoja(x - 3, y) < 1 || dentroDeLaHoja(x, y + 3) < 1 || dentroDeLaHoja(x, y - 3) < 1;
    pintar(lienzo, x, y, borde ? [149, 190, 232, 255 * cobertura] : [255, 255, 255, 255]);
  }
}

// Los renglones, que son los que dicen "documento" de un vistazo.
const renglones = [
  { y: 0.24, largo: 0.44 },
  { y: 0.36, largo: 0.32 },
  { y: 0.48, largo: 0.4 },
];
for (const renglon of SOLO_AVION ? [] : renglones) {
  const y0 = LADO * renglon.y;
  const alto = LADO * 0.045;
  const x0 = LADO * 0.16;
  const ancho = LADO * renglon.largo;
  for (let y = y0; y < y0 + alto; y++) {
    for (let x = x0; x < x0 + ancho; x++) {
      // Puntas redondeadas, para que no se vean como ladrillos.
      const dx = Math.min(x - x0, x0 + ancho - x);
      const dy = Math.min(y - y0, y0 + alto - y);
      const r = alto / 2;
      const cobertura = dx > r || dy > r ? 1 : Math.min(1, Math.hypot(Math.min(dx, r) - r, Math.min(dy, r) - r) < r ? 1 : 0);
      if (cobertura > 0) pintar(lienzo, Math.round(x), Math.round(y), [186, 214, 240, 255]);
    }
  }
}

// El avión, recortado del original —sin la estela larga— y apoyado abajo a la derecha.
const avion = leerPng(process.argv[2]);
const RECORTE = SOLO_AVION ? { x: 0.28, y: 0.24, lado: 0.70 } : { x: 0.30, y: 0.18, lado: 0.68 }; // en proporción del original
const destino = SOLO_AVION ? { x: 0, y: 0, lado: LADO } : { x: LADO * 0.30, y: LADO * 0.36, lado: LADO * 0.62 };

for (let y = 0; y < destino.lado; y++) {
  for (let x = 0; x < destino.lado; x++) {
    const fx = (RECORTE.x + (x / destino.lado) * RECORTE.lado) * avion.ancho;
    const fy = (RECORTE.y + (y / destino.lado) * RECORTE.lado) * avion.alto;
    pintar(lienzo, Math.round(destino.x + x), Math.round(destino.y + y), muestrear(avion, fx, fy));
  }
}

escribirPng(process.argv[3], lienzo);
console.log('ícono escrito:', process.argv[3], Math.round(fs.statSync(process.argv[3]).size / 1024), 'KB');

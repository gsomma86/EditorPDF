/**
 * Sube el número de versión en los cinco lugares donde vive, todos a la vez: package.json,
 * src-tauri/tauri.conf.json, src-tauri/Cargo.toml, el splash de escritorio (public/splash.html) y
 * el menú Ayuda > Acerca de (src/ui/ayuda.ts, una vez por idioma). No están centralizados en un
 * solo archivo a propósito — el splash es HTML estático que se pinta antes de que cargue nada del
 * editor (ver la lección de por qué vive en public/), y Cargo.toml/tauri.conf.json son de
 * ecosistemas que no leen TypeScript — así que el riesgo real es olvidarse uno; este script existe
 * para que no haga falta acordarse a mano.
 *
 * Cargo.lock también trae su propia copia de la versión, pero esa no hace falta tocarla: la
 * actualiza sola `cargo build`/`tauri build` en cuanto ve que Cargo.toml cambió.
 *
 * Uso:
 *   node scripts/subirVersion.cjs           # sube el parche: 1.0.0 -> 1.0.1
 *   node scripts/subirVersion.cjs minor     # sube el minor:  1.0.1 -> 1.1.0
 *   node scripts/subirVersion.cjs major     # sube el major:  1.1.0 -> 2.0.0
 *   node scripts/subirVersion.cjs 1.2.3     # fija una versión exacta
 */
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const rutaPackageJson = path.join(RAIZ, 'package.json');

function versionActual() {
  return JSON.parse(fs.readFileSync(rutaPackageJson, 'utf8')).version;
}

function siguienteVersion(actual, arg) {
  if (arg && /^\d+\.\d+\.\d+$/.test(arg)) return arg;
  const [mayor, menor, parche] = actual.split('.').map(Number);
  if (arg === 'major') return `${mayor + 1}.0.0`;
  if (arg === 'minor') return `${mayor}.${menor + 1}.0`;
  return `${mayor}.${menor}.${parche + 1}`;
}

/** Reemplaza una única aparición literal; avisa si no encontró nada o encontró de más. */
function reemplazarUna(ruta, buscar, reemplazar) {
  const contenido = fs.readFileSync(ruta, 'utf8');
  const veces = contenido.split(buscar).length - 1;
  if (veces !== 1) {
    console.warn(`⚠ ${path.relative(RAIZ, ruta)}: se esperaba una aparición de "${buscar}", se encontraron ${veces}. No se tocó.`);
    return false;
  }
  fs.writeFileSync(ruta, contenido.replace(buscar, reemplazar), 'utf8');
  return true;
}

function main() {
  const actual = versionActual();
  const nueva = siguienteVersion(actual, process.argv[2]);
  if (nueva === actual) {
    console.log(`Ya está en ${actual}, no hay nada que subir.`);
    return;
  }

  const cambios = [
    [rutaPackageJson, `"version": "${actual}"`, `"version": "${nueva}"`],
    [path.join(RAIZ, 'src-tauri', 'tauri.conf.json'), `"version": "${actual}"`, `"version": "${nueva}"`],
    [path.join(RAIZ, 'src-tauri', 'Cargo.toml'), `version = "${actual}"`, `version = "${nueva}"`],
    [path.join(RAIZ, 'public', 'splash.html'), `Versión ${actual} ·`, `Versión ${nueva} ·`],
    [path.join(RAIZ, 'src', 'ui', 'ayuda.ts'), `<li>Versión ${actual}</li>`, `<li>Versión ${nueva}</li>`],
    [path.join(RAIZ, 'src', 'ui', 'ayuda.ts'), `<li>Version ${actual}</li>`, `<li>Version ${nueva}</li>`],
    [path.join(RAIZ, 'src', 'ui', 'ayuda.ts'), `<li>Versão ${actual}</li>`, `<li>Versão ${nueva}</li>`],
  ];

  let ok = 0;
  for (const [ruta, buscar, reemplazar] of cambios) {
    if (reemplazarUna(ruta, buscar, reemplazar)) ok++;
  }

  console.log(`\n${actual} -> ${nueva}  (${ok}/${cambios.length} lugares actualizados)`);
  if (ok < cambios.length) {
    console.log('Revisar los que quedaron marcados con ⚠ antes de commitear.');
    process.exitCode = 1;
  }
}

main();

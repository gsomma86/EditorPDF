import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const raiz = fileURLToPath(new URL('..', import.meta.url));

/**
 * A diferencia de los otros arneses, este usa el `objetosFabric` de verdad: lo que se prueba es
 * justamente que cambiar de hoja arme y desarme bien los objetos del lienzo. Fabric corre en Node
 * con su propio canvas.
 */
export default defineConfig({
  root: raiz,
  // 'fabric/node' trae su propio DOM (jsdom), necesario para armar objetos fuera del navegador.
  resolve: { alias: { fabric: 'fabric/node' } },
  plugins: [
    {
      // `almacenPdf` guarda en IndexedDB, que en Node no existe.
      name: 'stub-almacen',
      enforce: 'pre',
      resolveId(fuente) {
        if (/almacenPdf(\.ts)?$/.test(fuente)) return `${raiz}pruebas/stubAlmacen.ts`;
        return null;
      },
    },
  ],
  build: {
    ssr: `${raiz}pruebas/arnesHojas.ts`,
    outDir: `${raiz}pruebas/dist-hojas`,
    emptyOutDir: true,
    target: 'node20',
    minify: false,
  },
});

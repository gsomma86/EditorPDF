import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const raiz = fileURLToPath(new URL('..', import.meta.url));

/** Igual que vite.ssr.config.ts pero sin stub: acá se quiere el Fabric de verdad. */
export default defineConfig({
  root: raiz,
  // 'fabric/node' trae su propio DOM (jsdom), necesario para medir textos fuera del navegador.
  resolve: { alias: { fabric: 'fabric/node' } },
  build: {
    ssr: `${raiz}pruebas/arnesFabric.ts`,
    outDir: `${raiz}pruebas/dist-fabric`,
    emptyOutDir: true,
    target: 'node20',
    minify: false,
  },
});

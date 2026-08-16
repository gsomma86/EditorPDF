import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const raiz = fileURLToPath(new URL('..', import.meta.url));

/**
 * Como el de hojas, usa el `objetosFabric` de verdad: lo que se mide es el orden real del arreglo
 * de objetos del lienzo, así que un stub no serviría de nada.
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
    ssr: `${raiz}pruebas/arnesObjetos.ts`,
    outDir: `${raiz}pruebas/dist-objetos`,
    emptyOutDir: true,
    target: 'node20',
    minify: false,
  },
});

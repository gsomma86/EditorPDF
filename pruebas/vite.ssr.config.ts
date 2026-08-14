import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const raiz = fileURLToPath(new URL('..', import.meta.url));

export default defineConfig({
  root: raiz,
  plugins: [
    {
      // El exportador importa './objetosFabric' (Fabric + DOM). En Node se cambia por el stub.
      name: 'stub-objetos-fabric',
      enforce: 'pre',
      resolveId(fuente) {
        if (/objetosFabric(\.ts)?$/.test(fuente)) return `${raiz}pruebas/stubObjetos.ts`;
        return null;
      },
    },
  ],
  build: {
    ssr: `${raiz}pruebas/arnes.ts`,
    outDir: `${raiz}pruebas/dist`,
    emptyOutDir: true,
    target: 'node20',
    minify: false,
  },
});

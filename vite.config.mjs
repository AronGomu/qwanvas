import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { defineConfig, transformWithOxc } from 'vite';

const root = resolve(import.meta.dirname);
const appSourceFiles = [
  'src/app/00-types.ts',
  'src/app/01-state.ts',
  'src/app/02-wire-commands.ts',
  'src/app/03-command-palette.ts',
  'src/app/04-render-inspector.ts',
  'src/app/05-interactions.ts',
  'src/app/06-project-model.ts',
  'src/app/07-import-export.ts',
  'src/app/08-storage-utils.ts',
];
const virtualModuleId = 'virtual:qwanvas-app';
const resolvedVirtualModuleId = `\0${virtualModuleId}.ts`;

function appBundlePlugin() {
  const absoluteAppFiles = appSourceFiles.map((file) => join(root, file));

  return {
    name: 'qwanvas-app-bundle',
    resolveId(id) {
      if (id === virtualModuleId) return resolvedVirtualModuleId;
      return null;
    },
    async load(id) {
      if (id !== resolvedVirtualModuleId) return null;
      for (const file of absoluteAppFiles) this.addWatchFile(file);
      const source = absoluteAppFiles.map((file) => readFileSync(file, 'utf8')).join('\n');
      return transformWithOxc(source, 'qwanvas-app.ts', { lang: 'ts', sourcemap: true });
    },
    handleHotUpdate(ctx) {
      if (!absoluteAppFiles.includes(ctx.file)) return;
      const module = ctx.server.moduleGraph.getModuleById(resolvedVirtualModuleId);
      if (module) ctx.server.moduleGraph.invalidateModule(module);
      ctx.server.ws.send({ type: 'full-reload' });
      return [];
    },
  };
}

function staticRootAssetsPlugin() {
  const staticAssets = ['manifest.webmanifest', 'sw.js', 'icons/icon.svg'];

  return {
    name: 'qwanvas-static-root-assets',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const pathname = request.url?.split('?')[0]?.replace(/^\//, '');
        if (!pathname || !staticAssets.includes(pathname)) return next();
        response.setHeader('Cache-Control', 'no-store');
        response.end(readFileSync(join(root, pathname)));
      });
    },
    closeBundle() {
      for (const asset of staticAssets) {
        const destination = join(root, 'dist', asset);
        mkdirSync(dirname(destination), { recursive: true });
        copyFileSync(join(root, asset), destination);
      }
    },
  };
}

export default defineConfig({
  plugins: [appBundlePlugin(), staticRootAssetsPlugin()],
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
  },
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        entryFileNames: 'app.js',
        chunkFileNames: 'chunks/[name].js',
        assetFileNames: (assetInfo) => assetInfo.name?.endsWith('.css') ? 'style.css' : 'assets/[name][extname]',
      },
    },
  },
  test: {
    globals: false,
    environment: 'node',
    include: ['tests/**/*.test.mjs'],
    exclude: ['tests/e2e/**'],
  },
});

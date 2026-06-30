import path from 'node:path';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { createServer, type Logger, type Plugin, type ViteDevServer } from 'vite';

const quietViteLogger: Logger = {
  info() {},
  warn() {},
  warnOnce() {},
  error(message) {
    console.error(message);
  },
  clearScreen() {},
  hasErrorLogged() {
    return false;
  },
  hasWarned: false,
};

function createLayerStyleStubPlugin(options: {
  layerStyleStubId: string;
  layerStyleStubModule: string;
}): Plugin {
  return {
    name: 'geoforge-layer-style-stub',
    enforce: 'pre',
    resolveId(source) {
      const normalizedSource = source.replaceAll('\\', '/');
      return source === '@/core/options/layers/style.ts' ||
        normalizedSource.endsWith('/src/core/options/layers/style.ts')
        ? options.layerStyleStubId
        : null;
    },
    load(id) {
      return id === options.layerStyleStubId ? options.layerStyleStubModule : null;
    },
  };
}

export async function createGeoForgeSsrServer(options: {
  layerStyleStubId: string;
  layerStyleStubModule: string;
  extraPlugins?: Plugin[];
}): Promise<ViteDevServer> {
  const packageRoot = process.cwd();

  return createServer({
    cacheDir: path.join(packageRoot, 'node_modules/.vite-vitest-ssr'),
    clearScreen: false,
    configFile: false,
    customLogger: quietViteLogger,
    define: {
      __GEOMAN_VERSION__: JSON.stringify('free'),
    },
    logLevel: 'error',
    plugins: [createLayerStyleStubPlugin(options), ...(options.extraPlugins ?? []), svelte()],
    resolve: {
      alias: {
        '@': path.join(packageRoot, 'src'),
        '@mapLib': path.join(packageRoot, 'src/core/map/maplibre'),
        '@tests': path.join(packageRoot, 'tests'),
      },
    },
    root: packageRoot,
    server: { middlewareMode: true },
  });
}

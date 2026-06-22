import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, searchForWorkspaceRoot } from 'vite';
import svgLoader from 'vite-svg-loader';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '../..');
const geoforgeRoot = workspaceRoot;
const svelteConfigFile = path.resolve(geoforgeRoot, 'svelte.config.js');

export default defineConfig({
  define: {
    __GEOMAN_VERSION__: JSON.stringify('free'),
  },
  plugins: [
    {
      name: 'geoforge-tile-proxy',
      configureServer(server) {
        server.middlewares.use('/__geoforge_tile_proxy', async (request, response) => {
          try {
            const requestUrl = new URL(request.url ?? '', 'http://127.0.0.1');
            const remoteUrl = requestUrl.searchParams.get('url');

            if (!remoteUrl) {
              response.statusCode = 400;
              response.end('Missing url query parameter.');
              return;
            }

            const parsedRemoteUrl = new URL(remoteUrl);

            if (!['http:', 'https:'].includes(parsedRemoteUrl.protocol)) {
              response.statusCode = 400;
              response.end('Only HTTP and HTTPS tile URLs are supported.');
              return;
            }

            const tileResponse = await fetch(parsedRemoteUrl);
            response.statusCode = tileResponse.status;

            const contentType = tileResponse.headers.get('content-type');
            const cacheControl = tileResponse.headers.get('cache-control');

            if (contentType) {
              response.setHeader('content-type', contentType);
            }

            if (cacheControl) {
              response.setHeader('cache-control', cacheControl);
            }

            response.setHeader('access-control-allow-origin', '*');
            response.end(Buffer.from(await tileResponse.arrayBuffer()));
          } catch (error) {
            response.statusCode = 502;
            response.end(error instanceof Error ? error.message : 'Tile proxy request failed.');
          }
        });
      },
    },
    svelte({
      configFile: svelteConfigFile,
    }),
    svgLoader({ defaultImport: 'raw' }),
  ],
  resolve: {
    alias: [
      {
        find: 'maplibre-geoforge/dist/maplibre-geoforge.css',
        replacement: path.resolve(geoforgeRoot, 'src/styles/style.css'),
      },
      {
        find: 'maplibre-geoforge',
        replacement: path.resolve(geoforgeRoot, 'src/index.ts'),
      },
      {
        find: '@',
        replacement: path.resolve(geoforgeRoot, 'src'),
      },
      {
        find: '@tests',
        replacement: path.resolve(geoforgeRoot, 'tests'),
      },
      {
        find: '@mapLib',
        replacement: path.resolve(geoforgeRoot, 'src/core/map/maplibre'),
      },
    ],
    dedupe: ['maplibre-gl'],
  },
  optimizeDeps: {
    exclude: ['maplibre-geoforge'],
  },
  build: {
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/maplibre-gl')) {
            return 'maplibre';
          }
        },
      },
    },
  },
  server: {
    fs: {
      allow: [searchForWorkspaceRoot(process.cwd()), workspaceRoot, geoforgeRoot],
    },
  },
});

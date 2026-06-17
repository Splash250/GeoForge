import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, searchForWorkspaceRoot } from 'vite';
import svgLoader from 'vite-svg-loader';
import { sveltePreprocess } from 'svelte-preprocess';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '../..');
const geoforgeRoot = workspaceRoot;

export default defineConfig({
  define: {
    __GEOMAN_VERSION__: JSON.stringify('free'),
  },
  plugins: [svelte({ preprocess: sveltePreprocess() }), svgLoader({ defaultImport: 'raw' })],
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
  server: {
    fs: {
      allow: [searchForWorkspaceRoot(process.cwd()), workspaceRoot, geoforgeRoot],
    },
  },
});

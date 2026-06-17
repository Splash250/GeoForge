import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import svgLoader from 'vite-svg-loader';

import { type Options } from './src/config/options.ts';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  const baseMap = 'maplibre';
  const gmVersion = (env.VITE_GEOFORGE_VERSION as Options['GmVersion']) || null;

  return {
    define: {
      __GEOMAN_VERSION__: JSON.stringify(gmVersion),
    },
    server: {
      port: 3100,
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@tests': path.resolve(__dirname, './tests'),
        '@mapLib': path.resolve(__dirname, `./src/core/map/${baseMap}`),
      },
    },
    plugins: [svelte(), svgLoader({ defaultImport: 'raw' })],
    build: {
      sourcemap: true,
      lib: {
        entry: 'src/index.ts',
        name: 'GeoForge',
        fileName: (format) => `${baseMap}-geoforge.${format}.js`,
      },
      rollupOptions: {
        external: [
          // exclude from the bundle
          // 'maplibre-gl',
          `${baseMap}-gl`,
        ],
        output: {
          globals: {
            // this should match the global variable maplibre-gl exposes
            // 'maplibre-gl': 'maplibregl',
            [`${baseMap}-gl`]: `${baseMap}gl`,
          },
          assetFileNames: (chunkInfo): string => {
            if (chunkInfo.name && chunkInfo.name.endsWith('.css')) {
              // return `${baseMap}-geoforge.css`;
              return `${baseMap}-geoforge.[ext]`;
            }
            return 'assets/[name].[ext]';
          },
        },
      },
    },
  };
});

import path from 'node:path';
import { defineConfig } from 'vitest/config';

const baseMap = 'maplibre';

export default defineConfig({
  define: {
    __GEOMAN_VERSION__: JSON.stringify(process.env.VITE_GEOFORGE_VERSION ?? 'free'),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@tests': path.resolve(__dirname, './tests'),
      '@mapLib': path.resolve(__dirname, `./src/core/map/${baseMap}`),
    },
  },
  test: {
    environment: 'node',
    exclude: ['node_modules/**', 'dist/**', 'tests/**/*.spec.ts', 'src/dev/**'],
    fileParallelism: false,
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    testTimeout: 15000,
  },
});

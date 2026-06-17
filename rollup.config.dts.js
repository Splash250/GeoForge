import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { existsSync } from 'fs';
import dts from 'rollup-plugin-dts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get the base map from command line arguments
const args = process.argv.slice(2);
const baseMapArg = args.find((arg) => arg.includes('--base-map='));
const baseMap = baseMapArg ? baseMapArg.split('=')[1] : 'maplibre'; // default to maplibre
const legacyTypesEntry = resolve(__dirname, 'dist/types/src/index.d.ts');
const typesEntry = existsSync(legacyTypesEntry)
  ? legacyTypesEntry
  : resolve(__dirname, 'dist/types/index.d.ts');

export default {
  input: typesEntry,
  external: (id) => id.endsWith('.css'),
  output: {
    file: resolve(__dirname, `dist/${baseMap}-geoforge.d.ts`),
    format: 'es',
  },
  plugins: [dts()],
};

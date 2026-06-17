import { writeFile } from 'node:fs/promises';

await writeFile(
  new URL('../dist/maplibre-geoforge.css.d.ts', import.meta.url),
  'declare const css: string;\nexport default css;\n',
);

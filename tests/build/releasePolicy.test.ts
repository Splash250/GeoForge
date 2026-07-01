import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, test } from 'vitest';
import type { ConfigEnv, UserConfig } from 'vite';

import viteConfig from '../../vite.config.ts';

const BUILD_ENV: ConfigEnv = {
  command: 'build',
  mode: 'production',
  isSsrBuild: false,
  isPreview: false,
};

async function resolveViteConfig(): Promise<UserConfig> {
  if (typeof viteConfig === 'function') {
    return viteConfig(BUILD_ENV) as UserConfig;
  }

  return viteConfig as UserConfig;
}

describe('release sourcemap policy', () => {
  test('keeps production sourcemaps disabled unless explicitly enabled', async () => {
    const previous = process.env.GEOFORGE_BUILD_SOURCEMAPS;
    delete process.env.GEOFORGE_BUILD_SOURCEMAPS;

    try {
      const config = await resolveViteConfig();

      expect(config.build?.sourcemap).toBe(false);
    } finally {
      if (previous === undefined) {
        delete process.env.GEOFORGE_BUILD_SOURCEMAPS;
      } else {
        process.env.GEOFORGE_BUILD_SOURCEMAPS = previous;
      }
    }
  });

  test('enables production sourcemaps with GEOFORGE_BUILD_SOURCEMAPS=true', async () => {
    const previous = process.env.GEOFORGE_BUILD_SOURCEMAPS;
    process.env.GEOFORGE_BUILD_SOURCEMAPS = 'true';

    try {
      const config = await resolveViteConfig();

      expect(config.build?.sourcemap).toBe(true);
    } finally {
      if (previous === undefined) {
        delete process.env.GEOFORGE_BUILD_SOURCEMAPS;
      } else {
        process.env.GEOFORGE_BUILD_SOURCEMAPS = previous;
      }
    }
  });
});

describe('bundle budget policy', () => {
  test('reports required artifact sizes and generated sourcemaps', async () => {
    // eslint-disable-next-line import/extensions
    const { checkBundleBudget } = await import('../../scripts/check-bundle-budget.mjs');
    const distPath = await mkdtemp(path.join(tmpdir(), 'geoforge-budget-'));

    try {
      await writeFile(path.join(distPath, 'maplibre-geoforge.es.js'), 'x'.repeat(1024));
      await writeFile(path.join(distPath, 'maplibre-geoforge.umd.js'), 'x'.repeat(2048));
      await writeFile(path.join(distPath, 'maplibre-geoforge.css'), 'x'.repeat(256));
      await writeFile(path.join(distPath, 'maplibre-geoforge.d.ts'), 'x'.repeat(512));
      await writeFile(path.join(distPath, 'maplibre-geoforge.es.js.map'), 'x'.repeat(4096));

      const result = await checkBundleBudget({ distPath });

      expect(result.ok).toBe(true);
      expect(result.artifacts.map((artifact) => artifact.name)).toEqual([
        'ES bundle',
        'UMD bundle',
        'CSS',
        'Type declarations',
      ]);
      expect(result.artifacts.map((artifact) => artifact.bytes)).toEqual([1024, 2048, 256, 512]);
      expect(result.sourcemaps).toEqual([
        {
          bytes: 4096,
          file: 'maplibre-geoforge.es.js.map',
        },
      ]);
    } finally {
      await rm(distPath, { recursive: true, force: true });
    }
  });

  test('fails when a required artifact exceeds its hard budget', async () => {
    // eslint-disable-next-line import/extensions
    const { checkBundleBudget } = await import('../../scripts/check-bundle-budget.mjs');
    const distPath = await mkdtemp(path.join(tmpdir(), 'geoforge-budget-'));

    try {
      await writeFile(path.join(distPath, 'maplibre-geoforge.es.js'), 'x'.repeat(1_250_001));
      await writeFile(path.join(distPath, 'maplibre-geoforge.umd.js'), 'x'.repeat(2048));
      await writeFile(path.join(distPath, 'maplibre-geoforge.css'), 'x'.repeat(256));
      await writeFile(path.join(distPath, 'maplibre-geoforge.d.ts'), 'x'.repeat(512));

      const result = await checkBundleBudget({ distPath });

      expect(result.ok).toBe(false);
      expect(result.failures).toEqual([
        expect.objectContaining({
          bytes: 1_250_001,
          file: 'maplibre-geoforge.es.js',
          limitBytes: 1_250_000,
          name: 'ES bundle',
        }),
      ]);
    } finally {
      await rm(distPath, { recursive: true, force: true });
    }
  });
});

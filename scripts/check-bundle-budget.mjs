import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const BUNDLE_BUDGETS = [
  {
    name: 'ES bundle',
    file: 'maplibre-geoforge.es.js',
    limitBytes: 1_250_000,
  },
  {
    name: 'UMD bundle',
    file: 'maplibre-geoforge.umd.js',
    limitBytes: 900_000,
  },
  {
    name: 'CSS',
    file: 'maplibre-geoforge.css',
    limitBytes: 15_000,
  },
  {
    name: 'Type declarations',
    file: 'maplibre-geoforge.d.ts',
    limitBytes: 225_000,
  },
];

const DEFAULT_DIST_PATH = path.resolve(process.cwd(), 'dist');

function formatBytes(bytes) {
  return `${bytes.toLocaleString('en-US')} B`;
}

async function getFileSize(filePath) {
  try {
    const details = await stat(filePath);

    if (!details.isFile()) {
      return null;
    }

    return details.size;
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return null;
    }

    throw error;
  }
}

async function findSourcemaps(distPath) {
  let entries;

  try {
    entries = await readdir(distPath, { withFileTypes: true });
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return [];
    }

    throw error;
  }

  const sourcemaps = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.map'))
      .map(async (entry) => ({
        file: entry.name,
        bytes: await getFileSize(path.join(distPath, entry.name)),
      })),
  );

  return sourcemaps
    .filter((artifact) => artifact.bytes !== null)
    .sort((left, right) => left.file.localeCompare(right.file));
}

export async function checkBundleBudget({ distPath = DEFAULT_DIST_PATH } = {}) {
  const artifacts = await Promise.all(
    BUNDLE_BUDGETS.map(async (budget) => ({
      ...budget,
      bytes: await getFileSize(path.join(distPath, budget.file)),
    })),
  );

  const failures = artifacts.filter(
    (artifact) => artifact.bytes === null || artifact.bytes > artifact.limitBytes,
  );
  const sourcemaps = await findSourcemaps(distPath);

  return {
    ok: failures.length === 0,
    artifacts,
    failures,
    sourcemaps,
  };
}

function printBudgetResult(result) {
  console.log('Bundle budget report');
  console.log('');

  for (const artifact of result.artifacts) {
    const actual = artifact.bytes === null ? 'missing' : formatBytes(artifact.bytes);
    const status =
      artifact.bytes !== null && artifact.bytes <= artifact.limitBytes ? 'PASS' : 'FAIL';

    console.log(
      `${status} ${artifact.name}: ${actual} / ${formatBytes(artifact.limitBytes)} ` +
        `(${artifact.file})`,
    );
  }

  if (result.sourcemaps.length > 0) {
    console.log('');
    console.log('Sourcemaps generated intentionally or by local build settings:');

    for (const sourcemap of result.sourcemaps) {
      console.log(`INFO ${sourcemap.file}: ${formatBytes(sourcemap.bytes)}`);
    }
  }

  if (!result.ok) {
    console.log('');
    console.log('Bundle budget failed.');
  }
}

const isCli = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isCli) {
  const result = await checkBundleBudget();
  printBudgetResult(result);

  if (!result.ok) {
    process.exitCode = 1;
  }
}

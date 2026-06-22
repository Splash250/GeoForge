import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';
import { resolveRouteFamilyFromHash } from '../../examples/playground/src/main.ts';

const repoRoot = resolve(__dirname, '../..');
const mainPath = resolve(repoRoot, 'examples/playground/src/main.ts');
const legacyRoutePath = resolve(repoRoot, 'examples/playground/src/routes/legacy-playground.ts');

describe('legacy playground retirement', () => {
  test('removes the legacy route import and route file', () => {
    const mainSource = readFileSync(mainPath, 'utf8');

    expect(mainSource).not.toContain('./routes/legacy-playground');
    expect(mainSource).not.toContain('startLegacyPlayground');
    expect(existsSync(legacyRoutePath)).toBe(false);
  });

  test('keeps legacy hashes on the Demo Studio route', () => {
    expect(resolveRouteFamilyFromHash('')).toBe('demo-studio');
    expect(resolveRouteFamilyFromHash('#decorators')).toBe('demo-studio');
    expect(resolveRouteFamilyFromHash('#overlays')).toBe('demo-studio');
    expect(resolveRouteFamilyFromHash('#demo-studio')).toBe('demo-studio');
    expect(resolveRouteFamilyFromHash('#control-board')).toBe('control-board');
  });
});

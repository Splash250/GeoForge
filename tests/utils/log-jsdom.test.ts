// @vitest-environment jsdom

import { describe, expect, test, vi } from 'vitest';

describe('log wrapper in jsdom', () => {
  test('preserves jsdom localStorage when importing loglevel', async () => {
    vi.resetModules();
    const localStorage = window.localStorage;

    const { default: log } = await import('../../src/utils/log.ts');

    expect(log).toHaveProperty('setLevel');
    expect(window.localStorage).toBe(localStorage);
    expect(globalThis.localStorage).toBe(localStorage);
  });
});

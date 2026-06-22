import { afterEach, describe, expect, test, vi } from 'vitest';

const originalLocalStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');

afterEach(() => {
  vi.resetModules();

  if (originalWindowDescriptor) {
    Object.defineProperty(globalThis, 'window', originalWindowDescriptor);
  } else {
    Reflect.deleteProperty(globalThis, 'window');
  }

  if (originalLocalStorageDescriptor) {
    Object.defineProperty(globalThis, 'localStorage', originalLocalStorageDescriptor);
    return;
  }

  Reflect.deleteProperty(globalThis, 'localStorage');
});

describe('log wrapper', () => {
  test('temporarily hides and restores Node localStorage before loading loglevel in non-browser Node', async () => {
    vi.resetModules();
    Reflect.deleteProperty(globalThis, 'window');
    const localStorageGetter = vi.fn(() => {
      throw new Error('localStorage was probed');
    });
    const localStorageDescriptor: PropertyDescriptor = {
      configurable: true,
      get: localStorageGetter,
    };

    Object.defineProperty(globalThis, 'localStorage', localStorageDescriptor);

    const { default: log } = await import('../../src/utils/log.ts');
    const restoredDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

    expect(log).toHaveProperty('setLevel');
    expect(localStorageGetter).not.toHaveBeenCalled();
    expect(restoredDescriptor).toMatchObject(localStorageDescriptor);
    expect(restoredDescriptor?.get).toBe(localStorageGetter);
  });

  test('temporarily hides and restores Node localStorage value descriptors', async () => {
    vi.resetModules();
    Reflect.deleteProperty(globalThis, 'window');
    const localStorage = {
      getItem: vi.fn(),
      removeItem: vi.fn(),
      setItem: vi.fn(),
    };

    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: localStorage,
    });

    const { default: log } = await import('../../src/utils/log.ts');

    expect(log).toHaveProperty('setLevel');
    expect(globalThis.localStorage).toBe(localStorage);
  });

  test('preserves localStorage when a browser-like window is present', async () => {
    vi.resetModules();
    const localStorage = {
      getItem: vi.fn(),
      removeItem: vi.fn(),
      setItem: vi.fn(),
    };

    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        document: { cookie: '' },
        localStorage,
      },
    });
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: localStorage,
    });

    const { default: log } = await import('../../src/utils/log.ts');

    expect(log).toHaveProperty('setLevel');
    expect(globalThis.localStorage).toBe(localStorage);
    expect(window.localStorage).toBe(localStorage);
  });
});

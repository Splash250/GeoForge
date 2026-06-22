import { describe, expect, test, vi } from 'vitest';
import { onDemoMapLoad } from '../../examples/playground/src/demo-studio/map/onDemoMapLoad.ts';

type LoadHandler = () => void;

function createMapDouble(initiallyLoaded = false) {
  let loaded = initiallyLoaded;
  const handlers: LoadHandler[] = [];

  return {
    map: {
      loaded: vi.fn(() => loaded),
      once: vi.fn((eventName: string, handler: LoadHandler) => {
        if (eventName === 'load') {
          handlers.push(handler);
        }
      }),
      off: vi.fn((eventName: string, handler: LoadHandler) => {
        if (eventName === 'load') {
          const index = handlers.indexOf(handler);
          if (index >= 0) {
            handlers.splice(index, 1);
          }
        }
      }),
    },
    load() {
      loaded = true;
      for (const handler of [...handlers]) {
        handler();
      }
    },
    setLoaded(value: boolean) {
      loaded = value;
    },
    handlers,
  };
}

describe('onDemoMapLoad', () => {
  test('waits for MapLibre load before running the callback', () => {
    const mapDouble = createMapDouble();
    const callback = vi.fn();

    const cleanup = onDemoMapLoad(mapDouble.map, callback);

    expect(callback).not.toHaveBeenCalled();
    expect(mapDouble.map.once).toHaveBeenCalledWith('load', expect.any(Function));

    mapDouble.load();
    mapDouble.load();

    expect(callback).toHaveBeenCalledTimes(1);
    expect(mapDouble.handlers).toHaveLength(0);

    cleanup();
    expect(callback).toHaveBeenCalledTimes(1);
  });

  test('runs immediately when the map is already loaded', () => {
    const mapDouble = createMapDouble(true);
    const callback = vi.fn();

    const cleanup = onDemoMapLoad(mapDouble.map, callback);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(mapDouble.map.once).not.toHaveBeenCalled();

    cleanup();
    expect(callback).toHaveBeenCalledTimes(1);
  });

  test('closes the loaded-between-check-and-listener race', () => {
    const mapDouble = createMapDouble();
    const callback = vi.fn();

    mapDouble.map.once.mockImplementationOnce((eventName: string, handler: LoadHandler) => {
      if (eventName === 'load') {
        mapDouble.handlers.push(handler);
        mapDouble.setLoaded(true);
      }
    });

    onDemoMapLoad(mapDouble.map, callback);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(mapDouble.handlers).toHaveLength(0);
  });
});

import { GeomanLifecycleController } from '@/core/lifecycle/geomanLifecycleController.ts';
import { describe, expect, it, vi } from 'vitest';
import { createGeoForgeSsrServer } from '../utils/viteSsrServer.ts';

type GeomanLifecycleWrapperHost = {
  addControls(controlsElement?: HTMLElement): Promise<unknown>;
  waitForBaseMap(): Promise<unknown>;
  waitForGeomanLoaded(): Promise<unknown>;
  init(): Promise<unknown>;
  destroy(options?: { removeSources: boolean }): Promise<unknown>;
  removeControls(): unknown;
  onMapLoad(): Promise<unknown>;
};

async function withMainModule<T>(
  callback: (modules: {
    mainModule: {
      Geoman: {
        new (map: unknown, options?: unknown): GeomanLifecycleWrapperHost;
        create(map: unknown, options?: unknown): Promise<GeomanLifecycleWrapperHost>;
        prototype: GeomanLifecycleWrapperHost;
      };
      GeoForge: {
        create(map: unknown, options?: unknown): Promise<GeomanLifecycleWrapperHost>;
      };
      createGeomanInstance(map: unknown, options?: unknown): Promise<GeomanLifecycleWrapperHost>;
    };
    lifecycleModule: {
      GeomanLifecycleController: new (...args: never[]) => GeomanLifecycleWrapperHost;
    };
  }) => Promise<T>,
): Promise<T> {
  const { TextEncoder } = await import('node:util');
  const textEncoderDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'TextEncoder');
  const uint8ArrayDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'Uint8Array');
  const originalGeomanVersion = process.env.VITE_GEOFORGE_VERSION;

  Object.defineProperty(globalThis, 'TextEncoder', {
    configurable: true,
    value: TextEncoder,
  });
  Object.defineProperty(globalThis, 'Uint8Array', {
    configurable: true,
    value: new TextEncoder().encode('').constructor,
  });
  process.env.VITE_GEOFORGE_VERSION = 'free';

  const server = await createGeoForgeSsrServer({
    layerStyleStubId: '\0lifecycle-layer-style-stub',
    layerStyleStubModule: 'export default {};',
  });

  try {
    const mainModule = (await server.ssrLoadModule('/src/main.ts')) as Parameters<
      typeof callback
    >[0]['mainModule'];
    const lifecycleModule = (await server.ssrLoadModule(
      '/src/core/lifecycle/geomanLifecycleController.ts',
    )) as Parameters<typeof callback>[0]['lifecycleModule'];

    return await callback({ mainModule, lifecycleModule });
  } finally {
    await server.close();

    if (textEncoderDescriptor) {
      Object.defineProperty(globalThis, 'TextEncoder', textEncoderDescriptor);
    } else {
      Reflect.deleteProperty(globalThis, 'TextEncoder');
    }

    if (uint8ArrayDescriptor) {
      Object.defineProperty(globalThis, 'Uint8Array', uint8ArrayDescriptor);
    } else {
      Reflect.deleteProperty(globalThis, 'Uint8Array');
    }

    if (originalGeomanVersion === undefined) {
      delete process.env.VITE_GEOFORGE_VERSION;
    } else {
      process.env.VITE_GEOFORGE_VERSION = originalGeomanVersion;
    }
  }
}

describe('GeomanLifecycleController', () => {
  it('rejects addControls when map load setup fails', async () => {
    const loadError = new Error('marker load failed');
    const geoman = {
      control: {},
      mapAdapter: {
        mapInstance: {},
        addControl: vi.fn(),
        loadImage: vi.fn(() => Promise.reject(loadError)),
      },
      loaded: false,
      destroyed: false,
      events: {
        fire: vi.fn(),
      },
    };
    const controller = new GeomanLifecycleController(geoman as never);
    const addControlsPromise = controller.addControls();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => reject(new Error('addControls timed out')), 50);
    });

    await expect(Promise.race([addControlsPromise, timeoutPromise])).rejects.toBe(loadError);
    if (timeout) {
      clearTimeout(timeout);
    }
    expect(geoman.mapAdapter.addControl).toHaveBeenCalledWith(geoman.control);
    expect(geoman.loaded).toBe(false);
    expect(geoman.events.fire).not.toHaveBeenCalled();
  });

  it('destroys the feature update manager before removing sources', async () => {
    const cleanupOrder: string[] = [];
    const updateManagerDestroy = vi.fn(() => cleanupOrder.push('update-manager'));
    const sourceRemove = vi.fn(() => cleanupOrder.push('source'));
    const geoman = {
      control: {},
      mapAdapter: {
        mapInstance: {},
        removeControl: vi.fn(),
        removeImage: vi.fn(),
      },
      mapAdapterInstance: null,
      loaded: false,
      destroyed: false,
      features: {
        updateManager: { destroy: updateManagerDestroy },
        sources: {
          main: { remove: sourceRemove },
        },
      },
      decorators: { lines: { destroy: vi.fn() } },
      overlays: { html: { destroy: vi.fn() } },
      contextPanels: { destroy: vi.fn() },
      transactions: { destroy: vi.fn() },
      tools: { destroy: vi.fn() },
      selection: { destroy: vi.fn() },
      events: {
        bus: { detachAllEvents: vi.fn() },
      },
      disableAllModes: vi.fn(),
    };
    const controller = new GeomanLifecycleController(geoman as never);

    await controller.destroy({ removeSources: true });

    expect(updateManagerDestroy).toHaveBeenCalledOnce();
    expect(sourceRemove).toHaveBeenCalledOnce();
    expect(cleanupOrder).toEqual(['update-manager', 'source']);
  });

  it('routes direct-mounted controls through control cleanup during destroy', async () => {
    const controlsElement = {} as HTMLElement;
    const geoman = {
      control: {
        createControls: vi.fn(),
        onRemove: vi.fn(),
      },
      mapAdapter: {
        mapInstance: {},
        addControl: vi.fn(),
        removeControl: vi.fn(),
        removeImage: vi.fn(),
        loadImage: vi.fn(() => Promise.resolve()),
      },
      mapAdapterInstance: null,
      loaded: false,
      destroyed: false,
      features: {
        updateManager: { destroy: vi.fn() },
        sources: {},
      },
      decorators: { lines: { destroy: vi.fn() } },
      overlays: { html: { destroy: vi.fn() } },
      contextPanels: { destroy: vi.fn() },
      transactions: { destroy: vi.fn() },
      tools: { destroy: vi.fn() },
      selection: { destroy: vi.fn() },
      events: {
        fire: vi.fn(),
        bus: { detachAllEvents: vi.fn() },
      },
      disableAllModes: vi.fn(),
    };
    const controller = new GeomanLifecycleController(geoman as never);

    await controller.addControls(controlsElement);
    await new GeomanLifecycleController(geoman as never).destroy();

    expect(geoman.control.createControls).toHaveBeenCalledWith(controlsElement);
    expect(geoman.disableAllModes).toHaveBeenCalledOnce();
    expect(geoman.control.onRemove).toHaveBeenCalledTimes(1);
    expect(geoman.mapAdapter.removeControl).not.toHaveBeenCalled();
  });

  it('cleans direct-mounted controls when destroy runs before Geoman is loaded', async () => {
    const controlsElement = {} as HTMLElement;
    const loadError = new Error('marker load failed');
    const geoman = {
      control: {
        createControls: vi.fn(),
        onRemove: vi.fn(),
      },
      mapAdapter: {
        mapInstance: {},
        addControl: vi.fn(),
        removeControl: vi.fn(),
        removeImage: vi.fn(),
        loadImage: vi.fn(() => Promise.reject(loadError)),
      },
      mapAdapterInstance: null,
      loaded: false,
      destroyed: false,
      features: {
        updateManager: { destroy: vi.fn() },
        sources: {},
      },
      decorators: { lines: { destroy: vi.fn() } },
      overlays: { html: { destroy: vi.fn() } },
      contextPanels: { destroy: vi.fn() },
      transactions: { destroy: vi.fn() },
      tools: { destroy: vi.fn() },
      selection: { destroy: vi.fn() },
      events: {
        fire: vi.fn(),
        bus: { detachAllEvents: vi.fn() },
      },
      disableAllModes: vi.fn(),
    };
    const controller = new GeomanLifecycleController(geoman as never);

    await expect(controller.addControls(controlsElement)).rejects.toBe(loadError);
    await new GeomanLifecycleController(geoman as never).destroy();

    expect(geoman.loaded).toBe(false);
    expect(geoman.control.createControls).toHaveBeenCalledWith(controlsElement);
    expect(geoman.disableAllModes).toHaveBeenCalledOnce();
    expect(geoman.control.onRemove).toHaveBeenCalledTimes(1);
    expect(geoman.mapAdapter.removeControl).not.toHaveBeenCalled();
    expect(geoman.events.bus.detachAllEvents).not.toHaveBeenCalled();
  });

  it('detaches remaining event bus handlers when loaded destroy removes controls', async () => {
    const geoman = {
      control: {},
      mapAdapter: {
        mapInstance: {},
        removeControl: vi.fn(),
        removeImage: vi.fn(),
      },
      mapAdapterInstance: null,
      loaded: true,
      destroyed: false,
      features: {
        updateManager: { destroy: vi.fn() },
        sources: {},
      },
      decorators: { lines: { destroy: vi.fn() } },
      overlays: { html: { destroy: vi.fn() } },
      contextPanels: { destroy: vi.fn() },
      transactions: { destroy: vi.fn() },
      tools: { destroy: vi.fn() },
      selection: { destroy: vi.fn() },
      events: {
        bus: { detachAllEvents: vi.fn() },
      },
      disableAllModes: vi.fn(),
    };
    const controller = new GeomanLifecycleController(geoman as never);

    await controller.destroy();

    expect(geoman.mapAdapter.removeControl).toHaveBeenCalledWith(geoman.control);
    expect(geoman.events.bus.detachAllEvents).toHaveBeenCalledOnce();
  });

  it('waits for the base map load event and resolves to the map', async () => {
    let loadListener: ((event: unknown) => void) | undefined;
    const map = {
      once: vi.fn((eventName: string, listener: (event: unknown) => void) => {
        if (eventName === 'load') {
          loadListener = listener;
        }
      }),
      off: vi.fn(),
    };
    const geoman = {
      mapAdapter: {
        mapInstance: map,
        isLoaded: vi.fn(() => false),
      },
    };
    const controller = new GeomanLifecycleController(geoman as never);

    const loadPromise = controller.waitForBaseMap();

    expect(map.once).toHaveBeenCalledWith('load', expect.any(Function));
    loadListener?.({});

    await expect(loadPromise).resolves.toBe(map);
  });

  it('keeps Geoman lifecycle methods on the prototype and delegates without exposing lifecycle state', async () => {
    const lifecycle = {
      addControls: vi.fn(() => Promise.resolve('addControls result')),
      waitForBaseMap: vi.fn(() => Promise.resolve('waitForBaseMap result')),
      waitForGeomanLoaded: vi.fn(() => Promise.resolve('waitForGeomanLoaded result')),
      init: vi.fn(() => Promise.resolve('init result')),
      destroy: vi.fn(() => Promise.resolve('destroy result')),
      removeControls: vi.fn(() => 'removeControls result'),
      onMapLoad: vi.fn(() => Promise.resolve('onMapLoad result')),
    };

    await withMainModule(async ({ mainModule, lifecycleModule }) => {
      const controllerPrototype = lifecycleModule.GeomanLifecycleController.prototype;
      const lifecycleSpies = {
        addControls: vi
          .spyOn(controllerPrototype, 'addControls')
          .mockImplementation(lifecycle.addControls),
        waitForBaseMap: vi
          .spyOn(controllerPrototype, 'waitForBaseMap')
          .mockImplementation(lifecycle.waitForBaseMap),
        waitForGeomanLoaded: vi
          .spyOn(controllerPrototype, 'waitForGeomanLoaded')
          .mockImplementation(lifecycle.waitForGeomanLoaded),
        init: vi.spyOn(controllerPrototype, 'init').mockImplementation(lifecycle.init),
        destroy: vi.spyOn(controllerPrototype, 'destroy').mockImplementation(lifecycle.destroy),
        removeControls: vi
          .spyOn(controllerPrototype, 'removeControls')
          .mockImplementation(lifecycle.removeControls),
        onMapLoad: vi
          .spyOn(controllerPrototype, 'onMapLoad')
          .mockImplementation(lifecycle.onMapLoad),
      };
      const geoman = Object.create(mainModule.Geoman.prototype) as GeomanLifecycleWrapperHost;

      try {
        expect('lifecycle' in geoman).toBe(false);
        expect('lifecycle' in mainModule.Geoman.prototype).toBe(false);

        const controlsElement = {} as HTMLElement;
        await expect(geoman.addControls(controlsElement)).resolves.toBe('addControls result');
        await expect(geoman.waitForBaseMap()).resolves.toBe('waitForBaseMap result');
        await expect(geoman.waitForGeomanLoaded()).resolves.toBe('waitForGeomanLoaded result');
        await expect(geoman.init()).resolves.toBe('init result');
        await expect(geoman.destroy({ removeSources: true })).resolves.toBe('destroy result');
        expect(geoman.removeControls()).toBe('removeControls result');
        await expect(geoman.onMapLoad()).resolves.toBe('onMapLoad result');

        expect(lifecycle.addControls).toHaveBeenCalledWith(controlsElement);
        expect(lifecycle.waitForBaseMap).toHaveBeenCalledWith();
        expect(lifecycle.waitForGeomanLoaded).toHaveBeenCalledWith();
        expect(lifecycle.init).toHaveBeenCalledWith();
        expect(lifecycle.destroy).toHaveBeenCalledWith({ removeSources: true });
        expect(lifecycle.removeControls).toHaveBeenCalledWith();
        expect(lifecycle.onMapLoad).toHaveBeenCalledWith();
        expect('lifecycle' in geoman).toBe(false);
      } finally {
        for (const spy of Object.values(lifecycleSpies)) {
          spy.mockRestore();
        }
      }
    });
  });

  it('creates Geoman instances through an awaited class factory', async () => {
    await withMainModule(async ({ mainModule, lifecycleModule }) => {
      const controllerPrototype = lifecycleModule.GeomanLifecycleController.prototype;
      const waitForBaseMapSpy = vi
        .spyOn(controllerPrototype, 'waitForBaseMap')
        .mockResolvedValue({} as never);
      const initSpy = vi.spyOn(controllerPrototype, 'init').mockResolvedValue(undefined as never);
      const waitForGeomanLoadedSpy = vi
        .spyOn(controllerPrototype, 'waitForGeomanLoaded')
        .mockImplementation(function (this: GeomanLifecycleWrapperHost) {
          return Promise.resolve(this);
        });

      try {
        const map = {};
        const options = { controls: { draw: { marker: { uiEnabled: false } } } };

        const geoman = await mainModule.Geoman.create(map, options);
        const helperGeoman = await mainModule.createGeomanInstance(map, options);

        expect(Object.getPrototypeOf(geoman)).toBe(mainModule.Geoman.prototype);
        expect(Object.getPrototypeOf(helperGeoman)).toBe(mainModule.Geoman.prototype);
        expect(waitForGeomanLoadedSpy).toHaveBeenCalledTimes(2);
      } finally {
        waitForGeomanLoadedSpy.mockRestore();
        initSpy.mockRestore();
        waitForBaseMapSpy.mockRestore();
      }
    });
  });

  it('rejects the awaited class factory when initialization does not load an instance', async () => {
    await withMainModule(async ({ mainModule, lifecycleModule }) => {
      const controllerPrototype = lifecycleModule.GeomanLifecycleController.prototype;
      const waitForBaseMapSpy = vi
        .spyOn(controllerPrototype, 'waitForBaseMap')
        .mockResolvedValue({} as never);
      const initSpy = vi.spyOn(controllerPrototype, 'init').mockResolvedValue(undefined as never);
      const waitForGeomanLoadedSpy = vi
        .spyOn(controllerPrototype, 'waitForGeomanLoaded')
        .mockResolvedValue(undefined);

      try {
        await expect(mainModule.Geoman.create({}, {})).rejects.toThrow(
          'Geoman initialization failed',
        );
      } finally {
        waitForGeomanLoadedSpy.mockRestore();
        initSpy.mockRestore();
        waitForBaseMapSpy.mockRestore();
      }
    });
  });
});

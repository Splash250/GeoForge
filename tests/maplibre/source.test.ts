import { MaplibreSource } from '@/core/map/maplibre/source.ts';
import { describe, expect, test, vi } from 'vitest';

type LayerStub = {
  id: string;
  source: string;
};

describe('MaplibreSource', () => {
  test('reports loaded state from the GeoJSON source instance when available', () => {
    const sourceInstance = { id: 'gm-source', loaded: vi.fn(() => true) };
    const mapInstance = {
      getSource: vi.fn(() => sourceInstance),
      isSourceLoaded: vi.fn(() => true),
    };
    const geoman = {
      mapAdapter: { mapInstance },
    };
    const source = new MaplibreSource({
      gm: geoman as never,
      sourceId: 'gm-source',
    });

    expect(source.loaded).toBe(true);
    expect(sourceInstance.loaded).toHaveBeenCalledOnce();
    expect(mapInstance.isSourceLoaded).not.toHaveBeenCalled();

    sourceInstance.loaded.mockReturnValue(false);

    expect(source.loaded).toBe(false);
  });

  test('returns false when loaded state is checked before source instance is available', () => {
    const mapInstance = {
      getSource: vi.fn(() => undefined),
      isSourceLoaded: vi.fn(),
    };
    const geoman = {
      mapAdapter: { mapInstance },
    };
    const source = new MaplibreSource({
      gm: geoman as never,
      sourceId: 'gm-source',
    });

    expect(source.loaded).toBe(false);
    expect(mapInstance.isSourceLoaded).not.toHaveBeenCalled();
  });

  test('does not probe map-level loaded state while the tile manager is not ready yet', () => {
    const sourceInstance = { id: 'gm-source', loaded: vi.fn(() => true) };
    const mapInstance = {
      getSource: vi.fn(() => sourceInstance),
      isSourceLoaded: vi.fn(() => {
        throw new Error("There is no tile manager with ID 'gm-source'");
      }),
    };
    const geoman = {
      mapAdapter: { mapInstance },
    };
    const source = new MaplibreSource({
      gm: geoman as never,
      sourceId: 'gm-source',
    });

    expect(source.loaded).toBe(true);
    expect(sourceInstance.loaded).toHaveBeenCalledOnce();
    expect(mapInstance.isSourceLoaded).not.toHaveBeenCalled();
  });

  test('returns true when a source stub exists without a loaded method', () => {
    const sourceInstance = { id: 'gm-source' };
    const mapInstance = {
      getSource: vi.fn(() => sourceInstance),
      isSourceLoaded: vi.fn(() => false),
    };
    const geoman = {
      mapAdapter: { mapInstance },
    };
    const source = new MaplibreSource({
      gm: geoman as never,
      sourceId: 'gm-source',
    });

    expect(source.loaded).toBe(true);
    expect(mapInstance.isSourceLoaded).not.toHaveBeenCalled();
  });

  test('returns false when MapLibre source is not ready yet', () => {
    const sourceInstance = {
      id: 'gm-source',
      loaded: vi.fn(() => {
        throw new Error("There is no source with ID 'gm-source'");
      }),
    };
    const mapInstance = {
      getSource: vi.fn(() => sourceInstance),
      isSourceLoaded: vi.fn(),
    };
    const geoman = {
      mapAdapter: { mapInstance },
    };
    const source = new MaplibreSource({
      gm: geoman as never,
      sourceId: 'gm-source',
    });

    expect(source.loaded).toBe(false);
    expect(mapInstance.isSourceLoaded).not.toHaveBeenCalled();
  });

  test('returns false when the source loaded check reports its tile manager is not ready yet', () => {
    const sourceInstance = {
      id: 'gm-source',
      loaded: vi.fn(() => {
        throw new Error("There is no tile manager with ID 'gm-source'");
      }),
    };
    const mapInstance = {
      getSource: vi.fn(() => sourceInstance),
      isSourceLoaded: vi.fn(),
    };
    const geoman = {
      mapAdapter: { mapInstance },
    };
    const source = new MaplibreSource({
      gm: geoman as never,
      sourceId: 'gm-source',
    });

    expect(source.loaded).toBe(false);
    expect(mapInstance.isSourceLoaded).not.toHaveBeenCalled();
  });

  test('rethrows readiness errors for a different source ID', () => {
    const sourceInstance = {
      id: 'gm-source',
      loaded: vi.fn(() => {
        throw new Error("There is no tile manager with ID 'other-source'");
      }),
    };
    const mapInstance = {
      getSource: vi.fn(() => sourceInstance),
      isSourceLoaded: vi.fn(),
    };
    const geoman = {
      mapAdapter: { mapInstance },
    };
    const source = new MaplibreSource({
      gm: geoman as never,
      sourceId: 'gm-source',
    });

    expect(() => source.loaded).toThrow("There is no tile manager with ID 'other-source'");
    expect(mapInstance.isSourceLoaded).not.toHaveBeenCalled();
  });

  test('rethrows unexpected MapLibre loaded state errors', () => {
    const sourceInstance = {
      id: 'gm-source',
      loaded: vi.fn(() => {
        throw new Error('Unexpected MapLibre failure');
      }),
    };
    const mapInstance = {
      getSource: vi.fn(() => sourceInstance),
      isSourceLoaded: vi.fn(),
    };
    const geoman = {
      mapAdapter: { mapInstance },
    };
    const source = new MaplibreSource({
      gm: geoman as never,
      sourceId: 'gm-source',
    });

    expect(() => source.loaded).toThrow('Unexpected MapLibre failure');
    expect(mapInstance.isSourceLoaded).not.toHaveBeenCalled();
  });

  test('rethrows nonmatching non-Error loaded state objects', () => {
    const thrownValue = { message: 'Unexpected MapLibre failure' };
    const sourceInstance = {
      id: 'gm-source',
      loaded: vi.fn(() => {
        throw thrownValue;
      }),
    };
    const mapInstance = {
      getSource: vi.fn(() => sourceInstance),
      isSourceLoaded: vi.fn(),
    };
    const geoman = {
      mapAdapter: { mapInstance },
    };
    const source = new MaplibreSource({
      gm: geoman as never,
      sourceId: 'gm-source',
    });

    let caughtValue: unknown;
    try {
      source.loaded;
    } catch (error) {
      caughtValue = error;
    }

    expect(caughtValue).toBe(thrownValue);
  });

  test('removes layers and source only once', () => {
    const layer: LayerStub = { id: 'gm-layer', source: 'gm-source' };
    const sourceInstance = {
      id: 'gm-source',
      serialize: vi.fn(),
      setData: vi.fn(),
      updateData: vi.fn(),
    };
    const mapInstance = {
      getSource: vi.fn((sourceId: string) =>
        sourceId === 'gm-source' ? sourceInstance : undefined,
      ),
      removeSource: vi.fn(),
    };
    const geoman = {
      mapAdapter: {
        mapInstance,
        eachLayer: vi.fn((callback: (layer: LayerStub) => void) => callback(layer)),
        removeLayer: vi.fn(),
      },
    };
    const source = new MaplibreSource({
      gm: geoman as never,
      sourceId: 'gm-source',
    });

    source.remove();
    source.remove();

    expect(geoman.mapAdapter.removeLayer).toHaveBeenCalledOnce();
    expect(geoman.mapAdapter.removeLayer).toHaveBeenCalledWith('gm-layer');
    expect(mapInstance.removeSource).toHaveBeenCalledOnce();
    expect(mapInstance.removeSource).toHaveBeenCalledWith('gm-source');
  });
});

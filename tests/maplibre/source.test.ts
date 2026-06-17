import { MaplibreSource } from '@/core/map/maplibre/source.ts';
import { describe, expect, test, vi } from 'vitest';

type LayerStub = {
  id: string;
  source: string;
};

describe('MaplibreSource', () => {
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

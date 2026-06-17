import { describe, expect, it, vi } from 'vitest';
import { ArrowheadManager } from '../../../../src/decorators/line/arrowheads/index.ts';
import type { ArrowheadOptions } from '../../../../src/decorators/line/arrowheads/types.ts';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { FeatureCollection } from 'geojson';

type GeoJsonSourceInput = { data: FeatureCollection };
type SourceWithSetData = { setData: (data: FeatureCollection) => void };
type LayerLike = { id: string };

function createMapStub() {
  const sources = new Map<string, FeatureCollection>();
  const layers = new Set<string>();

  const mapStub = {
    addSource: vi.fn((id: string, source: GeoJsonSourceInput) => {
      sources.set(id, source.data);
    }),
    getSource: vi.fn((id: string): SourceWithSetData | undefined => {
      if (!sources.has(id)) {
        return undefined;
      }
      return {
        setData: vi.fn((data: FeatureCollection) => {
          sources.set(id, data);
        }),
      };
    }),
    removeSource: vi.fn((id: string) => {
      sources.delete(id);
    }),
    addLayer: vi.fn((layer: LayerLike) => {
      layers.add(layer.id);
    }),
    getLayer: vi.fn((id: string): LayerLike | undefined => (layers.has(id) ? { id } : undefined)),
    removeLayer: vi.fn((id: string) => {
      layers.delete(id);
    }),
    project: ({ lng, lat }: { lng: number; lat: number }) => ({
      x: lng,
      y: lat,
    }),
    unproject: ([x, y]: [number, number]) => ({ lng: x, lat: y }),
  } as unknown as MapLibreMap;

  return mapStub;
}

describe('ArrowheadManager', () => {
  it('ensures and clears sources/layers', () => {
    const map = createMapStub();
    const manager = new ArrowheadManager({ map });

    manager.update(
      {
        type: 'LineString',
        coordinates: [
          [0, 0],
          [1, 0],
        ],
      },
      {},
    );

    const ids = manager.getSourceIds();
    expect(ids.sourceId).toBeDefined();
    manager.clear();
    manager.destroy();

    expect(map.getSource(ids.sourceId)).toBeUndefined();
  });

  it('builds arrowheads from multiple features', () => {
    const map = createMapStub();
    const manager = new ArrowheadManager({ map });

    manager.updateFromFeatures(
      [
        {
          type: 'Feature',
          id: 'a',
          properties: { arrowheads: { frequency: 'endonly' } },
          geometry: {
            type: 'LineString',
            coordinates: [
              [0, 0],
              [1, 0],
            ],
          },
        },
        {
          type: 'Feature',
          id: 'b',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: [
              [0, 0],
              [0, 1],
            ],
          },
        },
      ],
      (feature) => feature.properties?.arrowheads as ArrowheadOptions | undefined,
    );

    const ids = manager.getSourceIds();
    const source = map.getSource(ids.sourceId);
    expect(source).toBeDefined();

    manager.destroy();
  });
});

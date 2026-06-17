import { LineEndpointConnectionPreviewRenderer } from '@/geometry/lineEndpointConnectionPreviewRenderer.ts';
import type { FeatureData } from '@/core/features/feature-data.ts';
import type {
  GeomanLineEndpointConnectionPreview,
  GeomanLineEndpointConnectionPreviewRenderOptions,
} from '@/geometry/types.ts';
import type { LngLatTuple } from '@/types/map/index.ts';
import { describe, expect, test, vi } from 'vitest';

const createMap = () => {
  const sources = new Map<string, { setData: ReturnType<typeof vi.fn>; data?: unknown }>();
  const layers = new Set<string>();

  return {
    getSource: vi.fn((id: string) => sources.get(id)),
    addSource: vi.fn((id: string, source: { data: unknown }) => {
      sources.set(id, {
        setData: vi.fn((data) => {
          sources.get(id)!.data = data;
        }),
        data: source.data,
      });
    }),
    removeSource: vi.fn((id: string) => {
      sources.delete(id);
    }),
    getLayer: vi.fn((id: string) => (layers.has(id) ? { id } : undefined)),
    addLayer: vi.fn((layer: { id: string }) => {
      layers.add(layer.id);
    }),
    removeLayer: vi.fn((id: string) => {
      layers.delete(id);
    }),
    __sources: sources,
    __layers: layers,
  };
};

const createFeature = (coordinates: Array<LngLatTuple>, id = 'line-a') =>
  ({
    id,
    sourceName: 'gm_main',
    getGeoJson: vi.fn(() => ({
      type: 'Feature',
      id,
      properties: { shape: 'line' },
      geometry: {
        type: 'LineString',
        coordinates,
      },
    })),
  }) as unknown as FeatureData;

const createPreview = (): GeomanLineEndpointConnectionPreview => {
  const lineA = createFeature([
    [0, 0],
    [1, 0],
  ]);
  const lineB = createFeature(
    [
      [1.1, 0],
      [2, 0],
    ],
    'line-b',
  );

  return {
    from: { feature: lineA, endpoint: 'end' },
    to: {
      feature: lineB,
      featureId: 'line-b',
      sourceName: 'gm_main',
      partIndex: null,
      endpoint: 'start',
      vertexIndex: 0,
      coordinate: [1.1, 0],
      nodeKey: '1.1,0',
      distancePixels: 2,
    },
    connection: {
      updates: [
        {
          feature: lineA,
          geometry: {
            type: 'LineString',
            coordinates: [
              [0, 0],
              [1.1, 0],
            ],
          },
          properties: {},
        },
      ],
    },
  };
};

describe('LineEndpointConnectionPreviewRenderer', () => {
  test('renders a guide source and layer from preview endpoint data', () => {
    const map = createMap();
    const renderer = new LineEndpointConnectionPreviewRenderer({ getMap: () => map as never });

    renderer.render(createPreview());

    expect(map.addSource).toHaveBeenCalledWith('gm:line-endpoint-preview', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [],
      },
    });
    expect(map.addLayer).toHaveBeenCalledWith({
      id: 'gm:line-endpoint-preview-layer',
      type: 'line',
      source: 'gm:line-endpoint-preview',
      paint: {
        'line-color': '#0ea5e9',
        'line-width': 3,
        'line-opacity': 0.85,
        'line-dasharray': [2, 1],
      },
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
    });
    expect(map.__sources.get('gm:line-endpoint-preview')?.setData).toHaveBeenLastCalledWith({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {
            role: 'line-endpoint-connection-preview',
            fromEndpoint: 'end',
            toEndpoint: 'start',
          },
          geometry: {
            type: 'LineString',
            coordinates: [
              [1, 0],
              [1.1, 0],
            ],
          },
        },
      ],
    });
  });

  test('clears preview data without removing reusable source and layer', () => {
    const map = createMap();
    const renderer = new LineEndpointConnectionPreviewRenderer({ getMap: () => map as never });

    renderer.render(createPreview());
    renderer.clear();

    expect(map.removeLayer).not.toHaveBeenCalled();
    expect(map.removeSource).not.toHaveBeenCalled();
    expect(map.__sources.get('gm:line-endpoint-preview')?.setData).toHaveBeenLastCalledWith({
      type: 'FeatureCollection',
      features: [],
    });
  });

  test('destroys preview source and layer', () => {
    const map = createMap();
    const renderer = new LineEndpointConnectionPreviewRenderer({ getMap: () => map as never });

    renderer.render(createPreview());
    renderer.destroy();

    expect(map.removeLayer).toHaveBeenCalledWith('gm:line-endpoint-preview-layer');
    expect(map.removeSource).toHaveBeenCalledWith('gm:line-endpoint-preview');
  });

  test('supports custom ids and style options', () => {
    const map = createMap();
    const renderer = new LineEndpointConnectionPreviewRenderer({ getMap: () => map as never });
    const options: GeomanLineEndpointConnectionPreviewRenderOptions = {
      ids: { sourceId: 'custom-source', layerId: 'custom-layer' },
      style: { color: '#ef4444', width: 5, opacity: 0.5, dasharray: [1, 1] },
    };

    renderer.render(createPreview(), options);

    expect(map.addSource).toHaveBeenCalledWith('custom-source', expect.any(Object));
    expect(map.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'custom-layer',
        source: 'custom-source',
        paint: {
          'line-color': '#ef4444',
          'line-width': 5,
          'line-opacity': 0.5,
          'line-dasharray': [1, 1],
        },
      }),
    );
  });

  test('adds a new preview layer before the requested existing layer', () => {
    const map = createMap();
    const renderer = new LineEndpointConnectionPreviewRenderer({ getMap: () => map as never });

    renderer.render(createPreview(), { beforeId: 'existing-label-layer' });

    expect(map.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'gm:line-endpoint-preview-layer',
      }),
      'existing-label-layer',
    );
  });

  test('does not reorder an existing preview layer when beforeId changes', () => {
    const map = createMap();
    const renderer = new LineEndpointConnectionPreviewRenderer({ getMap: () => map as never });

    renderer.render(createPreview(), { beforeId: 'first-anchor-layer' });
    renderer.render(createPreview(), { beforeId: 'second-anchor-layer' });

    expect(map.addLayer).toHaveBeenCalledTimes(1);
    expect(map.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'gm:line-endpoint-preview-layer',
      }),
      'first-anchor-layer',
    );
  });
});

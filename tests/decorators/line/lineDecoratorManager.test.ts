import { describe, expect, it, vi } from 'vitest';
import { LineDecoratorManager } from '../../../src/decorators/line/index.ts';
import type { FeatureCollection } from 'geojson';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { Geoman } from '../../../src/main.ts';

type GeoJsonSourceInput = { data: FeatureCollection };
type SourceWithSetData = { setData: (data: FeatureCollection) => void };
type LayerLike = { id: string };

function createMapStub() {
  const sources = new Map<string, FeatureCollection>();
  const layers = new Set<string>();
  const layerOrder: string[] = [];

  return {
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
    addLayer: vi.fn((layer: LayerLike, beforeId?: string) => {
      layers.add(layer.id);
      if (beforeId && layerOrder.includes(beforeId)) {
        layerOrder.splice(layerOrder.indexOf(beforeId), 0, layer.id);
        return;
      }
      layerOrder.push(layer.id);
    }),
    getLayer: vi.fn((id: string): LayerLike | undefined => (layers.has(id) ? { id } : undefined)),
    getStyle: vi.fn(() => ({
      layers: layerOrder.map((id) => ({
        id,
        type: id.includes('__line-layer') ? 'line' : 'symbol',
      })),
    })),
    removeLayer: vi.fn((id: string) => {
      layers.delete(id);
      const index = layerOrder.indexOf(id);
      if (index >= 0) {
        layerOrder.splice(index, 1);
      }
    }),
    project: ({ lng, lat }: { lng: number; lat: number }) => ({
      x: lng,
      y: lat,
    }),
    unproject: ([x, y]: [number, number]) => ({ lng: x, lat: y }),
    __sources: sources,
    __layers: layers,
    __layerOrder: layerOrder,
  } as unknown as MapLibreMap & {
    __sources: Map<string, FeatureCollection>;
    __layers: Set<string>;
    __layerOrder: string[];
  };
}

describe('LineDecoratorManager', () => {
  it('renders arrowhead decorators through the generic line decorator API', () => {
    const map = createMapStub();
    const manager = new LineDecoratorManager({ map });

    manager.updateFromFeatures(
      [
        {
          type: 'Feature',
          id: 'line-1',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: [
              [0, 0],
              [1, 0],
            ],
          },
        },
      ],
      () => [{ kind: 'arrowhead', frequency: 'endonly', size: '8px' }],
    );

    expect(manager.getArrowheadSourceIds().sourceId).toBe('gm:line-decorators:arrowheads');
    expect(map.getSource(manager.getArrowheadSourceIds().sourceId)).toBeDefined();

    manager.destroy();
  });

  it('does not render undecorated lines through the generic API', () => {
    const map = createMapStub();
    const manager = new LineDecoratorManager({ map });

    manager.updateFromFeatures(
      [
        {
          type: 'Feature',
          id: 'line-1',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: [
              [0, 0],
              [1, 0],
            ],
          },
        },
      ],
      () => [],
    );

    const source = map.getSource(manager.getArrowheadSourceIds().sourceId);
    expect(source).toBeDefined();

    manager.destroy();
  });

  it('delegates symbol decorators to registered renderers', () => {
    const map = createMapStub();
    const renderer = {
      kind: 'symbol' as const,
      update: vi.fn(),
      clear: vi.fn(),
      destroy: vi.fn(),
    };
    const manager = new LineDecoratorManager({ map, renderers: [renderer] });

    const feature = {
      type: 'Feature' as const,
      id: 'line-1',
      properties: {},
      geometry: {
        type: 'LineString' as const,
        coordinates: [
          [0, 0],
          [1, 0],
        ],
      },
    };

    manager.updateFromFeatures([feature], () => [
      {
        kind: 'symbol',
        imageId: 'line-arrow',
        frequency: 'endonly',
        rotate: { mode: 'line' },
      },
    ]);

    expect(renderer.update).toHaveBeenCalledWith([
      {
        feature,
        decorator: expect.objectContaining({ kind: 'symbol', imageId: 'line-arrow' }),
      },
    ]);
  });

  it('passes line layer positioning to default symbol and text renderers', () => {
    const map = createMapStub();
    map.__layers.add('basemap');
    map.__layers.add('gm_main-line__line-layer-0');
    map.__layers.add('gm_temporary-line__line-layer-0');
    map.__layerOrder.push(
      'basemap',
      'gm_main-line__line-layer-0',
      'gm_temporary-line__line-layer-0',
    );
    const manager = new LineDecoratorManager({ map, layerPosition: 'below-lines' });

    manager.updateFromFeatures(
      [
        {
          type: 'Feature',
          id: 'line-1',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: [
              [0, 0],
              [1, 0],
            ],
          },
        },
      ],
      () => [
        { kind: 'symbol', imageId: 'line-arrow', frequency: 'endonly' },
        { kind: 'text', text: 'DN 300', frequency: 'endonly' },
      ],
    );

    expect(map.__layerOrder).toEqual([
      'basemap',
      'gm:line-decorators:arrowheads-fill',
      'gm:line-decorators:arrowheads-line',
      'gm:line-decorators:symbols-layer',
      'gm:line-decorators:text-layer',
      'gm:line-decorators:text-viewport-layer',
      'gm_main-line__line-layer-0',
      'gm_temporary-line__line-layer-0',
    ]);

    manager.destroy();
  });

  it('delegates text decorators to registered renderers', () => {
    const map = createMapStub();
    const renderer = {
      kind: 'text' as const,
      update: vi.fn(),
      clear: vi.fn(),
      destroy: vi.fn(),
    };
    const manager = new LineDecoratorManager({ map, renderers: [renderer] });

    const feature = {
      type: 'Feature' as const,
      id: 'line-1',
      properties: {},
      geometry: {
        type: 'LineString' as const,
        coordinates: [
          [0, 0],
          [1, 0],
        ],
      },
    };

    manager.updateFromFeatures([feature], () => [
      {
        kind: 'text',
        text: 'DN 300',
        frequency: 'single',
        rotate: { mode: 'line' },
      },
    ]);

    expect(renderer.update).toHaveBeenCalledWith([
      {
        feature,
        decorator: expect.objectContaining({ kind: 'text', text: 'DN 300' }),
      },
    ]);
  });

  it('uses the first arrowhead decorator for a feature', () => {
    const map = createMapStub();
    const manager = new LineDecoratorManager({ map });
    const feature = {
      type: 'Feature' as const,
      id: 'line-1',
      properties: {},
      geometry: {
        type: 'LineString' as const,
        coordinates: [
          [0, 0],
          [1, 0],
        ],
      },
    };

    manager.updateFromFeatures([feature], () => [
      { kind: 'arrowhead', frequency: 'endonly', size: '8px' },
      { kind: 'arrowhead', frequency: 'endonly', size: '20px' },
    ]);

    const source = map.__sources.get(manager.getArrowheadSourceIds().sourceId);
    expect(source?.features).toHaveLength(1);

    manager.destroy();
  });

  it('clears and destroys registered renderers', () => {
    const map = createMapStub();
    const renderer = {
      kind: 'symbol' as const,
      update: vi.fn(),
      clear: vi.fn(),
      destroy: vi.fn(),
    };
    const manager = new LineDecoratorManager({ map, renderers: [renderer] });

    manager.clear();
    manager.destroy();

    expect(renderer.clear).toHaveBeenCalledTimes(1);
    expect(renderer.destroy).toHaveBeenCalledTimes(1);
  });

  it('binds to Geoman render updates so decorators follow edited geometry', () => {
    const listeners = new Map<string, () => void>();
    const eventedMap = {
      on: vi.fn((eventName: string, listener: () => void) => {
        listeners.set(eventName, listener);
      }),
      off: vi.fn((eventName: string) => {
        listeners.delete(eventName);
      }),
    };
    const feature = {
      type: 'Feature' as const,
      id: 'line-1',
      properties: {},
      geometry: {
        type: 'LineString' as const,
        coordinates: [
          [0, 0],
          [1, 0],
        ],
      },
    };
    const geoman = {
      destroyed: false,
      mapAdapter: {
        getMapInstance: () => eventedMap,
      },
      features: {
        featureStore: new Map([
          [
            'line-1',
            {
              shape: 'line',
              temporary: true,
              getGeoJson: () => feature,
            },
          ],
        ]),
      },
    } as unknown as Geoman;
    const map = createMapStub();
    const renderer = {
      kind: 'symbol' as const,
      update: vi.fn(),
      clear: vi.fn(),
      destroy: vi.fn(),
    };
    const manager = new LineDecoratorManager({ map, renderers: [renderer] });

    manager.bindToGeoman({
      geoman,
      resolveDecorators: () => [
        {
          kind: 'symbol',
          imageId: 'line-arrow',
          frequency: 'endonly',
        },
      ],
    });

    expect(eventedMap.on).toHaveBeenCalledWith('render', expect.any(Function));
    expect(renderer.update).toHaveBeenCalledWith([
      {
        feature,
        decorator: expect.objectContaining({ kind: 'symbol', imageId: 'line-arrow' }),
      },
    ]);

    renderer.update.mockClear();
    feature.geometry.coordinates = [
      [0, 0],
      [2, 0],
    ];
    listeners.get('render')?.();

    expect(renderer.update).toHaveBeenCalledWith([
      {
        feature,
        decorator: expect.objectContaining({ kind: 'symbol', imageId: 'line-arrow' }),
      },
    ]);

    manager.destroy();

    expect(eventedMap.off).toHaveBeenCalledWith('render', expect.any(Function));
  });

  it('binds to Geoman with configured source names only', () => {
    const eventedMap = {
      on: vi.fn(),
      off: vi.fn(),
    };
    const mainFeature = {
      type: 'Feature' as const,
      id: 'main-line',
      properties: {},
      geometry: {
        type: 'LineString' as const,
        coordinates: [
          [0, 0],
          [1, 0],
        ],
      },
    };
    const temporaryFeature = {
      type: 'Feature' as const,
      id: 'temporary-line',
      properties: {},
      geometry: {
        type: 'LineString' as const,
        coordinates: [
          [1, 0],
          [2, 0],
        ],
      },
    };
    const geoman = {
      destroyed: false,
      mapAdapter: {
        getMapInstance: () => eventedMap,
      },
      features: {
        featureStore: new Map([
          [
            'gm_main:main-line',
            {
              shape: 'line',
              sourceName: 'gm_main',
              getGeoJson: () => mainFeature,
            },
          ],
          [
            'gm_temporary:temporary-line',
            {
              shape: 'line',
              sourceName: 'gm_temporary',
              getGeoJson: () => temporaryFeature,
            },
          ],
        ]),
      },
    } as unknown as Geoman;
    const map = createMapStub();
    const renderer = {
      kind: 'symbol' as const,
      update: vi.fn(),
      clear: vi.fn(),
      destroy: vi.fn(),
    };
    const manager = new LineDecoratorManager({ map, renderers: [renderer] });

    manager.bindToGeoman({
      geoman,
      sourceNames: ['gm_main'],
      resolveDecorators: () => [
        {
          kind: 'symbol',
          imageId: 'line-arrow',
          frequency: 'endonly',
        },
      ],
    });

    expect(renderer.update).toHaveBeenCalledWith([
      {
        feature: mainFeature,
        decorator: expect.objectContaining({ kind: 'symbol', imageId: 'line-arrow' }),
      },
    ]);
  });
});

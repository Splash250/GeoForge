import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FeatureCollection } from 'geojson';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { LineDecoratorManager } from '../../../../src/decorators/line/index.ts';
import { SymbolDecoratorRenderer } from '../../../../src/decorators/line/symbols/index.ts';
import type { LineSymbolDecoratorOptions } from '../../../../src/decorators/line/types.ts';

type GeoJsonSourceInput = { data: FeatureCollection };
type SourceWithSetData = { setData: (data: FeatureCollection) => void };
type LayerLike = { id: string };

function createMapStub() {
  const sources = new Map<string, FeatureCollection>();
  const layers = new Map<string, unknown>();
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
      layers.set(layer.id, layer);
      if (beforeId && layerOrder.includes(beforeId)) {
        layerOrder.splice(layerOrder.indexOf(beforeId), 0, layer.id);
        return;
      }
      layerOrder.push(layer.id);
    }),
    getLayer: vi.fn((id: string) => layers.get(id)),
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
    project: ({ lng, lat }: { lng: number; lat: number }) => ({ x: lng, y: lat }),
    unproject: ([x, y]: [number, number]) => ({ lng: x, lat: y }),
    __sources: sources,
    __layers: layers,
    __layerOrder: layerOrder,
  } as unknown as MapLibreMap & {
    __sources: Map<string, FeatureCollection>;
    __layers: Map<string, unknown>;
    __layerOrder: string[];
  };
}

describe('SymbolDecoratorRenderer', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('creates symbol features with line-following bearings', () => {
    const map = createMapStub();
    const renderer = new SymbolDecoratorRenderer({ map });

    renderer.update([
      {
        feature: {
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
        decorator: {
          kind: 'symbol',
          imageId: 'line-arrow',
          frequency: 'endonly',
          rotate: { mode: 'line' },
        },
      },
    ]);

    const source = map.__sources.get('gm:line-decorators:symbols');
    expect(source?.features).toHaveLength(1);
    expect(source?.features[0].properties).toEqual(
      expect.objectContaining({
        parentId: 'line-1',
        imageId: 'line-arrow',
        rotationMode: 'line',
      }),
    );
    expect(map.__layers.get('gm:line-decorators:symbols-layer')).toBeDefined();
  });

  it('uses fixed rotation angle when configured', () => {
    const map = createMapStub();
    const renderer = new SymbolDecoratorRenderer({ map });

    renderer.update([
      {
        feature: {
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
        decorator: {
          kind: 'symbol',
          imageId: 'line-arrow',
          frequency: 'endonly',
          rotate: { mode: 'fixed', angle: 45 },
        },
      },
    ]);

    const source = map.__sources.get('gm:line-decorators:symbols');
    expect(source?.features[0].properties?.rotate).toBe(45);
  });

  it('creates a MapLibre symbol layer with icon layout and opacity paint', () => {
    const map = createMapStub();
    new SymbolDecoratorRenderer({ map });

    const layer = map.__layers.get('gm:line-decorators:symbols-layer');
    expect(layer).toEqual(
      expect.objectContaining({
        id: 'gm:line-decorators:symbols-layer',
        type: 'symbol',
        source: 'gm:line-decorators:symbols',
        layout: expect.objectContaining({
          'icon-image': ['get', 'imageId'],
          'icon-size': ['coalesce', ['get', 'size'], 1],
          'icon-rotate': ['coalesce', ['get', 'rotate'], ['get', 'bearing'], 0],
          'icon-rotation-alignment': 'map',
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        }),
        paint: expect.objectContaining({
          'icon-color': ['coalesce', ['get', 'color'], '#ffffff'],
          'icon-opacity': ['coalesce', ['get', 'opacity'], 1],
        }),
      }),
    );
  });

  it('can place symbol decorators below Geoman line layers', () => {
    const map = createMapStub();
    map.__layers.set('basemap', { id: 'basemap' });
    map.__layers.set('gm_main-line__line-layer-0', { id: 'gm_main-line__line-layer-0' });
    map.__layers.set('gm_temporary-line__line-layer-0', {
      id: 'gm_temporary-line__line-layer-0',
    });
    map.__layerOrder.push(
      'basemap',
      'gm_main-line__line-layer-0',
      'gm_temporary-line__line-layer-0',
    );

    new SymbolDecoratorRenderer({ map, layerPosition: 'below-lines' });

    expect(map.__layerOrder).toEqual([
      'basemap',
      'gm:line-decorators:symbols-layer',
      'gm_main-line__line-layer-0',
      'gm_temporary-line__line-layer-0',
    ]);
  });

  it('can place symbol decorators above Geoman line layers', () => {
    const map = createMapStub();
    map.__layers.set('basemap', { id: 'basemap' });
    map.__layers.set('gm_main-line__line-layer-0', { id: 'gm_main-line__line-layer-0' });
    map.__layers.set('gm_temporary-line__line-layer-0', {
      id: 'gm_temporary-line__line-layer-0',
    });
    map.__layers.set('gm_main-marker__symbol-layer-0', { id: 'gm_main-marker__symbol-layer-0' });
    map.__layerOrder.push(
      'basemap',
      'gm_main-line__line-layer-0',
      'gm_temporary-line__line-layer-0',
      'gm_main-marker__symbol-layer-0',
    );

    new SymbolDecoratorRenderer({ map, layerPosition: 'above-lines' });

    expect(map.__layerOrder).toEqual([
      'basemap',
      'gm_main-line__line-layer-0',
      'gm_temporary-line__line-layer-0',
      'gm:line-decorators:symbols-layer',
      'gm_main-marker__symbol-layer-0',
    ]);
  });

  it('recreates the source and layer when they disappear before an update', () => {
    const map = createMapStub();
    const renderer = new SymbolDecoratorRenderer({ map });
    const ids = renderer.getSourceIds();

    map.__layers.delete(ids.layerId);
    map.__sources.delete(ids.sourceId);

    renderer.update([
      {
        feature: {
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
        decorator: {
          kind: 'symbol',
          imageId: 'line-arrow',
          frequency: 'endonly',
        },
      },
    ]);

    expect(map.__layers.get(ids.layerId)).toBeDefined();
    expect(map.__sources.get(ids.sourceId)?.features).toHaveLength(1);
  });

  it('sanitizes expression-valued options before writing feature properties', () => {
    const map = createMapStub();
    const renderer = new SymbolDecoratorRenderer({ map });

    renderer.update([
      {
        feature: {
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
        decorator: {
          kind: 'symbol',
          imageId: 'line-arrow',
          frequency: 'endonly',
          size: ['get', 'size'],
          opacity: ['get', 'opacity'],
          color: ['get', 'color'],
          rotate: { mode: 'fixed', angle: ['get', 'angle'] },
        } as unknown as LineSymbolDecoratorOptions,
      },
    ]);

    const source = map.__sources.get('gm:line-decorators:symbols');
    expect(source?.features[0].properties).toEqual(
      expect.objectContaining({
        rotate: 0,
        size: 1,
        opacity: 1,
        color: '#ffffff',
      }),
    );
  });

  it('animates configured symbol properties over time', () => {
    const animationFrames: FrameRequestCallback[] = [];
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((callback: FrameRequestCallback) => {
        animationFrames.push(callback);
        return animationFrames.length;
      }),
    );
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const map = createMapStub();
    const renderer = new SymbolDecoratorRenderer({ map });

    renderer.update([
      {
        feature: {
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
        decorator: {
          kind: 'symbol',
          imageId: 'line-arrow',
          frequency: 'endonly',
          rotate: { mode: 'fixed', angle: 0 },
          animation: {
            property: 'rotate',
            from: 0,
            to: 90,
            durationMs: 1000,
            easing: 'linear',
          },
        },
      },
    ]);

    expect(map.__sources.get('gm:line-decorators:symbols')?.features[0].properties?.rotate).toBe(0);

    animationFrames.shift()?.(0);
    animationFrames.shift()?.(500);

    expect(map.__sources.get('gm:line-decorators:symbols')?.features[0].properties?.rotate).toBe(
      45,
    );
  });

  it('keeps symbol animation timeline when line geometry updates', () => {
    const animationFrames: FrameRequestCallback[] = [];
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((callback: FrameRequestCallback) => {
        animationFrames.push(callback);
        return animationFrames.length;
      }),
    );
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const map = createMapStub();
    const renderer = new SymbolDecoratorRenderer({ map });
    const decorator: LineSymbolDecoratorOptions = {
      kind: 'symbol',
      imageId: 'line-arrow',
      frequency: 'endonly',
      rotate: { mode: 'fixed', angle: 0 },
      animation: {
        property: 'rotate',
        from: 0,
        to: 90,
        durationMs: 1000,
        easing: 'linear',
      },
    };

    renderer.update([
      {
        feature: {
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
        decorator,
      },
    ]);

    animationFrames.shift()?.(0);
    animationFrames.shift()?.(500);

    renderer.update([
      {
        feature: {
          type: 'Feature',
          id: 'line-1',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: [
              [0, 0],
              [2, 0],
            ],
          },
        },
        decorator,
      },
    ]);

    animationFrames.shift()?.(750);
    const feature = map.__sources.get('gm:line-decorators:symbols')?.features[0];

    expect(feature?.geometry).toMatchObject({
      type: 'Point',
      coordinates: [2, 0],
    });
    expect(feature?.properties?.rotate).toBe(67.5);
  });

  it('clears and destroys symbol resources', () => {
    const map = createMapStub();
    const renderer = new SymbolDecoratorRenderer({ map });
    renderer.clear();
    renderer.destroy();

    expect(map.getSource('gm:line-decorators:symbols')).toBeUndefined();
  });

  it('is registered by the line decorator manager by default', () => {
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
      {
        kind: 'symbol',
        imageId: 'line-arrow',
        frequency: 'endonly',
      },
    ]);

    expect(map.__sources.get('gm:line-decorators:symbols')?.features).toHaveLength(1);

    manager.destroy();
  });
});

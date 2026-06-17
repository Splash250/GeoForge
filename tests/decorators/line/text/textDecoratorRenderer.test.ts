import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FeatureCollection } from 'geojson';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { LineDecoratorManager } from '../../../../src/decorators/line/index.ts';
import { TextDecoratorRenderer } from '../../../../src/decorators/line/text/index.ts';
import type { LineTextDecoratorOptions } from '../../../../src/decorators/line/types.ts';

type GeoJsonSourceInput = { data: FeatureCollection };
type SourceWithSetData = { setData: (data: FeatureCollection) => void };
type LayerLike = { id: string };

function createMapStub() {
  const sources = new Map<string, FeatureCollection>();
  const layers = new Map<string, unknown>();

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
    addLayer: vi.fn((layer: LayerLike) => {
      layers.set(layer.id, layer);
    }),
    getLayer: vi.fn((id: string) => layers.get(id)),
    removeLayer: vi.fn((id: string) => {
      layers.delete(id);
    }),
    project: ({ lng, lat }: { lng: number; lat: number }) => ({ x: lng, y: lat }),
    unproject: ([x, y]: [number, number]) => ({ lng: x, lat: y }),
    __sources: sources,
    __layers: layers,
  } as unknown as MapLibreMap & {
    __sources: Map<string, FeatureCollection>;
    __layers: Map<string, unknown>;
  };
}

describe('TextDecoratorRenderer', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('creates text features with line-following rotation and styling properties', () => {
    const map = createMapStub();
    const renderer = new TextDecoratorRenderer({ map });

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
          kind: 'text',
          id: 'text-1',
          text: 'DN 300',
          frequency: 'single',
          rotate: { mode: 'line', angle: 10 },
          fontSize: 14,
          color: '#111827',
          opacity: 0.85,
          haloColor: '#ffffff',
          haloWidth: 2,
          haloBlur: 0.5,
        },
      },
    ]);

    const source = map.__sources.get('gm:line-decorators:text');
    expect(source?.features).toHaveLength(1);
    expect(source?.features[0].properties).toEqual(
      expect.objectContaining({
        parentId: 'line-1',
        decoratorId: 'text-1',
        text: 'DN 300',
        rotationMode: 'line',
        rotate: expect.any(Number),
        fontSize: 14,
        color: '#111827',
        opacity: 0.85,
        haloColor: '#ffffff',
        haloWidth: 2,
        haloBlur: 0.5,
      }),
    );
    expect(source?.features[0].properties).not.toHaveProperty('allowOverlap');
    expect(source?.features[0].properties).not.toHaveProperty('ignorePlacement');
  });

  it('uses fixed rotation angle when configured', () => {
    const map = createMapStub();
    const renderer = new TextDecoratorRenderer({ map });

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
          kind: 'text',
          text: 'Fixed',
          frequency: 'endonly',
          rotate: { mode: 'fixed', angle: 45 },
        },
      },
    ]);

    const source = map.__sources.get('gm:line-decorators:text');
    expect(source?.features[0].properties?.rotate).toBe(45);
    expect(source?.features[0].properties?.rotationMode).toBe('fixed');
  });

  it('creates a MapLibre text symbol layer with supported data-driven properties', () => {
    const map = createMapStub();
    new TextDecoratorRenderer({ map });

    const layer = map.__layers.get('gm:line-decorators:text-layer');
    expect(layer).toEqual(
      expect.objectContaining({
        id: 'gm:line-decorators:text-layer',
        type: 'symbol',
        source: 'gm:line-decorators:text',
        layout: expect.objectContaining({
          'text-field': ['get', 'text'],
          'text-size': ['coalesce', ['get', 'fontSize'], 14],
          'text-rotate': ['coalesce', ['get', 'rotate'], ['get', 'bearing'], 0],
          'text-rotation-alignment': 'map',
          'text-allow-overlap': true,
          'text-ignore-placement': true,
        }),
        paint: expect.objectContaining({
          'text-color': ['coalesce', ['get', 'color'], '#111827'],
          'text-opacity': ['coalesce', ['get', 'opacity'], 1],
          'text-halo-color': ['coalesce', ['get', 'haloColor'], '#ffffff'],
          'text-halo-width': ['coalesce', ['get', 'haloWidth'], 1.5],
          'text-halo-blur': ['coalesce', ['get', 'haloBlur'], 0],
        }),
        filter: ['!=', ['get', 'rotationMode'], 'viewport'],
      }),
    );
  });

  it('creates a viewport-aligned layer for viewport fixed text', () => {
    const map = createMapStub();
    new TextDecoratorRenderer({ map });

    expect(map.__layers.get('gm:line-decorators:text-viewport-layer')).toEqual(
      expect.objectContaining({
        id: 'gm:line-decorators:text-viewport-layer',
        type: 'symbol',
        source: 'gm:line-decorators:text',
        layout: expect.objectContaining({
          'text-rotation-alignment': 'viewport',
          'text-rotate': ['coalesce', ['get', 'rotate'], 0],
          'text-allow-overlap': true,
          'text-ignore-placement': true,
        }),
        filter: ['==', ['get', 'rotationMode'], 'viewport'],
      }),
    );
  });

  it('recreates the source and layer when they disappear before an update', () => {
    const map = createMapStub();
    const renderer = new TextDecoratorRenderer({ map });
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
          kind: 'text',
          text: 'Reloaded',
          frequency: 'endonly',
        },
      },
    ]);

    expect(map.__layers.get(ids.layerId)).toBeDefined();
    expect(map.__sources.get(ids.sourceId)?.features).toHaveLength(1);
  });

  it('sanitizes expression-valued and non-finite styling options before writing feature properties', () => {
    const map = createMapStub();
    const renderer = new TextDecoratorRenderer({ map });

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
          kind: 'text',
          text: 'Safe',
          frequency: 'single',
          offsetPercent: Number.POSITIVE_INFINITY,
          lineOffsetPx: Number.NaN,
          fontSize: ['get', 'fontSize'],
          color: ['get', 'color'],
          opacity: ['get', 'opacity'],
          haloColor: ['get', 'haloColor'],
          haloWidth: Number.POSITIVE_INFINITY,
          haloBlur: Number.NaN,
          rotate: { mode: 'fixed', angle: ['get', 'angle'] },
        } as unknown as LineTextDecoratorOptions,
      },
    ]);

    const source = map.__sources.get('gm:line-decorators:text');
    expect(source?.features[0].properties).toEqual(
      expect.objectContaining({
        rotate: 0,
        fontSize: 14,
        color: '#111827',
        opacity: 1,
        haloColor: '#ffffff',
        haloWidth: 1.5,
        haloBlur: 0,
      }),
    );
    expect(source?.features[0].properties).not.toHaveProperty('allowOverlap');
    expect(source?.features[0].properties).not.toHaveProperty('ignorePlacement');
  });

  it('does not render blank text decorators', () => {
    const map = createMapStub();
    const renderer = new TextDecoratorRenderer({ map });

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
          kind: 'text',
          text: '   ',
          frequency: 'endonly',
        },
      },
    ]);

    expect(map.__sources.get('gm:line-decorators:text')?.features).toHaveLength(0);
  });

  it('animates configured text properties over time', () => {
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
    const renderer = new TextDecoratorRenderer({ map });

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
          kind: 'text',
          text: 'Arrow',
          frequency: 'endonly',
          fontSize: 12,
          animation: {
            property: 'fontSize',
            from: 12,
            to: 24,
            durationMs: 1000,
            easing: 'linear',
          },
        },
      },
    ]);

    expect(map.__sources.get('gm:line-decorators:text')?.features[0].properties?.fontSize).toBe(12);

    animationFrames.shift()?.(0);
    animationFrames.shift()?.(500);

    expect(map.__sources.get('gm:line-decorators:text')?.features[0].properties?.fontSize).toBe(18);
  });

  it('keeps text animation timeline when line geometry updates', () => {
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
    const renderer = new TextDecoratorRenderer({ map });
    const decorator = {
      kind: 'text' as const,
      text: 'Arrow',
      frequency: 'endonly' as const,
      fontSize: 12,
      animation: {
        property: 'fontSize' as const,
        from: 12,
        to: 24,
        durationMs: 1000,
        easing: 'linear' as const,
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
    const feature = map.__sources.get('gm:line-decorators:text')?.features[0];

    expect(feature?.geometry).toMatchObject({
      type: 'Point',
      coordinates: [2, 0],
    });
    expect(feature?.properties?.fontSize).toBe(21);
  });

  it('clears and destroys text resources', () => {
    const map = createMapStub();
    const renderer = new TextDecoratorRenderer({ map });
    renderer.clear();
    renderer.destroy();

    expect(map.getSource('gm:line-decorators:text')).toBeUndefined();
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
        kind: 'text',
        text: 'DN 300',
        frequency: 'endonly',
      },
    ]);

    expect(map.__sources.get('gm:line-decorators:text')?.features).toHaveLength(1);

    manager.destroy();
  });
});

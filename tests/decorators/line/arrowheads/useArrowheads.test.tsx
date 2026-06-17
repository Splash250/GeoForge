// @vitest-environment jsdom

import { StrictMode, act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FeatureCollection, LineString } from 'geojson';
import type { Map as MapLibreMap } from 'maplibre-gl';
import {
  type UseArrowheadsOptions,
  useArrowheads,
} from '../../../../src/decorators/line/arrowheads/hooks/useArrowheads.ts';

type GeoJsonSourceInput = { data: FeatureCollection };
type SourceWithSetData = {
  data: FeatureCollection;
  setData: (data: FeatureCollection) => void;
};
type LayerLike = { id: string };

const reactActGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

const sourceId = 'gm:line-decorators:arrowheads';
const fillLayerId = 'gm:line-decorators:arrowheads-fill';
const lineLayerId = 'gm:line-decorators:arrowheads-line';

function HookHarness(props: UseArrowheadsOptions) {
  useArrowheads(props);
  return null;
}

const line: LineString = {
  type: 'LineString',
  coordinates: [
    [0, 0],
    [1, 0],
  ],
};

const updatedLine: LineString = {
  type: 'LineString',
  coordinates: [
    [0, 0],
    [2, 0],
  ],
};

const arrowheadOptions = { frequency: 'endonly' } as const;

const emptyCollection: FeatureCollection = {
  type: 'FeatureCollection',
  features: [],
};

const createMapStub = () => {
  const sources = new Map<string, SourceWithSetData>();
  const layers = new Set<string>();

  const mapStub = {
    addSource: vi.fn((id: string, payload: GeoJsonSourceInput) => {
      const source: SourceWithSetData = {
        data: payload.data,
        setData: vi.fn((data: FeatureCollection) => {
          source.data = data;
        }),
      };
      sources.set(id, source);
    }),
    getSource: vi.fn((id: string): SourceWithSetData | undefined => {
      return sources.get(id);
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

  return { mapStub, sources, layers };
};

const createHookRoot = () => {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);

  return {
    container,
    root,
    async render(props: UseArrowheadsOptions, strict = false) {
      await act(async () => {
        root.render(
          strict
            ? createElement(StrictMode, null, createElement(HookHarness, props))
            : createElement(HookHarness, props),
        );
      });
    },
    async unmount() {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    },
  };
};

describe('useArrowheads', () => {
  const roots: Array<{ root: Root; container: HTMLElement }> = [];

  beforeEach(() => {
    reactActGlobal.IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(async () => {
    for (const entry of roots.splice(0)) {
      await act(async () => {
        entry.root.unmount();
      });
      entry.container.remove();
    }
    vi.clearAllMocks();
  });

  const trackRoot = () => {
    const hookRoot = createHookRoot();
    roots.push({ root: hookRoot.root, container: hookRoot.container });
    return hookRoot;
  };

  it('updates arrowheads on mount and clears them when line becomes null', async () => {
    const { mapStub: map, sources } = createMapStub();
    const hookRoot = trackRoot();

    await hookRoot.render({ map, line, arrowheadOptions, enabled: true });

    const source = sources.get(sourceId);
    expect(source?.data.features).toHaveLength(1);
    expect(source?.setData).toHaveBeenCalledTimes(1);

    await hookRoot.render({ map, line: updatedLine, arrowheadOptions, enabled: true });

    expect(source?.setData).toHaveBeenCalledTimes(2);
    expect(source?.data.features).toHaveLength(1);

    await hookRoot.render({ map, line: null, arrowheadOptions, enabled: true });

    expect(source?.setData).toHaveBeenLastCalledWith(emptyCollection);
    expect(source?.data).toEqual(emptyCollection);
  });

  it('destroys map resources on unmount', async () => {
    const { mapStub: map, sources, layers } = createMapStub();
    const hookRoot = trackRoot();

    await hookRoot.render({ map, line, arrowheadOptions, enabled: true });

    expect(sources.has(sourceId)).toBe(true);
    expect(layers.has(fillLayerId)).toBe(true);
    expect(layers.has(lineLayerId)).toBe(true);

    await hookRoot.unmount();
    roots.pop();

    expect(map.removeLayer).toHaveBeenCalledWith(fillLayerId);
    expect(map.removeLayer).toHaveBeenCalledWith(lineLayerId);
    expect(map.removeSource).toHaveBeenCalledWith(sourceId);
    expect(sources.has(sourceId)).toBe(false);
    expect(layers.size).toBe(0);
  });

  it('cleans up when enabled toggles off and recreates when toggled on', async () => {
    const { mapStub: map, sources } = createMapStub();
    const hookRoot = trackRoot();

    await hookRoot.render({ map, line, arrowheadOptions, enabled: true });
    expect(sources.has(sourceId)).toBe(true);

    await hookRoot.render({ map, line, arrowheadOptions, enabled: false });
    expect(sources.has(sourceId)).toBe(false);
    expect(map.removeSource).toHaveBeenCalledTimes(1);

    await hookRoot.render({ map, line, arrowheadOptions, enabled: true });
    expect(sources.has(sourceId)).toBe(true);
    expect(map.addSource).toHaveBeenCalledTimes(2);
  });

  it('destroys resources for the old map when the map prop changes', async () => {
    const oldMap = createMapStub();
    const newMap = createMapStub();
    const hookRoot = trackRoot();

    await hookRoot.render({
      map: oldMap.mapStub,
      line,
      arrowheadOptions,
      enabled: true,
    });
    expect(oldMap.sources.has(sourceId)).toBe(true);

    await hookRoot.render({
      map: newMap.mapStub,
      line,
      arrowheadOptions,
      enabled: true,
    });

    expect(oldMap.mapStub.removeSource).toHaveBeenCalledWith(sourceId);
    expect(oldMap.sources.has(sourceId)).toBe(false);
    expect(newMap.sources.has(sourceId)).toBe(true);
  });

  it('keeps setup and cleanup balanced in Strict Mode', async () => {
    const { mapStub: map, sources } = createMapStub();
    const hookRoot = trackRoot();

    await hookRoot.render({ map, line, arrowheadOptions, enabled: true }, true);

    expect(map.addSource).toHaveBeenCalledTimes(2);
    expect(map.removeSource).toHaveBeenCalledTimes(1);
    expect(sources.has(sourceId)).toBe(true);

    await hookRoot.unmount();
    roots.pop();

    expect(map.addSource).toHaveBeenCalledTimes(2);
    expect(map.removeSource).toHaveBeenCalledTimes(2);
    expect(sources.has(sourceId)).toBe(false);
  });
});

// @vitest-environment jsdom
import {
  GeomanLayerSubsystem,
  buildRasterCapabilitiesRequestUrl,
  buildRasterProxyUrl,
  createRasterProxyPolicy,
  createRasterProxyTransformer,
  normalizeRasterTileUrl,
  parseRasterCapabilities,
} from '@/layers/index.ts';
import { describe, expect, test, vi } from 'vitest';

type Source = {
  tiles: string[];
  tileSize: number;
  type: 'raster';
};

function createMapStub(layerIds: string[]) {
  const orderedLayerIds = [...layerIds];
  const sources = new Map<string, Source>();

  return {
    orderedLayerIds,
    sources,
    addSource: vi.fn((id: string, source: Source) => {
      sources.set(id, source);
    }),
    getSource: vi.fn((id: string) => sources.get(id)),
    removeSource: vi.fn((id: string) => {
      sources.delete(id);
    }),
    addLayer: vi.fn((layer: { id: string; source: string }, beforeId?: string) => {
      const insertAt = beforeId ? orderedLayerIds.indexOf(beforeId) : -1;

      if (insertAt >= 0) {
        orderedLayerIds.splice(insertAt, 0, layer.id);
      } else {
        orderedLayerIds.push(layer.id);
      }
    }),
    getLayer: vi.fn((id: string) => (orderedLayerIds.includes(id) ? { id } : undefined)),
    moveLayer: vi.fn((id: string, beforeId?: string) => {
      const currentIndex = orderedLayerIds.indexOf(id);

      if (currentIndex < 0) {
        return;
      }

      orderedLayerIds.splice(currentIndex, 1);
      const insertAt = beforeId ? orderedLayerIds.indexOf(beforeId) : -1;

      if (insertAt >= 0) {
        orderedLayerIds.splice(insertAt, 0, id);
      } else {
        orderedLayerIds.push(id);
      }
    }),
    removeLayer: vi.fn((id: string) => {
      const index = orderedLayerIds.indexOf(id);

      if (index >= 0) {
        orderedLayerIds.splice(index, 1);
      }
    }),
    getStyle: vi.fn(() => ({
      layers: orderedLayerIds.map((id) => ({ id })),
    })),
  };
}

function createLayerSubsystem(map = createMapStub(['base', 'gm_main-fill'])) {
  const geoman = {
    mapAdapter: {
      getMapInstance: () => map,
    },
  };

  return {
    map,
    layers: new GeomanLayerSubsystem({ geoman }),
  };
}

function createWmsCapabilitiesXml(layerName = 'hotmaps:nuts', title = 'NUTS boundaries') {
  return `<?xml version="1.0"?>
    <WMS_Capabilities version="1.3.0">
      <Capability>
        <Layer>
          <Layer>
            <Name>${layerName}</Name>
            <Title>${title}</Title>
          </Layer>
        </Layer>
      </Capability>
    </WMS_Capabilities>`;
}

describe('GeomanLayerSubsystem', () => {
  test('uses configured raster defaults for discovery and layer sync', async () => {
    const { layers, map } = createLayerSubsystem(createMapStub(['base', 'gm_main-fill']));
    const fetchFn = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => `<?xml version="1.0"?>
        <WMS_Capabilities version="1.3.0">
          <Capability>
            <Layer>
              <Layer>
                <Name>nuts</Name>
                <Title>NUTS</Title>
              </Layer>
            </Layer>
          </Capability>
        </WMS_Capabilities>`,
    }));

    layers.configureRasterLayers({
      basemapLayerId: 'base',
      fetchFn,
      transformRequestUrl: (url) => `/capabilities?url=${encodeURIComponent(url)}`,
      transformTileUrl: (url) => `/tiles?url=${encodeURIComponent(url)}`,
    });

    const discovered = await layers.discoverRasterLayers('https://example.test/wms?service=WMS');
    layers.addRasterLayer({ name: discovered[0]!.title, url: discovered[0]!.url });

    expect(fetchFn).toHaveBeenCalledWith(
      '/capabilities?url=https%3A%2F%2Fexample.test%2Fwms%3Fservice%3DWMS%26request%3DGetCapabilities',
    );
    expect(map.orderedLayerIds).toEqual([
      'base',
      expect.stringMatching(/^gm-raster-layer-/),
      'gm_main-fill',
    ]);
    expect(map.sources.values().next().value?.tiles[0]).toContain('/tiles?url=');
  });

  test('lets per-call raster sync options override configured defaults', () => {
    const { layers, map } = createLayerSubsystem(createMapStub(['base', 'labels', 'gm_main-fill']));

    layers.configureRasterLayers({ basemapLayerId: 'base' });
    layers.addRasterLayer(
      {
        name: 'NUTS boundaries',
        url: 'https://example.test/wms?service=WMS&request=GetMap&layers=nuts',
      },
      { basemapLayerId: 'labels' },
    );

    expect(map.orderedLayerIds).toEqual([
      'base',
      'labels',
      expect.stringMatching(/^gm-raster-layer-/),
      'gm_main-fill',
    ]);
  });

  test('resyncs existing raster layers when configured defaults change', () => {
    const { layers, map } = createLayerSubsystem(createMapStub(['base', 'labels']));

    layers.configureRasterLayers({
      basemapLayerId: 'base',
      transformTileUrl: (url) => `/first?url=${encodeURIComponent(url)}`,
    });
    layers.addRasterLayer({
      id: 'external-wms-nuts',
      name: 'NUTS boundaries',
      url: 'https://example.test/wms?service=WMS&request=GetMap&layers=nuts',
    });

    layers.configureRasterLayers({
      basemapLayerId: 'labels',
      transformTileUrl: (url) => `/second?url=${encodeURIComponent(url)}`,
    });

    expect(map.orderedLayerIds).toEqual(['base', 'labels', 'external-wms-nuts']);
    expect(map.sources.values().next().value?.tiles[0]).toContain('/second?url=');
  });

  test('refreshes a raster source when transformed tile URL changes', () => {
    const { layers, map } = createLayerSubsystem(createMapStub(['base', 'gm_main-fill']));

    layers.addRasterLayer(
      {
        id: 'external-wms-nuts',
        name: 'NUTS boundaries',
        url: 'https://example.test/wms?service=WMS&request=GetMap&layers=nuts',
      },
      {
        basemapLayerId: 'base',
        transformTileUrl: (url) => `/proxy-a?url=${encodeURIComponent(url)}`,
      },
    );

    layers.syncRasterLayers({
      basemapLayerId: 'base',
      transformTileUrl: (url) => `/proxy-b?url=${encodeURIComponent(url)}`,
    });

    expect(map.sources.values().next().value?.tiles[0]).toContain('/proxy-b?url=');
    expect(map.orderedLayerIds).toEqual(['base', 'external-wms-nuts', 'gm_main-fill']);
  });

  test('discovers WMS layers with an injectable request URL transformer', async () => {
    const { layers } = createLayerSubsystem();
    const fetchFn = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => `<?xml version="1.0"?>
        <WMS_Capabilities version="1.3.0">
          <Capability>
            <Layer>
              <Layer>
                <Name>hotmaps:nuts</Name>
                <Title>NUTS boundaries</Title>
              </Layer>
            </Layer>
          </Capability>
        </WMS_Capabilities>`,
    }));

    const discovered = await layers.discoverRasterLayers(
      'https://example.test/geoserver/wms?service=WMS&request=GetMap&layers=old',
      {
        fetchFn,
        transformRequestUrl: (url) => `/proxy?url=${encodeURIComponent(url)}`,
      },
    );

    expect(fetchFn).toHaveBeenCalledWith(
      '/proxy?url=https%3A%2F%2Fexample.test%2Fgeoserver%2Fwms%3Fservice%3DWMS%26request%3DGetCapabilities',
    );
    expect(discovered).toEqual([
      expect.objectContaining({
        name: 'hotmaps:nuts',
        service: 'WMS',
        title: 'NUTS boundaries',
      }),
    ]);
    expect(discovered[0]?.url).toContain('layers=hotmaps%3Anuts');
    expect(discovered[0]?.url).toContain('bbox={bbox-epsg-3857}');
  });

  test('blocks raster capabilities discovery before fetch when the network policy rejects the URL', async () => {
    const { layers } = createLayerSubsystem();
    const fetchFn = vi.fn();
    const diagnostics: Array<{ type: string; url: string; reason?: unknown }> = [];

    await expect(
      layers.discoverRasterLayers('https://blocked.example.test/wms?service=WMS', {
        fetchFn,
        networkPolicy: {
          allowUrl: () => false,
          onDiagnostic: (event) => diagnostics.push(event),
        },
      }),
    ).rejects.toThrow('Capabilities request blocked by raster network policy.');

    expect(fetchFn).not.toHaveBeenCalled();
    expect(diagnostics).toEqual([
      expect.objectContaining({
        type: 'request-blocked',
        url: 'https://blocked.example.test/wms?service=WMS&request=GetCapabilities',
      }),
    ]);
  });

  test('aborts raster capabilities discovery when the network policy timeout expires', async () => {
    vi.useFakeTimers();
    const { layers } = createLayerSubsystem();
    const diagnostics: Array<{ type: string; timeoutMs?: number }> = [];
    const fetchFn = vi.fn(
      (_url: string, init?: { signal?: AbortSignal }) =>
        new Promise<{ ok: boolean; status: number; text(): Promise<string> }>(
          (_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => {
              reject(init.signal?.reason ?? new DOMException('Aborted', 'AbortError'));
            });
          },
        ),
    );

    const discovery = layers.discoverRasterLayers('https://example.test/wms?service=WMS', {
      fetchFn,
      networkPolicy: {
        timeoutMs: 100,
        onDiagnostic: (event) => diagnostics.push(event),
      },
    });
    const timeoutExpectation = expect(discovery).rejects.toThrow(
      'Capabilities request timed out after 100 ms.',
    );

    await vi.advanceTimersByTimeAsync(100);

    await timeoutExpectation;
    expect(diagnostics).toContainEqual({
      type: 'request-timeout',
      url: expect.any(String),
      timeoutMs: 100,
    });

    vi.useRealTimers();
  });

  test('keeps the network policy timeout active while reading capabilities text', async () => {
    vi.useFakeTimers();
    const { layers } = createLayerSubsystem();
    const fetchFn = vi.fn(async (_url: string, init?: { signal?: AbortSignal }) => ({
      ok: true,
      status: 200,
      text: () =>
        new Promise<string>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(init.signal?.reason ?? new DOMException('Aborted', 'AbortError'));
          });
        }),
    }));

    const discovery = layers.discoverRasterLayers('https://example.test/wms?service=WMS', {
      fetchFn,
      networkPolicy: {
        timeoutMs: 100,
      },
    });
    const timeoutExpectation = expect(discovery).rejects.toThrow(
      'Capabilities request timed out after 100 ms.',
    );

    await vi.advanceTimersByTimeAsync(100);

    await timeoutExpectation;
    vi.useRealTimers();
  });

  test('retries failed raster capabilities responses and emits diagnostics before parsing the success', async () => {
    const { layers } = createLayerSubsystem();
    const diagnostics: Array<{ type: string; attempt?: number; status?: number }> = [];
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: async () => '',
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => createWmsCapabilitiesXml(),
      });

    const discovered = await layers.discoverRasterLayers('https://example.test/wms?service=WMS', {
      fetchFn,
      networkPolicy: {
        retryCount: 1,
        onDiagnostic: (event) => diagnostics.push(event),
      },
    });

    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(diagnostics).toEqual([
      expect.objectContaining({ type: 'request-start', attempt: 1 }),
      expect.objectContaining({ type: 'request-retry', attempt: 1, status: 503 }),
      expect.objectContaining({ type: 'request-start', attempt: 2 }),
      expect.objectContaining({ type: 'request-success', attempt: 2, status: 200 }),
    ]);
    expect(discovered).toEqual([
      expect.objectContaining({
        name: 'hotmaps:nuts',
        title: 'NUTS boundaries',
      }),
    ]);
  });

  test('discovers raster layers through a composed proxy policy', async () => {
    const { layers, map } = createLayerSubsystem(createMapStub(['base', 'gm_main-fill']));
    const proxyPolicy = createRasterProxyPolicy({
      allowedOrigins: ['https://example.test'],
      origin: 'https://app.example.test',
      path: '/api/raster-proxy',
      retryCount: 1,
      timeoutMs: 5000,
    });
    const fetchFn = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => createWmsCapabilitiesXml(),
    }));

    layers.configureRasterLayers({
      basemapLayerId: 'base',
      ...proxyPolicy,
      fetchFn,
    });

    const discovered = await layers.discoverRasterLayers('https://example.test/wms?service=WMS');
    layers.addRasterLayer({ name: discovered[0]!.title, url: discovered[0]!.url });

    expect(fetchFn).toHaveBeenCalledWith(
      '/api/raster-proxy?url=https%3A%2F%2Fexample.test%2Fwms%3Fservice%3DWMS%26request%3DGetCapabilities',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(map.sources.values().next().value?.tiles[0]).toContain('/api/raster-proxy?url=');
  });

  test('blocks proxied raster capabilities discovery when the original target origin is disallowed', async () => {
    const { layers } = createLayerSubsystem();
    const diagnostics: Array<{ type: string; reason?: unknown }> = [];
    const fetchFn = vi.fn();
    const proxyPolicy = createRasterProxyPolicy({
      allowedOrigins: ['https://allowed.example.test'],
      onDiagnostic: (event) => diagnostics.push(event),
      origin: 'https://app.example.test',
      path: '/api/raster-proxy',
    });

    await expect(
      layers.discoverRasterLayers('https://blocked.example.test/wms?service=WMS', {
        ...proxyPolicy,
        fetchFn,
      }),
    ).rejects.toThrow('Capabilities request blocked by raster network policy.');

    expect(fetchFn).not.toHaveBeenCalled();
    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        type: 'request-blocked',
        reason: 'Origin is not allowed by raster proxy policy.',
      }),
    );
  });

  test('adds raster layers above the basemap and below GeoForge feature layers', () => {
    const { layers, map } = createLayerSubsystem(createMapStub(['base', 'gm_main-fill']));

    layers.addRasterLayer({
      name: 'NUTS boundaries',
      url: 'https://example.test/wms?service=WMS&request=GetMap&layers=nuts&bbox={bbox-epsg-3857}',
      basemapLayerId: 'base',
    });

    expect(layers.getRasterLayers()).toHaveLength(1);
    expect(map.orderedLayerIds).toEqual([
      'base',
      expect.stringMatching(/^gm-raster-layer-/),
      'gm_main-fill',
    ]);
    const source = map.sources.values().next().value;
    expect(source).toBeDefined();
    expect(source?.tiles[0]).toContain('bbox={bbox-epsg-3857}');
  });

  test('defaults raster layers above style basemaps and below GeoForge layers', () => {
    const { layers, map } = createLayerSubsystem(createMapStub(['base', 'labels', 'gm_main-fill']));

    layers.addRasterLayer({
      name: 'NUTS boundaries',
      url: 'https://example.test/wms?service=WMS&request=GetMap&layers=nuts',
    });

    expect(map.orderedLayerIds).toEqual([
      'base',
      'labels',
      expect.stringMatching(/^gm-raster-layer-/),
      'gm_main-fill',
    ]);
  });

  test('supports adding multiple selected discovered layers at the top of the raster stack', () => {
    const { layers } = createLayerSubsystem(createMapStub(['base', 'gm_main-fill']));

    layers.addRasterLayers(
      [
        { name: 'Layer A', url: 'https://example.test/a/{z}/{x}/{y}.png' },
        { name: 'Layer B', url: 'https://example.test/b/{z}/{x}/{y}.png' },
      ],
      { basemapLayerId: 'base' },
    );

    expect(layers.getRasterLayers().map((layer) => layer.name)).toEqual(['Layer A', 'Layer B']);
  });

  test('generates unique ids for duplicate layer names added in one batch', () => {
    const { layers } = createLayerSubsystem(createMapStub(['base', 'gm_main-fill']));

    layers.addRasterLayers(
      [
        { name: 'Duplicate', url: 'https://example.test/a/{z}/{x}/{y}.png' },
        { name: 'Duplicate', url: 'https://example.test/b/{z}/{x}/{y}.png' },
      ],
      { basemapLayerId: 'base' },
    );

    const stored = layers.getRasterLayers();

    expect(stored).toHaveLength(2);
    expect(new Set(stored.map((layer) => layer.id)).size).toBe(2);
    expect(stored.every((layer) => layer.id.startsWith('gm-raster-layer-duplicate-'))).toBe(true);
  });

  test('removes caller-supplied raster layer ids from the map and source registry', () => {
    const { layers, map } = createLayerSubsystem(createMapStub(['base', 'gm_main-fill']));

    layers.addRasterLayer(
      {
        id: 'external-wms-nuts',
        name: 'NUTS boundaries',
        url: 'https://example.test/wms?service=WMS&request=GetMap&layers=nuts',
      },
      { basemapLayerId: 'base' },
    );

    expect(map.orderedLayerIds).toContain('external-wms-nuts');
    expect(map.sources.size).toBe(1);

    layers.removeRasterLayer('external-wms-nuts', { basemapLayerId: 'base' });

    expect(map.orderedLayerIds).not.toContain('external-wms-nuts');
    expect(map.sources.size).toBe(0);
  });

  test('replaces an existing raster layer id with the latest URL', () => {
    const { layers, map } = createLayerSubsystem(createMapStub(['base', 'gm_main-fill']));

    layers.addRasterLayer(
      {
        id: 'external-wms-nuts',
        name: 'NUTS boundaries',
        url: 'https://example.test/wms?service=WMS&request=GetMap&layers=old',
      },
      { basemapLayerId: 'base' },
    );
    layers.addRasterLayer(
      {
        id: 'external-wms-nuts',
        name: 'NUTS boundaries',
        url: 'https://example.test/wms?service=WMS&request=GetMap&layers=new',
      },
      { basemapLayerId: 'base' },
    );

    expect(layers.getRasterLayers()).toHaveLength(1);
    expect(map.sources.size).toBe(1);
    expect(map.sources.values().next().value?.tiles[0]).toContain('layers=new');
  });

  test('destroy removes managed raster layers from the map', () => {
    const { layers, map } = createLayerSubsystem(createMapStub(['base', 'gm_main-fill']));

    layers.addRasterLayer(
      {
        id: 'external-wms-nuts',
        name: 'NUTS boundaries',
        url: 'https://example.test/wms?service=WMS&request=GetMap&layers=nuts',
      },
      { basemapLayerId: 'base' },
    );

    layers.destroy();

    expect(map.orderedLayerIds).not.toContain('external-wms-nuts');
    expect(map.sources.size).toBe(0);
    expect(layers.getRasterLayers()).toEqual([]);
  });

  test('notifies raster layer subscribers with fresh snapshots after state changes', () => {
    const { layers } = createLayerSubsystem(createMapStub(['base', 'gm_main-fill']));
    const subscriber = vi.fn();

    const unsubscribe = layers.subscribeRasterLayers(subscriber);

    expect(subscriber).toHaveBeenCalledTimes(1);
    expect(subscriber).toHaveBeenLastCalledWith([], { type: 'initial' });

    layers.addRasterLayer(
      {
        id: 'external-wms-nuts',
        name: 'NUTS boundaries',
        url: 'https://example.test/wms?service=WMS&request=GetMap&layers=nuts',
      },
      { basemapLayerId: 'base' },
    );

    const addSnapshot = subscriber.mock.calls.at(-1)?.[0] as Array<{ id: string; name: string }>;
    expect(subscriber).toHaveBeenCalledTimes(2);
    expect(subscriber).toHaveBeenLastCalledWith(
      [
        expect.objectContaining({
          id: 'external-wms-nuts',
          name: 'NUTS boundaries',
        }),
      ],
      { type: 'add' },
    );

    addSnapshot[0]!.name = 'Mutated by consumer';
    expect(layers.getRasterLayers()[0]?.name).toBe('NUTS boundaries');

    layers.configureRasterLayers({
      transformTileUrl: (url) => `/proxy?url=${encodeURIComponent(url)}`,
    });

    expect(subscriber).toHaveBeenCalledTimes(3);
    expect(subscriber).toHaveBeenLastCalledWith(
      [expect.objectContaining({ name: 'NUTS boundaries' })],
      { type: 'configure' },
    );

    layers.removeRasterLayer('external-wms-nuts', { basemapLayerId: 'base' });

    expect(subscriber).toHaveBeenCalledTimes(4);
    expect(subscriber).toHaveBeenLastCalledWith([], { type: 'remove' });

    unsubscribe();
    unsubscribe();
    layers.addRasterLayer({
      id: 'external-wms-roads',
      name: 'Roads',
      url: 'https://example.test/wms?service=WMS&request=GetMap&layers=roads',
    });

    expect(subscriber).toHaveBeenCalledTimes(4);
  });

  test('does not notify raster subscribers for no-op remove or reorder calls', () => {
    const { layers } = createLayerSubsystem(createMapStub(['base', 'gm_main-fill']));
    const subscriber = vi.fn();

    layers.addRasterLayer({ id: 'a', name: 'A', url: 'https://example.test/a/{z}/{x}/{y}.png' });
    layers.addRasterLayer({ id: 'b', name: 'B', url: 'https://example.test/b/{z}/{x}/{y}.png' });
    layers.subscribeRasterLayers(subscriber);

    layers.removeRasterLayer('missing');
    layers.reorderRasterLayer('missing', 1);
    layers.reorderRasterLayer('b', -1);

    expect(subscriber).toHaveBeenCalledTimes(1);

    layers.reorderRasterLayer('b', 1);

    expect(subscriber).toHaveBeenCalledTimes(2);
    expect(subscriber).toHaveBeenLastCalledWith(
      [expect.objectContaining({ id: 'a' }), expect.objectContaining({ id: 'b' })],
      { type: 'reorder' },
    );
  });

  test('does not notify raster subscribers for unchanged sync calls and notifies when destroy clears state', () => {
    const { layers } = createLayerSubsystem(createMapStub(['base', 'gm_main-fill']));
    const subscriber = vi.fn();

    layers.addRasterLayer({ id: 'a', name: 'A', url: 'https://example.test/a/{z}/{x}/{y}.png' });
    layers.subscribeRasterLayers(subscriber);
    layers.syncRasterLayers({ basemapLayerId: 'base' });

    expect(subscriber).toHaveBeenCalledTimes(1);

    layers.syncRasterLayers();
    expect(subscriber).toHaveBeenCalledTimes(1);

    layers.destroy();

    expect(subscriber).toHaveBeenCalledTimes(2);
    expect(subscriber).toHaveBeenLastCalledWith([], { type: 'destroy' });
  });

  test('destroy is best-effort when the map is no longer available', () => {
    const layers = new GeomanLayerSubsystem({
      geoman: {
        mapAdapter: {
          getMapInstance: () => ({}),
        },
      },
    });

    expect(() => layers.destroy()).not.toThrow();
  });
});

describe('raster layer helpers', () => {
  test('builds a capabilities URL from a WMS GetMap URL', () => {
    expect(
      buildRasterCapabilitiesRequestUrl(
        'https://example.test/wms?service=WMS&request=GetMap&layers=old',
      ),
    ).toBe('https://example.test/wms?service=WMS&request=GetCapabilities');
  });

  test('preserves service routing params when building a WMS capabilities URL', () => {
    expect(
      buildRasterCapabilitiesRequestUrl(
        'https://maps.example.test/wms?map=/srv/city.map&token=abc123&service=WMS&request=GetMap&layers=roads&bbox=1,2,3,4&width=256&height=256',
      ),
    ).toBe(
      'https://maps.example.test/wms?map=%2Fsrv%2Fcity.map&token=abc123&service=WMS&request=GetCapabilities',
    );
  });

  test('preserves service routing params when building a WMTS capabilities URL', () => {
    expect(
      buildRasterCapabilitiesRequestUrl(
        'https://tiles.example.test/wmts?tenant=demo&service=WMTS&request=GetTile&layer=population&tilematrix=4&tilerow=5&tilecol=6',
      ),
    ).toBe('https://tiles.example.test/wmts?tenant=demo&service=WMTS&request=GetCapabilities');
  });

  test('infers WMTS service from cased request params when building a capabilities URL', () => {
    expect(
      buildRasterCapabilitiesRequestUrl(
        'https://tiles.example.test/wmts?tenant=demo&SERVICE=WMTS&REQUEST=GetTile&LAYER=population&TILEMATRIX=4&TILEROW=5&TILECOL=6',
      ),
    ).toBe('https://tiles.example.test/wmts?tenant=demo&service=WMTS&request=GetCapabilities');
  });

  test('normalizes direct WMS tile URLs with cased service params', () => {
    const url = normalizeRasterTileUrl(
      'https://example.test/wms?SERVICE=WMS&REQUEST=GetMap&LAYERS=nuts',
    );

    expect(url).toContain('service=WMS');
    expect(url).toContain('request=GetMap');
    expect(url).toContain('LAYERS=nuts');
    expect(url).toContain('bbox={bbox-epsg-3857}');
    expect(url).toContain('width=256');
    expect(url).toContain('height=256');
    expect(decodeURIComponent(url)).toContain('crs=EPSG:3857');
    expect(decodeURIComponent(url)).toContain('srs=EPSG:3857');
  });

  test('parses WMTS ResourceURL templates into MapLibre tiles', () => {
    const layers = parseRasterCapabilities(
      `<?xml version="1.0"?>
      <Capabilities xmlns="http://www.opengis.net/wmts/1.0">
        <Contents>
          <Layer>
            <Title>Population</Title>
            <Identifier>population</Identifier>
            <ResourceURL resourceType="tile" template="https://tiles.test/{TileMatrix}/{TileRow}/{TileCol}.png" />
          </Layer>
        </Contents>
      </Capabilities>`,
      'https://tiles.test/wmts?service=WMTS&request=GetCapabilities',
    );

    expect(layers).toEqual([
      {
        format: 'image/png',
        name: 'population',
        service: 'WMTS',
        style: 'default',
        tileMatrixSet: 'EPSG:3857',
        title: 'Population',
        url: 'https://tiles.test/{z}/{y}/{x}.png',
      },
    ]);
  });

  test('builds WMTS KVP URLs from advertised style format and matrix set', () => {
    const layers = parseRasterCapabilities(
      `<?xml version="1.0"?>
      <Capabilities xmlns="http://www.opengis.net/wmts/1.0">
        <Contents>
          <Layer>
            <Title>Population</Title>
            <Identifier>population</Identifier>
            <Style isDefault="true">
              <Identifier>bright</Identifier>
            </Style>
            <Format>image/jpeg</Format>
            <TileMatrixSetLink>
              <TileMatrixSet>GoogleMapsCompatible</TileMatrixSet>
            </TileMatrixSetLink>
          </Layer>
        </Contents>
      </Capabilities>`,
      'https://tiles.test/wmts?service=WMTS&request=GetCapabilities',
    );

    expect(layers[0]).toEqual(
      expect.objectContaining({
        service: 'WMTS',
        format: 'image/jpeg',
        style: 'bright',
        tileMatrixSet: 'GoogleMapsCompatible',
      }),
    );
    expect(layers[0]?.url).toContain('style=bright');
    expect(layers[0]?.url).toContain('format=image%2Fjpeg');
    expect(layers[0]?.url).toContain('tilematrixset=GoogleMapsCompatible');
  });

  test('substitutes WMTS ResourceURL style and matrix set placeholders', () => {
    const layers = parseRasterCapabilities(
      `<?xml version="1.0"?>
      <Capabilities xmlns="http://www.opengis.net/wmts/1.0">
        <Contents>
          <Layer>
            <Title>Population</Title>
            <Identifier>population</Identifier>
            <Style isDefault="true">
              <Identifier>bright</Identifier>
            </Style>
            <TileMatrixSetLink>
              <TileMatrixSet>GoogleMapsCompatible</TileMatrixSet>
            </TileMatrixSetLink>
            <ResourceURL resourceType="tile" template="https://tiles.test/{Style}/{TileMatrixSet}/{TileMatrix}/{TileRow}/{TileCol}.png" />
          </Layer>
        </Contents>
      </Capabilities>`,
      'https://tiles.test/wmts?service=WMTS&request=GetCapabilities',
    );

    expect(layers[0]?.url).toBe('https://tiles.test/bright/GoogleMapsCompatible/{z}/{y}/{x}.png');
    expect(layers[0]?.url).not.toContain('{Style}');
    expect(layers[0]?.url).not.toContain('{TileMatrixSet}');
  });

  test('resolves WMS GetMap OnlineResource endpoints from capabilities', () => {
    const layers = parseRasterCapabilities(
      `<?xml version="1.0"?>
      <WMS_Capabilities version="1.3.0" xmlns:xlink="http://www.w3.org/1999/xlink">
        <Capability>
          <Request>
            <GetMap>
              <DCPType>
                <HTTP>
                  <Get>
                    <OnlineResource xlink:href="https://maps.example.test/ows" />
                  </Get>
                </HTTP>
              </DCPType>
            </GetMap>
          </Request>
          <Layer>
            <Layer>
              <Name>workspace:nuts</Name>
              <Title>NUTS</Title>
            </Layer>
          </Layer>
        </Capability>
      </WMS_Capabilities>`,
      'https://capabilities.example.test/geoserver/wms?service=WMS&request=GetCapabilities',
    );

    expect(layers[0]?.url).toContain('https://maps.example.test/ows?');
    expect(layers[0]?.url).toContain('layers=workspace%3Anuts');
  });

  test('keeps the HTTPS capabilities endpoint when WMS advertises a different HTTP GetMap origin', () => {
    const layers = parseRasterCapabilities(
      `<?xml version="1.0"?>
      <WMS_Capabilities version="1.3.0" xmlns:xlink="http://www.w3.org/1999/xlink">
        <Capability>
          <Request>
            <GetMap>
              <DCPType>
                <HTTP>
                  <Get>
                    <OnlineResource xlink:href="http://internal.example.test/geoserver/ows" />
                  </Get>
                </HTTP>
              </DCPType>
            </GetMap>
          </Request>
          <Layer>
            <Layer>
              <Name>workspace:nuts</Name>
              <Title>NUTS</Title>
            </Layer>
          </Layer>
        </Capability>
      </WMS_Capabilities>`,
      'https://public.example.test/geoserver/wms?service=WMS&request=GetCapabilities',
    );

    expect(layers[0]?.url).toContain('https://public.example.test/geoserver/wms?');
    expect(layers[0]?.url).toContain('layers=workspace%3Anuts');
  });

  test('resolves relative WMTS ResourceURL templates against the capabilities URL', () => {
    const layers = parseRasterCapabilities(
      `<?xml version="1.0"?>
      <Capabilities xmlns="http://www.opengis.net/wmts/1.0">
        <Contents>
          <Layer>
            <Title>Population</Title>
            <Identifier>population</Identifier>
            <ResourceURL resourceType="tile" template="../tiles/{TileMatrix}/{TileRow}/{TileCol}.png" />
          </Layer>
        </Contents>
      </Capabilities>`,
      'https://tiles.test/services/wmts?service=WMTS&request=GetCapabilities',
    );

    expect(layers[0]?.url).toBe('https://tiles.test/tiles/{z}/{y}/{x}.png');
  });

  test('builds raster proxy URLs for cross-origin HTTP requests while preserving MapLibre tokens', () => {
    const tileUrl =
      'https://geoserver.citiwatts.net/geoserver/hotmaps/wms?service=WMS&bbox={bbox-epsg-3857}&tile={z}/{x}/{y}';

    expect(
      buildRasterProxyUrl(tileUrl, {
        path: '/__geoforge_tile_proxy',
        origin: 'http://127.0.0.1:5178',
      }),
    ).toBe(
      '/__geoforge_tile_proxy?url=https%3A%2F%2Fgeoserver.citiwatts.net%2Fgeoserver%2Fhotmaps%2Fwms%3Fservice%3DWMS%26bbox%3D{bbox-epsg-3857}%26tile%3D{z}%2F{x}%2F{y}',
    );
  });

  test('does not proxy same-origin, non-http, invalid, or origin-less raster URLs', () => {
    expect(
      buildRasterProxyUrl('http://127.0.0.1:5178/tiles/{z}/{x}/{y}.png', {
        path: '/proxy',
        origin: 'http://127.0.0.1:5178',
      }),
    ).toBe('http://127.0.0.1:5178/tiles/{z}/{x}/{y}.png');
    expect(
      buildRasterProxyUrl('data:image/png;base64,abc', {
        path: '/proxy',
        origin: 'http://127.0.0.1:5178',
      }),
    ).toBe('data:image/png;base64,abc');
    expect(
      buildRasterProxyUrl('not a url', {
        path: '/proxy',
        origin: 'http://127.0.0.1:5178',
      }),
    ).toBe('not a url');
    expect(buildRasterProxyUrl('https://tiles.test/{z}/{x}/{y}.png', { path: '/proxy' })).toBe(
      'https://tiles.test/{z}/{x}/{y}.png',
    );
  });

  test('creates reusable raster proxy transformers with custom parameter names', () => {
    const transform = createRasterProxyTransformer({
      origin: 'https://app.example.test',
      parameterName: 'target',
      path: '/api/raster-proxy',
    });

    expect(transform('https://tiles.example.test/{z}/{x}/{y}.png')).toBe(
      '/api/raster-proxy?target=https%3A%2F%2Ftiles.example.test%2F{z}%2F{x}%2F{y}.png',
    );
  });

  test('creates a raster proxy policy with compatible request, tile, and network options', () => {
    const diagnostics = vi.fn();
    const policy = createRasterProxyPolicy({
      allowedOrigins: ['https://tiles.example.test'],
      onDiagnostic: diagnostics,
      origin: 'https://app.example.test',
      parameterName: 'target',
      path: '/api/raster-proxy',
      retryCount: 2,
      timeoutMs: 1500,
    });

    expect(policy.transformRequestUrl('https://tiles.example.test/wms?service=WMS')).toBe(
      '/api/raster-proxy?target=https%3A%2F%2Ftiles.example.test%2Fwms%3Fservice%3DWMS',
    );
    expect(policy.transformTileUrl('https://tiles.example.test/{z}/{x}/{y}.png')).toBe(
      '/api/raster-proxy?target=https%3A%2F%2Ftiles.example.test%2F{z}%2F{x}%2F{y}.png',
    );
    expect(policy.networkPolicy).toEqual(
      expect.objectContaining({
        onDiagnostic: diagnostics,
        retryCount: 2,
        timeoutMs: 1500,
      }),
    );
    expect(Object.keys(policy.networkPolicy).sort()).toEqual([
      'allowUrl',
      'onDiagnostic',
      'retryCount',
      'timeoutMs',
    ]);
    expect(
      policy.networkPolicy.allowUrl?.(
        '/api/raster-proxy?target=https%3A%2F%2Ftiles.example.test%2Fwms',
      ),
    ).toBe(true);
    expect(
      policy.networkPolicy.allowUrl?.(
        '/api/raster-proxy?target=https%3A%2F%2Fblocked.example.test%2Fwms',
      ),
    ).toBe(false);
    expect(policy.transformRequestUrl('https://app.example.test/wms?service=WMS')).toBe(
      'https://app.example.test/wms?service=WMS',
    );
    expect(policy.networkPolicy.allowUrl?.('https://app.example.test/wms?service=WMS')).toBe(true);
  });
});

// @vitest-environment jsdom
import {
  GeomanLayerSubsystem,
  buildRasterCapabilitiesRequestUrl,
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
        title: 'NUTS boundaries',
      }),
    ]);
    expect(discovered[0]?.url).toContain('layers=hotmaps%3Anuts');
    expect(discovered[0]?.url).toContain('bbox={bbox-epsg-3857}');
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
        name: 'population',
        title: 'Population',
        url: 'https://tiles.test/{z}/{y}/{x}.png',
      },
    ]);
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
});

# WMS and WMTS Raster Layers

GeoForge exposes WMS and WMTS raster overlay support through `geoForge.layers`.

Raster layers are rendered above the configured base map layer and below GeoForge feature and edit
layers. Pass `basemapLayerId` when your MapLibre style has a known base raster layer id.

## Add a Known WMS or WMTS URL

```ts
const geoForge = await createGeomanInstance(map, {});

geoForge.layers.addRasterLayer(
  {
    id: 'hotmaps-nuts',
    name: 'NUTS boundaries',
    url: 'https://geoserver.citiwatts.net/geoserver/hotmaps/wms?service=WMS&request=GetMap&layers=hotmaps%3Anuts&styles=&format=image%2Fpng8&transparent=true&version=1.3.0&cql_filter=stat_levl_%20%3D%202%20AND%20year%3D%272013-01-01%27&srs=EPSG%3A4326&width=256&height=256&crs=EPSG%3A3857&bbox=1252344.2714243277,6105178.3231936,1408887.3053523689,6261721.357121641',
  },
  {
    basemapLayerId: 'dark-basemap',
  },
);
```

WMS `GetMap` URLs are normalized into a MapLibre tile template using
`bbox={bbox-epsg-3857}`, `width=256`, `height=256`, and `EPSG:3857`.

Passing a stable `id` lets your application replace or remove the same layer later. Adding another
raster layer with the same `id` replaces the previous layer and source URL.

## Configure Once

```ts
geoForge.layers.configureRasterLayers({
  basemapLayerId: 'dark-basemap',
  transformRequestUrl: (url) => `/api/geoforge-raster-proxy?url=${encodeURIComponent(url)}`,
  transformTileUrl: (url) => `/api/geoforge-raster-proxy?url=${encodeURIComponent(url)}`,
});
```

Calls such as `discoverRasterLayers`, `addRasterLayer`, `addRasterLayers`,
`reorderRasterLayer`, and `removeRasterLayer` can be used without repeating proxy or basemap
options.

## Discover Available Layers

```ts
const discovered = await geoForge.layers.discoverRasterLayers(
  'https://geoserver.citiwatts.net/geoserver/hotmaps/wms?service=WMS&request=GetMap',
);

const selected = discovered.filter((layer) => layer.name === 'hotmaps:nuts');

geoForge.layers.addRasterLayers(
  selected.map((layer) => ({
    name: layer.title,
    url: layer.url,
  })),
  {
    basemapLayerId: 'dark-basemap',
  },
);
```

Discovery results include `service`, and WMTS results may include `style`, `format`, and
`tileMatrixSet` when advertised by the capabilities document. Prefer adding discovered WMTS layers
instead of hand-writing KVP tile URLs.

## CORS and Proxies

Browsers require WMS/WMTS servers to allow cross-origin tile requests. If a server does not send
CORS headers, proxy the capabilities and tile URLs through your application server:

```ts
const proxied = (url: string) => `/api/tile-proxy?url=${encodeURIComponent(url)}`;

const discovered = await geoForge.layers.discoverRasterLayers(serviceUrl, {
  transformRequestUrl: proxied,
});

geoForge.layers.addRasterLayer(
  {
    name: discovered[0].title,
    url: discovered[0].url,
  },
  {
    basemapLayerId: 'dark-basemap',
    transformTileUrl: proxied,
  },
);
```

The playground Vite proxy is intentionally local-development-only. Production proxies should allowlist
trusted WMS/WMTS hosts, block private-network destinations, enforce response-size limits, and set
request timeouts.

## Reorder or Remove Layers

```ts
const [layer] = geoForge.layers.getRasterLayers();

geoForge.layers.reorderRasterLayer(layer.id, -1, { basemapLayerId: 'dark-basemap' });
geoForge.layers.removeRasterLayer(layer.id, { basemapLayerId: 'dark-basemap' });
```

GeoForge removes managed raster layers during `geoForge.destroy()`. If the map has already been
torn down, layer cleanup is best-effort and does not block instance teardown.

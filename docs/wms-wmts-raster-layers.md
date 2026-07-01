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

## Subscribe to Raster Layer State

```ts
const unsubscribe = geoForge.layers.subscribeRasterLayers((layers) => {
  renderRasterLayerPanel(layers);
});
```

The callback runs immediately with the current raster layer snapshot and runs again after layer
state changes such as add, remove, reorder, configure resync, and destroy. Each callback receives a
fresh array, so UI code should render from the snapshot instead of mutating it.

## Discover Available Layers

```ts
const discovered = await geoForge.layers.discoverRasterLayers(
  'https://geoserver.citiwatts.net/geoserver/hotmaps/wms?service=WMS&request=GetMap',
  {
    networkPolicy: {
      timeoutMs: 8000,
      retryCount: 1,
      onDiagnostic: (event) => {
        console.debug('Raster discovery', event);
      },
    },
  },
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

### Browser-only mode

Use direct discovery and tile URLs when the WMS/WMTS service sends CORS headers that allow your
application origin. `networkPolicy` applies to capabilities discovery, while MapLibre still loads
tile URLs from the raster source:

```ts
const discovered = await geoForge.layers.discoverRasterLayers(serviceUrl, {
  networkPolicy: {
    timeoutMs: 8000,
    retryCount: 1,
    allowUrl: (url) => new URL(url).origin === 'https://geoserver.citiwatts.net',
    onDiagnostic: (event) => {
      reportRasterNetworkEvent(event);
    },
  },
});
```

Diagnostics include request start, success, retry, blocked, timeout, abort, and failure events.

### App-proxy mode

If a server does not send CORS headers, proxy capabilities and tile URLs through your application
server. `createRasterProxyPolicy` composes the compatible request transform, tile transform, and
capabilities network policy in one object:

```ts
const rasterProxy = createRasterProxyPolicy({
  path: '/api/tile-proxy',
  origin: window.location.origin,
  allowedOrigins: ['https://geoserver.citiwatts.net'],
  timeoutMs: 8000,
  retryCount: 1,
  onDiagnostic: (event) => {
    reportRasterNetworkEvent(event);
  },
});

geoForge.layers.configureRasterLayers({
  basemapLayerId: 'dark-basemap',
  ...rasterProxy,
});
```

The returned `transformRequestUrl` and `transformTileUrl` both use
`buildRasterProxyUrl(url, { path, origin, parameterName })`, and the returned `networkPolicy`
checks the original target URL origin when `allowedOrigins` is set.

`createRasterProxyTransformer` is still available when you only need URL transformation:

```ts
const proxied = createRasterProxyTransformer({
  path: '/api/tile-proxy',
  origin: window.location.origin,
});

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

`buildRasterProxyUrl(url, { path, origin, parameterName })` is also available when a one-off
transformation is more convenient. The helper proxies only cross-origin `http` and `https` URLs,
preserves MapLibre template tokens such as `{z}`, `{x}`, `{y}`, and `{bbox-epsg-3857}`, and returns
the original URL for same-origin, non-HTTP, invalid, or origin-less inputs.

### Server-proxy notes

The playground Vite proxy is intentionally local-development-only. Production proxies should still
enforce trusted WMS/WMTS host allowlists, block private-network destinations, enforce response-size
limits, validate content types, and set server-side request timeouts. The client `allowedOrigins`,
`timeoutMs`, `retryCount`, and diagnostic hooks improve browser behavior and observability, but they
do not replace server-side SSRF and resource-limit protections.

## Reorder or Remove Layers

```ts
const [layer] = geoForge.layers.getRasterLayers();

geoForge.layers.reorderRasterLayer(layer.id, -1, { basemapLayerId: 'dark-basemap' });
geoForge.layers.removeRasterLayer(layer.id, { basemapLayerId: 'dark-basemap' });
```

GeoForge removes managed raster layers during `geoForge.destroy()`. If the map has already been
torn down, layer cleanup is best-effort and does not block instance teardown.

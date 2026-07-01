# Basic Usage and Installation

Set up GeoForge in a few steps: install the package, provide the expected HTML scaffold, and initialize the toolkit alongside MapLibre GL.

## Installation

```bash
pnpm add maplibre-geoforge maplibre-gl
```

You can also download the package directly from [npm](https://www.npmjs.com/package/maplibre-geoforge).

## Expected HTML Structure

```html
<!-- index.html -->
<html lang="en_US">
  <head>
    <title>GeoForge MapLibre</title>
    <style>
      #dev-map {
        height: 100vh;
        width: 100vw;
      }
    </style>
  </head>
  <body>
    <div id="dev-map"></div>
  </body>
</html>
```

## MapLibre and GeoForge Initialization

```ts
import 'maplibre-gl/dist/maplibre-gl.css';
import 'maplibre-geoforge/dist/maplibre-geoforge.css';

import ml from 'maplibre-gl';
import { GeoForge, type GeoJsonImportFeature, type GmOptionsPartial } from 'maplibre-geoforge';

const mapLibreStyle: ml.StyleSpecification = {
  version: 8,
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  sources: {
    'osm-tiles': {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: 'Copyright (c) OpenStreetMap contributors',
    },
  },
  layers: [
    {
      id: 'osm-tiles-layer',
      type: 'raster',
      source: 'osm-tiles',
      minzoom: 0,
      maxzoom: 19,
    },
  ],
};

const map = new ml.Map({
  container: 'dev-map',
  style: mapLibreStyle,
  center: [0, 51],
  zoom: 5,
});

const gmOptions: GmOptionsPartial = {
  // GeoForge options here
};

// Create and wait for a loaded GeoForge instance
const geoForge = await GeoForge.create(map, gmOptions);

// Add GeoJSON shapes after GeoForge is loaded
const shapeGeoJson: GeoJsonImportFeature = {
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [0, 51] },
  properties: {},
};
geoForge.features.importGeoJsonFeature(shapeGeoJson);

const shapeGeoJson2: GeoJsonImportFeature = {
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [3, 52] },
  properties: {},
};
geoForge.features.importGeoJsonFeature(shapeGeoJson2);
```

`new GeoForge(map, gmOptions)` remains supported for existing integrations. New
application and framework code should prefer `await GeoForge.create(...)` so
setup code runs only after GeoForge has finished initializing.

## Framework Lifecycle Cleanup

When a component or route owns a GeoForge instance, await cleanup when your
framework allows it:

```ts
let geoForge: InstanceType<typeof GeoForge> | undefined;

geoForge = await GeoForge.create(map, gmOptions);

await geoForge.destroy({ removeSources: true });
geoForge = undefined;
```

React, Vue, Svelte, and similar component lifecycles should await or return the
`destroy(...)` promise when possible, especially before creating a replacement
instance for the same map.

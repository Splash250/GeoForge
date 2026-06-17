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

// Create a new GeoForge instance
const geoForge = new GeoForge(map, gmOptions);

// Callback when GeoForge is fully loaded
map.on('gm:loaded', () => {
  console.log('GeoForge fully loaded');

  // Add GeoJSON shapes
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
});
```

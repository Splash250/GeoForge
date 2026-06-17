# Basic Usage and Installation

Set up MapLibre Geoman in a few steps: install the package, provide the expected HTML scaffold, and initialize the plugin alongside MapLibre GL.

## Installation

```bash
pnpm add @sewergy/maplibre-geoman
```

You can also download the package directly from [npm](https://www.npmjs.com/package/@sewergy/maplibre-geoman).

## Expected HTML Structure

```html
<!-- index.html -->
<html lang="en_US">
  <head>
    <title>Geoman MapLibre</title>
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

## MapLibre and Geoman Initialization

```ts
import 'maplibre-gl/dist/maplibre-gl.css';
import '@sewergy/maplibre-geoman/dist/maplibre-geoman.css';

import ml from 'maplibre-gl';
import { Geoman, type GmOptionsPartial } from '@sewergy/maplibre-geoman';

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
  // Geoman options here
};

// Create a new Geoman instance
const geoman = new Geoman(map, gmOptions);

// Callback when Geoman is fully loaded
map.on('gm:loaded', () => {
  console.log('Geoman fully loaded');

  // Add GeoJSON shapes
  const shapeGeoJson = {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [0, 51] },
    properties: {},
  };
  geoman.features.importGeoJsonFeature(shapeGeoJson);

  const shapeGeoJson2 = {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [3, 52] },
    properties: {},
  };
  map.gm?.features.importGeoJsonFeature(shapeGeoJson2);
});
```

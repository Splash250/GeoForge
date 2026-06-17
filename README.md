# GeoForge

GeoForge is a MapLibre GL JS toolkit for feature operations, rendering, geometry, and editing.

It provides map editing primitives for drawing, editing, dragging, cutting,
rotating, deleting, snapping, feature import/export, line decorators, HTML
overlays, custom interaction tools, context panels, geometry utilities,
transactions, and history.

## Installation

```shell
pnpm add maplibre-geoforge maplibre-gl
```

## Basic Usage

```ts
import ml from 'maplibre-gl';
import { GeoForge, type GmOptionsPartial } from 'maplibre-geoforge';

import 'maplibre-gl/dist/maplibre-gl.css';
import 'maplibre-geoforge/dist/maplibre-geoforge.css';

const mapStyle: ml.StyleSpecification = {
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
  style: mapStyle,
  center: [0, 51],
  zoom: 5,
});

const gmOptions: GmOptionsPartial = {
  // GeoForge options here
};

const geoForge = new GeoForge(map, gmOptions);

map.on('gm:loaded', () => {
  console.log('GeoForge fully loaded');

  geoForge.features.importGeoJsonFeature({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [0, 51] },
    properties: {},
  });
});
```

The exported `Geoman` class name remains available as a compatibility alias for
existing integrations. New application code should prefer `GeoForge`.

## Preferred APIs

Use the `GeoForge` instance directly for modes, feature services, decorators,
overlays, tools, panels, geometry, transactions, and history:

```ts
const geoForge = new GeoForge(map);

geoForge.modes.enable('draw', 'line');
geoForge.modes.disableAll();

geoForge.decorators.lines.start({
  resolveDecorators: (geoJsonFeature) => geoJsonFeature.properties?.decorators,
});

geoForge.overlays.html.add({
  id: 'inspection-panel',
  html: '<main><h1>Inspection</h1></main>',
  corners: {
    topLeft: [16.371, 48.209],
    topRight: [16.373, 48.209],
    bottomRight: [16.373, 48.208],
    bottomLeft: [16.371, 48.208],
  },
});
```

Application code should import from the package root or the published CSS file:

- `maplibre-geoforge`
- `maplibre-geoforge/dist/maplibre-geoforge.css`

Do not rely on deep imports from `src`, `dist`, or internal folders.

## Documentation

- [Introduction](docs/introduction.md)
- [Basic usage and installation](docs/basic-usage-and-installation.md)
- [Configuration](docs/configuring-geoman.md)
- [Instance API](docs/geoman-instance-api.md)
- [Events](docs/geoman-events.md)
- [Public API boundary](docs/public-api-boundary.md)
- [Decorators](docs/decorators.md)
- [HTML overlays](docs/html-overlays.md)
- [Custom interaction tools](docs/custom-interaction-tools.md)
- [Context panels](docs/context-panels.md)

## Line Decorators

GeoForge supports `arrowhead`, `symbol`, and `text` decorators on line features.
Text and symbol decorators support per-frame animation through the line
decorator animation runner.

```ts
geoForge.decorators.lines.start({
  sourceNames: ['gm_main'],
  resolveDecorators: (feature) => feature.properties?.decorators,
});
```

## Security

Report security issues privately through the
[Security Policy](SECURITY.md). Do not create public issues for vulnerabilities.

## Provenance

GeoForge is a standalone package derived from the open-source Geoman MapLibre
work and extended with additional package APIs, rendering systems, geometry
helpers, tests, and documentation.

## License

This repository is licensed under the MIT License. See [LICENSE](LICENSE) for
details.

import maplibregl from 'maplibre-gl';

export function createDemoMap(container: HTMLElement) {
  return new maplibregl.Map({
    container,
    style: {
      version: 8,
      glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
      sources: {
        darkBasemap: {
          type: 'raster',
          tiles: [
            'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
            'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
            'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
            'https://d.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
          ],
          tileSize: 256,
          attribution: 'OpenStreetMap contributors | CARTO',
        },
      },
      layers: [
        {
          id: 'dark-basemap',
          type: 'raster',
          source: 'darkBasemap',
        },
      ],
    },
    center: [19.047, 47.497],
    zoom: 13.4,
    pitch: 0,
  });
}

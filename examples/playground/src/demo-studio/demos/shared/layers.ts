import type { Map } from 'maplibre-gl';

export function removeLayerIfExists(map: Map, layerId: string): void {
  if (map.getLayer(layerId)) {
    map.removeLayer(layerId);
  }
}

export function removeSourceIfExists(map: Map, sourceId: string): void {
  if (map.getSource(sourceId)) {
    map.removeSource(sourceId);
  }
}

export function removeLayersAndSources(
  map: Map,
  options: { layers: string[]; sources: string[] }
): void {
  for (const layerId of options.layers) {
    removeLayerIfExists(map, layerId);
  }

  for (const sourceId of options.sources) {
    removeSourceIfExists(map, sourceId);
  }
}

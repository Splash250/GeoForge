import type { LayerSpecification, Map } from 'maplibre-gl';

export type LineDecoratorLayerPosition = 'default' | 'below-lines' | 'above-lines';

type MapWithLayerOrder = Map & {
  moveLayer?: (id: string, beforeId?: string) => Map;
};

const GEOMAN_LINE_LAYER_ID = /^gm_(?:standby|main|temporary)-line__.+-layer-\d+$/;

export function addLineDecoratorLayer(
  map: Map,
  layer: LayerSpecification,
  position: LineDecoratorLayerPosition = 'default',
) {
  const beforeId = getLineDecoratorBeforeId(map, position);
  map.addLayer(layer, beforeId);
}

export function positionLineDecoratorLayers(
  map: Map,
  layerIds: string[],
  position: LineDecoratorLayerPosition = 'default',
) {
  if (position === 'default') {
    return;
  }

  const mapWithLayerOrder = map as MapWithLayerOrder;
  if (typeof mapWithLayerOrder.moveLayer !== 'function') {
    return;
  }

  layerIds.forEach((layerId) => {
    if (!map.getLayer(layerId)) {
      return;
    }

    const beforeId = getLineDecoratorBeforeId(map, position, layerId);
    mapWithLayerOrder.moveLayer?.(layerId, beforeId);
  });
}

function getLineDecoratorBeforeId(
  map: Map,
  position: LineDecoratorLayerPosition,
  movingLayerId?: string,
) {
  if (position === 'default') {
    return undefined;
  }

  const layers = map.getStyle().layers ?? [];
  const visibleLayerIds = layers
    .map((layer) => layer.id)
    .filter((layerId) => layerId !== movingLayerId);
  const lineLayerIndexes = visibleLayerIds
    .map((layerId, index) => (GEOMAN_LINE_LAYER_ID.test(layerId) ? index : -1))
    .filter((index) => index >= 0);

  if (lineLayerIndexes.length === 0) {
    return undefined;
  }

  if (position === 'below-lines') {
    return visibleLayerIds[Math.min(...lineLayerIndexes)];
  }

  return visibleLayerIds[Math.max(...lineLayerIndexes) + 1];
}

import type { FeatureCollection } from 'geojson';
import type { GeoJSONSource, Map } from 'maplibre-gl';
import {
  addLineDecoratorLayer,
  positionLineDecoratorLayers,
  type LineDecoratorLayerPosition,
} from '../layerPosition.ts';

export type SymbolDecoratorSourceIds = {
  sourceId: string;
  layerId: string;
};

const DEFAULT_IDS: SymbolDecoratorSourceIds = {
  sourceId: 'gm:line-decorators:symbols',
  layerId: 'gm:line-decorators:symbols-layer',
};

const EMPTY_COLLECTION: FeatureCollection = {
  type: 'FeatureCollection',
  features: [],
};

export type EnsureSymbolDecoratorSourceOptions = {
  ids?: Partial<SymbolDecoratorSourceIds>;
  layerPosition?: LineDecoratorLayerPosition;
};

export function resolveSymbolDecoratorIds(
  ids?: Partial<SymbolDecoratorSourceIds>,
): SymbolDecoratorSourceIds {
  return {
    sourceId: ids?.sourceId ?? DEFAULT_IDS.sourceId,
    layerId: ids?.layerId ?? DEFAULT_IDS.layerId,
  };
}

export function ensureSymbolDecoratorSource(
  map: Map,
  options: EnsureSymbolDecoratorSourceOptions = {},
) {
  const ids = resolveSymbolDecoratorIds(options.ids);

  if (!map.getSource(ids.sourceId)) {
    map.addSource(ids.sourceId, {
      type: 'geojson',
      data: EMPTY_COLLECTION,
    });
  }

  if (!map.getLayer(ids.layerId)) {
    addLineDecoratorLayer(
      map,
      {
        id: ids.layerId,
        type: 'symbol',
        source: ids.sourceId,
        layout: {
          'icon-image': ['get', 'imageId'],
          'icon-size': ['coalesce', ['get', 'size'], 1],
          'icon-rotate': ['coalesce', ['get', 'rotate'], ['get', 'bearing'], 0],
          'icon-rotation-alignment': 'map',
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
        paint: {
          'icon-color': ['coalesce', ['get', 'color'], '#ffffff'],
          'icon-opacity': ['coalesce', ['get', 'opacity'], 1],
        },
      },
      options.layerPosition,
    );
  } else {
    positionLineDecoratorLayers(map, [ids.layerId], options.layerPosition);
  }

  return ids;
}

export function updateSymbolDecoratorSource(
  map: Map,
  ids: Pick<SymbolDecoratorSourceIds, 'sourceId'>,
  collection: FeatureCollection,
) {
  const source = map.getSource(ids.sourceId) as GeoJSONSource | undefined;
  source?.setData(collection);
}

export function clearSymbolDecoratorSource(map: Map, ids: SymbolDecoratorSourceIds) {
  if (map.getLayer(ids.layerId)) {
    map.removeLayer(ids.layerId);
  }
  if (map.getSource(ids.sourceId)) {
    map.removeSource(ids.sourceId);
  }
}

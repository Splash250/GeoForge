import type { FeatureCollection } from 'geojson';
import type { GeoJSONSource, Map } from 'maplibre-gl';
import {
  addLineDecoratorLayer,
  positionLineDecoratorLayers,
  type LineDecoratorLayerPosition,
} from '../layerPosition.ts';

export type TextDecoratorSourceIds = {
  sourceId: string;
  layerId: string;
  viewportLayerId: string;
};

const DEFAULT_IDS: TextDecoratorSourceIds = {
  sourceId: 'gm:line-decorators:text',
  layerId: 'gm:line-decorators:text-layer',
  viewportLayerId: 'gm:line-decorators:text-viewport-layer',
};

const EMPTY_COLLECTION: FeatureCollection = {
  type: 'FeatureCollection',
  features: [],
};

export type EnsureTextDecoratorSourceOptions = {
  ids?: Partial<TextDecoratorSourceIds>;
  layerPosition?: LineDecoratorLayerPosition;
};

export function resolveTextDecoratorIds(
  ids?: Partial<TextDecoratorSourceIds>,
): TextDecoratorSourceIds {
  return {
    sourceId: ids?.sourceId ?? DEFAULT_IDS.sourceId,
    layerId: ids?.layerId ?? DEFAULT_IDS.layerId,
    viewportLayerId: ids?.viewportLayerId ?? DEFAULT_IDS.viewportLayerId,
  };
}

export function ensureTextDecoratorSource(
  map: Map,
  options: EnsureTextDecoratorSourceOptions = {},
) {
  const ids = resolveTextDecoratorIds(options.ids);

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
          'text-field': ['get', 'text'],
          'text-size': ['coalesce', ['get', 'fontSize'], 14],
          'text-rotate': ['coalesce', ['get', 'rotate'], ['get', 'bearing'], 0],
          'text-rotation-alignment': 'map',
          // MapLibre text collision flags are data-constant, so text decorators use
          // one layer-level policy instead of misleading per-feature properties.
          'text-allow-overlap': true,
          'text-ignore-placement': true,
        },
        paint: {
          'text-color': ['coalesce', ['get', 'color'], '#111827'],
          'text-opacity': ['coalesce', ['get', 'opacity'], 1],
          'text-halo-color': ['coalesce', ['get', 'haloColor'], '#ffffff'],
          'text-halo-width': ['coalesce', ['get', 'haloWidth'], 1.5],
          'text-halo-blur': ['coalesce', ['get', 'haloBlur'], 0],
        },
        filter: ['!=', ['get', 'rotationMode'], 'viewport'],
      },
      options.layerPosition,
    );
  }

  if (!map.getLayer(ids.viewportLayerId)) {
    addLineDecoratorLayer(
      map,
      {
        id: ids.viewportLayerId,
        type: 'symbol',
        source: ids.sourceId,
        layout: {
          'text-field': ['get', 'text'],
          'text-size': ['coalesce', ['get', 'fontSize'], 14],
          'text-rotate': ['coalesce', ['get', 'rotate'], 0],
          'text-rotation-alignment': 'viewport',
          // MapLibre text collision flags are data-constant, so text decorators use
          // one layer-level policy instead of misleading per-feature properties.
          'text-allow-overlap': true,
          'text-ignore-placement': true,
        },
        paint: {
          'text-color': ['coalesce', ['get', 'color'], '#111827'],
          'text-opacity': ['coalesce', ['get', 'opacity'], 1],
          'text-halo-color': ['coalesce', ['get', 'haloColor'], '#ffffff'],
          'text-halo-width': ['coalesce', ['get', 'haloWidth'], 1.5],
          'text-halo-blur': ['coalesce', ['get', 'haloBlur'], 0],
        },
        filter: ['==', ['get', 'rotationMode'], 'viewport'],
      },
      options.layerPosition,
    );
  } else {
    positionLineDecoratorLayers(map, [ids.layerId, ids.viewportLayerId], options.layerPosition);
  }

  return ids;
}

export function updateTextDecoratorSource(
  map: Map,
  ids: Pick<TextDecoratorSourceIds, 'sourceId'>,
  collection: FeatureCollection,
) {
  const source = map.getSource(ids.sourceId) as GeoJSONSource | undefined;
  source?.setData(collection);
}

export function clearTextDecoratorSource(map: Map, ids: TextDecoratorSourceIds) {
  if (map.getLayer(ids.viewportLayerId)) {
    map.removeLayer(ids.viewportLayerId);
  }
  if (map.getLayer(ids.layerId)) {
    map.removeLayer(ids.layerId);
  }
  if (map.getSource(ids.sourceId)) {
    map.removeSource(ids.sourceId);
  }
}

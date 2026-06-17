import type { Map, GeoJSONSource, ExpressionSpecification } from 'maplibre-gl';
import type { ArrowheadFeatureCollection } from '../types';
import {
  addLineDecoratorLayer,
  positionLineDecoratorLayers,
  type LineDecoratorLayerPosition,
} from '../../layerPosition.ts';

export type ArrowheadSourceIds = {
  sourceId: string;
  lineLayerId: string;
  fillLayerId: string;
};

const DEFAULT_IDS: ArrowheadSourceIds = {
  sourceId: 'gm:line-decorators:arrowheads',
  lineLayerId: 'gm:line-decorators:arrowheads-line',
  fillLayerId: 'gm:line-decorators:arrowheads-fill',
};

const EMPTY_COLLECTION: ArrowheadFeatureCollection = {
  type: 'FeatureCollection',
  features: [],
};

export type EnsureArrowheadSourceOptions = {
  ids?: Partial<ArrowheadSourceIds>;
  linePaint?: Record<string, unknown>;
  fillPaint?: Record<string, unknown>;
  lineLayout?: Record<string, unknown>;
  fillLayout?: Record<string, unknown>;
  layerPosition?: LineDecoratorLayerPosition;
};

export function resolveIds(ids?: Partial<ArrowheadSourceIds>): ArrowheadSourceIds {
  return {
    sourceId: ids?.sourceId ?? DEFAULT_IDS.sourceId,
    lineLayerId: ids?.lineLayerId ?? DEFAULT_IDS.lineLayerId,
    fillLayerId: ids?.fillLayerId ?? DEFAULT_IDS.fillLayerId,
  };
}

export function ensureArrowheadSource(map: Map, options: EnsureArrowheadSourceOptions = {}) {
  const ids = resolveIds(options.ids);

  if (!map.getSource(ids.sourceId)) {
    map.addSource(ids.sourceId, {
      type: 'geojson',
      data: EMPTY_COLLECTION,
    });
  }

  ensureFillLayer(map, ids, options.fillPaint, options.fillLayout, options.layerPosition);
  ensureLineLayer(map, ids, options.linePaint, options.lineLayout, options.layerPosition);
  positionLineDecoratorLayers(map, [ids.fillLayerId, ids.lineLayerId], options.layerPosition);

  return ids;
}

function ensureFillLayer(
  map: Map,
  ids: ArrowheadSourceIds,
  paint?: Record<string, unknown>,
  layout?: Record<string, unknown>,
  layerPosition?: LineDecoratorLayerPosition,
) {
  if (map.getLayer(ids.fillLayerId)) {
    return;
  }

  addLineDecoratorLayer(
    map,
    {
      id: ids.fillLayerId,
      type: 'fill',
      source: ids.sourceId,
      layout: {
        visibility: 'visible',
        ...layout,
      },
      paint: {
        'fill-color': [
          'coalesce',
          ['get', 'fillColor'],
          ['get', 'color'],
          '#2563eb',
        ] as ExpressionSpecification,
        'fill-opacity': ['coalesce', ['get', 'fillOpacity'], 1] as ExpressionSpecification,
        ...paint,
      },
      filter: ['==', ['geometry-type'], 'Polygon'],
    },
    layerPosition,
  );
}

function ensureLineLayer(
  map: Map,
  ids: ArrowheadSourceIds,
  paint?: Record<string, unknown>,
  layout?: Record<string, unknown>,
  layerPosition?: LineDecoratorLayerPosition,
) {
  if (map.getLayer(ids.lineLayerId)) {
    return;
  }

  addLineDecoratorLayer(
    map,
    {
      id: ids.lineLayerId,
      type: 'line',
      source: ids.sourceId,
      layout: {
        visibility: 'visible',
        'line-cap': 'butt',
        'line-join': 'miter',
        ...layout,
      },
      paint: {
        'line-color': ['coalesce', ['get', 'color'], '#1d4ed8'] as ExpressionSpecification,
        'line-width': ['coalesce', ['get', 'weight'], 2] as ExpressionSpecification,
        'line-opacity': ['coalesce', ['get', 'opacity'], 1] as ExpressionSpecification,
        ...paint,
      },
      filter: ['==', ['geometry-type'], 'LineString'],
    },
    layerPosition,
  );
}

export function updateArrowheadSource(
  map: Map,
  ids: Pick<ArrowheadSourceIds, 'sourceId'>,
  collection: ArrowheadFeatureCollection,
) {
  const source = map.getSource(ids.sourceId) as GeoJSONSource | undefined;
  if (!source) {
    return;
  }
  source.setData(collection);
}

export function clearArrowheadSource(map: Map, ids: ArrowheadSourceIds) {
  if (map.getLayer(ids.fillLayerId)) {
    map.removeLayer(ids.fillLayerId);
  }
  if (map.getLayer(ids.lineLayerId)) {
    map.removeLayer(ids.lineLayerId);
  }
  if (map.getSource(ids.sourceId)) {
    map.removeSource(ids.sourceId);
  }
}

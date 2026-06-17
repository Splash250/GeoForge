import type { FeatureData } from '@/core/features/feature-data.ts';
import type { LngLatTuple } from '@/types/map/index.ts';
import type { FeatureCollection, LineString } from 'geojson';
import type { AddLayerObject, GeoJSONSource, Map } from 'maplibre-gl';
import type {
  GeomanLineEndpointConnectionEndpoint,
  GeomanLineEndpointConnectionPreview,
  GeomanLineEndpointConnectionPreviewRenderIds,
  GeomanLineEndpointConnectionPreviewRenderOptions,
} from './types.ts';

const DEFAULT_IDS: GeomanLineEndpointConnectionPreviewRenderIds = {
  sourceId: 'gm:line-endpoint-preview',
  layerId: 'gm:line-endpoint-preview-layer',
};

const EMPTY_COLLECTION: FeatureCollection<LineString> = {
  type: 'FeatureCollection',
  features: [],
};

export type LineEndpointConnectionPreviewRendererOptions = {
  getMap: () => Map | null;
};

export class LineEndpointConnectionPreviewRenderer {
  constructor(private readonly options: LineEndpointConnectionPreviewRendererOptions) {}

  render(
    preview: GeomanLineEndpointConnectionPreview | null,
    options: GeomanLineEndpointConnectionPreviewRenderOptions = {},
  ) {
    if (!preview) {
      this.clear(options);
      return;
    }

    const map = this.options.getMap();
    if (!map) {
      return;
    }

    const ids = resolveLineEndpointConnectionPreviewIds(options.ids);
    this.ensureSourceAndLayer(map, ids, options);
    this.setData(map, ids, getPreviewCollection(preview));
  }

  clear(options: GeomanLineEndpointConnectionPreviewRenderOptions = {}) {
    const map = this.options.getMap();
    if (!map) {
      return;
    }

    this.setData(map, resolveLineEndpointConnectionPreviewIds(options.ids), EMPTY_COLLECTION);
  }

  destroy(options: GeomanLineEndpointConnectionPreviewRenderOptions = {}) {
    const map = this.options.getMap();
    if (!map) {
      return;
    }

    const ids = resolveLineEndpointConnectionPreviewIds(options.ids);

    if (map.getLayer(ids.layerId)) {
      map.removeLayer(ids.layerId);
    }

    if (map.getSource(ids.sourceId)) {
      map.removeSource(ids.sourceId);
    }
  }

  private ensureSourceAndLayer(
    map: Map,
    ids: GeomanLineEndpointConnectionPreviewRenderIds,
    options: GeomanLineEndpointConnectionPreviewRenderOptions,
  ) {
    if (!map.getSource(ids.sourceId)) {
      map.addSource(ids.sourceId, {
        type: 'geojson',
        data: EMPTY_COLLECTION,
      });
    }

    if (!map.getLayer(ids.layerId)) {
      const layer = getPreviewLayer(ids, options);
      if (options.beforeId) {
        map.addLayer(layer, options.beforeId);
      } else {
        map.addLayer(layer);
      }
    }
  }

  private setData(
    map: Map,
    ids: Pick<GeomanLineEndpointConnectionPreviewRenderIds, 'sourceId'>,
    collection: FeatureCollection<LineString>,
  ) {
    const source = map.getSource(ids.sourceId) as GeoJSONSource | undefined;
    source?.setData(collection);
  }
}

export function resolveLineEndpointConnectionPreviewIds(
  ids: Partial<GeomanLineEndpointConnectionPreviewRenderIds> = {},
): GeomanLineEndpointConnectionPreviewRenderIds {
  return {
    sourceId: ids.sourceId ?? DEFAULT_IDS.sourceId,
    layerId: ids.layerId ?? DEFAULT_IDS.layerId,
  };
}

function getPreviewLayer(
  ids: GeomanLineEndpointConnectionPreviewRenderIds,
  options: GeomanLineEndpointConnectionPreviewRenderOptions,
): AddLayerObject {
  return {
    id: ids.layerId,
    type: 'line',
    source: ids.sourceId,
    paint: {
      'line-color': options.style?.color ?? '#0ea5e9',
      'line-width': options.style?.width ?? 3,
      'line-opacity': options.style?.opacity ?? 0.85,
      'line-dasharray': options.style?.dasharray ?? [2, 1],
    },
    layout: {
      'line-cap': 'round',
      'line-join': 'round',
    },
  };
}

function getPreviewCollection(
  preview: GeomanLineEndpointConnectionPreview,
): FeatureCollection<LineString> {
  const fromCoordinate = getEndpointCoordinate(preview.from);

  if (!fromCoordinate) {
    return EMPTY_COLLECTION;
  }

  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {
          role: 'line-endpoint-connection-preview',
          fromEndpoint: preview.from.endpoint,
          toEndpoint: preview.to.endpoint,
        },
        geometry: {
          type: 'LineString',
          coordinates: [
            [...fromCoordinate] as LngLatTuple,
            [...preview.to.coordinate] as LngLatTuple,
          ],
        },
      },
    ],
  };
}

function getEndpointCoordinate(endpoint: GeomanLineEndpointConnectionEndpoint): LngLatTuple | null {
  const part = getLinePart(endpoint.feature, endpoint.partIndex ?? null);
  if (!part) {
    return null;
  }

  const vertexIndex = endpoint.endpoint === 'start' ? 0 : part.length - 1;
  const coordinate = part[vertexIndex];

  return coordinate ? ([...coordinate] as LngLatTuple) : null;
}

function getLinePart(feature: FeatureData, partIndex: number | null): Array<LngLatTuple> | null {
  const geometry = feature.getGeoJson().geometry;

  if (geometry.type === 'LineString') {
    return geometry.coordinates as Array<LngLatTuple>;
  }

  if (geometry.type === 'MultiLineString') {
    const parts = geometry.coordinates as Array<Array<LngLatTuple>>;
    return parts[partIndex ?? 0] ?? null;
  }

  return null;
}

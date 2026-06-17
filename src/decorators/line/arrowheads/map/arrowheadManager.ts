import type { Map } from 'maplibre-gl';
import type { Feature, LineString, MultiLineString } from 'geojson';
import { generateArrowheads } from '../generator.ts';
import type { ArrowheadOptions } from '../types.ts';
import type { LineDecoratorLayerPosition } from '../../layerPosition.ts';
import {
  ensureArrowheadSource,
  updateArrowheadSource,
  clearArrowheadSource,
  type ArrowheadSourceIds,
  type EnsureArrowheadSourceOptions,
} from './arrowheadSource.ts';

export type ArrowheadManagerOptions = EnsureArrowheadSourceOptions & {
  map: Map;
  ids?: Partial<ArrowheadSourceIds>;
};

export class ArrowheadManager {
  private map: Map;
  private ids: ArrowheadSourceIds;
  private layerPosition: LineDecoratorLayerPosition | undefined;

  constructor(options: ArrowheadManagerOptions) {
    this.map = options.map;
    this.layerPosition = options.layerPosition;
    this.ids = ensureArrowheadSource(this.map, options);
  }

  update(line: LineString | MultiLineString, options: ArrowheadOptions) {
    const collection = generateArrowheads({
      map: this.map,
      line,
      options,
    });

    updateArrowheadSource(this.map, this.ids, collection);
  }

  clear() {
    updateArrowheadSource(this.map, this.ids, {
      type: 'FeatureCollection',
      features: [],
    });
  }

  destroy() {
    clearArrowheadSource(this.map, this.ids);
  }

  getSourceIds(): ArrowheadSourceIds {
    return this.ids;
  }

  updateFromFeatures(
    features: Feature[],
    resolveOptions?: (feature: Feature) => ArrowheadOptions | null | undefined,
  ) {
    this.ids = ensureArrowheadSource(this.map, {
      ids: this.ids,
      layerPosition: this.layerPosition,
    });

    const arrowheadFeatures = features.flatMap((feature) => {
      if (
        !feature.geometry ||
        (feature.geometry.type !== 'LineString' && feature.geometry.type !== 'MultiLineString')
      ) {
        return [];
      }

      const options = resolveOptions ? (resolveOptions(feature) ?? {}) : {};

      const collection = generateArrowheads({
        map: this.map,
        line: feature.geometry,
        options,
      });

      return collection.features.map((arrowFeature) => ({
        ...arrowFeature,
        properties: {
          ...arrowFeature.properties,
          parentId: feature.id ?? null,
        },
      }));
    });

    updateArrowheadSource(this.map, this.ids, {
      type: 'FeatureCollection',
      features: arrowheadFeatures,
    });
  }
}

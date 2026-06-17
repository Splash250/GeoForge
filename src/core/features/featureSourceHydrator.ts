import { FeatureData } from './feature-data.ts';
import { FEATURE_ID_PROPERTY } from './constants.ts';
import type { FeatureId, FeatureSourceName, SourcesStorage } from '../../types/features.ts';
import type { GeoJsonShapeFeature } from '../../types/geojson.ts';
import type { Geoman } from '@/main.ts';
import { typedKeys } from '../../utils/typing.ts';
import { cloneDeep } from 'lodash-es';

type FeatureSourceHydratorOptions = {
  gm: Geoman;
  sources: SourcesStorage;
  hasFeature: (sourceName: FeatureSourceName, featureId: FeatureId) => boolean;
  setFeature: (
    sourceName: FeatureSourceName,
    featureId: FeatureId,
    featureData: FeatureData,
  ) => void;
};

export type FeatureSourceHydrationResult = {
  maxCounter: number;
};

export class FeatureSourceHydrator {
  private gm: Geoman;
  private sources: SourcesStorage;
  private hasFeature: (sourceName: FeatureSourceName, featureId: FeatureId) => boolean;
  private setFeature: (
    sourceName: FeatureSourceName,
    featureId: FeatureId,
    featureData: FeatureData,
  ) => void;

  constructor({ gm, sources, hasFeature, setFeature }: FeatureSourceHydratorOptions) {
    this.gm = gm;
    this.sources = sources;
    this.hasFeature = hasFeature;
    this.setFeature = setFeature;
  }

  hydrate(): FeatureSourceHydrationResult {
    let maxCounter = 0;

    typedKeys(this.sources).forEach((sourceName) => {
      const source = this.sources[sourceName];
      if (!source) return;

      try {
        const geoJson = source.getGeoJson();
        if (geoJson && 'features' in geoJson) {
          for (const feature of geoJson.features) {
            const featureId = feature.properties?.[FEATURE_ID_PROPERTY] as FeatureId | undefined;
            if (!featureId) continue;

            if (typeof featureId === 'string' && featureId.startsWith('feature-')) {
              const num = parseInt(featureId.replace('feature-', ''), 10);
              if (!isNaN(num) && num > maxCounter) {
                maxCounter = num;
              }
            }

            if (this.hasFeature(sourceName, featureId)) continue;

            const shapeGeoJson = feature as GeoJsonShapeFeature;
            const featureData = new FeatureData({
              gm: this.gm,
              id: featureId,
              parent: null,
              source,
              geoJsonShapeFeature: cloneDeep(shapeGeoJson),
              skipSourceUpdate: true,
            });

            this.setFeature(sourceName, featureId, featureData);
          }
        }
      } catch {
        // Source might not be ready yet, ignore
      }
    });

    return { maxCounter };
  }
}

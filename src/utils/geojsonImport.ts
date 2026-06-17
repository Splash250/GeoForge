import type { FeatureId } from '@/types/features.ts';
import type { GeoJsonImportFeature } from '@/types/geojson.ts';
import rewind from '@turf/rewind';
import type { Feature } from 'geojson';
import { isLineBasedGeoJsonFeature, isPointBasedGeoJsonFeature } from './geojsonTypes.ts';

export const fixGeoJsonFeature = (feature: GeoJsonImportFeature): GeoJsonImportFeature | null => {
  if (isLineBasedGeoJsonFeature(feature)) {
    const resultFeature = rewind(feature, { mutate: false });
    if (resultFeature.type === 'Feature' && isLineBasedGeoJsonFeature(resultFeature)) {
      return {
        ...resultFeature,
        properties: feature.properties || {},
      };
    }
  }

  if (isPointBasedGeoJsonFeature(feature)) {
    return feature;
  }

  return null;
};

export const getCustomFeatureId = (
  featureGeoJson: Feature,
  idPropertyName: string,
): FeatureId | null => {
  const featureId = featureGeoJson.properties?.[idPropertyName];
  if (typeof featureId === 'string' || typeof featureId === 'number') {
    return featureId;
  }
  return null;
};

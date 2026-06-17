import type { FeatureData } from './feature-data.ts';
import type { BaseMapAdapter } from '../map/base/index.ts';
import type { FeatureSourceName } from '../../types/features.ts';
import type { AnyMapInstance, ScreenPoint } from '../../types/map/index.ts';
import { getGeoJsonBounds } from '../../utils/geojson.ts';
import { isMapPointerEvent } from '../../utils/guards/map.ts';
import type { BaseMapPointerEvent } from '@mapLib/types/events.ts';
import type { Feature, LineString, MultiPolygon, Polygon } from 'geojson';

type FeatureQueryServiceOptions = {
  mapAdapter: Pick<
    BaseMapAdapter<AnyMapInstance>,
    'coordBoundsToScreenBounds' | 'queryFeaturesByScreenCoordinates'
  >;
};

export class FeatureQueryService {
  private readonly mapAdapter: FeatureQueryServiceOptions['mapAdapter'];

  constructor({ mapAdapter }: FeatureQueryServiceOptions) {
    this.mapAdapter = mapAdapter;
  }

  getFeatureByMouseEvent({
    event,
    sourceNames,
  }: {
    event: BaseMapPointerEvent;
    sourceNames: Array<FeatureSourceName>;
  }): FeatureData | null {
    if (!isMapPointerEvent(event, { warning: true })) {
      return null;
    }

    const point: ScreenPoint = [event.point.x, event.point.y];
    const features = this.mapAdapter.queryFeaturesByScreenCoordinates({
      queryCoordinates: point,
      sourceNames,
    });
    return features.length ? features[0] : null;
  }

  getFeaturesByGeoJsonBounds({
    geoJson,
    sourceNames,
  }: {
    geoJson: Feature<Polygon | MultiPolygon | LineString>;
    sourceNames: Array<FeatureSourceName>;
  }): Array<FeatureData> {
    const coordBounds = getGeoJsonBounds(geoJson);
    const polygonScreenBounds = this.mapAdapter.coordBoundsToScreenBounds(coordBounds);

    return this.getFeaturesByScreenBounds({ bounds: polygonScreenBounds, sourceNames });
  }

  getFeaturesByScreenBounds({
    bounds,
    sourceNames,
  }: {
    bounds: [ScreenPoint, ScreenPoint];
    sourceNames: Array<FeatureSourceName>;
  }) {
    return this.mapAdapter.queryFeaturesByScreenCoordinates({
      queryCoordinates: bounds,
      sourceNames,
    });
  }
}

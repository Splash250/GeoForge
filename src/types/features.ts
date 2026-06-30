import type { FeatureData } from '@/core/features/feature-data.ts';
import {
  FEATURE_ID_PROPERTY,
  FEATURE_PROPERTY_PREFIX,
  SOURCES,
} from '@/core/features/constants.ts';
import type { BaseSource } from '@/core/map/base/source.ts';
import type { Geoman } from '@/main.ts';
import type { GeoJsonShapeFeature } from '@/types/geojson.ts';
import type { FeatureFwdEvent } from '@/types/events/forwarder/features.ts';
import type { GeomanHistorySubscriptionEvent } from '@/history/types.ts';
import type { LngLatTuple } from '@/types/map/index.ts';
import type { MarkerData, ShapeName } from '@/types/modes/index.ts';
import type { WithPrefixedKeys } from '@/types/utils.ts';
import type { GeoJsonShapeFeatureCollection } from '@/types/geojson.ts';

export type FeatureId = number | string;
export type FeatureOwnerId = number | string;

export type FeatureShape = ShapeName | `${MarkerData['type']}_marker` | 'snap_guide';

export type ShapeGeoJsonProperties = {
  [FEATURE_ID_PROPERTY]?: FeatureId;
  [key: string]: unknown;
};

export type FeatureDataParameters = {
  gm: Geoman;
  id: FeatureId;
  ownerId?: FeatureOwnerId;
  parent: FeatureData | null;
  source: BaseSource;
  geoJsonShapeFeature: GeoJsonShapeFeature;
  /** Skip adding to source (used when hydrating from existing source data) */
  skipSourceUpdate?: boolean;
};

export type FeatureSourceName = (typeof SOURCES)[keyof typeof SOURCES];
export type SourcesStorage = { [key in FeatureSourceName]: BaseSource | null };
export type FeatureStore = Map<string, FeatureData>;
export type ForEachFeatureDataCallbackFn = (
  value: FeatureData,
  key: FeatureId,
  map: FeatureStore,
) => void;

export type FeatureHistoryOptions = {
  /**
   * Set to false to skip recording this single feature operation in history.
   *
   * Use geoForge.history.suspend(...) when suppressing history for a multi-operation batch.
   */
  history?: boolean;
};

export type FeatureMutationOptions = FeatureHistoryOptions;

export type FeatureShapeProperties = {
  id?: FeatureId;
  shape?: FeatureShape;
  center?: LngLatTuple;
  xSemiAxis?: number;
  ySemiAxis?: number;
  angle?: number;
  text?: string;
  disableEdit?: boolean;
};

export type PrefixedFeatureShapeProperties = WithPrefixedKeys<
  FeatureShapeProperties,
  typeof FEATURE_PROPERTY_PREFIX
>;

export type ImportGeoJsonOptions = {
  /** Property name to use as feature ID (e.g., 'id', 'customId') */
  idPropertyName?: string;
  /** If true, existing features with the same ID will be replaced */
  overwrite?: boolean;
  /** Runtime owner used for scoped lookup and cleanup through features.getByOwner/deleteByOwner */
  ownerId?: FeatureOwnerId;
} & FeatureHistoryOptions;

export type GeomanUnsubscribe = () => void;

export type GeomanFeatureSubscriptionOptions = {
  sourceNames?: Array<FeatureSourceName>;
  includeTemporary?: boolean;
};

export type GeomanFeatureSubscriptionEventType = 'create' | 'update' | 'delete' | 'unknown';

export type GeomanFeatureSubscriptionEvent = {
  type: GeomanFeatureSubscriptionEventType;
  name: string;
  sourceNames: Array<FeatureSourceName>;
  features: Array<FeatureData>;
  geoJson: GeoJsonShapeFeatureCollection;
  feature?: FeatureData;
  originalEvent?: FeatureFwdEvent | GeomanHistorySubscriptionEvent | unknown;
};

export type GeomanFeatureSubscriptionCallback = (event: GeomanFeatureSubscriptionEvent) => void;

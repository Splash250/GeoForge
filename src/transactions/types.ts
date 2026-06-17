import type { FeatureData } from '@/core/features/feature-data.ts';
import type { FeatureId, FeatureSourceName } from '@/types/features.ts';
import type { GeoJsonShapeFeature } from '@/types/geojson.ts';

export type GeomanTransactionStatus = 'active' | 'committed' | 'cancelled';

export type GeomanTransactionFeatureRef = {
  id: FeatureId;
  sourceName: FeatureSourceName;
};

export type GeomanTransactionChange = {
  feature: FeatureData;
  ref: GeomanTransactionFeatureRef;
  before: GeoJsonShapeFeature;
  after: GeoJsonShapeFeature;
};

export type GeomanTransactionValidationResult =
  | void
  | boolean
  | string
  | string[]
  | {
      valid: boolean;
      messages?: string[];
    };

export type GeomanTransactionValidator = (transaction: {
  id: string;
  getChanges: () => GeomanTransactionChange[];
  isDirty: () => boolean;
}) => GeomanTransactionValidationResult;

export type GeomanTransactionOptions = {
  id?: string;
  validate?: GeomanTransactionValidator;
};

export type GeomanTransactionCommitResult = {
  committed: boolean;
  messages: string[];
  historyEntryId?: string | null;
};

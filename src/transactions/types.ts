import type { FeatureData } from '@/core/features/feature-data.ts';
import type { GeomanHistoryState } from '@/history/types.ts';
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
  label?: string;
};

export type GeomanTransactionCommitResult = {
  committed: boolean;
  messages: string[];
  historyEntryId?: string | null;
};

export type GeomanFeaturePropertyEditorValidationContext = {
  feature: FeatureData;
  id: string;
  values: Record<string, unknown>;
  properties: Record<string, unknown>;
};

export type GeomanFeaturePropertyEditorValidator = (
  context: GeomanFeaturePropertyEditorValidationContext,
) => GeomanTransactionValidationResult;

export type GeomanFeaturePropertyEditorOptions = {
  feature: FeatureData;
  id: string;
  validate?: GeomanFeaturePropertyEditorValidator;
  label?: string;
};

export type GeomanFeaturePropertyEditorState = {
  id: string;
  values: Record<string, unknown>;
  properties: Record<string, unknown>;
  dirty: boolean;
  active: boolean;
  available: boolean;
  disposed: boolean;
  blocked: boolean;
  blockReason: string | null;
  canCommit: boolean;
  canCancel: boolean;
  canUndo: boolean;
  canRedo: boolean;
  validationMessages: string[];
  history: GeomanHistoryState | null;
};

export type GeomanFeaturePropertyEditorSubscription = (
  state: GeomanFeaturePropertyEditorState,
) => void;

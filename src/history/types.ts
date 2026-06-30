import type { FeatureId, FeatureSourceName } from '@/types/features.ts';
import type { GeoJsonShapeFeature } from '@/types/geojson.ts';

export type GeomanHistoryOperationKind = 'create' | 'update' | 'delete';

export type GeomanFeatureRef = {
  sourceName: FeatureSourceName;
  featureId: FeatureId;
};

export type GeomanFeatureMutationKind = GeomanHistoryOperationKind;

export type GeomanFeatureMutationRecord = {
  id: string;
  kind: GeomanFeatureMutationKind;
  ref: GeomanFeatureRef;
  before: GeoJsonShapeFeature | null;
  after: GeoJsonShapeFeature | null;
  reason: string;
  groupId: string | null;
  timestamp: number;
};

export type GeomanHistoryOperation = {
  kind: GeomanHistoryOperationKind;
  ref: GeomanFeatureRef;
  before: GeoJsonShapeFeature | null;
  after: GeoJsonShapeFeature | null;
};

export type GeomanHistoryEntry = {
  id: string;
  label?: string;
  createdAt: number;
  operations: GeomanHistoryOperation[];
};

export type GeomanHistoryOptions = {
  enabled: boolean;
  maxEntries: number;
};

export type GeomanHistoryOptionsPartial = Partial<GeomanHistoryOptions>;

export type GeomanHistoryState = {
  canUndo: boolean;
  canRedo: boolean;
  undoCount: number;
  redoCount: number;
  maxEntries: number;
  enabled: boolean;
};

export type GeomanHistorySubscriptionEventType = 'initial' | 'record' | 'change' | 'undo' | 'redo';

export type GeomanHistorySubscriptionEvent = {
  type: GeomanHistorySubscriptionEventType;
  name: 'gm:historyrecord' | 'gm:historychange' | 'gm:undo' | 'gm:redo' | null;
  entry?: GeomanHistoryEntry;
  originalEvent?: unknown;
};

export type GeomanHistorySubscriptionCallback = (
  state: GeomanHistoryState,
  event: GeomanHistorySubscriptionEvent,
) => void;

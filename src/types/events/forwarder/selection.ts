import type { FeatureData } from '@/core/features/feature-data.ts';
import type {
  GmHelperSelectionClearedEvent,
  GmHelperSelectionSelectedEvent,
} from '@/types/events/helper.ts';
import type { AnyMapInstance } from '@/types/map/index.ts';
import type { BaseFwdEvent } from '@/types/events/forwarder/base.ts';
import type { GmPrefix } from '@/types';

export interface SelectFwdEvent extends BaseFwdEvent<GmHelperSelectionSelectedEvent> {
  name: `${GmPrefix}:select`;
  feature: FeatureData;
  previousFeature: FeatureData | null;
  reason: GmHelperSelectionSelectedEvent['reason'];
  map: AnyMapInstance;
}

export interface DeselectFwdEvent extends BaseFwdEvent<GmHelperSelectionClearedEvent> {
  name: `${GmPrefix}:deselect`;
  feature: null;
  previousFeature: FeatureData;
  reason: GmHelperSelectionClearedEvent['reason'];
  map: AnyMapInstance;
}

export type SelectionFwdEvent = SelectFwdEvent | DeselectFwdEvent;

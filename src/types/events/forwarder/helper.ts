import type { FeatureData } from '@/core/features/feature-data.ts';
import type {
  GmHelperFeatureClickEvent,
  GmHelperFeatureHoverEndEvent,
  GmHelperFeatureHoverEvent,
  GmHelperMapBlankClickEvent,
} from '@/types/events/helper.ts';
import type { BaseFwdEvent } from '@/types/events/forwarder/base.ts';
import type { GmPrefix } from '@/types/events/index.ts';
import type { FeatureSourceName } from '@/types/features.ts';
import type { AnyMapInstance } from '@/types/map/index.ts';
import type { BaseMapPointerEvent } from '@mapLib/types/events.ts';

export interface FeatureHoverFwdEvent extends BaseFwdEvent<GmHelperFeatureHoverEvent> {
  name: `${GmPrefix}:featurehover`;
  mode: 'click_to_edit';
  feature: FeatureData;
  previousFeature: FeatureData | null;
  sourceName: FeatureSourceName;
  point: BaseMapPointerEvent['point'];
  lngLat: BaseMapPointerEvent['lngLat'];
  originalEvent: BaseMapPointerEvent['originalEvent'];
  map: AnyMapInstance;
}

export interface FeatureHoverEndFwdEvent extends BaseFwdEvent<GmHelperFeatureHoverEndEvent> {
  name: `${GmPrefix}:featurehoverend`;
  mode: 'click_to_edit';
  feature: FeatureData;
  reason: GmHelperFeatureHoverEndEvent['reason'];
  map: AnyMapInstance;
}

export interface FeatureClickFwdEvent extends BaseFwdEvent<GmHelperFeatureClickEvent> {
  name: `${GmPrefix}:featureclick`;
  mode: 'click_to_edit';
  feature: FeatureData;
  sourceName: FeatureSourceName;
  point: BaseMapPointerEvent['point'];
  lngLat: BaseMapPointerEvent['lngLat'];
  originalEvent: BaseMapPointerEvent['originalEvent'];
  map: AnyMapInstance;
}

export interface MapBlankClickFwdEvent extends BaseFwdEvent<GmHelperMapBlankClickEvent> {
  name: `${GmPrefix}:mapblankclick`;
  mode: 'click_to_edit';
  point: BaseMapPointerEvent['point'];
  lngLat: BaseMapPointerEvent['lngLat'];
  originalEvent: BaseMapPointerEvent['originalEvent'];
  map: AnyMapInstance;
}

export type HelperInteractionFwdEvent =
  | FeatureHoverFwdEvent
  | FeatureHoverEndFwdEvent
  | FeatureClickFwdEvent
  | MapBlankClickFwdEvent;

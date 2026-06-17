import { type GmBaseEvent, type GmSystemPrefix } from '@/types/events/index.ts';
import type { GmBaseModeEvent } from '@/types/events/mode.ts';
import type { FeatureData } from '@/core/features/feature-data.ts';
import type { FeatureSourceName } from '@/types/features.ts';
import type { GeomanSelectionChangeReason } from '@/selection/types.ts';
import type { HelperModeName } from '@/types/modes/index.ts';
import type { BaseMapPointerEvent } from '@mapLib/types/events.ts';
import type { GeomanToolCancelReason } from '@/tools/types.ts';

export interface GmHelperModeEvent extends GmBaseModeEvent {
  name: `${GmSystemPrefix}:helper:mode`;
  actionType: 'helper';
  mode: HelperModeName;
}

export const geofencingViolationActions = [
  'intersection_violation',
  'containment_violation',
] as const;

export interface GmGeofencingViolationEvent extends GmBaseEvent {
  name: `${GmSystemPrefix}:helper:geofencing_violation`;
  mode: 'geofencing';
  actionType: 'draw' | 'edit';
  action: (typeof geofencingViolationActions)[number];
}

export interface GmHelperSelectionSelectedEvent extends GmBaseEvent {
  name: `${GmSystemPrefix}:helper:selection`;
  actionType: 'helper';
  mode: 'click_to_edit';
  action: 'selected';
  previousFeature: FeatureData | null;
  feature: FeatureData;
  reason: GeomanSelectionChangeReason;
}

export interface GmHelperSelectionClearedEvent extends GmBaseEvent {
  name: `${GmSystemPrefix}:helper:selection`;
  actionType: 'helper';
  mode: 'click_to_edit';
  action: 'cleared';
  previousFeature: FeatureData;
  feature: null;
  reason: GeomanSelectionChangeReason;
}

export type GmHelperSelectionEvent = GmHelperSelectionSelectedEvent | GmHelperSelectionClearedEvent;

export type GmHelperFeatureHoverEndReason =
  | 'feature-leave'
  | 'map-leave'
  | 'map-click'
  | 'mode-end'
  | 'api';

export interface GmHelperFeatureHoverEvent extends GmBaseEvent {
  name: `${GmSystemPrefix}:helper:feature_hover`;
  actionType: 'helper';
  action: 'feature_hover';
  mode: 'click_to_edit';
  feature: FeatureData;
  previousFeature: FeatureData | null;
  sourceName: FeatureSourceName;
  point: BaseMapPointerEvent['point'];
  lngLat: BaseMapPointerEvent['lngLat'];
  originalEvent: BaseMapPointerEvent['originalEvent'];
}

export interface GmHelperFeatureHoverEndEvent extends GmBaseEvent {
  name: `${GmSystemPrefix}:helper:feature_hover_end`;
  actionType: 'helper';
  action: 'feature_hover_end';
  mode: 'click_to_edit';
  feature: FeatureData;
  reason: GmHelperFeatureHoverEndReason;
}

export interface GmHelperFeatureClickEvent extends GmBaseEvent {
  name: `${GmSystemPrefix}:helper:feature_click`;
  actionType: 'helper';
  action: 'feature_click';
  mode: 'click_to_edit';
  feature: FeatureData;
  sourceName: FeatureSourceName;
  point: BaseMapPointerEvent['point'];
  lngLat: BaseMapPointerEvent['lngLat'];
  originalEvent: BaseMapPointerEvent['originalEvent'];
}

export interface GmHelperMapBlankClickEvent extends GmBaseEvent {
  name: `${GmSystemPrefix}:helper:map_blank_click`;
  actionType: 'helper';
  action: 'map_blank_click';
  mode: 'click_to_edit';
  point: BaseMapPointerEvent['point'];
  lngLat: BaseMapPointerEvent['lngLat'];
  originalEvent: BaseMapPointerEvent['originalEvent'];
}

export type GmHelperInteractionEvent =
  | GmHelperFeatureHoverEvent
  | GmHelperFeatureHoverEndEvent
  | GmHelperFeatureClickEvent
  | GmHelperMapBlankClickEvent;

export interface GmHelperToolStartEvent extends GmBaseEvent {
  name: `${GmSystemPrefix}:helper:tool_start`;
  actionType: 'helper';
  action: 'tool_start';
  toolId: string;
}

export interface GmHelperToolEndEvent extends GmBaseEvent {
  name: `${GmSystemPrefix}:helper:tool_end`;
  actionType: 'helper';
  action: 'tool_end';
  toolId: string;
}

export interface GmHelperToolCancelEvent extends GmBaseEvent {
  name: `${GmSystemPrefix}:helper:tool_cancel`;
  actionType: 'helper';
  action: 'tool_cancel';
  toolId: string;
  reason: GeomanToolCancelReason;
}

export type GmHelperToolLifecycleEvent =
  | GmHelperToolStartEvent
  | GmHelperToolEndEvent
  | GmHelperToolCancelEvent;

export type GmHelperEvent =
  | GmHelperModeEvent
  | GmGeofencingViolationEvent
  | GmHelperSelectionEvent
  | GmHelperInteractionEvent
  | GmHelperToolLifecycleEvent;

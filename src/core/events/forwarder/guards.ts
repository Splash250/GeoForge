import { GM_SYSTEM_PREFIX } from '@/core/constants.ts';
import { SOURCES } from '@/core/features/constants.ts';
import type { GeomanSelectionChangeReason } from '@/selection/types.ts';
import type {
  GmHelperFeatureClickEvent,
  GmHelperFeatureHoverEndEvent,
  GmHelperFeatureHoverEndReason,
  GmHelperFeatureHoverEvent,
  GmHelperMapBlankClickEvent,
  GmHelperSelectionEvent,
  GmHelperToolLifecycleEvent,
} from '@/types/events/helper.ts';
import type { GmSystemEvent } from '@/types/events/index.ts';
import type { FeatureSourceName } from '@/types/features.ts';
import type { GeomanToolCancelReason } from '@/tools/types.ts';

const SELECTION_CHANGE_REASONS = new Set<GeomanSelectionChangeReason>([
  'api',
  'feature-click',
  'map-click',
  'escape',
  'mode-end',
  'draw-start',
  'destroy',
  'feature-removed',
]);

const HELPER_FEATURE_HOVER_END_REASONS = new Set<GmHelperFeatureHoverEndReason>([
  'feature-leave',
  'map-leave',
  'map-click',
  'mode-end',
  'api',
]);

const TOOL_CANCEL_REASONS = new Set<GeomanToolCancelReason>(['api']);

const FEATURE_SOURCE_NAMES = new Set<FeatureSourceName>(
  Object.values(SOURCES) as Array<FeatureSourceName>,
);

const POINTER_PAYLOAD_KEYS = ['point', 'lngLat', 'originalEvent'] as const;

function isFeatureSourceName(value: unknown): value is FeatureSourceName {
  return typeof value === 'string' && FEATURE_SOURCE_NAMES.has(value as FeatureSourceName);
}

function hasPointerPayloadValues(payload: GmSystemEvent): boolean {
  const record = payload as Record<string, unknown>;

  return POINTER_PAYLOAD_KEYS.every((key) => record[key] !== null && record[key] !== undefined);
}

function hasToolId(payload: GmSystemEvent): payload is GmSystemEvent & { toolId: string } {
  return 'toolId' in payload && typeof payload.toolId === 'string' && payload.toolId.length > 0;
}

export function isSelectionEvent(payload: GmSystemEvent): payload is GmHelperSelectionEvent {
  const hasValidReason =
    'reason' in payload &&
    typeof payload.reason === 'string' &&
    SELECTION_CHANGE_REASONS.has(payload.reason as GeomanSelectionChangeReason);
  const hasValidPreviousFeature =
    'previousFeature' in payload &&
    (payload.previousFeature === null || typeof payload.previousFeature === 'object');

  if (
    payload.name !== `${GM_SYSTEM_PREFIX}:helper:selection` ||
    payload.actionType !== 'helper' ||
    !('mode' in payload) ||
    payload.mode !== 'click_to_edit' ||
    !hasValidReason
  ) {
    return false;
  }

  if (payload.action === 'selected') {
    return (
      'feature' in payload &&
      payload.feature !== null &&
      typeof payload.feature === 'object' &&
      hasValidPreviousFeature
    );
  }

  return (
    payload.action === 'cleared' &&
    'feature' in payload &&
    payload.feature === null &&
    payload.previousFeature !== null &&
    typeof payload.previousFeature === 'object'
  );
}

export function isHelperFeatureHoverEvent(
  payload: GmSystemEvent,
): payload is GmHelperFeatureHoverEvent {
  return (
    payload.name === `${GM_SYSTEM_PREFIX}:helper:feature_hover` &&
    payload.actionType === 'helper' &&
    payload.action === 'feature_hover' &&
    'mode' in payload &&
    payload.mode === 'click_to_edit' &&
    'feature' in payload &&
    payload.feature !== null &&
    typeof payload.feature === 'object' &&
    'previousFeature' in payload &&
    (payload.previousFeature === null || typeof payload.previousFeature === 'object') &&
    'sourceName' in payload &&
    isFeatureSourceName(payload.sourceName) &&
    hasPointerPayloadValues(payload)
  );
}

export function isHelperFeatureHoverEndEvent(
  payload: GmSystemEvent,
): payload is GmHelperFeatureHoverEndEvent {
  return (
    payload.name === `${GM_SYSTEM_PREFIX}:helper:feature_hover_end` &&
    payload.actionType === 'helper' &&
    payload.action === 'feature_hover_end' &&
    'mode' in payload &&
    payload.mode === 'click_to_edit' &&
    'feature' in payload &&
    payload.feature !== null &&
    typeof payload.feature === 'object' &&
    'reason' in payload &&
    typeof payload.reason === 'string' &&
    HELPER_FEATURE_HOVER_END_REASONS.has(payload.reason as GmHelperFeatureHoverEndReason)
  );
}

export function isHelperFeatureClickEvent(
  payload: GmSystemEvent,
): payload is GmHelperFeatureClickEvent {
  return (
    payload.name === `${GM_SYSTEM_PREFIX}:helper:feature_click` &&
    payload.actionType === 'helper' &&
    payload.action === 'feature_click' &&
    'mode' in payload &&
    payload.mode === 'click_to_edit' &&
    'feature' in payload &&
    payload.feature !== null &&
    typeof payload.feature === 'object' &&
    'sourceName' in payload &&
    isFeatureSourceName(payload.sourceName) &&
    hasPointerPayloadValues(payload)
  );
}

export function isHelperMapBlankClickEvent(
  payload: GmSystemEvent,
): payload is GmHelperMapBlankClickEvent {
  return (
    payload.name === `${GM_SYSTEM_PREFIX}:helper:map_blank_click` &&
    payload.actionType === 'helper' &&
    payload.action === 'map_blank_click' &&
    'mode' in payload &&
    payload.mode === 'click_to_edit' &&
    hasPointerPayloadValues(payload)
  );
}

export function isHelperToolLifecycleEvent(
  payload: GmSystemEvent,
): payload is GmHelperToolLifecycleEvent {
  if (payload.actionType !== 'helper' || !hasToolId(payload)) {
    return false;
  }

  if (payload.action === 'tool_start') {
    return payload.name === `${GM_SYSTEM_PREFIX}:helper:tool_start`;
  }

  if (payload.action === 'tool_end') {
    return payload.name === `${GM_SYSTEM_PREFIX}:helper:tool_end`;
  }

  return (
    payload.name === `${GM_SYSTEM_PREFIX}:helper:tool_cancel` &&
    payload.action === 'tool_cancel' &&
    'reason' in payload &&
    typeof payload.reason === 'string' &&
    TOOL_CANCEL_REASONS.has(payload.reason as GeomanToolCancelReason)
  );
}

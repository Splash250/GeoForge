import { GM_PREFIX, type GM_SYSTEM_PREFIX } from '@/core/constants.ts';
import type {
  FeatureCreatedFwdEvent,
  FeatureEditEndFwdEvent,
  FeatureEditStartFwdEvent,
  FeatureRemovedFwdEvent,
  FeatureUpdatedFwdEvent,
  FeatureClickFwdEvent,
  FeatureHoverEndFwdEvent,
  FeatureHoverFwdEvent,
  FwdEditModeName,
  GlobalDrawEnabledDisabledFwdEvent,
  GlobalDrawToggledFwdEvent,
  GlobalEditToggledFwdEvent,
  GlobalHelperToggledFwdEvent,
  GmControlEvent,
  GmControlLoadEvent,
  DeselectFwdEvent,
  GmDrawEvent,
  GmEditEvent,
  GmEvent,
  GmHelperEvent,
  GmLoadStateFwdEvent,
  MapBlankClickFwdEvent,
  GmSystemEvent,
  HelperModeName,
  SelectFwdEvent,
  ToolCancelFwdEvent,
  ToolEndFwdEvent,
  ToolStartFwdEvent,
} from '@/types';
import type { BaseMapEvent } from '@mapLib/types/events.ts';

export type EventsMap = Record<`${typeof GM_SYSTEM_PREFIX}:draw`, GmDrawEvent> &
  Record<`${typeof GM_SYSTEM_PREFIX}:edit`, GmEditEvent> &
  Record<`${typeof GM_SYSTEM_PREFIX}:helper`, GmHelperEvent> &
  Record<`${typeof GM_SYSTEM_PREFIX}:control`, GmControlEvent> &
  // forwarded events
  Record<`${typeof GM_PREFIX}:globaldrawmodetoggled`, GlobalDrawToggledFwdEvent> &
  Record<`${typeof GM_PREFIX}:drawstart`, GlobalDrawEnabledDisabledFwdEvent> &
  Record<`${typeof GM_PREFIX}:drawend`, GlobalDrawEnabledDisabledFwdEvent> &
  Record<`${typeof GM_PREFIX}:global${FwdEditModeName}modetoggled`, GlobalEditToggledFwdEvent> &
  Record<`${typeof GM_PREFIX}:global${HelperModeName}modetoggled`, GlobalHelperToggledFwdEvent> &
  Record<`${typeof GM_PREFIX}:create`, FeatureCreatedFwdEvent> &
  Record<`${typeof GM_PREFIX}:remove`, FeatureRemovedFwdEvent> &
  Record<`${typeof GM_PREFIX}:${FwdEditModeName}`, FeatureUpdatedFwdEvent> &
  Record<`${typeof GM_PREFIX}:${FwdEditModeName}start`, FeatureEditStartFwdEvent> &
  Record<`${typeof GM_PREFIX}:${FwdEditModeName}end`, FeatureEditEndFwdEvent> &
  Record<`${typeof GM_PREFIX}:select`, SelectFwdEvent> &
  Record<`${typeof GM_PREFIX}:deselect`, DeselectFwdEvent> &
  Record<`${typeof GM_PREFIX}:featurehover`, FeatureHoverFwdEvent> &
  Record<`${typeof GM_PREFIX}:featurehoverend`, FeatureHoverEndFwdEvent> &
  Record<`${typeof GM_PREFIX}:featureclick`, FeatureClickFwdEvent> &
  Record<`${typeof GM_PREFIX}:mapblankclick`, MapBlankClickFwdEvent> &
  Record<`${typeof GM_PREFIX}:toolstart`, ToolStartFwdEvent> &
  Record<`${typeof GM_PREFIX}:toolend`, ToolEndFwdEvent> &
  Record<`${typeof GM_PREFIX}:toolcancel`, ToolCancelFwdEvent> &
  Record<`${typeof GM_PREFIX}:${GmControlLoadEvent['action']}`, GmLoadStateFwdEvent>;

export type EventFor<T extends string> = T extends keyof EventsMap
  ? EventsMap[T]
  : GmSystemEvent | GmEvent | BaseMapEvent;

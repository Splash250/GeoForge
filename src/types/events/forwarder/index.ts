import type { GmControlLoadEvent } from '@/types/events/control.ts';
import type { FeatureEditFwdEvent, FwdEditModeName } from '@/types/events/forwarder/edit.ts';
import type { FeatureFwdEvent } from '@/types/events/forwarder/features.ts';
import type { HelperInteractionFwdEvent } from '@/types/events/forwarder/helper.ts';
import type { GlobalModeToggledFwdEvent } from '@/types/events/forwarder/mode.ts';
import type {
  DeselectFwdEvent,
  SelectFwdEvent,
  SelectionFwdEvent,
} from '@/types/events/forwarder/selection.ts';
import type { SystemFwdEvent } from '@/types/events/forwarder/system.ts';
import type {
  ToolCancelFwdEvent,
  ToolEndFwdEvent,
  ToolLifecycleFwdEvent,
  ToolStartFwdEvent,
} from '@/types/events/forwarder/tool.ts';
import type {
  GmSystemEvent,
  GmEventNameWithoutPrefix,
  GmPrefix,
  GmSystemPrefix,
} from '@/types/events/index.ts';
import type { HelperModeName } from '@/types/modes/index.ts';

export type GmFwdEventNameWithPrefix = `${GmPrefix}:${GmFwdEventName}`;
export type GmFwdSystemEventNameWithPrefix = `${GmSystemPrefix}:${GmEventNameWithoutPrefix}`;
export type GlobalEventsListener = (event: GmSystemEvent | GmEvent) => void;

export type GmFwdEventName =
  | 'globaldrawmodetoggled'
  | 'drawstart'
  | 'drawend'
  | `global${FwdEditModeName}modetoggled`
  | `global${HelperModeName}modetoggled`
  | 'create'
  | 'remove'
  | FwdEditModeName
  | `${FwdEditModeName}start`
  | `${FwdEditModeName}end`
  | 'select'
  | 'deselect'
  | 'featurehover'
  | 'featurehoverend'
  | 'featureclick'
  | 'mapblankclick'
  | 'toolstart'
  | 'toolend'
  | 'toolcancel'
  | GmControlLoadEvent['action'];

export type GmEvent =
  | SystemFwdEvent
  | GlobalModeToggledFwdEvent
  | FeatureFwdEvent
  | FeatureEditFwdEvent
  | SelectionFwdEvent
  | HelperInteractionFwdEvent
  | ToolLifecycleFwdEvent;

export type GmSelectionFwdEventByName = {
  select: SelectFwdEvent;
  deselect: DeselectFwdEvent;
};

export type GmToolLifecycleFwdEventByName = {
  toolstart: ToolStartFwdEvent;
  toolend: ToolEndFwdEvent;
  toolcancel: ToolCancelFwdEvent;
};

export type * from '@/types/events/forwarder/edit.ts';
export type * from '@/types/events/forwarder/features.ts';
export type * from '@/types/events/forwarder/helper.ts';
export type * from '@/types/events/forwarder/mode.ts';
export type * from '@/types/events/forwarder/selection.ts';
export type * from '@/types/events/forwarder/system.ts';
export type * from '@/types/events/forwarder/tool.ts';

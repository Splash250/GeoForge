import type {
  GmHelperToolCancelEvent,
  GmHelperToolEndEvent,
  GmHelperToolStartEvent,
} from '@/types/events/helper.ts';
import type { BaseFwdEvent } from '@/types/events/forwarder/base.ts';
import type { GmPrefix } from '@/types/events/index.ts';
import type { AnyMapInstance } from '@/types/map/index.ts';

export interface ToolStartFwdEvent extends BaseFwdEvent<GmHelperToolStartEvent> {
  name: `${GmPrefix}:toolstart`;
  toolId: string;
  map: AnyMapInstance;
}

export interface ToolEndFwdEvent extends BaseFwdEvent<GmHelperToolEndEvent> {
  name: `${GmPrefix}:toolend`;
  toolId: string;
  map: AnyMapInstance;
}

export interface ToolCancelFwdEvent extends BaseFwdEvent<GmHelperToolCancelEvent> {
  name: `${GmPrefix}:toolcancel`;
  toolId: string;
  reason: GmHelperToolCancelEvent['reason'];
  map: AnyMapInstance;
}

export type ToolLifecycleFwdEvent = ToolStartFwdEvent | ToolEndFwdEvent | ToolCancelFwdEvent;

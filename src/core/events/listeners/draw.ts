import { GM_SYSTEM_PREFIX } from '@/core/constants.ts';
import { EventBus } from '@/core/events/bus.ts';
import { BaseEventListener } from '@/core/events/listeners/base.ts';
import type { Geoman } from '@/main.ts';
import { BaseDraw } from '@/modes/draw/base.ts';
import { createDrawInstance } from '@/modes/draw/index.ts';
import type { EventHandlers } from '@/types/events/bus.ts';
import type { GmDrawEvent } from '@/types/events/draw.ts';
import type { GmSystemEvent } from '@/types/events/index.ts';
import type { ActionInstanceKey } from '@/types/modes/index.ts';
import { isGmDrawEvent } from '@/utils/guards/modes.ts';
import log from '@/utils/log';

export class DrawEventListener extends BaseEventListener {
  eventHandlers: EventHandlers = {
    [`${GM_SYSTEM_PREFIX}:draw`]: this.handleDrawEvent.bind(this),
  };

  constructor(gm: Geoman, bus: EventBus) {
    super(gm);
    bus.attachEvents(this.eventHandlers);
  }

  handleDrawEvent(payload: GmSystemEvent) {
    if (!isGmDrawEvent(payload)) {
      return { next: true };
    }

    const actionInstanceKey: ActionInstanceKey = `${payload.actionType}__${payload.mode}`;

    if (payload.action === 'mode_start') {
      this.trackExclusiveModes(payload);
      this.gm.selection.clearSelection({ reason: 'draw-start' });
      this.gm.contextPanels.close('draw-start');
      this.start(actionInstanceKey, payload);
      this.trackRelatedModes(payload);
    } else if (payload.action === 'mode_end') {
      this.trackRelatedModes(payload);
      this.end(actionInstanceKey);
    }

    return { next: true };
  }

  start(actionInstanceKey: ActionInstanceKey, payload: GmDrawEvent) {
    const actionInstance = createDrawInstance(this.gm, payload.mode);
    if (!actionInstance) {
      return;
    }

    if (actionInstanceKey in this.gm.actionInstances) {
      log.error(`Action instance "${actionInstanceKey}" already exists`);
    }

    this.gm.actionInstances[actionInstanceKey] = actionInstance;
    actionInstance.startAction();
  }

  end(actionInstanceKey: ActionInstanceKey) {
    const actionInstance = this.gm.actionInstances[actionInstanceKey];
    if (actionInstance instanceof BaseDraw) {
      actionInstance.endAction();
      delete this.gm.actionInstances[actionInstanceKey];
    } else {
      console.error(`Wrong action instance for draw event "${actionInstanceKey}":`, actionInstance);
    }
  }
}

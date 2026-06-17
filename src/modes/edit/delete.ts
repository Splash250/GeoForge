import { SHAPE_NAMES } from '@/modes/constants.ts';
import { BaseEdit } from '@/modes/edit/base.ts';
import type { MapHandlerReturnData } from '@/types/events/bus.ts';
import type { FeatureShape } from '@/types/features.ts';
import type { EditModeName } from '@/types/modes/index.ts';
import { isMapPointerEvent } from '@/utils/guards/map.ts';

import { SOURCES } from '@/core/features/constants.ts';
import type { BaseMapEvent } from '@mapLib/types/events.ts';

export class EditDelete extends BaseEdit {
  mode: EditModeName = 'delete';
  allowedShapes: Array<FeatureShape> = [...SHAPE_NAMES];
  eventHandlers = {
    click: this.onMouseClick.bind(this),
  };

  onStartAction() {
    this.gm.markerPointer.enable({ invisibleMarker: true });
    this.gm.markerPointer.pauseSnapping();
  }

  onEndAction() {
    this.gm.markerPointer.resumeSnapping();
    this.gm.markerPointer.disable();
  }

  onMouseClick(event: BaseMapEvent): MapHandlerReturnData {
    if (!isMapPointerEvent(event, { warning: true })) {
      return { next: false };
    }

    const feature = this.getFeatureByMouseEvent({ event, sourceNames: [SOURCES.main] });
    if (feature && this.allowedShapes.includes(feature.shape)) {
      this.gm.features.delete(feature);
      this.fireFeatureRemovedEvent(feature);
    }
    return { next: false };
  }
}

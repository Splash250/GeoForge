import { GM_SYSTEM_PREFIX } from '@/core/constants.ts';
import type { FeatureData } from '@/core/features/feature-data.ts';
import { SOURCES } from '@/core/features/constants.ts';
import type { GeomanSelectionFilterReason } from '@/selection/types.ts';
import type {
  GmHelperFeatureClickEvent,
  GmHelperFeatureHoverEndEvent,
  GmHelperFeatureHoverEndReason,
  GmHelperFeatureHoverEvent,
  GmHelperMapBlankClickEvent,
  GmSystemEvent,
} from '@/types/events/index.ts';
import type { MapHandlerReturnData } from '@/types/events/bus.ts';
import type { FeatureSourceName } from '@/types/features.ts';
import { BaseHelper } from '@/modes/helpers/base.ts';
import { ShapeMarkersHelper } from '@/modes/helpers/shape-markers.ts';
import { isMapPointerEvent } from '@/utils/guards/map.ts';
import type { BaseMapEvent, BaseMapPointerEvent } from '@mapLib/types/events.ts';

export class ClickToEditHelper extends BaseHelper {
  mode = 'click_to_edit' as const;

  eventHandlers = {
    [`${GM_SYSTEM_PREFIX}:helper`]: this.onHelperEvent.bind(this),
    mousemove: this.onMouseMove.bind(this),
    mouseleave: this.onMouseLeave.bind(this),
    click: this.onClick.bind(this),
  };

  private readonly documentKeydownHandler = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') {
      return;
    }

    if (!this.gm.selection.shouldClearOnEscape()) {
      return;
    }

    this.gm.selection.clearSelection({ reason: 'escape' });
    this.refreshShapeMarkers();
  };

  onStartAction() {
    this.gm.selection.activate();
    document.addEventListener('keydown', this.documentKeydownHandler);
  }

  onEndAction() {
    this.fireHoveredFeatureEnd('mode-end');
    document.removeEventListener('keydown', this.documentKeydownHandler);
    this.gm.mapAdapter.setCursor('');
    this.gm.selection.deactivate({ reason: 'mode-end' });
    this.refreshShapeMarkers();
  }

  onMouseMove(event: BaseMapEvent): MapHandlerReturnData {
    if (!isMapPointerEvent(event)) {
      return { next: true };
    }

    const feature = this.getSelectableFeatureByMouseEvent(event, [SOURCES.main], 'hover');
    const previousFeature = this.gm.selection.getHoveredFeature();
    if (previousFeature?.id !== feature?.id) {
      this.fireFeatureHoverEnd(previousFeature, 'feature-leave');
      this.fireFeatureHover(feature, previousFeature, event);
    }

    this.gm.selection.setHoveredFeature(feature);
    this.gm.mapAdapter.setCursor(feature ? 'pointer' : '');
    return { next: true };
  }

  onMouseLeave(): MapHandlerReturnData {
    this.fireHoveredFeatureEnd('map-leave');
    this.gm.selection.clearHoveredFeature();
    this.gm.mapAdapter.setCursor('');
    return { next: true };
  }

  onClick(event: BaseMapEvent): MapHandlerReturnData {
    if (!isMapPointerEvent(event)) {
      return { next: true };
    }

    const feature = this.getSelectableFeatureByMouseEvent(event, [SOURCES.main], 'select');
    if (feature) {
      this.fireFeatureClick(feature, event);
      this.gm.selection.selectFeature(feature, { reason: 'feature-click' });
      this.refreshShapeMarkers();
      return { next: false };
    }

    this.fireMapBlankClick(event);

    if (!this.gm.selection.shouldClearOnMapClick()) {
      return { next: true };
    }

    this.fireHoveredFeatureEnd('map-click');
    this.gm.selection.clearSelection({ reason: 'map-click' });
    this.gm.selection.clearHoveredFeature();
    this.gm.mapAdapter.setCursor('');
    this.refreshShapeMarkers();
    return { next: true };
  }

  onHelperEvent(event: GmSystemEvent): MapHandlerReturnData {
    const action = (event as { action?: unknown }).action;
    const mode = (event as { mode?: unknown }).mode;

    if (
      event.actionType === 'helper' &&
      mode === 'click_to_edit' &&
      (action === 'selected' || action === 'cleared')
    ) {
      this.refreshShapeMarkers();
    }

    return { next: true };
  }

  private getSelectableFeatureByMouseEvent(
    event: BaseMapPointerEvent,
    sourceNames: FeatureSourceName[],
    reason: GeomanSelectionFilterReason,
  ) {
    const feature = this.gm.features.getFeatureByMouseEvent({ event, sourceNames });
    return this.getSelectableFeatureOrParent(feature, reason);
  }

  private getSelectableFeatureOrParent(
    feature: FeatureData | null,
    reason: GeomanSelectionFilterReason,
  ) {
    const parentFeature = feature?.parent ?? null;

    if (this.gm.selection.isSelectableFeature(feature, { reason })) {
      return feature;
    }

    if (parentFeature && this.gm.selection.isSelectableFeature(parentFeature, { reason })) {
      return parentFeature;
    }

    return null;
  }

  private fireFeatureHover(
    feature: FeatureData | null,
    previousFeature: FeatureData | null,
    event: BaseMapPointerEvent,
  ) {
    if (!feature) {
      return;
    }

    const payload: GmHelperFeatureHoverEvent = {
      name: `${GM_SYSTEM_PREFIX}:helper:feature_hover`,
      level: 'system',
      actionType: 'helper',
      mode: this.mode,
      action: 'feature_hover',
      feature,
      previousFeature,
      sourceName: feature.sourceName,
      point: event.point,
      lngLat: event.lngLat,
      originalEvent: event.originalEvent,
    };

    this.gm.events.fire(`${GM_SYSTEM_PREFIX}:helper`, payload);
  }

  private fireHoveredFeatureEnd(reason: GmHelperFeatureHoverEndReason) {
    this.fireFeatureHoverEnd(this.gm.selection.getHoveredFeature(), reason);
  }

  private fireFeatureHoverEnd(feature: FeatureData | null, reason: GmHelperFeatureHoverEndReason) {
    if (!feature) {
      return;
    }

    const payload: GmHelperFeatureHoverEndEvent = {
      name: `${GM_SYSTEM_PREFIX}:helper:feature_hover_end`,
      level: 'system',
      actionType: 'helper',
      mode: this.mode,
      action: 'feature_hover_end',
      feature,
      reason,
    };

    this.gm.events.fire(`${GM_SYSTEM_PREFIX}:helper`, payload);
  }

  private fireFeatureClick(feature: FeatureData, event: BaseMapPointerEvent) {
    const payload: GmHelperFeatureClickEvent = {
      name: `${GM_SYSTEM_PREFIX}:helper:feature_click`,
      level: 'system',
      actionType: 'helper',
      mode: this.mode,
      action: 'feature_click',
      feature,
      sourceName: feature.sourceName,
      point: event.point,
      lngLat: event.lngLat,
      originalEvent: event.originalEvent,
    };

    this.gm.events.fire(`${GM_SYSTEM_PREFIX}:helper`, payload);
  }

  private fireMapBlankClick(event: BaseMapPointerEvent) {
    const payload: GmHelperMapBlankClickEvent = {
      name: `${GM_SYSTEM_PREFIX}:helper:map_blank_click`,
      level: 'system',
      actionType: 'helper',
      mode: this.mode,
      action: 'map_blank_click',
      point: event.point,
      lngLat: event.lngLat,
      originalEvent: event.originalEvent,
    };

    this.gm.events.fire(`${GM_SYSTEM_PREFIX}:helper`, payload);
  }

  private refreshShapeMarkers() {
    const helper = this.gm.actionInstances.helper__shape_markers;
    if (helper instanceof ShapeMarkersHelper) {
      helper.refreshMarkers();
    }
  }
}

import type { FeatureData } from '@/core/features/feature-data.ts';
import { SOURCES } from '@/core/features/constants.ts';
import type { BaseMapEvent, BaseMapPointerEvent } from '@mapLib/types/events.ts';
import type {
  GeomanToolContext,
  GeomanToolDefinition,
  GeomanToolFeatureHoverEndReason,
  GeomanToolInteractionHookResult,
  GeomanToolSelectionOptions,
} from './types.ts';

type MapHandlerReturnData = { next: boolean };
type EventHandlers = Record<string, ((event: BaseMapEvent) => MapHandlerReturnData) | undefined>;
type FeatureSourceName = string;
type ToolSelectionFilterReason = 'hover' | 'select';
type ResolvedToolSelectionOptions = Required<
  Pick<GeomanToolSelectionOptions, 'enabled' | 'hover' | 'cursor'>
> &
  Pick<GeomanToolSelectionOptions, 'allowedShapes' | 'sourceNames'>;

const POINTER_EVENT_NAMES = new Set([
  'click',
  'dblclick',
  'mousedown',
  'mouseup',
  'mousemove',
  'mouseenter',
  'mouseleave',
  'mouseover',
  'mouseout',
  'contextmenu',
  'touchstart',
  'touchend',
  'touchmove',
  'touchcancel',
]);

type GeomanToolInteractionListenerOptions = {
  geoman: GeomanToolContext['geoman'];
  getActiveDefinition: () => GeomanToolDefinition | null;
  getContext: () => GeomanToolContext;
};

export class GeomanToolInteractionListener {
  private readonly eventHandlers: EventHandlers = {
    mousemove: this.onMouseMove.bind(this),
    mouseleave: this.onMouseLeave.bind(this),
    click: this.onClick.bind(this),
    contextmenu: this.onContextMenu.bind(this),
  };

  private attached = false;
  private hoveredFeature: FeatureData | null = null;
  private lifecycleVersion = 0;

  constructor(private readonly options: GeomanToolInteractionListenerOptions) {}

  start() {
    this.lifecycleVersion += 1;
    this.activateToolSelection(this.options.getActiveDefinition());

    if (this.attached) {
      return;
    }

    this.options.geoman.events.bus.attachEvents(this.eventHandlers);
    this.attached = true;
  }

  stop(definition: GeomanToolDefinition | null) {
    let hookError: unknown;
    this.lifecycleVersion += 1;

    try {
      if (definition) {
        this.fireHoveredFeatureEnd(definition, 'tool-end');
      }
    } catch (error) {
      hookError = error;
    } finally {
      this.hoveredFeature = null;
      this.clearToolSelection(definition);
      this.options.geoman.contextPanels.close('tool-end');

      if (this.attached && this.shouldDetachAfterStop(definition)) {
        this.options.geoman.events.bus.detachEvents(this.eventHandlers);
        this.attached = false;
      }
    }

    if (hookError !== undefined) {
      throw hookError;
    }
  }

  private onMouseMove(event: BaseMapEvent): MapHandlerReturnData {
    const definition = this.options.getActiveDefinition();
    if (!definition || !this.isMapPointerEvent(event)) {
      return { next: true };
    }

    const lifecycleVersion = this.lifecycleVersion;
    const feature = this.getSelectableFeatureByMouseEvent(
      event,
      this.getToolSourceNames(definition),
      'hover',
      definition,
    );
    const previousFeature = this.hoveredFeature;
    if (previousFeature?.id === feature?.id) {
      return { next: true };
    }

    let handled = false;
    if (previousFeature) {
      this.hoveredFeature = null;
      handled =
        this.fireFeatureHoverEnd(definition, previousFeature, 'feature-leave', event) || handled;

      if (!this.isCurrentLifecycle(definition, lifecycleVersion)) {
        return { next: !handled };
      }
    }

    handled = this.fireFeatureHover(definition, feature, previousFeature, event) || handled;

    if (!this.isCurrentLifecycle(definition, lifecycleVersion)) {
      return { next: !handled };
    }

    this.applyToolHoverSelection(definition, feature);
    this.hoveredFeature = feature;

    return { next: !handled };
  }

  private onMouseLeave(event: BaseMapEvent): MapHandlerReturnData {
    const definition = this.options.getActiveDefinition();
    if (!definition) {
      return { next: true };
    }

    const pointerEvent = this.isMapPointerEvent(event) ? event : undefined;
    const handled = this.fireHoveredFeatureEnd(definition, 'map-leave', pointerEvent);
    this.hoveredFeature = null;
    this.applyToolHoverSelection(definition, null);

    return { next: !handled };
  }

  private onClick(event: BaseMapEvent): MapHandlerReturnData {
    const definition = this.options.getActiveDefinition();
    if (!definition || !this.isMapPointerEvent(event)) {
      return { next: true };
    }

    const feature = this.getSelectableFeatureByMouseEvent(
      event,
      this.getToolSourceNames(definition),
      'select',
      definition,
    );
    if (feature) {
      const result = definition.onFeatureClick?.(this.options.getContext(), {
        feature,
        sourceName: feature.sourceName,
        point: event.point,
        lngLat: event.lngLat,
        originalEvent: event.originalEvent,
        map: this.options.getContext().map,
      });

      return { next: !this.isHandled(result) };
    }

    const result = definition.onBlankMapClick?.(this.options.getContext(), {
      point: event.point,
      lngLat: event.lngLat,
      originalEvent: event.originalEvent,
      map: this.options.getContext().map,
    });

    return { next: !this.isHandled(result) };
  }

  private onContextMenu(event: BaseMapEvent): MapHandlerReturnData {
    const definition = this.options.getActiveDefinition();
    if (!definition || !this.isMapPointerEvent(event)) {
      return { next: true };
    }

    const feature = this.getSelectableFeatureByMouseEvent(
      event,
      this.getToolSourceNames(definition),
      'select',
      definition,
    );
    const context = this.options.getContext();
    const result = feature
      ? definition.onFeatureContextMenu?.(context, {
          feature,
          sourceName: feature.sourceName,
          point: event.point,
          lngLat: event.lngLat,
          originalEvent: event.originalEvent,
          map: context.map,
        })
      : definition.onContextMenu?.(context, {
          point: event.point,
          lngLat: event.lngLat,
          originalEvent: event.originalEvent,
          map: context.map,
        });

    const handled = this.isHandled(result);
    if (handled) {
      event.originalEvent.preventDefault?.();
    }

    return { next: !handled };
  }

  private getSelectableFeatureByMouseEvent(
    event: BaseMapPointerEvent,
    sourceNames: FeatureSourceName[],
    reason: ToolSelectionFilterReason,
    definition?: GeomanToolDefinition,
  ) {
    const feature = this.options.geoman.features.getFeatureByMouseEvent({ event, sourceNames });
    return this.getSelectableFeatureOrParent(feature, reason, definition);
  }

  private getSelectableFeatureOrParent(
    feature: FeatureData | null,
    reason: ToolSelectionFilterReason,
    definition?: GeomanToolDefinition,
  ) {
    const parentFeature = feature?.parent ?? null;

    if (
      this.options.geoman.selection.isSelectableFeature(feature, { reason }) &&
      this.isAllowedByToolSelection(definition, feature)
    ) {
      return feature;
    }

    if (
      parentFeature &&
      this.options.geoman.selection.isSelectableFeature(parentFeature, { reason }) &&
      this.isAllowedByToolSelection(definition, parentFeature)
    ) {
      return parentFeature;
    }

    return null;
  }

  private fireFeatureHover(
    definition: GeomanToolDefinition,
    feature: FeatureData | null,
    previousFeature: FeatureData | null,
    event: BaseMapPointerEvent,
  ) {
    if (!feature) {
      return false;
    }

    const result = definition.onFeatureHover?.(this.options.getContext(), {
      feature,
      previousFeature,
      sourceName: feature.sourceName,
      point: event.point,
      lngLat: event.lngLat,
      originalEvent: event.originalEvent,
      map: this.options.getContext().map,
    });

    return this.isHandled(result);
  }

  private fireHoveredFeatureEnd(
    definition: GeomanToolDefinition,
    reason: GeomanToolFeatureHoverEndReason,
    event?: BaseMapPointerEvent,
  ) {
    const feature = this.hoveredFeature;
    this.hoveredFeature = null;
    return this.fireFeatureHoverEnd(definition, feature, reason, event);
  }

  private fireFeatureHoverEnd(
    definition: GeomanToolDefinition,
    feature: FeatureData | null,
    reason: GeomanToolFeatureHoverEndReason,
    event?: BaseMapPointerEvent,
  ) {
    if (!feature) {
      return false;
    }

    const result = definition.onFeatureHoverEnd?.(this.options.getContext(), {
      feature,
      sourceName: feature.sourceName,
      reason,
      point: event?.point,
      lngLat: event?.lngLat,
      originalEvent: event?.originalEvent,
      map: this.options.getContext().map,
    });

    return this.isHandled(result);
  }

  private isHandled(result: GeomanToolInteractionHookResult) {
    return !!result?.handled;
  }

  private activateToolSelection(definition: GeomanToolDefinition | null) {
    const selection = this.getToolSelectionOptions(definition);
    if (!selection.enabled) {
      return;
    }

    this.options.geoman.selection.activate();
  }

  private clearToolSelection(definition: GeomanToolDefinition | null) {
    const selection = this.getToolSelectionOptions(definition);
    if (!selection.enabled) {
      return;
    }

    this.options.geoman.selection.clearHoveredFeature();
    this.options.geoman.mapAdapter.setCursor('');
    this.options.geoman.selection.deactivate({ reason: 'mode-end' });
  }

  private applyToolHoverSelection(definition: GeomanToolDefinition, feature: FeatureData | null) {
    const selection = this.getToolSelectionOptions(definition);
    if (!selection.enabled || !selection.hover) {
      return;
    }

    if (feature) {
      this.options.geoman.selection.setHoveredFeature(feature);
      this.options.geoman.mapAdapter.setCursor(selection.cursor);
      return;
    }

    this.options.geoman.selection.clearHoveredFeature();
    this.options.geoman.mapAdapter.setCursor('');
  }

  private isAllowedByToolSelection(
    definition: GeomanToolDefinition | undefined,
    feature: FeatureData | null,
  ) {
    if (!feature) {
      return false;
    }

    const selection = this.getToolSelectionOptions(definition ?? null);
    if (!selection.enabled || !selection.allowedShapes) {
      return true;
    }

    return selection.allowedShapes.includes(feature.shape);
  }

  private getToolSelectionOptions(
    definition: GeomanToolDefinition | null,
  ): ResolvedToolSelectionOptions {
    const selection = definition?.selection;

    if (!selection) {
      return { enabled: false, hover: false, cursor: '' };
    }

    if (selection === true) {
      return { enabled: true, hover: true, cursor: 'pointer' };
    }

    return {
      enabled: selection.enabled ?? true,
      hover: selection.hover ?? true,
      cursor: selection.cursor ?? 'pointer',
      allowedShapes: selection.allowedShapes,
      sourceNames: selection.sourceNames,
    };
  }

  private getToolSourceNames(definition: GeomanToolDefinition) {
    const selection = this.getToolSelectionOptions(definition);
    return selection.sourceNames?.length ? selection.sourceNames : [this.getMainSourceName()];
  }

  private getMainSourceName() {
    return (this.options.geoman.features.defaultSourceName ?? SOURCES.main) as FeatureSourceName;
  }

  private isCurrentLifecycle(definition: GeomanToolDefinition, lifecycleVersion: number): boolean {
    return (
      this.lifecycleVersion === lifecycleVersion &&
      this.attached &&
      this.options.getActiveDefinition() === definition
    );
  }

  private shouldDetachAfterStop(definition: GeomanToolDefinition | null): boolean {
    const activeDefinition = this.options.getActiveDefinition();
    return activeDefinition === null || activeDefinition === definition;
  }

  private isMapPointerEvent(event: BaseMapEvent): event is BaseMapPointerEvent {
    return !!(
      event &&
      typeof event === 'object' &&
      'lngLat' in event &&
      'point' in event &&
      'type' in event &&
      'originalEvent' in event &&
      typeof event.type === 'string' &&
      POINTER_EVENT_NAMES.has(event.type)
    );
  }
}

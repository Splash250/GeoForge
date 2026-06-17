import type { Features } from '@/core/features/index.ts';
import type { Geoman } from '@/main.ts';
import type { ModeController } from '@/core/modes/modeController.ts';
import type { GeomanContextPanelSubsystem } from '@/context-panels/geomanContextPanelSubsystem.ts';
import type { GeomanSelectionSubsystem } from '@/selection/geomanSelectionSubsystem.ts';
import type { AnyMapInstance } from '@/types/map/index.ts';
import type { FeatureData } from '@/core/features/feature-data.ts';
import type { FeatureShape, FeatureSourceName } from '@/types/features.ts';
import type { CursorType } from '@/types/map/index.ts';
import type { BaseMapPointerEvent } from '@mapLib/types/events.ts';

export type GeomanToolContext = {
  geoman: Geoman;
  map: AnyMapInstance;
  features: Features;
  selection: GeomanSelectionSubsystem;
  contextPanels: GeomanContextPanelSubsystem;
  modes: ModeController;
};

export type GeomanToolCancelReason = 'api';

export type GeomanToolInteractionHookResult = { handled?: boolean } | void;

export type GeomanToolFeatureHoverEndReason = 'feature-leave' | 'map-leave' | 'tool-end';

export type GeomanToolControlEventType = 'toggle' | 'click';

export type GeomanToolControlOptions = {
  title?: string;
  icon?: string | null;
  uiEnabled?: boolean;
  eventType?: GeomanToolControlEventType;
};

export type GeomanToolControlState = Required<GeomanToolControlOptions> & {
  toolId: string;
  active: boolean;
};

export type GeomanToolSelectionOptions = {
  enabled?: boolean;
  hover?: boolean;
  cursor?: CursorType;
  allowedShapes?: Array<FeatureShape>;
  sourceNames?: Array<FeatureSourceName>;
};

export type GeomanToolSelectionConfig = boolean | GeomanToolSelectionOptions;

export type GeomanToolFeatureHoverEvent = {
  feature: FeatureData;
  previousFeature: FeatureData | null;
  sourceName: FeatureSourceName;
  point: BaseMapPointerEvent['point'];
  lngLat: BaseMapPointerEvent['lngLat'];
  originalEvent: BaseMapPointerEvent['originalEvent'];
  map: AnyMapInstance;
};

export type GeomanToolFeatureHoverEndEvent = {
  feature: FeatureData;
  sourceName: FeatureSourceName;
  reason: GeomanToolFeatureHoverEndReason;
  point?: BaseMapPointerEvent['point'];
  lngLat?: BaseMapPointerEvent['lngLat'];
  originalEvent?: BaseMapPointerEvent['originalEvent'];
  map: AnyMapInstance;
};

export type GeomanToolFeatureClickEvent = {
  feature: FeatureData;
  sourceName: FeatureSourceName;
  point: BaseMapPointerEvent['point'];
  lngLat: BaseMapPointerEvent['lngLat'];
  originalEvent: BaseMapPointerEvent['originalEvent'];
  map: AnyMapInstance;
};

export type GeomanToolBlankMapClickEvent = {
  point: BaseMapPointerEvent['point'];
  lngLat: BaseMapPointerEvent['lngLat'];
  originalEvent: BaseMapPointerEvent['originalEvent'];
  map: AnyMapInstance;
};

export type GeomanToolFeatureContextMenuEvent = GeomanToolFeatureClickEvent;

export type GeomanToolContextMenuEvent = GeomanToolBlankMapClickEvent;

export type GeomanToolDefinition = {
  id: string;
  title?: string;
  group?: string;
  control?: GeomanToolControlOptions;
  selection?: GeomanToolSelectionConfig;
  onStart?: (ctx: GeomanToolContext) => void;
  onCancel?: (ctx: GeomanToolContext, reason: GeomanToolCancelReason) => void;
  onEnd?: (ctx: GeomanToolContext) => void;
  onFeatureHover?: (
    ctx: GeomanToolContext,
    event: GeomanToolFeatureHoverEvent,
  ) => GeomanToolInteractionHookResult;
  onFeatureHoverEnd?: (
    ctx: GeomanToolContext,
    event: GeomanToolFeatureHoverEndEvent,
  ) => GeomanToolInteractionHookResult;
  onFeatureClick?: (
    ctx: GeomanToolContext,
    event: GeomanToolFeatureClickEvent,
  ) => GeomanToolInteractionHookResult;
  onBlankMapClick?: (
    ctx: GeomanToolContext,
    event: GeomanToolBlankMapClickEvent,
  ) => GeomanToolInteractionHookResult;
  onFeatureContextMenu?: (
    ctx: GeomanToolContext,
    event: GeomanToolFeatureContextMenuEvent,
  ) => GeomanToolInteractionHookResult;
  onContextMenu?: (
    ctx: GeomanToolContext,
    event: GeomanToolContextMenuEvent,
  ) => GeomanToolInteractionHookResult;
};

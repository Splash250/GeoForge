import type { FeatureData } from '@/core/features/feature-data.ts';
import type { Geoman } from '@/main.ts';
import type { FeatureId, FeatureShape } from '@/types/features.ts';

export type SelectionFeatureState = 'hover' | 'selected';

export type SelectionStyle = {
  lineColor?: string;
  lineWidth?: number;
  lineOpacity?: number;
  fillColor?: string;
  fillOpacity?: number;
  circleRadius?: number;
  circleColor?: string;
  circleStrokeColor?: string;
  circleStrokeWidth?: number;
};

export type SelectionLayerStyleOptions = {
  hover?: SelectionStyle;
  selected?: SelectionStyle;
};

export type GeomanSelectionOptions = {
  allowedShapes?: FeatureShape[];
  clearOnMapClick?: boolean;
  clearOnEscape?: boolean;
  styles?: SelectionLayerStyleOptions;
  selectableFeatureFilter?: (ctx: {
    feature: FeatureData;
    reason: GeomanSelectionFilterReason;
    geoman: Geoman;
  }) => boolean;
  beforeSelect?: (ctx: {
    feature: FeatureData;
    previousFeature: FeatureData | null;
    reason: GeomanSelectionChangeReason;
    geoman: Geoman;
  }) => boolean;
};

export type GeomanSelectionState = {
  hoveredFeatureId: FeatureId | null;
  selectedFeatureId: FeatureId | null;
  hoveredFeature: FeatureData | null;
  selectedFeature: FeatureData | null;
};

export type GeomanSelectionChangeReason =
  | 'api'
  | 'feature-click'
  | 'map-click'
  | 'escape'
  | 'mode-end'
  | 'draw-start'
  | 'destroy'
  | 'feature-removed';

export type GeomanSelectionFilterReason =
  | 'hover'
  | 'select'
  | 'configure-selected'
  | 'configure-hovered';

export type GeomanSelectionEventPayload = {
  previousFeature: FeatureData | null;
  feature: FeatureData | null;
  reason: GeomanSelectionChangeReason;
};

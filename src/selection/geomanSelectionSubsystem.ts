import { GM_SYSTEM_PREFIX } from '@/core/constants.ts';
import { SOURCES } from '@/core/features/constants.ts';
import type { FeatureData } from '@/core/features/feature-data.ts';
import type { GmHelperSelectionEvent } from '@/types/events/helper.ts';
import type { FeatureId, FeatureShape } from '@/types/features.ts';
import type { Geoman } from '@/main.ts';
import type {
  GeomanSelectionChangeReason,
  GeomanSelectionEventPayload,
  GeomanSelectionFilterReason,
  GeomanSelectionOptions,
  GeomanSelectionState,
  SelectionLayerStyleOptions,
} from './types.ts';
import { SelectionLayerManager } from './selectionLayerManager.ts';

const DEFAULT_ALLOWED_SHAPES: FeatureShape[] = [
  'marker',
  'circle_marker',
  'text_marker',
  'line',
  'polygon',
  'rectangle',
  'circle',
  'ellipse',
];

type SelectionOptions = Required<
  Pick<GeomanSelectionOptions, 'clearOnMapClick' | 'clearOnEscape'>
> &
  Omit<GeomanSelectionOptions, 'clearOnMapClick' | 'clearOnEscape'>;

type SelectionHighlightLayerManager = {
  configure(styles?: SelectionLayerStyleOptions): void;
  update(state: Pick<GeomanSelectionState, 'hoveredFeatureId' | 'selectedFeatureId'>): void;
  destroy(): void;
};

export class GeomanSelectionSubsystem {
  private active = false;
  private hoveredFeatureId: FeatureId | null = null;
  private selectedFeatureId: FeatureId | null = null;
  private selectedFeature: FeatureData | null = null;
  private readonly layerManager: SelectionHighlightLayerManager;
  private options: SelectionOptions = {
    allowedShapes: DEFAULT_ALLOWED_SHAPES,
    clearOnMapClick: true,
    clearOnEscape: true,
    styles: {},
  };

  constructor(
    private readonly subsystemOptions: {
      geoman: Geoman;
      layerManager?: SelectionHighlightLayerManager;
    },
  ) {
    this.layerManager =
      subsystemOptions.layerManager ??
      new SelectionLayerManager({ geoman: subsystemOptions.geoman });
  }

  get geoman() {
    return this.subsystemOptions.geoman;
  }

  configure(options: GeomanSelectionOptions = {}) {
    this.options = {
      ...this.options,
      ...options,
      allowedShapes: options.allowedShapes ?? this.options.allowedShapes,
      styles: {
        ...this.options.styles,
        ...options.styles,
      },
    };

    const selectedFeature = this.getSelectedFeature();
    if (
      selectedFeature &&
      !this.isSelectableFeature(selectedFeature, { reason: 'configure-selected' })
    ) {
      this.clearSelection({ reason: 'api' });
    }

    const hoveredFeature = this.getHoveredFeature();
    if (
      hoveredFeature &&
      !this.isSelectableFeature(hoveredFeature, { reason: 'configure-hovered' })
    ) {
      this.clearHoveredFeature();
    }

    this.layerManager.configure(this.options.styles);
    return this;
  }

  activate() {
    this.active = true;
    this.applyEditableScope();
    this.updateLayerManager();
  }

  deactivate({ reason }: { reason: GeomanSelectionChangeReason } = { reason: 'mode-end' }) {
    const wasActive = this.active;
    this.active = false;
    this.clearSelection({ reason, restoreGlobalEditability: true });
    this.clearHoveredFeature();
    if (wasActive) {
      this.updateLayerManager({ force: true });
    }
  }

  destroy() {
    this.deactivate({ reason: 'destroy' });
    this.layerManager.destroy();
  }

  isActive() {
    return this.active;
  }

  getState(): GeomanSelectionState {
    return {
      hoveredFeatureId: this.hoveredFeatureId,
      selectedFeatureId: this.selectedFeatureId,
      hoveredFeature: this.getHoveredFeature(),
      selectedFeature: this.getSelectedFeature(),
    };
  }

  getSelectedFeatureId() {
    return this.selectedFeatureId;
  }

  getSelectedFeature(): FeatureData | null {
    return this.resolveFeature(this.selectedFeatureId);
  }

  shouldClearOnMapClick() {
    return this.options.clearOnMapClick;
  }

  shouldClearOnEscape() {
    return this.options.clearOnEscape;
  }

  getHoveredFeature(): FeatureData | null {
    return this.resolveFeature(this.hoveredFeatureId);
  }

  setHoveredFeature(feature: FeatureData | null) {
    if (feature && !this.isSelectableFeature(feature, { reason: 'hover' })) {
      this.clearHoveredFeature();
      return null;
    }

    this.hoveredFeatureId = feature?.id ?? null;
    this.updateLayerManager();
    return feature;
  }

  clearHoveredFeature() {
    this.hoveredFeatureId = null;
    this.updateLayerManager();
  }

  selectFeature(
    featureOrId: FeatureData | FeatureId | null,
    { reason }: { reason: GeomanSelectionChangeReason } = { reason: 'api' },
  ): FeatureData | null {
    const feature = this.resolveInputFeature(featureOrId);
    if (!feature || !this.isSelectableFeature(feature, { reason: 'select' })) {
      this.clearSelection({ reason });
      return null;
    }

    const previousFeature = this.getSelectedFeatureForEvent();
    if (
      this.options.beforeSelect?.({
        feature,
        previousFeature,
        reason,
        geoman: this.geoman,
      }) === false
    ) {
      return null;
    }

    this.selectedFeatureId = feature.id;
    this.selectedFeature = feature;
    this.applyEditableScope();
    this.updateLayerManager();

    if (previousFeature !== feature) {
      this.fireSelectionEvent('selected', {
        previousFeature,
        feature,
        reason,
      });
    }

    return feature;
  }

  clearSelection({
    reason,
    restoreGlobalEditability = false,
  }: {
    reason: GeomanSelectionChangeReason;
    restoreGlobalEditability?: boolean;
  }) {
    const previousFeature = this.getSelectedFeatureForEvent();
    this.selectedFeatureId = null;
    this.selectedFeature = null;

    if (restoreGlobalEditability) {
      this.geoman.clearEditableFeatureIds();
    } else {
      this.applyEditableScope();
    }
    this.updateLayerManager();

    if (previousFeature) {
      this.fireSelectionEvent('cleared', {
        previousFeature,
        feature: null,
        reason,
      });
    }
  }

  clearRemovedFeature(feature: FeatureData) {
    if (this.hoveredFeatureId === feature.id) {
      this.hoveredFeatureId = null;
    }

    if (this.selectedFeatureId !== feature.id) {
      this.updateLayerManager();
      return;
    }

    this.selectedFeature = feature;
    this.clearSelection({
      reason: 'feature-removed',
      restoreGlobalEditability: !this.active,
    });
  }

  isSelectableFeature(
    feature: FeatureData | null | undefined,
    { reason }: { reason: GeomanSelectionFilterReason } = { reason: 'select' },
  ): feature is FeatureData {
    if (!feature || this.isFeatureEditDisabled(feature)) {
      return false;
    }

    if (!(this.options.allowedShapes ?? DEFAULT_ALLOWED_SHAPES).includes(feature.shape)) {
      return false;
    }

    return (
      this.options.selectableFeatureFilter?.({
        feature,
        reason,
        geoman: this.geoman,
      }) ?? true
    );
  }

  private isFeatureEditDisabled(feature: FeatureData) {
    return feature.getShapeProperty('disableEdit') === true;
  }

  private applyEditableScope() {
    if (!this.active) {
      return;
    }

    if (this.selectedFeatureId !== null) {
      this.geoman.setEditableFeatureIds([this.selectedFeatureId]);
    } else {
      this.geoman.setEditableFeatureIds([]);
    }
  }

  private updateLayerManager({ force = false }: { force?: boolean } = {}) {
    if (!this.active && !force) {
      return;
    }

    this.layerManager.update({
      hoveredFeatureId: this.hoveredFeatureId,
      selectedFeatureId: this.selectedFeatureId,
    });
  }

  private resolveInputFeature(featureOrId: FeatureData | FeatureId | null): FeatureData | null {
    if (featureOrId === null) {
      return null;
    }

    if (typeof featureOrId === 'object') {
      return featureOrId;
    }

    return this.resolveFeature(featureOrId);
  }

  private resolveFeature(featureId: FeatureId | null): FeatureData | null {
    if (featureId === null) {
      return null;
    }

    return this.geoman.features.get(SOURCES.main, featureId) ?? null;
  }

  private getSelectedFeatureForEvent(): FeatureData | null {
    return this.getSelectedFeature() ?? this.selectedFeature;
  }

  private fireSelectionEvent(action: 'selected' | 'cleared', payload: GeomanSelectionEventPayload) {
    if (action === 'selected' && payload.feature) {
      const event: GmHelperSelectionEvent = {
        name: `${GM_SYSTEM_PREFIX}:helper:selection`,
        level: 'system',
        actionType: 'helper',
        mode: 'click_to_edit',
        action,
        previousFeature: payload.previousFeature,
        feature: payload.feature,
        reason: payload.reason,
      };

      this.geoman.events.fire(`${GM_SYSTEM_PREFIX}:helper`, event);
      return;
    }

    if (action === 'cleared' && payload.previousFeature) {
      const event: GmHelperSelectionEvent = {
        name: `${GM_SYSTEM_PREFIX}:helper:selection`,
        level: 'system',
        actionType: 'helper',
        mode: 'click_to_edit',
        action,
        previousFeature: payload.previousFeature,
        feature: null,
        reason: payload.reason,
      };

      this.geoman.events.fire(`${GM_SYSTEM_PREFIX}:helper`, event);
    }
  }
}

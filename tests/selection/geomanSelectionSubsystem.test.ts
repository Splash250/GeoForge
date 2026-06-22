import { describe, expect, test, vi } from 'vitest';
import { EventForwarder } from '../../src/core/events/forwarder.ts';
import { GeomanSelectionSubsystem } from '../../src/selection/geomanSelectionSubsystem.ts';

function feature(id: string, shape = 'line', disableEdit = false) {
  return {
    id,
    shape,
    getShapeProperty: vi.fn((name: string) => {
      if (name === 'disableEdit') return disableEdit;
      if (name === 'shape') return shape;
      return undefined;
    }),
  };
}

type FeatureStub = ReturnType<typeof feature>;
type GeomanEditableState = {
  editableFeatureIds: Set<string> | null;
};

function createGeomanStub() {
  const features = new Map<string, FeatureStub>();
  return {
    editableFeatureIds: null as Set<string> | null,
    setEditableFeatureIds: vi.fn(function (this: GeomanEditableState, ids: string[]) {
      this.editableFeatureIds = new Set(ids);
    }),
    clearEditableFeatureIds: vi.fn(function (this: GeomanEditableState) {
      this.editableFeatureIds = null;
    }),
    isFeatureEditable: vi.fn(function (
      this: GeomanEditableState,
      item: FeatureStub | null | undefined,
    ) {
      if (!item || item.getShapeProperty('disableEdit') === true) {
        return false;
      }

      if (this.editableFeatureIds !== null) {
        return this.editableFeatureIds.has(item.id);
      }

      return true;
    }),
    features: {
      get: vi.fn((_sourceName: string, id: string) => features.get(id) ?? null),
      featureStore: features,
      bringEditOverlayLayersToFront: vi.fn(),
    },
    events: {
      fire: vi.fn(),
    },
  };
}

describe('GeomanSelectionSubsystem', () => {
  test('blocks all editable features when active and no feature is selected', () => {
    const geoman = createGeomanStub();
    const selection = new GeomanSelectionSubsystem({ geoman: geoman as never });

    selection.activate();

    expect(geoman.setEditableFeatureIds).toHaveBeenCalledWith([]);
    expect(geoman.editableFeatureIds).toEqual(new Set());
  });

  test('selects exactly one editable feature', () => {
    const geoman = createGeomanStub();
    const line = feature('line-1', 'line');
    geoman.features.featureStore.set('line-1', line);
    const selection = new GeomanSelectionSubsystem({ geoman: geoman as never });

    selection.activate();
    const selected = selection.selectFeature(line as never, { reason: 'api' });

    expect(selected).toBe(line);
    expect(selection.getSelectedFeature()).toBe(line);
    expect(geoman.setEditableFeatureIds).toHaveBeenLastCalledWith(['line-1']);
    expect(geoman.editableFeatureIds).toEqual(new Set(['line-1']));
  });

  test('keeps edit marker overlay layers above selection highlight layers after selection changes', () => {
    const geoman = createGeomanStub();
    const line = feature('line-1', 'line');
    geoman.features.featureStore.set('line-1', line);
    const layerManager = {
      configure: vi.fn(),
      update: vi.fn(),
      destroy: vi.fn(),
    };
    const selection = new GeomanSelectionSubsystem({
      geoman: geoman as never,
      layerManager,
    } as never);

    selection.activate();
    geoman.features.bringEditOverlayLayersToFront.mockClear();
    selection.selectFeature(line as never, { reason: 'api' });

    expect(layerManager.update).toHaveBeenLastCalledWith({
      hoveredFeatureId: null,
      selectedFeatureId: 'line-1',
    });
    expect(geoman.features.bringEditOverlayLayersToFront).toHaveBeenCalledTimes(1);
  });

  test('does not select disabled edit features', () => {
    const geoman = createGeomanStub();
    const disabled = feature('line-1', 'line', true);
    geoman.features.featureStore.set('line-1', disabled);
    const selection = new GeomanSelectionSubsystem({ geoman: geoman as never });

    selection.activate();
    const selected = selection.selectFeature(disabled as never, { reason: 'api' });

    expect(selected).toBeNull();
    expect(selection.getSelectedFeature()).toBeNull();
    expect(geoman.setEditableFeatureIds).toHaveBeenLastCalledWith([]);
  });

  test('honors allowed shape filters', () => {
    const geoman = createGeomanStub();
    const polygon = feature('poly-1', 'polygon');
    geoman.features.featureStore.set('poly-1', polygon);
    const selection = new GeomanSelectionSubsystem({ geoman: geoman as never });

    selection.configure({ allowedShapes: ['line'] as never });
    selection.activate();
    const selected = selection.selectFeature(polygon as never, { reason: 'api' });

    expect(selected).toBeNull();
    expect(selection.getSelectedFeatureId()).toBeNull();
  });

  test('blocks features by selectableFeatureFilter', () => {
    const geoman = createGeomanStub();
    const line = feature('line-1', 'line');
    geoman.features.featureStore.set('line-1', line);
    const selection = new GeomanSelectionSubsystem({ geoman: geoman as never });
    const selectableFeatureFilter = vi.fn(({ feature: item }) => item.id !== 'line-1');

    selection.configure({ selectableFeatureFilter } as never);
    selection.activate();
    const selected = selection.selectFeature(line as never, { reason: 'api' });
    const hovered = selection.setHoveredFeature(line as never);

    expect(selected).toBeNull();
    expect(hovered).toBeNull();
    expect(selection.getSelectedFeatureId()).toBeNull();
    expect(selection.getState().hoveredFeatureId).toBeNull();
    expect(selectableFeatureFilter).toHaveBeenCalledWith({
      feature: line,
      reason: 'select',
      geoman,
    });
    expect(selectableFeatureFilter).toHaveBeenCalledWith({
      feature: line,
      reason: 'hover',
      geoman,
    });
  });

  test('combines selectableFeatureFilter with allowedShapes and disableEdit checks', () => {
    const geoman = createGeomanStub();
    const polygon = feature('poly-1', 'polygon');
    const disabledLine = feature('line-1', 'line', true);
    geoman.features.featureStore.set('poly-1', polygon);
    geoman.features.featureStore.set('line-1', disabledLine);
    const selection = new GeomanSelectionSubsystem({ geoman: geoman as never });

    selection.configure({
      allowedShapes: ['line'] as never,
      selectableFeatureFilter: () => true,
    } as never);
    selection.activate();

    expect(selection.selectFeature(polygon as never, { reason: 'api' })).toBeNull();
    expect(selection.selectFeature(disabledLine as never, { reason: 'api' })).toBeNull();
    expect(selection.getSelectedFeatureId()).toBeNull();
    expect(selection.setHoveredFeature(polygon as never)).toBeNull();
    expect(selection.setHoveredFeature(disabledLine as never)).toBeNull();
    expect(selection.getState().hoveredFeatureId).toBeNull();
  });

  test('clears previous hovered feature when hovering a non-selectable feature', () => {
    const geoman = createGeomanStub();
    const line = feature('line-1', 'line');
    const disabled = feature('line-2', 'line', true);
    geoman.features.featureStore.set('line-1', line);
    geoman.features.featureStore.set('line-2', disabled);
    const selection = new GeomanSelectionSubsystem({ geoman: geoman as never });

    selection.setHoveredFeature(line as never);
    const hovered = selection.setHoveredFeature(disabled as never);

    expect(hovered).toBeNull();
    expect(selection.getHoveredFeature()).toBeNull();
    expect(selection.getState().hoveredFeatureId).toBeNull();
  });

  test('configure clears hovered feature when it no longer matches allowed shapes', () => {
    const geoman = createGeomanStub();
    const polygon = feature('poly-1', 'polygon');
    geoman.features.featureStore.set('poly-1', polygon);
    const selection = new GeomanSelectionSubsystem({ geoman: geoman as never });

    selection.setHoveredFeature(polygon as never);
    selection.configure({ allowedShapes: ['line'] as never });

    expect(selection.getHoveredFeature()).toBeNull();
    expect(selection.getState().hoveredFeatureId).toBeNull();
  });

  test('configure revalidates selected and hovered features with filter reason values', () => {
    const geoman = createGeomanStub();
    const line = feature('line-1', 'line');
    const polygon = feature('poly-1', 'polygon');
    geoman.features.featureStore.set('line-1', line);
    geoman.features.featureStore.set('poly-1', polygon);
    const selection = new GeomanSelectionSubsystem({ geoman: geoman as never });
    const selectableFeatureFilter = vi.fn(() => false);

    selection.selectFeature(line as never, { reason: 'api' });
    selection.setHoveredFeature(polygon as never);
    selection.configure({ selectableFeatureFilter } as never);

    expect(selection.getSelectedFeatureId()).toBeNull();
    expect(selection.getState().hoveredFeatureId).toBeNull();
    expect(selectableFeatureFilter).toHaveBeenCalledWith({
      feature: line,
      reason: 'configure-selected',
      geoman,
    });
    expect(selectableFeatureFilter).toHaveBeenCalledWith({
      feature: polygon,
      reason: 'configure-hovered',
      geoman,
    });
  });

  test('clearSelection restores blocked empty selection while active', () => {
    const geoman = createGeomanStub();
    const line = feature('line-1', 'line');
    geoman.features.featureStore.set('line-1', line);
    const selection = new GeomanSelectionSubsystem({ geoman: geoman as never });

    selection.activate();
    selection.selectFeature(line as never, { reason: 'api' });
    selection.clearSelection({ reason: 'api' });

    expect(selection.getSelectedFeature()).toBeNull();
    expect(geoman.setEditableFeatureIds).toHaveBeenLastCalledWith([]);
  });

  test('clearSelection emits previous feature after selected feature is removed from the store', () => {
    const geoman = createGeomanStub();
    const line = feature('line-1', 'line');
    geoman.features.featureStore.set('line-1', line);
    const selection = new GeomanSelectionSubsystem({ geoman: geoman as never });

    selection.activate();
    selection.selectFeature(line as never, { reason: 'api' });
    geoman.features.featureStore.delete('line-1');

    selection.clearSelection({ reason: 'feature-removed' });

    expect(selection.getSelectedFeatureId()).toBeNull();
    expect(geoman.setEditableFeatureIds).toHaveBeenLastCalledWith([]);
    expect(geoman.editableFeatureIds).toEqual(new Set());
    expect(geoman.events.fire).toHaveBeenCalledWith(
      '_gm:helper',
      expect.objectContaining({
        name: '_gm:helper:selection',
        action: 'cleared',
        feature: null,
        previousFeature: line,
        reason: 'feature-removed',
      }),
    );
  });

  test('beforeSelect can veto without clearing current selection or emitting selection events', () => {
    const geoman = createGeomanStub();
    const line = feature('line-1', 'line');
    const polygon = feature('poly-1', 'polygon');
    geoman.features.featureStore.set('line-1', line);
    geoman.features.featureStore.set('poly-1', polygon);
    const selection = new GeomanSelectionSubsystem({ geoman: geoman as never });
    const beforeSelect = vi.fn(() => false);

    selection.activate();
    selection.selectFeature(line as never, { reason: 'api' });
    geoman.events.fire.mockClear();
    selection.configure({ beforeSelect } as never);
    const selected = selection.selectFeature(polygon as never, { reason: 'feature-click' });

    expect(selected).toBeNull();
    expect(selection.getSelectedFeatureId()).toBe('line-1');
    expect(geoman.editableFeatureIds).toEqual(new Set(['line-1']));
    expect(beforeSelect).toHaveBeenCalledWith({
      feature: polygon,
      previousFeature: line,
      reason: 'feature-click',
      geoman,
    });
    expect(geoman.events.fire).not.toHaveBeenCalled();
  });

  test('beforeSelect receives previousFeature and reason before allowing selection', () => {
    const geoman = createGeomanStub();
    const line = feature('line-1', 'line');
    const polygon = feature('poly-1', 'polygon');
    geoman.features.featureStore.set('line-1', line);
    geoman.features.featureStore.set('poly-1', polygon);
    const selection = new GeomanSelectionSubsystem({ geoman: geoman as never });
    const beforeSelect = vi.fn(() => true);

    selection.selectFeature(line as never, { reason: 'api' });
    selection.configure({ beforeSelect } as never);
    const selected = selection.selectFeature(polygon as never, { reason: 'feature-click' });

    expect(selected).toBe(polygon);
    expect(selection.getSelectedFeatureId()).toBe('poly-1');
    expect(beforeSelect).toHaveBeenCalledWith({
      feature: polygon,
      previousFeature: line,
      reason: 'feature-click',
      geoman,
    });
  });

  test('deactivate clears selection and restores global editability', () => {
    const geoman = createGeomanStub();
    const line = feature('line-1', 'line');
    geoman.features.featureStore.set('line-1', line);
    const selection = new GeomanSelectionSubsystem({ geoman: geoman as never });

    selection.activate();
    selection.selectFeature(line as never, { reason: 'api' });
    selection.deactivate({ reason: 'mode-end' });

    expect(selection.getSelectedFeature()).toBeNull();
    expect(geoman.clearEditableFeatureIds).toHaveBeenCalled();
  });

  test('updates injected highlight layer manager when hover and selection state changes', () => {
    const geoman = createGeomanStub();
    const line = feature('line-1', 'line');
    const polygon = feature('poly-1', 'polygon');
    geoman.features.featureStore.set('line-1', line);
    geoman.features.featureStore.set('poly-1', polygon);
    const layerManager = {
      configure: vi.fn(),
      update: vi.fn(),
      destroy: vi.fn(),
    };
    const selection = new GeomanSelectionSubsystem({
      geoman: geoman as never,
      layerManager,
    } as never);

    selection.configure({
      styles: {
        hover: { lineColor: '#0ea5e9' },
        selected: { lineColor: '#db2777' },
      },
    });
    selection.activate();
    selection.setHoveredFeature(line as never);
    selection.selectFeature(polygon as never, { reason: 'api' });
    selection.clearSelection({ reason: 'api' });
    selection.destroy();

    expect(layerManager.configure).toHaveBeenCalledWith({
      hover: { lineColor: '#0ea5e9' },
      selected: { lineColor: '#db2777' },
    });
    expect(layerManager.update).toHaveBeenCalledWith({
      hoveredFeatureId: 'line-1',
      selectedFeatureId: null,
    });
    expect(layerManager.update).toHaveBeenCalledWith({
      hoveredFeatureId: 'line-1',
      selectedFeatureId: 'poly-1',
    });
    expect(layerManager.update).toHaveBeenLastCalledWith({
      hoveredFeatureId: null,
      selectedFeatureId: null,
    });
    expect(layerManager.destroy).toHaveBeenCalled();
  });

  test('does not update injected highlight layer manager before activation', () => {
    const geoman = createGeomanStub();
    const line = feature('line-1', 'line');
    geoman.features.featureStore.set('line-1', line);
    const layerManager = {
      configure: vi.fn(),
      update: vi.fn(),
      destroy: vi.fn(),
    };
    const selection = new GeomanSelectionSubsystem({
      geoman: geoman as never,
      layerManager,
    } as never);

    selection.setHoveredFeature(line as never);
    selection.clearHoveredFeature();
    selection.selectFeature(line as never, { reason: 'api' });
    selection.clearSelection({ reason: 'api' });

    expect(layerManager.update).not.toHaveBeenCalled();

    selection.activate();

    expect(layerManager.update).toHaveBeenCalledTimes(1);
    expect(layerManager.update).toHaveBeenLastCalledWith({
      hoveredFeatureId: null,
      selectedFeatureId: null,
    });
  });

  test('fires selected and cleared helper events', () => {
    const geoman = createGeomanStub();
    const line = feature('line-1', 'line');
    geoman.features.featureStore.set('line-1', line);
    const selection = new GeomanSelectionSubsystem({ geoman: geoman as never });

    selection.activate();
    selection.selectFeature(line as never, { reason: 'api' });
    selection.clearSelection({ reason: 'api' });

    expect(geoman.events.fire).toHaveBeenCalledWith(
      '_gm:helper',
      expect.objectContaining({
        name: '_gm:helper:selection',
        actionType: 'helper',
        mode: 'click_to_edit',
        action: 'selected',
        feature: line,
        previousFeature: null,
        reason: 'api',
      }),
    );
    expect(geoman.events.fire).toHaveBeenCalledWith(
      '_gm:helper',
      expect.objectContaining({
        name: '_gm:helper:selection',
        actionType: 'helper',
        mode: 'click_to_edit',
        action: 'cleared',
        feature: null,
        previousFeature: line,
        reason: 'api',
      }),
    );
  });

  test('forwards helper selection events as public select and deselect map events', async () => {
    const map = {};
    const line = feature('line-1', 'line');
    const fire = vi.fn();
    const forwarder = new EventForwarder({
      mapAdapter: {
        fire,
        getMapInstance: vi.fn(() => map),
      },
      options: {
        settings: {
          awaitDataUpdatesOnEvents: false,
        },
      },
    } as never);

    await forwarder.processEvent('_gm:helper', {
      name: '_gm:helper:selection',
      level: 'system',
      actionType: 'helper',
      mode: 'click_to_edit',
      action: 'selected',
      feature: line,
      previousFeature: null,
      reason: 'api',
    } as never);
    await forwarder.processEvent('_gm:helper', {
      name: '_gm:helper:selection',
      level: 'system',
      actionType: 'helper',
      mode: 'click_to_edit',
      action: 'cleared',
      feature: null,
      previousFeature: line,
      reason: 'api',
    } as never);

    expect(fire).toHaveBeenCalledWith(
      'gm:select',
      expect.objectContaining({
        name: 'gm:select',
        actionType: 'helper',
        action: 'selected',
        feature: line,
        previousFeature: null,
        reason: 'api',
        map,
      }),
    );
    expect(fire).toHaveBeenCalledWith(
      'gm:deselect',
      expect.objectContaining({
        name: 'gm:deselect',
        actionType: 'helper',
        action: 'cleared',
        feature: null,
        previousFeature: line,
        reason: 'api',
        map,
      }),
    );
  });

  test('forwards helper feature interaction events as public map events', async () => {
    const map = {};
    const line = feature('line-1', 'line');
    const previousLine = feature('line-0', 'line');
    const point = { x: 12, y: 34 };
    const lngLat = { lng: 1, lat: 2 };
    const originalEvent = { type: 'click' };
    const fire = vi.fn();
    const forwarder = new EventForwarder({
      mapAdapter: {
        fire,
        getMapInstance: vi.fn(() => map),
      },
      options: {
        settings: {
          awaitDataUpdatesOnEvents: false,
        },
      },
    } as never);

    await forwarder.processEvent('_gm:helper', {
      name: '_gm:helper:feature_hover',
      level: 'system',
      actionType: 'helper',
      mode: 'click_to_edit',
      action: 'feature_hover',
      feature: line,
      previousFeature: previousLine,
      sourceName: 'gm_main',
      point,
      lngLat,
      originalEvent,
    } as never);
    await forwarder.processEvent('_gm:helper', {
      name: '_gm:helper:feature_hover_end',
      level: 'system',
      actionType: 'helper',
      mode: 'click_to_edit',
      action: 'feature_hover_end',
      feature: line,
      reason: 'feature-leave',
    } as never);
    await forwarder.processEvent('_gm:helper', {
      name: '_gm:helper:feature_click',
      level: 'system',
      actionType: 'helper',
      mode: 'click_to_edit',
      action: 'feature_click',
      feature: line,
      sourceName: 'gm_main',
      point,
      lngLat,
      originalEvent,
    } as never);
    await forwarder.processEvent('_gm:helper', {
      name: '_gm:helper:map_blank_click',
      level: 'system',
      actionType: 'helper',
      mode: 'click_to_edit',
      action: 'map_blank_click',
      point,
      lngLat,
      originalEvent,
    } as never);

    expect(fire).toHaveBeenCalledWith(
      'gm:featurehover',
      expect.objectContaining({
        name: 'gm:featurehover',
        actionType: 'helper',
        action: 'feature_hover',
        mode: 'click_to_edit',
        feature: line,
        previousFeature: previousLine,
        sourceName: 'gm_main',
        point,
        lngLat,
        originalEvent,
        map,
      }),
    );
    expect(fire).toHaveBeenCalledWith(
      'gm:featurehoverend',
      expect.objectContaining({
        name: 'gm:featurehoverend',
        actionType: 'helper',
        action: 'feature_hover_end',
        mode: 'click_to_edit',
        feature: line,
        reason: 'feature-leave',
        map,
      }),
    );
    expect(fire).toHaveBeenCalledWith(
      'gm:featureclick',
      expect.objectContaining({
        name: 'gm:featureclick',
        actionType: 'helper',
        action: 'feature_click',
        mode: 'click_to_edit',
        feature: line,
        sourceName: 'gm_main',
        point,
        lngLat,
        originalEvent,
        map,
      }),
    );
    expect(fire).toHaveBeenCalledWith(
      'gm:mapblankclick',
      expect.objectContaining({
        name: 'gm:mapblankclick',
        actionType: 'helper',
        action: 'map_blank_click',
        mode: 'click_to_edit',
        point,
        lngLat,
        originalEvent,
        map,
      }),
    );
  });

  test('does not forward malformed helper interaction events', async () => {
    const line = feature('line-1', 'line');
    const point = { x: 12, y: 34 };
    const lngLat = { lng: 1, lat: 2 };
    const originalEvent = { type: 'click' };
    const fire = vi.fn();
    const forwarder = new EventForwarder({
      mapAdapter: {
        fire,
        getMapInstance: vi.fn(() => ({})),
      },
      options: {
        settings: {
          awaitDataUpdatesOnEvents: false,
        },
      },
    } as never);

    const featureHoverPayload = (overrides: Record<string, unknown> = {}) => ({
      name: '_gm:helper:feature_hover',
      level: 'system',
      actionType: 'helper',
      mode: 'click_to_edit',
      action: 'feature_hover',
      feature: line,
      previousFeature: null,
      sourceName: 'gm_main',
      point,
      lngLat,
      originalEvent,
      ...overrides,
    });
    const featureClickPayload = (overrides: Record<string, unknown> = {}) => ({
      name: '_gm:helper:feature_click',
      level: 'system',
      actionType: 'helper',
      mode: 'click_to_edit',
      action: 'feature_click',
      feature: line,
      sourceName: 'gm_main',
      point,
      lngLat,
      originalEvent,
      ...overrides,
    });
    const mapBlankClickPayload = (overrides: Record<string, unknown> = {}) => ({
      name: '_gm:helper:map_blank_click',
      level: 'system',
      actionType: 'helper',
      mode: 'click_to_edit',
      action: 'map_blank_click',
      point,
      lngLat,
      originalEvent,
      ...overrides,
    });

    await forwarder.processEvent('_gm:helper', {
      name: '_gm:helper:feature_hover_end',
      level: 'system',
      actionType: 'helper',
      mode: 'click_to_edit',
      action: 'feature_hover_end',
      feature: line,
      reason: 'unknown',
    } as never);

    const pointerPayloads = [featureHoverPayload, featureClickPayload, mapBlankClickPayload];
    const pointerKeys = ['point', 'lngLat', 'originalEvent'] as const;

    for (const createPayload of pointerPayloads) {
      for (const key of pointerKeys) {
        const missingPayload = createPayload();
        delete missingPayload[key];

        await forwarder.processEvent('_gm:helper', missingPayload as never);
        await forwarder.processEvent('_gm:helper', createPayload({ [key]: null }) as never);
      }
    }

    for (const createPayload of [featureHoverPayload, featureClickPayload]) {
      await forwarder.processEvent(
        '_gm:helper',
        createPayload({ sourceName: 'not_a_source' }) as never,
      );
    }

    expect(fire).not.toHaveBeenCalledWith('gm:featurehover', expect.anything());
    expect(fire).not.toHaveBeenCalledWith('gm:featurehoverend', expect.anything());
    expect(fire).not.toHaveBeenCalledWith('gm:featureclick', expect.anything());
    expect(fire).not.toHaveBeenCalledWith('gm:mapblankclick', expect.anything());
  });

  test('does not forward malformed helper selection-like events', async () => {
    const line = feature('line-1', 'line');
    const fire = vi.fn();
    const forwarder = new EventForwarder({
      mapAdapter: {
        fire,
        getMapInstance: vi.fn(() => ({})),
      },
      options: {
        settings: {
          awaitDataUpdatesOnEvents: false,
        },
      },
    } as never);

    await forwarder.processEvent('_gm:helper', {
      name: '_gm:helper:mode',
      level: 'system',
      actionType: 'helper',
      mode: 'click_to_edit',
      action: 'selected',
      feature: line,
      previousFeature: null,
      reason: 'api',
    } as never);
    await forwarder.processEvent('_gm:helper', {
      name: '_gm:helper:selection',
      level: 'system',
      actionType: 'helper',
      mode: 'click_to_edit',
      action: 'selected',
      feature: null,
      previousFeature: null,
      reason: 'api',
    } as never);
    await forwarder.processEvent('_gm:helper', {
      name: '_gm:helper:selection',
      level: 'system',
      actionType: 'helper',
      mode: 'click_to_edit',
      action: 'selected',
      feature: line,
      previousFeature: 'line-0',
      reason: 'api',
    } as never);
    await forwarder.processEvent('_gm:helper', {
      name: '_gm:helper:selection',
      level: 'system',
      actionType: 'helper',
      mode: 'click_to_edit',
      action: 'selected',
      feature: line,
      previousFeature: null,
    } as never);
    await forwarder.processEvent('_gm:helper', {
      name: '_gm:helper:selection',
      level: 'system',
      actionType: 'helper',
      mode: 'click_to_edit',
      action: 'selected',
      feature: line,
      previousFeature: null,
      reason: 7,
    } as never);
    await forwarder.processEvent('_gm:helper', {
      name: '_gm:helper:selection',
      level: 'system',
      actionType: 'helper',
      mode: 'click_to_edit',
      action: 'selected',
      feature: line,
      previousFeature: null,
      reason: 'unknown',
    } as never);
    await forwarder.processEvent('_gm:helper', {
      name: '_gm:helper:selection',
      level: 'system',
      actionType: 'helper',
      mode: 'click_to_edit',
      action: 'cleared',
      feature: null,
      previousFeature: null,
      reason: 'api',
    } as never);
    await forwarder.processEvent('_gm:helper', {
      name: '_gm:helper:selection',
      level: 'system',
      actionType: 'helper',
      mode: 'click_to_edit',
      action: 'cleared',
      feature: null,
      previousFeature: line,
    } as never);
    await forwarder.processEvent('_gm:helper', {
      name: '_gm:helper:selection',
      level: 'system',
      actionType: 'helper',
      mode: 'click_to_edit',
      action: 'cleared',
      feature: null,
      previousFeature: line,
      reason: 7,
    } as never);
    await forwarder.processEvent('_gm:helper', {
      name: '_gm:helper:selection',
      level: 'system',
      actionType: 'helper',
      mode: 'click_to_edit',
      action: 'cleared',
      feature: null,
      previousFeature: line,
      reason: 'unknown',
    } as never);

    expect(fire).not.toHaveBeenCalledWith('gm:select', expect.anything());
    expect(fire).not.toHaveBeenCalledWith('gm:deselect', expect.anything());
  });
});

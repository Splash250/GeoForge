import { FEATURE_ID_PROPERTY, SOURCES } from '@/core/features/constants.ts';
import { SelectionLayerManager } from '@/selection/selectionLayerManager.ts';
import { describe, expect, test, vi } from 'vitest';
import type { AddLayerObject, FilterSpecification } from 'maplibre-gl';

type TestLayer = AddLayerObject & {
  filter?: FilterSpecification;
};

function createMapStub() {
  const layers = new Map<string, TestLayer>();
  return {
    layers,
    addLayer: vi.fn((layer: AddLayerObject) => {
      layers.set(layer.id, layer as TestLayer);
    }),
    getLayer: vi.fn((id: string) => layers.get(id) ?? null),
    removeLayer: vi.fn((id: string) => {
      layers.delete(id);
    }),
    setFilter: vi.fn((id: string, filter: FilterSpecification) => {
      const layer = layers.get(id);
      if (layer) {
        layer.filter = filter;
      }
    }),
    setPaintProperty: vi.fn(),
  };
}

function createManager() {
  const map = createMapStub();
  const manager = new SelectionLayerManager({
    geoman: {
      mapAdapterInstance: {
        getMapInstance: () => map,
      },
    } as never,
  });

  return { manager, map };
}

function expectFilterFeatureId(filter: FilterSpecification | undefined, featureId: string) {
  expect(filter).toEqual(expect.arrayContaining([['==', ['get', FEATURE_ID_PROPERTY], featureId]]));
}

describe('SelectionLayerManager', () => {
  test('creates internal hover and selected highlight layers and updates only changed filters', () => {
    const { manager, map } = createManager();

    manager.update({ hoveredFeatureId: 'line-1', selectedFeatureId: 'poly-1' });

    expect(map.addLayer).toHaveBeenCalledTimes(6);
    expect(Array.from(map.layers.values()).map((layer) => [layer.id, layer.type])).toEqual([
      [`${SOURCES.main}__selection_hover_fill`, 'fill'],
      [`${SOURCES.main}__selection_hover_line`, 'line'],
      [`${SOURCES.main}__selection_hover_circle`, 'circle'],
      [`${SOURCES.main}__selection_selected_fill`, 'fill'],
      [`${SOURCES.main}__selection_selected_line`, 'line'],
      [`${SOURCES.main}__selection_selected_circle`, 'circle'],
    ]);
    expect(map.setFilter).toHaveBeenCalledTimes(6);
    expectFilterFeatureId(
      map.layers.get(`${SOURCES.main}__selection_hover_line`)?.filter,
      'line-1',
    );
    expectFilterFeatureId(
      map.layers.get(`${SOURCES.main}__selection_selected_fill`)?.filter,
      'poly-1',
    );

    map.setFilter.mockClear();
    manager.update({ hoveredFeatureId: 'line-1', selectedFeatureId: 'poly-1' });
    expect(map.setFilter).not.toHaveBeenCalled();

    manager.update({ hoveredFeatureId: 'line-2', selectedFeatureId: 'poly-1' });
    expect(map.setFilter).toHaveBeenCalledTimes(3);
    expect(map.setFilter.mock.calls.map(([id]) => id)).toEqual([
      `${SOURCES.main}__selection_hover_fill`,
      `${SOURCES.main}__selection_hover_line`,
      `${SOURCES.main}__selection_hover_circle`,
    ]);
    expectFilterFeatureId(
      map.layers.get(`${SOURCES.main}__selection_hover_line`)?.filter,
      'line-2',
    );

    map.setFilter.mockClear();
    manager.update({ hoveredFeatureId: 'line-2', selectedFeatureId: null });
    expect(map.setFilter).toHaveBeenCalledTimes(3);
    expect(map.setFilter.mock.calls.map(([id]) => id)).toEqual([
      `${SOURCES.main}__selection_selected_fill`,
      `${SOURCES.main}__selection_selected_line`,
      `${SOURCES.main}__selection_selected_circle`,
    ]);
  });

  test('destroy removes internal highlight layers', () => {
    const { manager, map } = createManager();

    manager.update({ hoveredFeatureId: 'line-1', selectedFeatureId: 'poly-1' });
    manager.destroy();

    expect(map.removeLayer).toHaveBeenCalledTimes(6);
    expect(map.layers.size).toBe(0);
  });
});

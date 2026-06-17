import { bringEditOverlayLayersToFront } from '@/core/features/layerOrder.ts';
import type { BaseLayer } from '@/core/map/base/layer.ts';
import { describe, expect, test, vi } from 'vitest';

function layer(id: string): BaseLayer {
  return { id } as BaseLayer;
}

function createMapStub(layerIds: string[]) {
  const orderedLayerIds = [...layerIds];
  return {
    orderedLayerIds,
    getLayer: vi.fn((id: string) => (orderedLayerIds.includes(id) ? { id } : null)),
    moveLayer: vi.fn((id: string) => {
      const index = orderedLayerIds.indexOf(id);
      if (index >= 0) {
        orderedLayerIds.splice(index, 1);
        orderedLayerIds.push(id);
      }
    }),
  };
}

describe('bringEditOverlayLayersToFront', () => {
  test('moves Geoman edit marker layers above later app layers while preserving marker order', () => {
    const map = createMapStub([
      'gm_main-line__line-layer-0',
      'gm_main-center_marker__circle-layer-0',
      'gm_main-vertex_marker__circle-layer-0',
      'gm_main-edge_marker__circle-layer-0',
      'app-lines',
      'app-polygons',
    ]);

    bringEditOverlayLayersToFront({
      map,
      layers: [
        layer('gm_main-line__line-layer-0'),
        layer('gm_main-center_marker__circle-layer-0'),
        layer('gm_main-vertex_marker__circle-layer-0'),
        layer('gm_main-edge_marker__circle-layer-0'),
      ],
    });

    expect(map.orderedLayerIds).toEqual([
      'gm_main-line__line-layer-0',
      'app-lines',
      'app-polygons',
      'gm_main-center_marker__circle-layer-0',
      'gm_main-vertex_marker__circle-layer-0',
      'gm_main-edge_marker__circle-layer-0',
    ]);
    expect(map.moveLayer).toHaveBeenCalledTimes(3);
  });

  test('does nothing when the map does not expose layer ordering', () => {
    expect(() =>
      bringEditOverlayLayersToFront({
        map: {},
        layers: [layer('gm_main-vertex_marker__circle-layer-0')],
      }),
    ).not.toThrow();
  });
});

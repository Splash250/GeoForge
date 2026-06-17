import { describe, expect, it, vi } from 'vitest';
import { FeatureLayerFactory } from '../../src/core/features/featureLayerFactory.ts';
import type { BaseLayer } from '../../src/core/map/base/layer.ts';
import type { Geoman, PartialLayerStyle } from '../../src/main.ts';

function createGeomanStub(existingLayerIds: Array<string> = []) {
  const addLayer = vi.fn((options) => ({ id: options.id }) as BaseLayer);
  const getLayer = vi.fn((layerId: string) =>
    existingLayerIds.includes(layerId) ? ({ id: layerId } as BaseLayer) : null,
  );

  return {
    gm: {
      mapAdapter: {
        addLayer,
        getLayer,
      },
    } as unknown as Geoman,
    addLayer,
    getLayer,
  };
}

describe('FeatureLayerFactory', () => {
  it('creates a generic layer with the expected name, source, and shape filter', () => {
    const { gm, addLayer } = createGeomanStub();
    const factory = new FeatureLayerFactory(gm);
    const partialStyle = {
      type: 'line',
      paint: {
        'line-color': '#123456',
      },
    } as PartialLayerStyle;

    const layer = factory.createGenericLayer({
      sourceName: 'gm_main',
      shapeNames: ['line'],
      partialStyle,
    });

    expect(layer).toEqual({ id: 'gm_main-line__line-layer-0' });
    expect(addLayer).toHaveBeenCalledWith({
      ...partialStyle,
      id: 'gm_main-line__line-layer-0',
      source: 'gm_main',
      filter: ['in', ['get', '__gm_shape'], ['literal', ['line']]],
    });
  });

  it('uses the next available generic layer name for mixed shape layers', () => {
    const { gm } = createGeomanStub(['gm_temporary-mixed__fill-layer-0']);
    const factory = new FeatureLayerFactory(gm);

    const layerName = factory.getGenericLayerName({
      sourceName: 'gm_temporary',
      shapeNames: ['polygon', 'circle'],
      partialStyle: { type: 'fill' } as PartialLayerStyle,
    });

    expect(layerName).toBe('gm_temporary-mixed__fill-layer-1');
  });
});

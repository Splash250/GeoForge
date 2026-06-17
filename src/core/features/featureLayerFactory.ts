import { GM_PREFIX } from '../constants.ts';
import type { BaseLayer } from '../map/base/layer.ts';
import type { Geoman } from '@/main.ts';
import type { FeatureShape, FeatureSourceName } from '@/types/features.ts';
import type { PartialLayerStyle } from '@/types/map/layers.ts';

const FEATURE_PROPERTY_PREFIX = `__${GM_PREFIX}_`;

export class FeatureLayerFactory {
  gm: Geoman;

  constructor(gm: Geoman) {
    this.gm = gm;
  }

  createGenericLayer({
    sourceName,
    shapeNames,
    partialStyle,
  }: {
    sourceName: FeatureSourceName;
    shapeNames: Array<FeatureShape>;
    partialStyle: PartialLayerStyle;
  }): BaseLayer | null {
    const layerId = this.getGenericLayerName({ sourceName, shapeNames, partialStyle });
    if (!layerId) {
      throw new Error(`Can't create a layer, for ${{ sourceName, shapeNames, partialStyle }}`);
    }

    const layerOptions = {
      ...partialStyle,
      id: layerId,
      source: sourceName,
      filter: ['in', ['get', `${FEATURE_PROPERTY_PREFIX}shape`], ['literal', shapeNames]],
    };

    return this.gm.mapAdapter.addLayer(layerOptions);
  }

  getGenericLayerName({
    sourceName,
    shapeNames,
    partialStyle,
  }: {
    sourceName: FeatureSourceName;
    shapeNames: Array<FeatureShape>;
    partialStyle: PartialLayerStyle;
  }): string | null {
    const MAX_LAYERS = 100;
    const shapeName = shapeNames.length === 1 ? shapeNames[0] : 'mixed';
    const getLayerId = (index: number) =>
      `${sourceName}-${shapeName}__${partialStyle.type}-layer-${index}`;
    let layerId: string | null = null;

    for (let i = 0; i < MAX_LAYERS; i += 1) {
      const tmpLayerId = getLayerId(i);
      if (!this.gm.mapAdapter.getLayer(tmpLayerId)) {
        layerId = tmpLayerId;
        return layerId;
      }
    }

    return null;
  }
}

import type { Feature, LineString, MultiLineString } from 'geojson';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { Geoman } from '@/main.ts';
import type { FeatureSourceName } from '@/types/features.ts';
import {
  ArrowheadManager,
  type ArrowheadManagerOptions,
} from './arrowheads/map/arrowheadManager.ts';
import type { ArrowheadSourceIds } from './arrowheads/map/arrowheadSource.ts';
import type { ArrowheadOptions } from './arrowheads/types.ts';
import type {
  LineDecoratorRenderer,
  LineDecoratorRendererKind,
  LineDecoratorRenderItem,
} from './renderers/types.ts';
import {
  isArrowheadDecorator,
  type LineArrowheadDecoratorOptions,
  type LineDecoratorOptions,
} from './types.ts';
import { SymbolDecoratorRenderer } from './symbols/index.ts';
import { TextDecoratorRenderer } from './text/index.ts';

export type LineDecoratorManagerOptions = ArrowheadManagerOptions & {
  map: MapLibreMap;
  renderers?: LineDecoratorRenderer[];
};

export type LineDecoratorGeomanSyncOptions = {
  geoman: Geoman;
  resolveDecorators?: (feature: Feature) => LineDecoratorOptions[] | null | undefined;
  sourceNames?: Array<FeatureSourceName>;
  syncOnRender?: boolean;
};

type EventedMap = {
  on: (type: string, listener: () => void) => void;
  off: (type: string, listener: () => void) => void;
};

export class LineDecoratorManager {
  private arrowheadManager: ArrowheadManager;
  private renderers: globalThis.Map<LineDecoratorRendererKind, LineDecoratorRenderer>;
  private stopGeomanSync: (() => void) | null = null;

  constructor(options: LineDecoratorManagerOptions) {
    this.arrowheadManager = new ArrowheadManager(options);
    this.renderers = new globalThis.Map(
      (
        options.renderers ?? [
          new SymbolDecoratorRenderer({
            map: options.map,
            layerPosition: options.layerPosition,
          }),
          new TextDecoratorRenderer({
            map: options.map,
            layerPosition: options.layerPosition,
          }),
        ]
      ).map((renderer) => [renderer.kind, renderer]),
    );
  }

  updateArrowheads(line: LineString | MultiLineString, options: ArrowheadOptions) {
    this.arrowheadManager.update(line, options);
  }

  updateFromFeatures(
    features: Feature[],
    resolveDecorators?: (feature: Feature) => LineDecoratorOptions[] | null | undefined,
  ) {
    const arrowheadOptionsByFeature = new WeakMap<Feature, ArrowheadOptions>();
    const arrowheadFeatures: Feature[] = [];
    const rendererItems = new globalThis.Map<
      LineDecoratorRendererKind,
      LineDecoratorRenderItem[]
    >();

    features.forEach((feature) => {
      const decorators = resolveDecorators?.(feature) ?? [];
      decorators.forEach((decorator) => {
        if (isArrowheadDecorator(decorator)) {
          if (arrowheadOptionsByFeature.has(feature)) {
            return;
          }
          arrowheadOptionsByFeature.set(feature, toArrowheadOptions(decorator));
          arrowheadFeatures.push(feature);
          return;
        }

        const rendererKind = decorator.kind as LineDecoratorRendererKind;
        const items = rendererItems.get(rendererKind) ?? [];
        items.push({ feature, decorator });
        rendererItems.set(rendererKind, items);
      });
    });

    this.arrowheadManager.updateFromFeatures(
      arrowheadFeatures,
      (feature) => arrowheadOptionsByFeature.get(feature) ?? {},
    );

    this.renderers.forEach((renderer, kind) => {
      renderer.update(rendererItems.get(kind) ?? []);
    });
  }

  updateArrowheadsFromFeatures(
    features: Feature[],
    resolveOptions?: (feature: Feature) => ArrowheadOptions | null | undefined,
  ) {
    this.arrowheadManager.updateFromFeatures(features, resolveOptions);
  }

  updateFromGeoman({
    geoman,
    resolveDecorators,
    sourceNames,
  }: Pick<LineDecoratorGeomanSyncOptions, 'geoman' | 'resolveDecorators' | 'sourceNames'>) {
    this.updateFromFeatures(getGeomanLineFeatures(geoman, sourceNames), resolveDecorators);
  }

  bindToGeoman(options: LineDecoratorGeomanSyncOptions) {
    this.unbindFromGeoman();

    const map = options.geoman.mapAdapter.getMapInstance() as EventedMap;
    const sync = () => {
      if (options.geoman.destroyed) {
        return;
      }

      this.updateFromGeoman(options);
    };
    const eventNames = ['gm:create', 'gm:edit', 'gm:drag', 'gm:remove'];

    eventNames.forEach((eventName) => map.on(eventName, sync));

    if (options.syncOnRender ?? true) {
      map.on('render', sync);
    }

    this.stopGeomanSync = () => {
      eventNames.forEach((eventName) => map.off(eventName, sync));

      if (options.syncOnRender ?? true) {
        map.off('render', sync);
      }
    };

    sync();

    return this.stopGeomanSync;
  }

  unbindFromGeoman() {
    this.stopGeomanSync?.();
    this.stopGeomanSync = null;
  }

  clear() {
    this.arrowheadManager.clear();
    this.renderers.forEach((renderer) => renderer.clear());
  }

  destroy() {
    this.unbindFromGeoman();
    this.arrowheadManager.destroy();
    this.renderers.forEach((renderer) => renderer.destroy());
  }

  getArrowheadSourceIds(): ArrowheadSourceIds {
    return this.arrowheadManager.getSourceIds();
  }
}

function toArrowheadOptions(decorator: LineArrowheadDecoratorOptions): ArrowheadOptions {
  const options = { ...decorator };
  delete options.kind;
  delete options.id;

  return options;
}

function getGeomanLineFeatures(
  geoman: Geoman,
  sourceNames: Array<FeatureSourceName> | undefined,
): Feature[] {
  const features: Feature[] = [];
  const allowedSourceNames = sourceNames?.length ? new Set(sourceNames) : null;

  geoman.features.featureStore.forEach((featureData) => {
    if (featureData.shape !== 'line') {
      return;
    }

    if (allowedSourceNames && !allowedSourceNames.has(featureData.sourceName)) {
      return;
    }

    features.push(featureData.getGeoJson());
  });

  return features;
}

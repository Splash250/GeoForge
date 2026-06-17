import type { Feature, LineString, MultiLineString } from 'geojson';
import type { Map } from 'maplibre-gl';
import {
  applyLineDecoratorAnimationProperties,
  LineDecoratorAnimationRunner,
} from '../animation/lineDecoratorAnimationRunner.ts';
import { createLinePlacements } from '../placement/index.ts';
import type { LineDecoratorRenderer, LineDecoratorRenderItem } from '../renderers/types.ts';
import type { LineDecoratorLayerPosition } from '../layerPosition.ts';
import type { LineSymbolDecoratorOptions } from '../types.ts';
import {
  clearSymbolDecoratorSource,
  ensureSymbolDecoratorSource,
  updateSymbolDecoratorSource,
  type EnsureSymbolDecoratorSourceOptions,
  type SymbolDecoratorSourceIds,
} from './symbolDecoratorSource.ts';

export type SymbolDecoratorRendererOptions = EnsureSymbolDecoratorSourceOptions & {
  map: Map;
};

export class SymbolDecoratorRenderer implements LineDecoratorRenderer<LineSymbolDecoratorOptions> {
  readonly kind = 'symbol' as const;
  private map: Map;
  private ids: SymbolDecoratorSourceIds;
  private animationRunner: LineDecoratorAnimationRunner;
  private layerPosition: LineDecoratorLayerPosition | undefined;

  constructor(options: SymbolDecoratorRendererOptions) {
    this.map = options.map;
    this.layerPosition = options.layerPosition;
    this.ids = ensureSymbolDecoratorSource(this.map, options);
    this.animationRunner = new LineDecoratorAnimationRunner(this.map);
  }

  update(items: Array<LineDecoratorRenderItem<LineSymbolDecoratorOptions>>) {
    this.ids = ensureSymbolDecoratorSource(this.map, {
      ids: this.ids,
      layerPosition: this.layerPosition,
    });
    const features = items.flatMap((item) => buildSymbolFeatures(this.map, item));
    this.animationRunner.update(this.ids.sourceId, {
      type: 'FeatureCollection',
      features,
    });
  }

  clear() {
    this.animationRunner.clear(this.ids.sourceId);
    updateSymbolDecoratorSource(this.map, this.ids, {
      type: 'FeatureCollection',
      features: [],
    });
  }

  destroy() {
    this.animationRunner.destroy();
    clearSymbolDecoratorSource(this.map, this.ids);
  }

  getSourceIds(): SymbolDecoratorSourceIds {
    return this.ids;
  }
}

function buildSymbolFeatures(
  map: Map,
  item: LineDecoratorRenderItem<LineSymbolDecoratorOptions>,
): Feature[] {
  const { feature, decorator } = item;
  if (
    !feature.geometry ||
    (feature.geometry.type !== 'LineString' && feature.geometry.type !== 'MultiLineString')
  ) {
    return [];
  }

  const placements = createLinePlacements({
    map,
    line: feature.geometry as LineString | MultiLineString,
    placement: {
      frequency: decorator.frequency,
      offsets: decorator.offsets,
      segment: decorator.segment,
      anchor: decorator.anchor,
      offsetPercent: decorator.offsetPercent,
      lineOffsetPx: decorator.lineOffsetPx,
    },
  });

  return placements.map((placement) => {
    const properties = {
      parentId: feature.id ?? null,
      decoratorId: decorator.id ?? null,
      imageId: decorator.imageId,
      bearing: placement.bearing,
      rotate: resolveRotation(decorator, placement.bearing),
      rotationMode: decorator.rotate?.mode ?? 'line',
      size: resolveNumber(decorator.size, 1),
      opacity: resolveNumber(decorator.opacity, 1),
      color: resolveColor(decorator.color, '#ffffff'),
    };

    return {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [placement.point.lng, placement.point.lat],
      },
      properties: applyLineDecoratorAnimationProperties(decorator, properties),
    };
  });
}

function resolveRotation(decorator: LineSymbolDecoratorOptions, bearing: number) {
  const mode = decorator.rotate?.mode ?? 'line';
  if (mode === 'fixed' || mode === 'viewport') {
    return typeof decorator.rotate?.angle === 'number' ? decorator.rotate.angle : 0;
  }

  const offset = typeof decorator.rotate?.angle === 'number' ? decorator.rotate.angle : 0;
  return bearing + offset;
}

function resolveNumber(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function resolveColor(value: unknown, fallback: string) {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

import type { Feature, LineString, MultiLineString } from 'geojson';
import type { Map } from 'maplibre-gl';
import {
  applyLineDecoratorAnimationProperties,
  LineDecoratorAnimationRunner,
} from '../animation/lineDecoratorAnimationRunner.ts';
import { createLinePlacements } from '../placement/index.ts';
import type { LineDecoratorRenderer, LineDecoratorRenderItem } from '../renderers/types.ts';
import type { LineDecoratorLayerPosition } from '../layerPosition.ts';
import type { LineTextDecoratorOptions } from '../types.ts';
import {
  clearTextDecoratorSource,
  ensureTextDecoratorSource,
  updateTextDecoratorSource,
  type EnsureTextDecoratorSourceOptions,
  type TextDecoratorSourceIds,
} from './textDecoratorSource.ts';

export type TextDecoratorRendererOptions = EnsureTextDecoratorSourceOptions & {
  map: Map;
};

export class TextDecoratorRenderer implements LineDecoratorRenderer<LineTextDecoratorOptions> {
  readonly kind = 'text' as const;
  private map: Map;
  private ids: TextDecoratorSourceIds;
  private animationRunner: LineDecoratorAnimationRunner;
  private layerPosition: LineDecoratorLayerPosition | undefined;

  constructor(options: TextDecoratorRendererOptions) {
    this.map = options.map;
    this.layerPosition = options.layerPosition;
    this.ids = ensureTextDecoratorSource(this.map, options);
    this.animationRunner = new LineDecoratorAnimationRunner(this.map);
  }

  update(items: Array<LineDecoratorRenderItem<LineTextDecoratorOptions>>) {
    this.ids = ensureTextDecoratorSource(this.map, {
      ids: this.ids,
      layerPosition: this.layerPosition,
    });
    const features = items.flatMap((item) => buildTextFeatures(this.map, item));
    this.animationRunner.update(this.ids.sourceId, {
      type: 'FeatureCollection',
      features,
    });
  }

  clear() {
    this.animationRunner.clear(this.ids.sourceId);
    updateTextDecoratorSource(this.map, this.ids, {
      type: 'FeatureCollection',
      features: [],
    });
  }

  destroy() {
    this.animationRunner.destroy();
    clearTextDecoratorSource(this.map, this.ids);
  }

  getSourceIds(): TextDecoratorSourceIds {
    return this.ids;
  }
}

function buildTextFeatures(
  map: Map,
  item: LineDecoratorRenderItem<LineTextDecoratorOptions>,
): Feature[] {
  const { feature, decorator } = item;
  const text = decorator.text.trim();
  if (
    text.length === 0 ||
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
      text,
      bearing: placement.bearing,
      rotate: resolveTextRotation(decorator, placement.bearing),
      rotationMode: decorator.rotate?.mode ?? 'line',
      fontSize: resolveNumber(decorator.fontSize, 14),
      color: resolveColor(decorator.color, '#111827'),
      opacity: resolveNumber(decorator.opacity, 1),
      haloColor: resolveColor(decorator.haloColor, '#ffffff'),
      haloWidth: resolveNumber(decorator.haloWidth, 1.5),
      haloBlur: resolveNumber(decorator.haloBlur, 0),
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

function resolveTextRotation(decorator: LineTextDecoratorOptions, bearing: number) {
  const mode = decorator.rotate?.mode ?? 'line';
  if (mode === 'fixed' || mode === 'viewport') {
    return resolveNumber(decorator.rotate?.angle, 0);
  }

  return bearing + resolveNumber(decorator.rotate?.angle, 0);
}

function resolveNumber(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function resolveColor(value: unknown, fallback: string) {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

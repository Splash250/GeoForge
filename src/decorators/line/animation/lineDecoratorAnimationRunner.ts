import type { Feature, FeatureCollection, GeoJsonProperties } from 'geojson';
import type { GeoJSONSource, Map } from 'maplibre-gl';
import type { LineDecoratorAnimationOptions, LineDecoratorAnimationProperty } from '../types.ts';

type AnimatedProperties = GeoJsonProperties & {
  __gmLineDecoratorAnimations?: ResolvedLineDecoratorAnimation[];
};

type ResolvedLineDecoratorAnimation = {
  property: SupportedAnimationProperty;
  from: number;
  to: number;
  durationMs: number;
  delayMs: number;
  iterationCount: number | 'infinite';
  direction: NonNullable<LineDecoratorAnimationOptions['direction']>;
  easing: NonNullable<LineDecoratorAnimationOptions['easing']>;
};

type SupportedAnimationProperty = Exclude<LineDecoratorAnimationProperty, 'offset'>;

const SUPPORTED_PROPERTIES = new Set<SupportedAnimationProperty>([
  'rotate',
  'opacity',
  'size',
  'fontSize',
]);

const DEFAULT_DURATION_MS = 1000;

export type DecoratorWithLineAnimation = {
  animation?: LineDecoratorAnimationOptions | LineDecoratorAnimationOptions[];
  rotate?: {
    animation?: LineDecoratorAnimationOptions;
  };
};

export class LineDecoratorAnimationRunner {
  private map: Map;
  private frameId: number | null = null;
  private startedAt: number | null = null;
  private sourceId: string | null = null;
  private collection: FeatureCollection | null = null;

  constructor(map: Map) {
    this.map = map;
  }

  update(sourceId: string, collection: FeatureCollection) {
    this.sourceId = sourceId;
    this.collection = collection;

    if (!hasAnimatedFeatures(collection)) {
      this.cancel();
      this.startedAt = null;
      this.setData(collection);
      return;
    }

    const elapsedMs = this.startedAt === null ? 0 : this.getElapsedMs();
    this.setData(resolveAnimatedCollection(collection, elapsedMs).collection);
    this.scheduleNextFrame();
  }

  clear(sourceId: string) {
    this.cancel();
    this.sourceId = sourceId;
    this.collection = null;
  }

  destroy() {
    this.cancel();
    this.sourceId = null;
    this.collection = null;
  }

  private scheduleNextFrame() {
    if (typeof globalThis.requestAnimationFrame !== 'function') {
      return;
    }

    if (this.frameId !== null) {
      return;
    }

    this.frameId = globalThis.requestAnimationFrame((timestamp) => this.tick(timestamp));
  }

  private tick(timestamp: number) {
    this.frameId = null;

    if (!this.collection || !this.sourceId) {
      return;
    }

    if (this.startedAt === null) {
      this.startedAt = timestamp;
    }

    const elapsedMs = timestamp - this.startedAt;
    const { collection, complete } = resolveAnimatedCollection(this.collection, elapsedMs);
    this.setData(collection);

    if (!complete) {
      this.scheduleNextFrame();
    } else {
      this.frameId = null;
    }
  }

  private setData(collection: FeatureCollection) {
    if (!this.sourceId) {
      return;
    }

    const source = this.map.getSource(this.sourceId) as GeoJSONSource | undefined;
    source?.setData(collection);
  }

  private cancel() {
    if (this.frameId !== null && typeof globalThis.cancelAnimationFrame === 'function') {
      globalThis.cancelAnimationFrame(this.frameId);
    }

    this.frameId = null;
  }

  private getElapsedMs() {
    if (this.startedAt === null) {
      return 0;
    }

    const now =
      typeof globalThis.performance?.now === 'function' ? globalThis.performance.now() : Date.now();

    return Math.max(0, now - this.startedAt);
  }
}

export function applyLineDecoratorAnimationProperties(
  decorator: DecoratorWithLineAnimation,
  properties: GeoJsonProperties,
) {
  const animations = resolveAnimations(decorator, properties);
  if (animations.length === 0) {
    return properties;
  }

  return {
    ...properties,
    __gmLineDecoratorAnimations: animations,
  };
}

function resolveAnimations(
  decorator: DecoratorWithLineAnimation,
  properties: GeoJsonProperties,
): ResolvedLineDecoratorAnimation[] {
  const candidates = [
    ...toArray(decorator.animation),
    ...(decorator.rotate?.animation
      ? [{ property: 'rotate' as const, ...decorator.rotate.animation }]
      : []),
  ];

  return candidates
    .filter((animation) => animation?.enabled !== false)
    .map((animation) => resolveAnimation(animation, properties))
    .filter((animation): animation is ResolvedLineDecoratorAnimation => animation !== null);
}

function resolveAnimation(
  animation: LineDecoratorAnimationOptions,
  properties: GeoJsonProperties,
): ResolvedLineDecoratorAnimation | null {
  const property = animation.property;
  if (!isSupportedProperty(property)) {
    return null;
  }

  const baseValue = resolveNumber(properties?.[property], defaultValueForProperty(property));
  const from = resolveNumber(animation.from, baseValue);
  const to = resolveNumber(animation.to, defaultTargetValue(property, baseValue));
  const durationMs = resolvePositiveNumber(animation.durationMs, DEFAULT_DURATION_MS);
  const delayMs = Math.max(0, resolveNumber(animation.delayMs, 0));
  const iterationCount =
    animation.iterationCount === 'infinite'
      ? 'infinite'
      : Math.max(1, Math.floor(resolveNumber(animation.iterationCount, 1)));

  return {
    property,
    from,
    to,
    durationMs,
    delayMs,
    iterationCount,
    direction: animation.direction ?? 'normal',
    easing: animation.easing ?? 'linear',
  };
}

function resolveAnimatedCollection(collection: FeatureCollection, elapsedMs: number) {
  let complete = true;
  const features = collection.features.map((feature) => {
    const animations = (feature.properties as AnimatedProperties | null | undefined)
      ?.__gmLineDecoratorAnimations;
    if (!animations || animations.length === 0) {
      return feature;
    }

    const nextProperties: AnimatedProperties = { ...(feature.properties ?? {}) };
    animations.forEach((animation) => {
      const state = resolveAnimationState(animation, elapsedMs);
      nextProperties[animation.property] = state.value;
      if (!state.complete) {
        complete = false;
      }
    });

    return {
      ...feature,
      properties: nextProperties,
    } as Feature;
  });

  return {
    complete,
    collection: {
      ...collection,
      features,
    },
  };
}

function resolveAnimationState(animation: ResolvedLineDecoratorAnimation, elapsedMs: number) {
  const activeElapsedMs = elapsedMs - animation.delayMs;
  if (activeElapsedMs <= 0) {
    return {
      complete: false,
      value: valueAtProgress(animation, 0),
    };
  }

  const rawIteration = activeElapsedMs / animation.durationMs;
  const finiteIterationCount =
    animation.iterationCount === 'infinite' ? Number.POSITIVE_INFINITY : animation.iterationCount;
  const complete = rawIteration >= finiteIterationCount;
  const iterationIndex = complete
    ? Math.max(0, finiteIterationCount - 1)
    : Math.floor(rawIteration);
  const localProgress = complete ? 1 : rawIteration - iterationIndex;

  return {
    complete,
    value: valueAtProgress(
      animation,
      resolveDirectedProgress(animation, iterationIndex, localProgress),
    ),
  };
}

function valueAtProgress(animation: ResolvedLineDecoratorAnimation, progress: number) {
  const eased = applyEasing(progress, animation.easing);
  return animation.from + (animation.to - animation.from) * eased;
}

function resolveDirectedProgress(
  animation: ResolvedLineDecoratorAnimation,
  iterationIndex: number,
  progress: number,
) {
  const isOddIteration = iterationIndex % 2 === 1;

  if (animation.direction === 'reverse') {
    return 1 - progress;
  }

  if (animation.direction === 'alternate') {
    return isOddIteration ? 1 - progress : progress;
  }

  if (animation.direction === 'alternate-reverse') {
    return isOddIteration ? progress : 1 - progress;
  }

  return progress;
}

function applyEasing(
  progress: number,
  easing: NonNullable<LineDecoratorAnimationOptions['easing']>,
) {
  const clampedProgress = Math.min(1, Math.max(0, progress));

  if (easing === 'ease-in') {
    return clampedProgress * clampedProgress;
  }

  if (easing === 'ease-out') {
    return 1 - (1 - clampedProgress) * (1 - clampedProgress);
  }

  if (easing === 'ease' || easing === 'ease-in-out') {
    return clampedProgress < 0.5
      ? 2 * clampedProgress * clampedProgress
      : 1 - Math.pow(-2 * clampedProgress + 2, 2) / 2;
  }

  return clampedProgress;
}

function hasAnimatedFeatures(collection: FeatureCollection) {
  return collection.features.some((feature) => {
    const properties = feature.properties as AnimatedProperties | null | undefined;
    return Boolean(properties?.__gmLineDecoratorAnimations?.length);
  });
}

function isSupportedProperty(
  property: LineDecoratorAnimationOptions['property'],
): property is SupportedAnimationProperty {
  return (
    typeof property === 'string' && SUPPORTED_PROPERTIES.has(property as SupportedAnimationProperty)
  );
}

function toArray<T>(value: T | T[] | null | undefined): T[] {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function resolvePositiveNumber(value: unknown, fallback: number) {
  const resolved = resolveNumber(value, fallback);
  return resolved > 0 ? resolved : fallback;
}

function resolveNumber(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function defaultValueForProperty(property: SupportedAnimationProperty) {
  return property === 'rotate' ? 0 : 1;
}

function defaultTargetValue(property: SupportedAnimationProperty, baseValue: number) {
  if (property === 'rotate') {
    return baseValue + 360;
  }

  if (property === 'opacity') {
    return baseValue * 0.35;
  }

  return baseValue * 1.15;
}

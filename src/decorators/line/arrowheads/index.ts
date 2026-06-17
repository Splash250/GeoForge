export type {
  ArrowFrequencyUnit,
  ArrowheadFeatureCollection,
  ArrowheadOptions,
  ArrowheadsGeneratorConfig,
  ArrowOffsetUnit,
  ArrowSizeUnit,
  BaseArrowheadOptions,
  InterpolatedPoint,
} from './types.ts';

/**
 * @deprecated Low-level arrowhead unit helper retained for root barrel compatibility.
 * Prefer `geoman.decorators.lines` or `LineDecoratorManager`.
 */
export { isInMeters, isInPercent, isInPixels, parseNumeric } from './utils/units.ts';
/**
 * @deprecated Low-level arrowhead geometry helper retained for root barrel compatibility.
 * Prefer `geoman.decorators.lines` or `LineDecoratorManager`.
 */
export {
  bearingBetween,
  destinationPoint,
  distanceBetween,
  interpolateOnLine,
  pixelsToMeters,
  toLngLat,
  type NormalizedLngLat,
} from './utils/geometry.ts';
/**
 * @deprecated Low-level arrowhead utility retained for root barrel compatibility.
 * Prefer `geoman.decorators.lines` or `LineDecoratorManager`.
 */
export { definedProps, modulus } from './utils/misc.ts';
/**
 * @deprecated Low-level arrowhead generation utility retained for root barrel compatibility.
 * Prefer `geoman.decorators.lines` or `LineDecoratorManager`.
 */
export { generateArrowheads } from './generator.ts';
export * from './map/index.ts';

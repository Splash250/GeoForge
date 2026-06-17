export type {
  CreateLinePlacementsOptions,
  LinePlacement,
  LinePlacementOptions,
} from './linePlacementEngine.ts';
/**
 * @deprecated Low-level line placement helper retained for root barrel compatibility.
 * Prefer `geoman.decorators.lines` or `LineDecoratorManager`.
 */
export { createLinePlacements } from './linePlacementEngine.ts';

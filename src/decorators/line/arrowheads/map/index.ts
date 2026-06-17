export type { ArrowheadSourceIds, EnsureArrowheadSourceOptions } from './arrowheadSource.ts';
/**
 * @deprecated Low-level arrowhead source helper retained for root barrel compatibility.
 * Prefer `geoman.decorators.lines` or `LineDecoratorManager`.
 */
export {
  clearArrowheadSource,
  ensureArrowheadSource,
  resolveIds,
  updateArrowheadSource,
} from './arrowheadSource.ts';
export type { ArrowheadManagerOptions } from './arrowheadManager.ts';
/**
 * @deprecated Low-level arrowhead manager retained for root barrel compatibility.
 * Prefer `geoman.decorators.lines` or `LineDecoratorManager`.
 */
export { ArrowheadManager } from './arrowheadManager.ts';

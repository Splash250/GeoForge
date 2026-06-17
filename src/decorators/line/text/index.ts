export type {
  EnsureTextDecoratorSourceOptions,
  TextDecoratorSourceIds,
} from './textDecoratorSource.ts';
/**
 * @deprecated Low-level text decorator source helper retained for root barrel compatibility.
 * Prefer `geoman.decorators.lines` or `LineDecoratorManager`.
 */
export {
  clearTextDecoratorSource,
  ensureTextDecoratorSource,
  resolveTextDecoratorIds,
  updateTextDecoratorSource,
} from './textDecoratorSource.ts';
export type { TextDecoratorRendererOptions } from './textDecoratorRenderer.ts';
/**
 * @deprecated Low-level text decorator renderer retained for root barrel compatibility.
 * Prefer `geoman.decorators.lines` or `LineDecoratorManager`.
 */
export { TextDecoratorRenderer } from './textDecoratorRenderer.ts';

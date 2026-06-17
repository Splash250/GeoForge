export type {
  EnsureSymbolDecoratorSourceOptions,
  SymbolDecoratorSourceIds,
} from './symbolDecoratorSource.ts';
/**
 * @deprecated Low-level symbol decorator source helper retained for root barrel compatibility.
 * Prefer `geoman.decorators.lines` or `LineDecoratorManager`.
 */
export {
  clearSymbolDecoratorSource,
  ensureSymbolDecoratorSource,
  resolveSymbolDecoratorIds,
  updateSymbolDecoratorSource,
} from './symbolDecoratorSource.ts';
export type { SymbolDecoratorRendererOptions } from './symbolDecoratorRenderer.ts';
/**
 * @deprecated Low-level symbol decorator renderer retained for root barrel compatibility.
 * Prefer `geoman.decorators.lines` or `LineDecoratorManager`.
 */
export { SymbolDecoratorRenderer } from './symbolDecoratorRenderer.ts';
export type {
  SymbolImageInput,
  SymbolImageMap,
  SymbolImageRegistration,
} from './symbolImageRegistry.ts';
/**
 * @deprecated Low-level symbol image registry helper retained for root barrel compatibility.
 * Prefer `geoman.decorators.lines` or `LineDecoratorManager`.
 */
export { ensureSymbolImage } from './symbolImageRegistry.ts';

export * from './types.ts';
export { normalizeLineDecorators } from './normalizeLineDecorators.ts';
export * from './placement/index.ts';
export type { LineDecoratorLayerPosition } from './layerPosition.ts';
/**
 * @deprecated Low-level decorator layer helper retained for root barrel compatibility.
 * Prefer `geoman.decorators.lines` or `LineDecoratorManager`.
 */
export { addLineDecoratorLayer, positionLineDecoratorLayers } from './layerPosition.ts';
export * from './renderers/index.ts';
export { LineDecoratorManager } from './lineDecoratorManager.ts';
export type {
  LineDecoratorGeomanSyncOptions,
  LineDecoratorManagerOptions,
} from './lineDecoratorManager.ts';
export { GeomanLineDecoratorSubsystem } from './geomanLineDecoratorSubsystem.ts';
export type {
  GeomanLineDecoratorConfigureOptions,
  GeomanLineDecoratorManualSyncOptions,
  GeomanLineDecoratorSubsystemOptions,
} from './geomanLineDecoratorSubsystem.ts';
export {
  GeomanLineDecoratorAuthoringSession,
  loadSvgSymbolImage,
  validateSvgSymbolMarkup,
} from './lineDecoratorAuthoringSession.ts';
export type {
  LineDecoratorAuthoringDecoratorInput,
  LineDecoratorAuthoringDecoratorResolver,
  LineDecoratorAuthoringFeatureInput,
  LineDecoratorAuthoringFeatureTarget,
  LineDecoratorAuthoringLineStyle,
  LineDecoratorAuthoringSession,
  LineDecoratorAuthoringSessionOptions,
  SvgSymbolImageMap,
  SvgSymbolImageRegistration,
  SvgSymbolImageRegistrationResult,
} from './lineDecoratorAuthoringSession.ts';
export * from './arrowheads/index.ts';
export * from './symbols/index.ts';
export * from './text/index.ts';

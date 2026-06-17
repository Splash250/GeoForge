import type { ArrowFrequencyUnit, ArrowheadOptions } from './arrowheads/types.ts';

export type LineDecoratorKind = 'arrowhead' | 'symbol' | 'text';
export type LineDecoratorRotationMode = 'line' | 'fixed' | 'viewport';
export type LinePlacementFrequency = ArrowFrequencyUnit | 'single';
export type LineSymbolSegmentTarget = 'first' | 'middle' | 'last' | 'all';
export type LineSymbolAnchor = 'front' | 'middle' | 'back';
export type LineDecoratorAnimationProperty = 'rotate' | 'opacity' | 'size' | 'fontSize' | 'offset';
export type LineDecoratorAnimationDirection =
  | 'normal'
  | 'reverse'
  | 'alternate'
  | 'alternate-reverse';
export type LineDecoratorAnimationEasing =
  | 'linear'
  | 'ease'
  | 'ease-in'
  | 'ease-out'
  | 'ease-in-out';

export type LineDecoratorAnimationOptions = {
  enabled?: boolean;
  property?: LineDecoratorAnimationProperty;
  from?: number;
  to?: number;
  durationMs?: number;
  delayMs?: number;
  iterationCount?: number | 'infinite';
  direction?: LineDecoratorAnimationDirection;
  easing?: LineDecoratorAnimationEasing;
};

export type LineDecoratorPlacementOptions = {
  frequency?: LinePlacementFrequency;
  offsets?: {
    start?: `${number}m` | `${number}px`;
    end?: `${number}m` | `${number}px`;
  };
};

export type LineSymbolSegmentPlacementOptions = {
  segment?: LineSymbolSegmentTarget;
  anchor?: LineSymbolAnchor;
  offsetPercent?: number;
  lineOffsetPx?: number;
};

export type LineDecoratorRotationOptions = {
  mode?: LineDecoratorRotationMode;
  angle?: number;
  animation?: LineDecoratorAnimationOptions;
};

export type LineArrowheadDecoratorOptions = ArrowheadOptions & {
  kind?: 'arrowhead';
  id?: string;
};

export type LineSymbolDecoratorOptions = LineDecoratorPlacementOptions &
  LineSymbolSegmentPlacementOptions & {
    kind: 'symbol';
    id?: string;
    imageId: string;
    size?: number;
    opacity?: number;
    color?: string;
    rotate?: LineDecoratorRotationOptions;
    animation?: LineDecoratorAnimationOptions | LineDecoratorAnimationOptions[];
  };

export type LineTextDecoratorOptions = LineDecoratorPlacementOptions &
  LineSymbolSegmentPlacementOptions & {
    kind: 'text';
    id?: string;
    text: string;
    fontSize?: number;
    color?: string;
    opacity?: number;
    haloColor?: string;
    haloWidth?: number;
    haloBlur?: number;
    rotate?: LineDecoratorRotationOptions;
    animation?: LineDecoratorAnimationOptions | LineDecoratorAnimationOptions[];
  };

export type LineDecoratorOptions =
  | LineArrowheadDecoratorOptions
  | LineSymbolDecoratorOptions
  | LineTextDecoratorOptions;

export function isArrowheadDecorator(
  decorator: LineDecoratorOptions,
): decorator is LineArrowheadDecoratorOptions {
  return !decorator.kind || decorator.kind === 'arrowhead';
}

export function isTextDecorator(
  decorator: LineDecoratorOptions,
): decorator is LineTextDecoratorOptions {
  return decorator.kind === 'text';
}

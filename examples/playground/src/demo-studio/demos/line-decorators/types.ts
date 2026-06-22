import type { LineDecoratorOptions } from 'maplibre-geoforge';

export type LayerPosition = 'default' | 'below-lines' | 'above-lines';
export type DecoratorKind = 'arrowhead' | 'symbol' | 'text';

export type LineDecoratorDemoState = {
  kind: DecoratorKind;
  layerPosition: LayerPosition;
  frequency: string;
  segment: 'first' | 'middle' | 'last' | 'all';
  anchor: 'front' | 'middle' | 'back';
  lineOffsetPx: number;
  animationEnabled: boolean;
  animationDurationMs: number;
  text: string;
  textColor: string;
  symbolColor: string;
  arrowColor: string;
  decorators: LineDecoratorOptions[];
};

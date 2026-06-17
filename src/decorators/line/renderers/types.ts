import type { Feature } from 'geojson';
import type { LineDecoratorKind, LineDecoratorOptions } from '../types.ts';

export type LineDecoratorRendererKind = Exclude<LineDecoratorKind, 'arrowhead'>;

export type LineDecoratorRenderItem<
  TDecorator extends LineDecoratorOptions = LineDecoratorOptions,
> = {
  feature: Feature;
  decorator: TDecorator;
};

export type LineDecoratorRenderer<TDecorator extends LineDecoratorOptions = LineDecoratorOptions> =
  {
    kind: LineDecoratorRendererKind;
    update(items: Array<LineDecoratorRenderItem<TDecorator>>): void;
    clear(): void;
    destroy(): void;
  };

import type {
  ArrowFrequencyUnit,
  LineDecoratorAnimationOptions,
  LineDecoratorOptions,
  LinePlacementFrequency,
} from 'maplibre-geoforge';
import type { LineDecoratorDemoState } from './types.ts';

const DEMO_SYMBOL_IMAGE_ID = 'gf-demo-chevron';
const DEFAULT_FREQUENCY = '50m';

type StateWithoutDecorators = Omit<LineDecoratorDemoState, 'decorators'>;

const initialStateValues = {
  kind: 'arrowhead',
  layerPosition: 'above-lines',
  frequency: DEFAULT_FREQUENCY,
  segment: 'middle',
  anchor: 'middle',
  lineOffsetPx: 0,
  animationEnabled: false,
  animationDurationMs: 900,
  text: 'FLOW',
  textColor: '#f8fafc',
  symbolColor: '#67d6ff',
  arrowColor: '#67d6ff',
} satisfies StateWithoutDecorators;

export const initialLineDecoratorState: LineDecoratorDemoState = {
  ...initialStateValues,
  decorators: [createDecoratorFromState({ ...initialStateValues, decorators: [] })],
};

export function buildLineDecoratorSnippet(state: LineDecoratorDemoState): string {
  const decorator = createDecoratorFromState(state);
  const decoratorsJson = JSON.stringify([decorator], null, 2);
  const layerPositionJson = JSON.stringify(state.layerPosition);

  return `const decorators = ${decoratorsJson};

geoForge.decorators.lines.configure({ layerPosition: ${layerPositionJson} });
geoForge.decorators.lines.syncFromFeatures(features, () => decorators);`;
}

export function createDecoratorFromState(state: LineDecoratorDemoState): LineDecoratorOptions {
  if (state.kind === 'arrowhead') {
    return {
      kind: 'arrowhead',
      color: normalizeColor(state.arrowColor, initialStateValues.arrowColor),
      fillColor: normalizeColor(state.arrowColor, initialStateValues.arrowColor),
      fill: true,
      size: '18px',
      yawn: 62,
      frequency: normalizeArrowFrequency(state.frequency),
      offsets: { start: '10m', end: '10m' },
      weight: 2,
      opacity: 1,
      fillOpacity: 0.35,
    };
  }

  const animation: LineDecoratorAnimationOptions | undefined = state.animationEnabled
    ? {
        enabled: true,
        property: state.kind === 'text' ? 'fontSize' : 'size',
        from: state.kind === 'text' ? 12 : 0.75,
        to: state.kind === 'text' ? 18 : 1.2,
        durationMs: normalizePositiveNumber(state.animationDurationMs, 900),
        iterationCount: 'infinite',
        direction: 'alternate',
        easing: 'ease-in-out',
      }
    : undefined;

  const placement = {
    frequency: normalizePlacementFrequency(state.frequency),
    segment: state.segment,
    anchor: state.anchor,
    lineOffsetPx: state.lineOffsetPx,
    rotate: { mode: 'line', angle: -90 },
    ...(animation ? { animation } : {}),
  } satisfies Partial<Extract<LineDecoratorOptions, { kind: 'symbol' | 'text' }>>;

  if (state.kind === 'text') {
    return {
      kind: 'text',
      text: state.text.trim() || initialStateValues.text,
      color: normalizeColor(state.textColor, initialStateValues.textColor),
      fontSize: 14,
      haloColor: '#020617',
      haloWidth: 2,
      opacity: 1,
      ...placement,
    };
  }

  return {
    kind: 'symbol',
    imageId: DEMO_SYMBOL_IMAGE_ID,
    color: normalizeColor(state.symbolColor, initialStateValues.symbolColor),
    size: 1,
    opacity: 1,
    ...placement,
  };
}

function normalizeArrowFrequency(value: string): ArrowFrequencyUnit {
  const frequency = normalizeSharedFrequency(value);

  return frequency === 'single' ? DEFAULT_FREQUENCY : frequency;
}

function normalizePlacementFrequency(value: string): LinePlacementFrequency {
  return normalizeSharedFrequency(value);
}

function normalizeSharedFrequency(value: string): LinePlacementFrequency {
  const frequency = value.trim().toLowerCase();

  if (frequency === 'single' || frequency === 'endonly' || frequency === 'allvertices') {
    return frequency;
  }

  if (isPositiveDistanceFrequency(frequency)) {
    return frequency as LinePlacementFrequency;
  }

  const numericFrequency = Number(frequency);
  if (Number.isFinite(numericFrequency) && numericFrequency > 0) {
    return numericFrequency;
  }

  return DEFAULT_FREQUENCY;
}

function isPositiveDistanceFrequency(value: string): value is `${number}m` | `${number}px` {
  return /^(?:\d+|\d*\.\d+)(?:m|px)$/.test(value) && Number.parseFloat(value) > 0;
}

function normalizePositiveNumber(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function normalizeColor(value: string, fallback: string): string {
  return value.trim() || fallback;
}

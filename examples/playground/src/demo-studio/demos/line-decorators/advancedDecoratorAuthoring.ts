import type {
  ArrowFrequencyUnit,
  LineDecoratorAnimationDirection,
  LineDecoratorAnimationEasing,
  LineDecoratorAnimationOptions,
  LineDecoratorAnimationProperty,
  LineDecoratorOptions,
  LineDecoratorRotationMode,
  LinePlacementFrequency,
} from 'maplibre-geoforge';

export type AdvancedDecoratorLayerPosition = 'default' | 'below-lines' | 'above-lines';
export type AdvancedDecoratorKind = 'arrowhead' | 'symbol' | 'text';
export type AdvancedDecoratorInteractionMode = 'select' | 'draw';
export type AdvancedDecoratorLineSelectionId = 'sample-line' | string;
export type AdvancedDecoratorSymbolPreset = 'chevron' | 'diamond' | 'dot' | 'custom';
export type AdvancedDecoratorAnimationProperty = Extract<
  LineDecoratorAnimationProperty,
  'rotate' | 'opacity' | 'size' | 'fontSize'
>;

export type AdvancedLineStyleState = {
  color: string;
  width: number;
  opacity: number;
};

export type AdvancedSvgValidationResult =
  | { valid: true; message: 'Live' }
  | { valid: false; message: 'Paste SVG markup' | 'Invalid SVG' };

export type AdvancedDecoratorPlacement = {
  frequency: LinePlacementFrequency;
  offsets: ReturnType<typeof buildOffsets>;
  segment: AdvancedDecoratorState['segment'];
  anchor: AdvancedDecoratorState['anchor'];
  offsetPercent: number;
  lineOffsetPx: number;
  rotate: {
    mode: LineDecoratorRotationMode;
    angle: number;
  };
  animation: LineDecoratorAnimationOptions[] | undefined;
};

export type AdvancedDecoratorState = {
  selectedLineId: AdvancedDecoratorLineSelectionId | null;
  interactionMode: AdvancedDecoratorInteractionMode;
  layerPosition: AdvancedDecoratorLayerPosition;
  lineStyle: AdvancedLineStyleState;
  kind: AdvancedDecoratorKind;
  frequency: string;
  segment: 'first' | 'middle' | 'last' | 'all';
  anchor: 'front' | 'middle' | 'back';
  offsetPercent: number;
  lineOffsetPx: number;
  startOffset: string;
  endOffset: string;
  rotateMode: LineDecoratorRotationMode;
  rotateAngle: number;
  symbolPreset: AdvancedDecoratorSymbolPreset;
  symbolColor: string;
  symbolSize: number;
  symbolOpacity: number;
  customSvg: string;
  customSvgCss: string;
  text: string;
  textColor: string;
  fontSize: number;
  textOpacity: number;
  haloColor: string;
  haloWidth: number;
  haloBlur: number;
  arrowColor: string;
  arrowFillColor: string;
  arrowSize: string;
  arrowYawn: number;
  arrowWeight: number;
  arrowOpacity: number;
  arrowFillOpacity: number;
  arrowFill: boolean;
  arrowProportional: boolean;
  animationEnabled: boolean;
  animationProperties: AdvancedDecoratorAnimationProperty[];
  animationFrom: number;
  animationTo: number;
  animationDurationMs: number;
  animationDelayMs: number;
  animationIterationCount: string;
  animationDirection: LineDecoratorAnimationDirection;
  animationEasing: LineDecoratorAnimationEasing;
};

const DEFAULT_LINE_STYLE: AdvancedLineStyleState = {
  color: '#0f766e',
  width: 6,
  opacity: 0.86,
};

const DEFAULT_CUSTOM_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <path class="mark" d="M6 16h17m0 0-7-7m7 7-7 7" />
</svg>`;

const DEFAULT_CUSTOM_SVG_CSS = `.mark {
  fill: none;
  stroke: #0f766e;
  stroke-width: 4;
  stroke-linecap: round;
  stroke-linejoin: round;
}`;

export function createAdvancedDecoratorState(): AdvancedDecoratorState {
  return {
    selectedLineId: null,
    interactionMode: 'select',
    layerPosition: 'above-lines',
    lineStyle: { ...DEFAULT_LINE_STYLE },
    kind: 'symbol',
    frequency: 'single',
    segment: 'middle',
    anchor: 'middle',
    offsetPercent: 0,
    lineOffsetPx: 0,
    startOffset: '0px',
    endOffset: '0px',
    rotateMode: 'line',
    rotateAngle: -90,
    symbolPreset: 'chevron',
    symbolColor: '#0f766e',
    symbolSize: 1,
    symbolOpacity: 1,
    customSvg: DEFAULT_CUSTOM_SVG,
    customSvgCss: DEFAULT_CUSTOM_SVG_CSS,
    text: 'DN 300',
    textColor: '#172554',
    fontSize: 16,
    textOpacity: 1,
    haloColor: '#ffffff',
    haloWidth: 2,
    haloBlur: 0,
    arrowColor: '#f97316',
    arrowFillColor: '#f97316',
    arrowSize: '16px',
    arrowYawn: 60,
    arrowWeight: 2,
    arrowOpacity: 1,
    arrowFillOpacity: 0.22,
    arrowFill: true,
    arrowProportional: false,
    animationEnabled: false,
    animationProperties: ['rotate'],
    animationFrom: 0,
    animationTo: 360,
    animationDurationMs: 1200,
    animationDelayMs: 0,
    animationIterationCount: 'infinite',
    animationDirection: 'normal',
    animationEasing: 'linear',
  };
}

export function validateSvgMarkup(svg: string): AdvancedSvgValidationResult {
  if (!svg.trim()) {
    return { valid: false, message: 'Paste SVG markup' };
  }

  if (typeof DOMParser !== 'undefined') {
    const parser = new DOMParser();
    const parsed = parser.parseFromString(svg, 'image/svg+xml');
    const parserError = parsed.querySelector('parsererror');
    const root = parsed.documentElement;

    if (parserError || root.nodeName.toLowerCase() !== 'svg') {
      return { valid: false, message: 'Invalid SVG' };
    }

    return { valid: true, message: 'Live' };
  }

  return validateSvgMarkupWithoutDomParser(svg);
}

export function mergeSvgCss(svg: string, css: string): string {
  if (!css.trim() || /<style[\s>]/i.test(svg)) {
    return svg;
  }

  return svg.replace(/<svg([^>]*)>/i, `<svg$1><style>${css}</style>`);
}

export function buildDecoratorFromAdvancedState(
  form: AdvancedDecoratorState,
  imageId = 'lab-chevron',
): LineDecoratorOptions {
  const frequency = parseFrequency(form.frequency);
  const offsets = buildOffsets(form);

  if (form.kind === 'arrowhead') {
    const arrowFrequency: ArrowFrequencyUnit =
      form.frequency === 'single' ? 'endonly' : (frequency as ArrowFrequencyUnit);

    return {
      kind: 'arrowhead',
      frequency: arrowFrequency,
      offsets,
      color: form.arrowColor,
      fillColor: form.arrowFillColor,
      fill: form.arrowFill,
      size: form.arrowSize as never,
      yawn: form.arrowYawn,
      weight: form.arrowWeight,
      opacity: form.arrowOpacity,
      fillOpacity: form.arrowFillOpacity,
      proportionalToTotal: form.arrowProportional,
    };
  }

  const placement = buildSegmentPlacement(form);

  if (form.kind === 'text') {
    return {
      kind: 'text',
      text: form.text,
      color: form.textColor,
      fontSize: form.fontSize,
      opacity: form.textOpacity,
      haloColor: form.haloColor,
      haloWidth: form.haloWidth,
      haloBlur: form.haloBlur,
      ...placement,
    };
  }

  return {
    kind: 'symbol',
    imageId,
    color: form.symbolColor,
    size: form.symbolSize,
    opacity: form.symbolOpacity,
    ...placement,
  };
}

export function buildSegmentPlacement(form: AdvancedDecoratorState): AdvancedDecoratorPlacement {
  return {
    frequency: parseFrequency(form.frequency),
    offsets: buildOffsets(form),
    segment: form.segment,
    anchor: form.anchor,
    offsetPercent: form.offsetPercent,
    lineOffsetPx: form.lineOffsetPx,
    rotate: {
      mode: form.rotateMode,
      angle: form.rotateAngle,
    },
    animation: buildAnimations(form),
  };
}

export function buildAnimations(
  form: AdvancedDecoratorState,
): LineDecoratorAnimationOptions[] | undefined {
  if (!form.animationEnabled || form.kind === 'arrowhead') {
    return undefined;
  }

  const properties = form.animationProperties.filter((property) => {
    if (form.kind === 'symbol') {
      return property !== 'fontSize';
    }

    return property !== 'size';
  });

  return properties.map((property): LineDecoratorAnimationOptions => {
    return {
      property,
      from: form.animationFrom,
      to: form.animationTo,
      durationMs: form.animationDurationMs,
      delayMs: form.animationDelayMs,
      iterationCount: parseIterationCount(form.animationIterationCount),
      direction: form.animationDirection,
      easing: form.animationEasing,
    };
  });
}

export function buildOffsets(form: Pick<AdvancedDecoratorState, 'startOffset' | 'endOffset'>) {
  const start = form.startOffset.trim();
  const end = form.endOffset.trim();

  return {
    ...(start ? { start: start as never } : {}),
    ...(end ? { end: end as never } : {}),
  };
}

export function parseFrequency(value: string): LinePlacementFrequency {
  const numeric = Number(value);

  return Number.isFinite(numeric) && value.trim() !== ''
    ? numeric
    : (value as LinePlacementFrequency);
}

export function parseIterationCount(value: string): number | 'infinite' {
  return value === 'infinite' ? 'infinite' : Number(value) || 1;
}

function validateSvgMarkupWithoutDomParser(svg: string): AdvancedSvgValidationResult {
  const trimmed = svg.trim();
  const openTag = trimmed.match(/^<svg(?:\s[^>]*)?>/i);

  if (!openTag || !/<\/svg>\s*$/i.test(trimmed)) {
    return { valid: false, message: 'Invalid SVG' };
  }

  const tags = Array.from(trimmed.matchAll(/<\/?([a-z][\w:-]*)(?:\s[^>]*)?>/gi));
  const stack: string[] = [];

  for (const tag of tags) {
    const raw = tag[0];
    const name = tag[1].toLowerCase();

    if (raw.startsWith('</')) {
      if (stack.pop() !== name) {
        return { valid: false, message: 'Invalid SVG' };
      }
    } else if (!raw.endsWith('/>')) {
      stack.push(name);
    }
  }

  return stack.length === 0
    ? { valid: true, message: 'Live' }
    : { valid: false, message: 'Invalid SVG' };
}

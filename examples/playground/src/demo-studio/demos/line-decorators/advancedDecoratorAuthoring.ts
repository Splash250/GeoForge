import type {
  ArrowFrequencyUnit,
  ArrowOffsetUnit,
  ArrowSizeUnit,
  GeoJsonImportFeature,
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

export type AdvancedDecoratorLineFeature = GeoJsonImportFeature & {
  id: 'advanced-decorator-line';
  geometry: {
    type: 'LineString';
    coordinates: [number, number][];
  };
  properties: {
    lineColor: string;
    lineWidth: number;
    lineOpacity: number;
    decorators: LineDecoratorOptions[];
  };
};

export type AdvancedSvgValidationResult =
  | { valid: true; message: 'Live' }
  | { valid: false; message: 'Paste SVG markup' | 'Invalid SVG' };

export type AdvancedDecoratorPlacement = {
  frequency?: LinePlacementFrequency;
  offsets?: NonNullable<ReturnType<typeof buildOffsets>>;
  segment: AdvancedDecoratorState['segment'];
  anchor: AdvancedDecoratorState['anchor'];
  offsetPercent: number;
  lineOffsetPx: number;
  rotate: {
    mode: LineDecoratorRotationMode;
    angle: number;
  };
  animation?: LineDecoratorAnimationOptions[];
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
  decorators?: LineDecoratorOptions[];
};

export type AdvancedDecoratorSyncTarget = {
  decorators: {
    lines: {
      configure: (options: { layerPosition: AdvancedDecoratorLayerPosition }) => void;
      syncFromFeatures: (
        features: GeoJsonImportFeature[],
        resolveDecorators: (feature: GeoJsonImportFeature) => LineDecoratorOptions[],
      ) => void;
    };
  };
};

export type SyncAdvancedDecoratorsOptions = {
  geoForge: AdvancedDecoratorSyncTarget;
  state: AdvancedDecoratorState;
  features: GeoJsonImportFeature[];
};

export type AdvancedLineStyleFeatureTarget = {
  updateProperties: (
    properties: Pick<
      AdvancedDecoratorLineFeature['properties'],
      'lineColor' | 'lineWidth' | 'lineOpacity'
    >,
  ) => void;
};

export type AdvancedCustomSvgImageTarget<TImage = unknown> = {
  hasImage: (id: string) => boolean;
  addImage: (id: string, image: TImage) => void;
  removeImage?: (id: string) => void;
  updateImage?: (id: string, image: TImage) => void;
};

export type AdvancedSvgImageLoader<TImage = unknown> = (svg: string) => Promise<TImage>;

export type AdvancedCustomSvgEnsureOptions = {
  isCurrent?: () => boolean;
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

const ADVANCED_DECORATOR_LINE_COORDINATES: [number, number][] = [
  [19.025, 47.491],
  [19.04, 47.497],
  [19.055, 47.493],
  [19.071, 47.501],
];

const SYMBOL_IMAGE_IDS: Record<AdvancedDecoratorSymbolPreset, string> = {
  chevron: 'gf-demo-chevron',
  diamond: 'gf-demo-diamond',
  dot: 'gf-demo-dot',
  custom: 'gf-demo-custom-advanced',
};

export const ADVANCED_CUSTOM_SYMBOL_IMAGE_ID = SYMBOL_IMAGE_IDS.custom;

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

export function getAdvancedDecoratorLineFeature(
  state: AdvancedDecoratorState,
): AdvancedDecoratorLineFeature {
  return {
    type: 'Feature',
    id: 'advanced-decorator-line',
    geometry: {
      type: 'LineString',
      coordinates: ADVANCED_DECORATOR_LINE_COORDINATES.map(([lng, lat]) => [lng, lat]),
    },
    properties: {
      lineColor: state.lineStyle.color,
      lineWidth: state.lineStyle.width,
      lineOpacity: state.lineStyle.opacity,
      decorators: getAdvancedDecorators(state),
    },
  };
}

export function getAdvancedDecoratorCode(state: AdvancedDecoratorState): string {
  const lineFeatureJson = JSON.stringify(getAdvancedDecoratorLineFeature(state), null, 2);
  const layerPositionJson = JSON.stringify(state.layerPosition);

  return `const lineFeature = ${lineFeatureJson};
const importResult = geoForge.features.importGeoJson(lineFeature, { overwrite: true });
const features = importResult.addedFeatures.map((featureData) => featureData.getGeoJson());

geoForge.decorators.lines.configure({ layerPosition: ${layerPositionJson} });
geoForge.decorators.lines.syncFromFeatures(features, (feature) =>
  Array.isArray(feature.properties?.decorators) ? feature.properties.decorators : []
);`;
}

export function addAdvancedDecorator(
  state: AdvancedDecoratorState,
  decorator: LineDecoratorOptions,
): AdvancedDecoratorState {
  return {
    ...state,
    decorators: [
      ...(state.decorators ?? []).map(cloneLineDecorator),
      cloneLineDecorator(decorator),
    ],
  };
}

export function removeAdvancedDecorator(
  state: AdvancedDecoratorState,
  index: number,
): AdvancedDecoratorState {
  return {
    ...state,
    decorators: (state.decorators ?? [])
      .filter((_, decoratorIndex) => decoratorIndex !== index)
      .map(cloneLineDecorator),
  };
}

export function clearAdvancedDecorators(state: AdvancedDecoratorState): AdvancedDecoratorState {
  return {
    ...state,
    decorators: [],
  };
}

export function applyAdvancedLineStyleToFeatures(
  features: AdvancedLineStyleFeatureTarget[],
  state: AdvancedDecoratorState,
): void {
  const properties = {
    lineColor: state.lineStyle.color,
    lineWidth: state.lineStyle.width,
    lineOpacity: state.lineStyle.opacity,
  };

  features.forEach((feature) => {
    feature.updateProperties(properties);
  });
}

export function syncAdvancedDecorators({
  geoForge,
  state,
  features,
}: SyncAdvancedDecoratorsOptions): void {
  geoForge.decorators.lines.configure({ layerPosition: state.layerPosition });
  geoForge.decorators.lines.syncFromFeatures(features, () => getAdvancedDecorators(state));
}

export function createAdvancedCustomSvgImageManager<TImage>(
  loadImage: AdvancedSvgImageLoader<TImage>,
) {
  let registeredSvg: string | undefined;

  function isCurrent(options: AdvancedCustomSvgEnsureOptions): boolean {
    return options.isCurrent ? options.isCurrent() : true;
  }

  function removeRegisteredImage(map: AdvancedCustomSvgImageTarget<TImage>): void {
    if (map.hasImage(ADVANCED_CUSTOM_SYMBOL_IMAGE_ID) && map.removeImage) {
      map.removeImage(ADVANCED_CUSTOM_SYMBOL_IMAGE_ID);
    }

    registeredSvg = undefined;
  }

  return {
    async ensure(
      map: AdvancedCustomSvgImageTarget<TImage>,
      state: AdvancedDecoratorState,
      options: AdvancedCustomSvgEnsureOptions = {},
    ): Promise<void> {
      if (state.kind !== 'symbol' || state.symbolPreset !== 'custom') {
        if (isCurrent(options)) {
          removeRegisteredImage(map);
        }

        return;
      }

      if (!validateSvgMarkup(state.customSvg).valid) {
        if (isCurrent(options)) {
          removeRegisteredImage(map);
        }

        return;
      }

      const svg = mergeSvgCss(state.customSvg, state.customSvgCss);

      if (registeredSvg === svg && map.hasImage(ADVANCED_CUSTOM_SYMBOL_IMAGE_ID)) {
        return;
      }

      let image: TImage;
      try {
        image = await loadImage(svg);
      } catch (error) {
        if (isCurrent(options)) {
          removeRegisteredImage(map);
          throw error;
        }

        return;
      }

      if (!isCurrent(options)) {
        return;
      }

      if (map.hasImage(ADVANCED_CUSTOM_SYMBOL_IMAGE_ID)) {
        if (map.updateImage) {
          map.updateImage(ADVANCED_CUSTOM_SYMBOL_IMAGE_ID, image);
        } else if (map.removeImage) {
          map.removeImage(ADVANCED_CUSTOM_SYMBOL_IMAGE_ID);
          map.addImage(ADVANCED_CUSTOM_SYMBOL_IMAGE_ID, image);
        }
      } else {
        map.addImage(ADVANCED_CUSTOM_SYMBOL_IMAGE_ID, image);
      }

      registeredSvg = svg;
    },

    cleanup(map: AdvancedCustomSvgImageTarget<TImage>): void {
      removeRegisteredImage(map);
    },
  };
}

function getAdvancedDecorators(state: AdvancedDecoratorState): LineDecoratorOptions[] {
  return state.decorators
    ? state.decorators.map(cloneLineDecorator)
    : [cloneLineDecorator(buildDecoratorFromAdvancedState(state))];
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

export function getAdvancedSymbolImageId(
  state: Pick<AdvancedDecoratorState, 'symbolPreset'>,
): string {
  return SYMBOL_IMAGE_IDS[state.symbolPreset];
}

export function buildDecoratorFromAdvancedState(
  form: AdvancedDecoratorState,
  imageId = getAdvancedSymbolImageId(form),
): LineDecoratorOptions {
  const offsets = buildOffsets(form);

  if (form.kind === 'arrowhead') {
    const arrowFrequency = parseArrowFrequency(form.frequency);
    const arrowSize = parseArrowSize(form.arrowSize);

    return {
      kind: 'arrowhead',
      ...(arrowFrequency ? { frequency: arrowFrequency } : {}),
      ...(offsets ? { offsets } : {}),
      color: form.arrowColor,
      fillColor: form.arrowFillColor,
      fill: form.arrowFill,
      ...(arrowSize ? { size: arrowSize } : {}),
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
  const frequency = parsePlacementFrequency(form.frequency);
  const offsets = buildOffsets(form);
  const animation = buildAnimations(form);

  return {
    ...(frequency ? { frequency } : {}),
    ...(offsets ? { offsets } : {}),
    segment: form.segment,
    anchor: form.anchor,
    offsetPercent: form.offsetPercent,
    lineOffsetPx: form.lineOffsetPx,
    rotate: {
      mode: form.rotateMode,
      angle: form.rotateAngle,
    },
    ...(animation ? { animation } : {}),
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

export function buildOffsets(
  form: Pick<AdvancedDecoratorState, 'startOffset' | 'endOffset'>,
): { start?: ArrowOffsetUnit; end?: ArrowOffsetUnit } | undefined {
  const start = parseArrowOffset(form.startOffset);
  const end = parseArrowOffset(form.endOffset);
  const offsets = {
    ...(start ? { start } : {}),
    ...(end ? { end } : {}),
  };

  return start || end ? offsets : undefined;
}

export function parsePlacementFrequency(value: string): LinePlacementFrequency | undefined {
  const trimmed = value.trim().toLowerCase();
  const numeric = Number(trimmed);

  if (trimmed === 'single' || trimmed === 'allvertices' || trimmed === 'endonly') {
    return trimmed;
  }

  if (isArrowDistanceUnit(trimmed)) {
    return trimmed;
  }

  return Number.isFinite(numeric) && numeric > 0 ? numeric : undefined;
}

export function parseArrowFrequency(value: string): ArrowFrequencyUnit | undefined {
  const frequency = parsePlacementFrequency(value);

  if (frequency === 'single') {
    return 'endonly';
  }

  return frequency;
}

export function parseArrowOffset(value: string): ArrowOffsetUnit | undefined {
  const trimmed = value.trim();

  return isArrowDistanceUnit(trimmed) ? trimmed : undefined;
}

export function parseArrowSize(value: string): ArrowSizeUnit | undefined {
  const trimmed = value.trim();

  return isArrowSizeUnit(trimmed) ? trimmed : undefined;
}

export function parseIterationCount(value: string): number | 'infinite' {
  const trimmed = value.trim().toLowerCase();
  const numeric = Number(trimmed);

  if (trimmed === 'infinite') {
    return 'infinite';
  }

  return Number.isFinite(numeric) && numeric > 0 ? numeric : 1;
}

function isArrowDistanceUnit(value: string): value is ArrowOffsetUnit {
  return isNonNegativeUnit(value, ['m', 'px']);
}

function isArrowSizeUnit(value: string): value is ArrowSizeUnit {
  return isNonNegativeUnit(value, ['m', 'px', '%']);
}

function isNonNegativeUnit(value: string, units: string[]): boolean {
  const match = value.match(/^(\d+|\d*\.\d+)([a-z%]+)$/);

  return Boolean(match && Number(match[1]) >= 0 && units.includes(match[2]));
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

function cloneLineDecorator(decorator: LineDecoratorOptions): LineDecoratorOptions {
  if (typeof structuredClone === 'function') {
    return structuredClone(decorator) as LineDecoratorOptions;
  }

  return JSON.parse(JSON.stringify(decorator)) as LineDecoratorOptions;
}

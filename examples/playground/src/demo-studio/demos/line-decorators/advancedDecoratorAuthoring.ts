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
  customSymbolImages?: Record<string, { svg: string }>;
};

export type AdvancedDecoratorAuthoringTarget = {
  setDecorators: (decorators: LineDecoratorOptions[]) => void;
  setLayerPosition: (layerPosition: AdvancedDecoratorLayerPosition) => void;
  setLineStyle: (style: AdvancedLineStyleState) => void;
  sync: () => void;
};

export type SyncAdvancedDecoratorsOptions = {
  authoring: AdvancedDecoratorAuthoringTarget;
  state: AdvancedDecoratorState;
};

export type AdvancedCustomSvgMapImageTarget<TImage = unknown> = {
  hasImage: (id: string) => boolean;
  addImage: (id: string, image: TImage) => void;
  removeImage?: (id: string) => void;
  updateImage?: (id: string, image: TImage) => void;
};

export type AdvancedSvgSymbolImageRegistrationResult =
  | { ok: true; id: string; action: 'added' | 'updated' }
  | { ok: false; id: string; reason: string; error: Error };

export type AdvancedCustomSvgAuthoringImageTarget<TImage = unknown> = {
  registerSvgSymbolImage: (registration: {
    id: string;
    svg: string;
    loadImage: (svg: string) => Promise<TImage>;
    isCurrent?: () => boolean;
  }) => Promise<AdvancedSvgSymbolImageRegistrationResult>;
  unregisterSvgSymbolImage: (id: string) => void;
};

export type AdvancedCustomSvgImageTarget<TImage = unknown> =
  | AdvancedCustomSvgMapImageTarget<TImage>
  | AdvancedCustomSvgAuthoringImageTarget<TImage>;

export type AdvancedSvgImageLoader<TImage = unknown> = (svg: string) => Promise<TImage>;

export type AdvancedCustomSvgEnsureOptions = {
  isCurrent?: () => boolean;
};

export type AdvancedCustomSvgEnsureResult = {
  customImageReady: boolean;
  readyImageIds?: string[];
};

export type AdvancedDecoratorRenderStateOptions = {
  customImageReady: boolean;
  readyImageIds?: string[];
};

export type AdvancedCustomSvgEnsureError = Error & {
  readyImageIds?: string[];
};

type AdvancedCustomSymbolImageSource = {
  id: string;
  svg: string | null;
  throwOnFailure: boolean;
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
const ADVANCED_SAVED_CUSTOM_SYMBOL_IMAGE_ID_PREFIX = `${ADVANCED_CUSTOM_SYMBOL_IMAGE_ID}-saved-`;

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
  const lineStyleJson = JSON.stringify(state.lineStyle, null, 2);
  const customSymbolRegistrations = getAdvancedCustomSymbolImageSources(state).filter(
    (source): source is AdvancedCustomSymbolImageSource & { svg: string } => Boolean(source.svg),
  );
  const customSymbolRegistrationCode = customSymbolRegistrations.length
    ? `

const svgToImage = async (svg) => {
  const image = new Image(32, 32);
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('Unable to load SVG image'));
      image.src = url;
    });
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
};
${customSymbolRegistrations
  .map(
    (source) => `await authoring.registerSvgSymbolImage({
  id: ${JSON.stringify(source.id)},
  svg: ${JSON.stringify(source.svg)},
  loadImage: svgToImage,
});`,
  )
  .join('\n')}`
    : '';

  return `const lineFeature = ${lineFeatureJson};
const importResult = geoForge.features.importGeoJson(lineFeature, {
  overwrite: true,
  history: false,
});
const authoring = geoForge.decorators.lines.createAuthoringSession({
  features: importResult.addedFeatures,
  layerPosition: ${layerPositionJson},
  decorators: lineFeature.properties.decorators,
});${customSymbolRegistrationCode}

authoring.setLineStyle(${lineStyleJson});
authoring.sync();

// Later, when the editor is closed:
// authoring.dispose();`;
}

export function addAdvancedDecorator(
  state: AdvancedDecoratorState,
  decorator: LineDecoratorOptions,
): AdvancedDecoratorState {
  const nextCustomSymbolImages = { ...(state.customSymbolImages ?? {}) };
  const nextDecorator = captureSavedCustomSymbolDecorator(
    state,
    cloneLineDecorator(decorator),
    nextCustomSymbolImages,
  );

  return {
    ...state,
    decorators: [...(state.decorators ?? []).map(cloneLineDecorator), nextDecorator],
    customSymbolImages: emptyToUndefined(nextCustomSymbolImages),
  };
}

export function removeAdvancedDecorator(
  state: AdvancedDecoratorState,
  index: number,
): AdvancedDecoratorState {
  const decorators = (state.decorators ?? [])
    .filter((_, decoratorIndex) => decoratorIndex !== index)
    .map(cloneLineDecorator);

  return {
    ...state,
    decorators,
    customSymbolImages: pruneCustomSymbolImages(state.customSymbolImages, decorators),
  };
}

export function clearAdvancedDecorators(state: AdvancedDecoratorState): AdvancedDecoratorState {
  return {
    ...state,
    decorators: [],
    customSymbolImages: undefined,
  };
}

export function syncAdvancedDecorators({ authoring, state }: SyncAdvancedDecoratorsOptions): void {
  authoring.setLayerPosition(state.layerPosition);
  authoring.setLineStyle(state.lineStyle);
  authoring.setDecorators(getAdvancedDecorators(state));
  authoring.sync();
}

export function getAdvancedDecoratorRenderState(
  state: AdvancedDecoratorState,
  options: AdvancedDecoratorRenderStateOptions,
): AdvancedDecoratorState {
  const readyImageIds = new Set(options.readyImageIds);

  if (options.customImageReady) {
    readyImageIds.add(ADVANCED_CUSTOM_SYMBOL_IMAGE_ID);
  }

  if (readyImageIds.size && allCustomSymbolDecoratorsReady(state, readyImageIds)) {
    return state;
  }

  return {
    ...state,
    symbolPreset:
      state.symbolPreset === 'custom' && !readyImageIds.has(ADVANCED_CUSTOM_SYMBOL_IMAGE_ID)
        ? 'chevron'
        : state.symbolPreset,
    decorators: state.decorators?.map((decorator) =>
      replaceUnavailableCustomSymbolDecorator(decorator, readyImageIds),
    ),
  };
}

export function createAdvancedCustomSvgImageManager<TImage>(
  loadImage: AdvancedSvgImageLoader<TImage>,
) {
  const registeredSvgs = new Map<string, string>();

  function isCurrent(options: AdvancedCustomSvgEnsureOptions): boolean {
    return options.isCurrent ? options.isCurrent() : true;
  }

  function removeRegisteredImage(map: AdvancedCustomSvgImageTarget<TImage>): void {
    for (const imageId of [...registeredSvgs.keys()]) {
      removeRegisteredImageById(map, imageId);
    }

    registeredSvgs.clear();
  }

  function removeRegisteredImageById(
    map: AdvancedCustomSvgImageTarget<TImage>,
    imageId: string,
  ): void {
    if (isAuthoringImageTarget(map)) {
      map.unregisterSvgSymbolImage(imageId);
    } else if (map.hasImage(imageId) && map.removeImage) {
      map.removeImage(imageId);
    }

    registeredSvgs.delete(imageId);
  }

  return {
    async ensure(
      map: AdvancedCustomSvgImageTarget<TImage>,
      state: AdvancedDecoratorState,
      options: AdvancedCustomSvgEnsureOptions = {},
    ): Promise<AdvancedCustomSvgEnsureResult> {
      const sources = getAdvancedCustomSymbolImageSources(state);
      const sourceIds = new Set(sources.map((source) => source.id));
      const readyImageIds: string[] = [];
      let pendingError: unknown;

      for (const imageId of [...registeredSvgs.keys()]) {
        if (!sourceIds.has(imageId) && isCurrent(options)) {
          removeRegisteredImageById(map, imageId);
        }
      }

      if (!sources.length) {
        if (isCurrent(options)) {
          removeRegisteredImage(map);
        }

        return { customImageReady: false };
      }

      for (const source of sources) {
        if (!source.svg) {
          if (isCurrent(options)) {
            removeRegisteredImageById(map, source.id);
          }

          continue;
        }

        if (registeredSvgs.get(source.id) === source.svg && imageTargetHasImage(map, source.id)) {
          readyImageIds.push(source.id);
          continue;
        }

        const registration = await registerAdvancedSvgImage(
          map,
          { ...source, svg: source.svg },
          loadImage,
          options,
        );

        if (!registration.ok) {
          if (isCurrent(options)) {
            removeRegisteredImageById(map, source.id);
            if (source.throwOnFailure) {
              pendingError = registration.error;
            }
          }

          continue;
        }

        registeredSvgs.set(source.id, source.svg);
        readyImageIds.push(source.id);
      }

      if (pendingError) {
        throw attachReadyImageIds(pendingError, readyImageIds);
      }

      return {
        customImageReady: readyImageIds.includes(ADVANCED_CUSTOM_SYMBOL_IMAGE_ID),
        readyImageIds,
      };
    },

    cleanup(map: AdvancedCustomSvgImageTarget<TImage>): void {
      removeRegisteredImage(map);
    },
  };
}

type AdvancedCustomSvgRegistrationResult = { ok: true } | { ok: false; error: Error };

async function registerAdvancedSvgImage<TImage>(
  target: AdvancedCustomSvgImageTarget<TImage>,
  source: AdvancedCustomSymbolImageSource & { svg: string },
  loadImage: AdvancedSvgImageLoader<TImage>,
  options: AdvancedCustomSvgEnsureOptions,
): Promise<AdvancedCustomSvgRegistrationResult> {
  if (isAuthoringImageTarget(target)) {
    const result = await target.registerSvgSymbolImage({
      id: source.id,
      svg: source.svg,
      loadImage,
      isCurrent: options.isCurrent,
    });

    return result.ok ? { ok: true } : { ok: false, error: result.error };
  }

  let image: TImage;
  try {
    image = await loadImage(source.svg);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error : new Error('Unable to load custom SVG image.'),
    };
  }

  if (options.isCurrent && !options.isCurrent()) {
    return { ok: false, error: new Error('Custom SVG registration is stale.') };
  }

  if (target.hasImage(source.id)) {
    if (target.removeImage) {
      target.removeImage(source.id);
      target.addImage(source.id, image);
    } else if (target.updateImage) {
      target.updateImage(source.id, image);
    }
  } else {
    target.addImage(source.id, image);
  }

  return { ok: true };
}

function imageTargetHasImage<TImage>(
  target: AdvancedCustomSvgImageTarget<TImage>,
  imageId: string,
): boolean {
  return isAuthoringImageTarget(target) || target.hasImage(imageId);
}

function isAuthoringImageTarget<TImage>(
  target: AdvancedCustomSvgImageTarget<TImage>,
): target is AdvancedCustomSvgAuthoringImageTarget<TImage> {
  return (
    typeof (target as AdvancedCustomSvgAuthoringImageTarget<TImage>).registerSvgSymbolImage ===
    'function'
  );
}

function getAdvancedDecorators(state: AdvancedDecoratorState): LineDecoratorOptions[] {
  return state.decorators
    ? state.decorators.map(cloneLineDecorator)
    : [cloneLineDecorator(buildDecoratorFromAdvancedState(state))];
}

function replaceUnavailableCustomSymbolDecorator(
  decorator: LineDecoratorOptions,
  readyImageIds: Set<string>,
): LineDecoratorOptions {
  const clone = cloneLineDecorator(decorator);

  if (
    clone.kind === 'symbol' &&
    isAdvancedCustomSymbolImageId(clone.imageId) &&
    !readyImageIds.has(clone.imageId)
  ) {
    return {
      ...clone,
      imageId: SYMBOL_IMAGE_IDS.chevron,
    };
  }

  return clone;
}

function allCustomSymbolDecoratorsReady(
  state: AdvancedDecoratorState,
  readyImageIds: Set<string>,
): boolean {
  const draftReady =
    state.kind !== 'symbol' ||
    state.symbolPreset !== 'custom' ||
    readyImageIds.has(ADVANCED_CUSTOM_SYMBOL_IMAGE_ID);

  return (
    draftReady &&
    (state.decorators ?? []).every(
      (decorator) =>
        decorator.kind !== 'symbol' ||
        !isAdvancedCustomSymbolImageId(decorator.imageId) ||
        readyImageIds.has(decorator.imageId),
    )
  );
}

function getAdvancedCustomSymbolImageSources(
  state: AdvancedDecoratorState,
): AdvancedCustomSymbolImageSource[] {
  const sources: AdvancedCustomSymbolImageSource[] = [];

  if (state.kind === 'symbol' && state.symbolPreset === 'custom') {
    sources.push({
      id: ADVANCED_CUSTOM_SYMBOL_IMAGE_ID,
      svg: validateSvgMarkup(state.customSvg).valid
        ? mergeSvgCss(state.customSvg, state.customSvgCss)
        : null,
      throwOnFailure: true,
    });
  }

  for (const [id, image] of Object.entries(state.customSymbolImages ?? {})) {
    sources.push({
      id,
      svg: image.svg,
      throwOnFailure: false,
    });
  }

  if (
    (state.decorators ?? []).some(
      (decorator) =>
        decorator.kind === 'symbol' && decorator.imageId === ADVANCED_CUSTOM_SYMBOL_IMAGE_ID,
    ) &&
    !sources.some((source) => source.id === ADVANCED_CUSTOM_SYMBOL_IMAGE_ID)
  ) {
    sources.push({
      id: ADVANCED_CUSTOM_SYMBOL_IMAGE_ID,
      svg: validateSvgMarkup(state.customSvg).valid
        ? mergeSvgCss(state.customSvg, state.customSvgCss)
        : null,
      throwOnFailure: true,
    });
  }

  return sources;
}

function isAdvancedCustomSymbolImageId(imageId: string): boolean {
  return (
    imageId === ADVANCED_CUSTOM_SYMBOL_IMAGE_ID ||
    imageId.startsWith(ADVANCED_SAVED_CUSTOM_SYMBOL_IMAGE_ID_PREFIX)
  );
}

function captureSavedCustomSymbolDecorator(
  state: AdvancedDecoratorState,
  decorator: LineDecoratorOptions,
  customSymbolImages: Record<string, { svg: string }>,
): LineDecoratorOptions {
  if (decorator.kind !== 'symbol' || decorator.imageId !== ADVANCED_CUSTOM_SYMBOL_IMAGE_ID) {
    return decorator;
  }

  const imageId = getNextSavedCustomSymbolImageId(state);
  customSymbolImages[imageId] = {
    svg: mergeSvgCss(state.customSvg, state.customSvgCss),
  };

  return {
    ...decorator,
    imageId,
  };
}

function attachReadyImageIds(
  error: unknown,
  readyImageIds: string[],
): AdvancedCustomSvgEnsureError {
  const ensureError: AdvancedCustomSvgEnsureError =
    error instanceof Error ? error : new Error('Unable to load custom SVG image.');
  ensureError.readyImageIds = readyImageIds;

  return ensureError;
}

function getNextSavedCustomSymbolImageId(state: AdvancedDecoratorState): string {
  const reservedIds = new Set([
    ...Object.keys(state.customSymbolImages ?? {}),
    ...(state.decorators ?? [])
      .filter(
        (decorator): decorator is LineDecoratorOptions & { kind: 'symbol' } =>
          decorator.kind === 'symbol',
      )
      .map((decorator) => decorator.imageId),
  ]);
  let index = 1;

  while (reservedIds.has(`${ADVANCED_SAVED_CUSTOM_SYMBOL_IMAGE_ID_PREFIX}${index}`)) {
    index++;
  }

  return `${ADVANCED_SAVED_CUSTOM_SYMBOL_IMAGE_ID_PREFIX}${index}`;
}

function pruneCustomSymbolImages(
  customSymbolImages: AdvancedDecoratorState['customSymbolImages'],
  decorators: LineDecoratorOptions[],
): AdvancedDecoratorState['customSymbolImages'] {
  if (!customSymbolImages) {
    return undefined;
  }

  const usedImageIds = new Set(
    decorators
      .filter(
        (decorator): decorator is LineDecoratorOptions & { kind: 'symbol' } =>
          decorator.kind === 'symbol',
      )
      .map((decorator) => decorator.imageId),
  );
  const nextImages = Object.fromEntries(
    Object.entries(customSymbolImages).filter(([imageId]) => usedImageIds.has(imageId)),
  );

  return emptyToUndefined(nextImages);
}

function emptyToUndefined<T>(record: Record<string, T>): Record<string, T> | undefined {
  return Object.keys(record).length ? record : undefined;
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
  return cloneDecoratorValue(decorator) as LineDecoratorOptions;
}

function cloneDecoratorValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(cloneDecoratorValue);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [key, cloneDecoratorValue(entryValue)]),
    );
  }

  return value;
}

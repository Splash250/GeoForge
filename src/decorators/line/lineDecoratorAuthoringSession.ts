import type { Feature } from 'geojson';
import type { StyleImageMetadata } from 'maplibre-gl';
import type { Geoman } from '@/main.ts';
import type { LineDecoratorLayerPosition } from './layerPosition.ts';
import type { LineDecoratorOptions } from './types.ts';
import type { SymbolImageInput } from './symbols/symbolImageRegistry.ts';
import { sanitizeSvgMarkup } from '@/utils/sanitizeSvgMarkup.ts';

export type LineDecoratorAuthoringLineStyle = {
  color?: string;
  width?: number;
  opacity?: number;
};

export type LineDecoratorAuthoringFeatureTarget =
  | Feature
  | {
      getGeoJson: () => Feature;
      updateProperties?: (properties: Record<string, unknown>) => unknown;
    };

export type LineDecoratorAuthoringFeatureInput =
  | readonly LineDecoratorAuthoringFeatureTarget[]
  | (() => readonly LineDecoratorAuthoringFeatureTarget[]);

export type LineDecoratorAuthoringDecoratorResolver = (
  feature: Feature,
) => readonly LineDecoratorOptions[] | null | undefined;

export type LineDecoratorAuthoringDecoratorInput =
  | readonly LineDecoratorOptions[]
  | LineDecoratorAuthoringDecoratorResolver;

export type LineDecoratorAuthoringSessionOptions = {
  features: LineDecoratorAuthoringFeatureInput;
  decorators?: LineDecoratorAuthoringDecoratorInput;
  layerPosition?: LineDecoratorLayerPosition;
};

export type SvgSymbolImageMap = {
  hasImage: (id: string) => boolean;
  addImage: (id: string, image: SymbolImageInput, options?: Partial<StyleImageMetadata>) => unknown;
  updateImage?: (id: string, image: SymbolImageInput) => unknown;
  removeImage?: (id: string) => unknown;
};

export type SvgSymbolImageRegistration<TImage extends SymbolImageInput = SymbolImageInput> = {
  id: string;
  svg: string;
  options?: Partial<StyleImageMetadata>;
  loadImage?: (svg: string) => TImage | Promise<TImage>;
  isCurrent?: () => boolean;
};

export type SvgSymbolImageRegistrationResult =
  | {
      ok: true;
      id: string;
      action: 'added' | 'updated';
    }
  | {
      ok: false;
      id: string;
      reason: 'empty-svg' | 'invalid-svg' | 'image-exists' | 'load-failed' | 'stale';
      error: Error;
    };

export type LineDecoratorAuthoringSession = {
  setFeatures(features: LineDecoratorAuthoringFeatureInput): void;
  setLineStyle(style: LineDecoratorAuthoringLineStyle): void;
  setDecorators(decorators: LineDecoratorAuthoringDecoratorInput): void;
  setLayerPosition(layerPosition: LineDecoratorLayerPosition | undefined): void;
  sync(): void;
  registerSvgSymbolImage(
    registration: SvgSymbolImageRegistration,
  ): Promise<SvgSymbolImageRegistrationResult>;
  unregisterSvgSymbolImage(id: string): void;
  dispose(): void;
};

export type CreateLineDecoratorAuthoringSessionOptions = {
  geoman: Geoman;
  getMap: () => SvgSymbolImageMap;
  options: LineDecoratorAuthoringSessionOptions;
  syncFromFeatures: (
    features: Feature[],
    resolveDecorators?: (feature: Feature) => LineDecoratorOptions[] | null | undefined,
    layerPosition?: LineDecoratorLayerPosition,
  ) => void;
  clear: () => void;
  isActive: () => boolean;
  release: () => void;
};

export class GeomanLineDecoratorAuthoringSession implements LineDecoratorAuthoringSession {
  private disposed = false;
  private featureInput: LineDecoratorAuthoringFeatureInput;
  private decoratorInput: LineDecoratorAuthoringDecoratorInput | undefined;
  private layerPosition: LineDecoratorLayerPosition | undefined;
  private readonly registeredSvgImageIds = new Set<string>();

  constructor(private readonly sessionOptions: CreateLineDecoratorAuthoringSessionOptions) {
    this.featureInput = sessionOptions.options.features;
    this.decoratorInput = cloneDecoratorInput(sessionOptions.options.decorators);
    this.layerPosition = sessionOptions.options.layerPosition;
  }

  setFeatures(features: LineDecoratorAuthoringFeatureInput): void {
    this.assertUsable();
    this.featureInput = Array.isArray(features) ? [...features] : features;
  }

  setLineStyle(style: LineDecoratorAuthoringLineStyle): void {
    this.assertUsable();
    const properties = getLineStyleProperties(style);

    if (!Object.keys(properties).length) {
      return;
    }

    this.runWithoutHistory(() => {
      for (const target of this.resolveFeatureTargets()) {
        if (hasUpdateProperties(target)) {
          target.updateProperties(properties);
        }
      }
    });
  }

  setDecorators(decorators: LineDecoratorAuthoringDecoratorInput): void {
    this.assertUsable();
    this.decoratorInput = cloneDecoratorInput(decorators);
  }

  setLayerPosition(layerPosition: LineDecoratorLayerPosition | undefined): void {
    this.assertUsable();
    this.layerPosition = layerPosition;
  }

  sync(): void {
    this.assertUsable();
    const features = this.resolveFeatureTargets().map(toGeoJsonFeature);
    const decoratorInput = this.decoratorInput;
    const resolveDecorators = decoratorInput
      ? (feature: Feature) => cloneLineDecorators(resolveDecoratorInput(decoratorInput, feature))
      : undefined;

    this.sessionOptions.syncFromFeatures(features, resolveDecorators, this.layerPosition);
  }

  async registerSvgSymbolImage(
    registration: SvgSymbolImageRegistration,
  ): Promise<SvgSymbolImageRegistrationResult> {
    this.assertUsable();

    const sanitizedSvg = sanitizeSvgMarkup(registration.svg);
    const sanitizedRegistration: SvgSymbolImageRegistration = {
      ...registration,
      svg: sanitizedSvg,
    };

    const validationError = getSvgValidationError(
      sanitizedRegistration.id,
      sanitizedRegistration.svg,
    );
    if (validationError) {
      return validationError;
    }

    const map = this.sessionOptions.getMap();
    const ownsImage = this.registeredSvgImageIds.has(sanitizedRegistration.id);

    if (map.hasImage(sanitizedRegistration.id) && !ownsImage) {
      return getImageExistsRegistrationResult(sanitizedRegistration.id);
    }

    let image: SymbolImageInput;
    try {
      image = sanitizedRegistration.loadImage
        ? await sanitizedRegistration.loadImage(sanitizedRegistration.svg)
        : await loadSvgSymbolImage(sanitizedRegistration.svg);
    } catch (error) {
      return {
        ok: false,
        id: sanitizedRegistration.id,
        reason: 'load-failed',
        error: error instanceof Error ? error : new Error('Unable to load SVG symbol image.'),
      };
    }

    const staleSessionResult = this.getStaleRegistrationResult(sanitizedRegistration.id);
    if (staleSessionResult) {
      return staleSessionResult;
    }

    if (sanitizedRegistration.isCurrent && !sanitizedRegistration.isCurrent()) {
      return {
        ok: false,
        id: sanitizedRegistration.id,
        reason: 'stale',
        error: new Error(`Symbol image "${sanitizedRegistration.id}" registration is stale.`),
      };
    }

    if (
      map.hasImage(sanitizedRegistration.id) &&
      !this.registeredSvgImageIds.has(sanitizedRegistration.id)
    ) {
      return getImageExistsRegistrationResult(sanitizedRegistration.id);
    }

    if (map.hasImage(sanitizedRegistration.id)) {
      if (map.removeImage) {
        map.removeImage(sanitizedRegistration.id);
        map.addImage(sanitizedRegistration.id, image, sanitizedRegistration.options);
      } else if (map.updateImage) {
        map.updateImage(sanitizedRegistration.id, image);
      } else {
        return {
          ok: false,
          id: sanitizedRegistration.id,
          reason: 'image-exists',
          error: new Error(`Symbol image "${sanitizedRegistration.id}" cannot be updated.`),
        };
      }
      this.registeredSvgImageIds.add(sanitizedRegistration.id);
      return { ok: true, id: sanitizedRegistration.id, action: 'updated' };
    }

    map.addImage(sanitizedRegistration.id, image, sanitizedRegistration.options);
    this.registeredSvgImageIds.add(sanitizedRegistration.id);
    return { ok: true, id: sanitizedRegistration.id, action: 'added' };
  }

  unregisterSvgSymbolImage(id: string): void {
    this.assertUsable();
    this.removeRegisteredSvgImage(id);
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    for (const id of [...this.registeredSvgImageIds]) {
      this.removeRegisteredSvgImage(id);
    }

    if (this.sessionOptions.isActive()) {
      this.sessionOptions.clear();
    }

    this.sessionOptions.release();
    this.disposed = true;
  }

  private resolveFeatureTargets(): LineDecoratorAuthoringFeatureTarget[] {
    return typeof this.featureInput === 'function'
      ? [...this.featureInput()]
      : [...this.featureInput];
  }

  private runWithoutHistory<T>(callback: () => T): T {
    const history = this.sessionOptions.geoman.history as
      | { suspend?: <TResult>(callback: () => TResult) => TResult }
      | undefined;

    return history?.suspend ? history.suspend(callback) : callback();
  }

  private removeRegisteredSvgImage(id: string): void {
    if (!this.registeredSvgImageIds.has(id)) {
      return;
    }

    const map = this.sessionOptions.getMap();
    if (map.hasImage(id) && map.removeImage) {
      map.removeImage(id);
    }

    this.registeredSvgImageIds.delete(id);
  }

  private assertUsable(): void {
    if (this.disposed) {
      throw new Error('Line decorator authoring session is disposed.');
    }

    if (!this.sessionOptions.isActive()) {
      throw new Error('Line decorator authoring session is no longer active.');
    }
  }

  private getStaleRegistrationResult(id: string): SvgSymbolImageRegistrationResult | null {
    if (!this.disposed && this.sessionOptions.isActive()) {
      return null;
    }

    return {
      ok: false,
      id,
      reason: 'stale',
      error: new Error(`Symbol image "${id}" registration is stale.`),
    };
  }
}

export function validateSvgSymbolMarkup(svg: string): boolean {
  const trimmed = svg.trim();
  if (!trimmed) {
    return false;
  }

  if (typeof DOMParser !== 'undefined') {
    const parsed = new DOMParser().parseFromString(trimmed, 'image/svg+xml');
    const root = parsed.documentElement;
    return !parsed.querySelector('parsererror') && root.nodeName.toLowerCase() === 'svg';
  }

  const openTag = trimmed.match(/^<svg(?:\s[^>]*)?>/i);
  if (!openTag || !/<\/svg>\s*$/i.test(trimmed)) {
    return false;
  }

  const tags = Array.from(trimmed.matchAll(/<\/?([a-z][\w:-]*)(?:\s[^>]*)?>/gi));
  const stack: string[] = [];

  for (const tag of tags) {
    const raw = tag[0];
    const name = tag[1].toLowerCase();

    if (raw.startsWith('</')) {
      if (stack.pop() !== name) {
        return false;
      }
    } else if (!raw.endsWith('/>')) {
      stack.push(name);
    }
  }

  return stack.length === 0;
}

export function loadSvgSymbolImage(svg: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    if (
      typeof Image === 'undefined' ||
      typeof Blob === 'undefined' ||
      typeof URL === 'undefined' ||
      typeof URL.createObjectURL !== 'function'
    ) {
      reject(new Error('SVG symbol image loading requires browser image APIs.'));
      return;
    }

    const image = new Image();
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Unable to load SVG symbol image.'));
    };
    image.src = url;
  });
}

function cloneDecoratorInput(
  decorators: LineDecoratorAuthoringDecoratorInput | undefined,
): LineDecoratorAuthoringDecoratorInput | undefined {
  if (!decorators || typeof decorators === 'function') {
    return decorators;
  }

  return cloneLineDecorators(decorators);
}

function resolveDecoratorInput(
  decorators: LineDecoratorAuthoringDecoratorInput,
  feature: Feature,
): readonly LineDecoratorOptions[] {
  if (typeof decorators === 'function') {
    return decorators(feature) ?? [];
  }

  return decorators;
}

function cloneLineDecorators(decorators: readonly LineDecoratorOptions[]): LineDecoratorOptions[] {
  return decorators.map(cloneLineDecorator);
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

function toGeoJsonFeature(target: LineDecoratorAuthoringFeatureTarget): Feature {
  return hasGetGeoJson(target) ? target.getGeoJson() : target;
}

function hasGetGeoJson(
  target: LineDecoratorAuthoringFeatureTarget,
): target is { getGeoJson: () => Feature } {
  return typeof (target as { getGeoJson?: unknown }).getGeoJson === 'function';
}

function hasUpdateProperties(
  target: LineDecoratorAuthoringFeatureTarget,
): target is LineDecoratorAuthoringFeatureTarget & {
  updateProperties: (properties: Record<string, unknown>) => unknown;
} {
  return typeof (target as { updateProperties?: unknown }).updateProperties === 'function';
}

function getLineStyleProperties(style: LineDecoratorAuthoringLineStyle): Record<string, unknown> {
  return {
    ...(style.color !== undefined ? { lineColor: style.color } : {}),
    ...(style.width !== undefined ? { lineWidth: style.width } : {}),
    ...(style.opacity !== undefined ? { lineOpacity: style.opacity } : {}),
  };
}

function getSvgValidationError(id: string, svg: string): SvgSymbolImageRegistrationResult | null {
  if (!svg.trim()) {
    return {
      ok: false,
      id,
      reason: 'empty-svg',
      error: new Error('SVG symbol image markup is empty.'),
    };
  }

  if (!validateSvgSymbolMarkup(svg)) {
    return {
      ok: false,
      id,
      reason: 'invalid-svg',
      error: new Error('SVG symbol image markup must parse to an SVG document.'),
    };
  }

  return null;
}

function getImageExistsRegistrationResult(id: string): SvgSymbolImageRegistrationResult {
  return {
    ok: false,
    id,
    reason: 'image-exists',
    error: new Error(`Symbol image "${id}" is already registered.`),
  };
}

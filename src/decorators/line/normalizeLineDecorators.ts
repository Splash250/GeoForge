import type { LineDecoratorOptions } from './types.ts';

type PropertiesLike = Record<string, unknown> | null | undefined;

export function normalizeLineDecorators(properties: PropertiesLike): LineDecoratorOptions[] {
  if (!properties) {
    return [];
  }

  const decorators = properties.decorators;
  const normalizedDecorators = Array.isArray(decorators)
    ? decorators.filter(isLineDecoratorOptions)
    : [];
  const hasExplicitArrowhead = normalizedDecorators.some(
    (decorator) => !decorator.kind || decorator.kind === 'arrowhead',
  );
  const legacyArrowheads = properties.arrowheads;
  const shouldAppendLegacyArrowheads =
    !hasExplicitArrowhead && isLegacyArrowheadOptions(legacyArrowheads);

  if (Array.isArray(decorators)) {
    return shouldAppendLegacyArrowheads
      ? [
          ...normalizedDecorators,
          { kind: 'arrowhead', ...legacyArrowheads } as LineDecoratorOptions,
        ]
      : normalizedDecorators;
  }

  if (shouldAppendLegacyArrowheads) {
    return [{ kind: 'arrowhead', ...legacyArrowheads } as LineDecoratorOptions];
  }

  return [];
}

function isLineDecoratorOptions(value: unknown): value is LineDecoratorOptions {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  if (!candidate.kind || candidate.kind === 'arrowhead') {
    return true;
  }

  if (candidate.kind === 'symbol') {
    return typeof candidate.imageId === 'string' && candidate.imageId.length > 0;
  }

  if (candidate.kind === 'text') {
    return typeof candidate.text === 'string' && candidate.text.trim().length > 0;
  }

  return false;
}

function isLegacyArrowheadOptions(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

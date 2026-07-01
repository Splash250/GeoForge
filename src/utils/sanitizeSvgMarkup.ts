import type { HtmlOverlaySandboxToken } from '@/overlays/html/types.ts';
import * as DOMPurifyModule from 'dompurify';

type SvgPurifier = {
  sanitize: (svg: string, options: Record<string, unknown>) => string;
};
type DomPurifyFactory = (window: Window) => unknown;

export function sanitizeSvgMarkup(svg: string): string {
  const purifier = getSvgPurifier();

  return purifier.sanitize(svg.trim(), {
    USE_PROFILES: { svg: true, svgFilters: true },
    FORBID_TAGS: ['foreignObject', 'iframe', 'script'],
    FORBID_ATTR: ['onload', 'onclick', 'onerror', 'onmouseover', 'onfocus', 'onbegin'],
  });
}

function getSvgPurifier(): SvgPurifier {
  const candidate: unknown =
    'default' in DOMPurifyModule ? DOMPurifyModule.default : DOMPurifyModule;

  if (hasSanitize(candidate)) {
    return candidate;
  }

  if (typeof candidate === 'function') {
    const initialized = (candidate as DomPurifyFactory)(globalThis.window);
    if (hasSanitize(initialized)) {
      return initialized;
    }
  }

  throw new Error('SVG sanitization requires DOMPurify browser support.');
}

function hasSanitize(value: unknown): value is SvgPurifier {
  return (
    value !== null &&
    (typeof value === 'object' || typeof value === 'function') &&
    'sanitize' in value &&
    typeof value.sanitize === 'function'
  );
}

export function hasRiskyHtmlOverlaySandboxCombination(
  tokens: readonly HtmlOverlaySandboxToken[] | null | undefined,
): boolean {
  if (!tokens?.length) {
    return false;
  }

  return tokens.includes('allow-scripts') && tokens.includes('allow-same-origin');
}

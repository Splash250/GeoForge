import type { CssQuadTransform } from './homography.ts';
import {
  DEFAULT_HTML_OVERLAY_IFRAME_OPTIONS,
  type HtmlOverlayDefinition,
  type HtmlOverlayIframeOptions,
  type HtmlOverlayReferrerPolicy,
} from './types.ts';
import { hasRiskyHtmlOverlaySandboxCombination } from '@/utils/sanitizeSvgMarkup.ts';

const FALLBACK_IFRAME_TITLE = 'HTML map overlay';
const DEFAULT_REFERRER_POLICY: HtmlOverlayReferrerPolicy = 'no-referrer';
const ALLOWED_REFERRER_POLICIES = new Set<HtmlOverlayReferrerPolicy>([
  'no-referrer',
  'no-referrer-when-downgrade',
  'origin',
  'origin-when-cross-origin',
  'same-origin',
  'strict-origin',
  'strict-origin-when-cross-origin',
  'unsafe-url',
]);

function mergedIframeOptions(definition: HtmlOverlayDefinition): HtmlOverlayIframeOptions {
  return {
    ...DEFAULT_HTML_OVERLAY_IFRAME_OPTIONS,
    ...definition.iframe,
  };
}

function iframeTitle(title: unknown): string {
  const trimmed = typeof title === 'string' ? title.trim() : '';

  return trimmed.length > 0 ? trimmed : FALLBACK_IFRAME_TITLE;
}

function resolveReferrerPolicy(value: unknown): HtmlOverlayReferrerPolicy {
  return typeof value === 'string' &&
    ALLOWED_REFERRER_POLICIES.has(value as HtmlOverlayReferrerPolicy)
    ? (value as HtmlOverlayReferrerPolicy)
    : DEFAULT_REFERRER_POLICY;
}

export class HtmlOverlayElement {
  readonly id: string;
  readonly element: HTMLDivElement;
  readonly iframe: HTMLIFrameElement;

  private definition: HtmlOverlayDefinition;
  private appliedHtml: string | null = null;

  constructor(definition: HtmlOverlayDefinition) {
    this.id = definition.id;
    this.definition = definition;
    this.element = document.createElement('div');
    this.iframe = document.createElement('iframe');

    this.element.className = 'gm-html-overlay';
    this.element.dataset.overlayId = definition.id;
    this.iframe.loading = 'lazy';
    this.iframe.style.width = '100%';
    this.iframe.style.height = '100%';
    this.iframe.style.border = '0';
    this.iframe.style.display = 'block';
    this.element.append(this.iframe);

    this.applyDefinition(definition);
  }

  updateDefinition(definition: HtmlOverlayDefinition): void {
    this.definition = definition;
    this.element.dataset.overlayId = this.id;
    this.applyDefinition(definition);
  }

  updateFrame(transform: CssQuadTransform | null): void {
    if (!transform || this.definition.visible === false) {
      this.element.style.display = 'none';
      this.element.dataset.frameState = 'hidden';

      return;
    }

    this.element.style.display = '';
    this.element.style.position = 'absolute';
    this.element.style.left = `${transform.left}px`;
    this.element.style.top = `${transform.top}px`;
    this.element.style.width = `${transform.width}px`;
    this.element.style.height = `${transform.height}px`;
    this.element.style.transform = transform.transform;
    this.element.style.transformOrigin = transform.transformOrigin;
    this.element.style.overflow = 'hidden';
    this.element.dataset.frameState = 'visible';
  }

  remove(): void {
    this.element.remove();
  }

  private applyDefinition(definition: HtmlOverlayDefinition): void {
    const iframeOptions = mergedIframeOptions(definition);

    if (this.appliedHtml !== definition.html) {
      this.iframe.srcdoc = definition.html;
      this.appliedHtml = definition.html;
    }

    this.iframe.title = iframeTitle(iframeOptions.title);
    if (hasRiskyHtmlOverlaySandboxCombination(iframeOptions.sandbox)) {
      console.warn(
        'GeoForge HTML overlay iframe sandbox combines allow-scripts with allow-same-origin. Treat overlay HTML as trusted application content.',
        { overlayId: definition.id, sandbox: iframeOptions.sandbox },
      );
    }
    this.iframe.setAttribute('sandbox', iframeOptions.sandbox?.join(' ') ?? '');
    const referrerPolicy = resolveReferrerPolicy(iframeOptions.referrerPolicy);
    this.iframe.referrerPolicy = referrerPolicy;
    this.iframe.setAttribute('referrerpolicy', referrerPolicy);

    if (iframeOptions.allow?.trim()) {
      this.iframe.setAttribute('allow', iframeOptions.allow);
    } else {
      this.iframe.removeAttribute('allow');
    }

    this.element.dataset.selected = String(definition.selected === true);
    this.element.dataset.interactable = String(iframeOptions.interactable === true);
    this.element.dataset.pointerMode = iframeOptions.pointerMode ?? 'selected';
    this.applyPointerEvents(iframeOptions);
  }

  private applyPointerEvents(iframeOptions: HtmlOverlayIframeOptions): void {
    const pointerMode = iframeOptions.pointerMode ?? 'selected';
    const interactive =
      iframeOptions.interactable === true &&
      (pointerMode === 'always' ||
        (pointerMode === 'selected' && this.definition.selected === true));
    const pointerEvents = interactive ? 'auto' : 'none';

    this.element.style.pointerEvents = pointerEvents;
    this.iframe.style.pointerEvents = pointerEvents;
  }
}

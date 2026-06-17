import type { LngLatTuple } from '@/types/map/index.ts';

export type HtmlOverlayCornerName = 'topLeft' | 'topRight' | 'bottomRight' | 'bottomLeft';

export type HtmlOverlayCorners = Record<HtmlOverlayCornerName, LngLatTuple>;

export type HtmlOverlayPointerMode = 'none' | 'selected' | 'always';

export type HtmlOverlayReferrerPolicy =
  | 'no-referrer'
  | 'no-referrer-when-downgrade'
  | 'origin'
  | 'origin-when-cross-origin'
  | 'same-origin'
  | 'strict-origin'
  | 'strict-origin-when-cross-origin'
  | 'unsafe-url';

export type HtmlOverlaySandboxToken =
  | 'allow-downloads'
  | 'allow-forms'
  | 'allow-modals'
  | 'allow-popups'
  | 'allow-presentation'
  | 'allow-same-origin'
  | 'allow-scripts';

export interface HtmlOverlayIframeOptions {
  title?: string;
  sandbox?: Array<HtmlOverlaySandboxToken>;
  allow?: string;
  referrerPolicy?: HtmlOverlayReferrerPolicy;
  interactable?: boolean;
  pointerMode?: HtmlOverlayPointerMode;
}

export interface HtmlOverlayDefinition {
  id: string;
  corners: HtmlOverlayCorners;
  html: string;
  iframe?: HtmlOverlayIframeOptions | null;
  selected?: boolean;
  visible?: boolean;
}

export type HtmlOverlayValidationFailureReason =
  | 'missing-corner'
  | 'self-intersecting'
  | 'too-small'
  | 'non-finite'
  | 'not-rectangle'
  | 'invalid-ring';

export type HtmlOverlayValidationResult =
  | { valid: true }
  | { valid: false; reasons: Array<HtmlOverlayValidationFailureReason> };

export const DEFAULT_HTML_OVERLAY_IFRAME_OPTIONS: Omit<
  HtmlOverlayIframeOptions,
  'title' | 'allow'
> = {
  sandbox: [],
  interactable: false,
  pointerMode: 'selected',
  referrerPolicy: 'no-referrer',
};

export { HtmlOverlayManager } from './htmlOverlayManager.ts';
/**
 * @deprecated DOM implementation detail retained for root barrel compatibility.
 * Prefer `geoman.overlays.html` or `HtmlOverlayManager`.
 */
export { HtmlOverlayElement } from './htmlOverlayElement.ts';
export { GeomanHtmlOverlaySubsystem } from './geomanHtmlOverlaySubsystem.ts';
export {
  closedRingToCorners,
  constrainDraggedRectangleCorner,
  cornersToClosedRing,
  getProjectedOverlayQuad,
  lngLatToWebMercatorPoint,
  validateHtmlOverlayCorners,
  type HtmlOverlayProjectedQuad,
} from './geometry.ts';
export {
  computeHomography,
  createCssQuadTransform,
  matrix3dFromHomography,
  type CssQuadTransform,
  type Matrix3x3,
  type Point,
  type Quad,
  type SourceRect,
} from './homography.ts';
export type {
  HtmlOverlayCornerName,
  HtmlOverlayCorners,
  HtmlOverlayDefinition,
  HtmlOverlayIframeOptions,
  HtmlOverlayPointerMode,
  HtmlOverlayReferrerPolicy,
  HtmlOverlaySandboxToken,
  HtmlOverlayValidationFailureReason,
  HtmlOverlayValidationResult,
} from './types.ts';

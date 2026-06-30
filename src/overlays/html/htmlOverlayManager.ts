import type { BaseMapAdapter } from '@/core/map/base/index.ts';
import type { AnyMapInstance, LngLatTuple, ScreenPoint } from '@/types/map/index.ts';
import {
  getProjectedOverlayQuad,
  validateHtmlOverlayCorners,
  type HtmlOverlayProjectedQuad,
} from './geometry.ts';
import { createCssQuadTransform, type Quad } from './homography.ts';
import { HtmlOverlayElement } from './htmlOverlayElement.ts';
import type { HtmlOverlayDefinition, HtmlOverlayIframeOptions } from './types.ts';

type HtmlOverlayMapEventName = 'render' | 'move' | 'zoom' | 'rotate' | 'pitch' | 'resize';
type HtmlOverlayMapEventListener = () => void;
type HtmlOverlayMapAdapter = {
  getContainer(): HTMLElement;
  project(lngLat: LngLatTuple): ScreenPoint;
  on(type: HtmlOverlayMapEventName, listener: HtmlOverlayMapEventListener): void;
  off(type: HtmlOverlayMapEventName, listener: HtmlOverlayMapEventListener): void;
};

type StoredOverlay = {
  definition: HtmlOverlayDefinition;
  element: HtmlOverlayElement;
};

const HTML_OVERLAY_ROOT_CLASS = 'gm-html-overlay-root';
const REFRESH_EVENTS: Array<HtmlOverlayMapEventName> = [
  'render',
  'move',
  'zoom',
  'rotate',
  'pitch',
  'resize',
];

export class HtmlOverlayManager {
  private readonly mapAdapter: HtmlOverlayMapAdapter;
  private readonly root: HTMLDivElement;
  private readonly overlays = new Map<string, StoredOverlay>();
  private readonly refreshListener: HtmlOverlayMapEventListener;
  private animationFrameId: number | null = null;
  private destroyed = false;

  constructor(options: { mapAdapter: BaseMapAdapter<AnyMapInstance> }) {
    this.mapAdapter = options.mapAdapter as unknown as HtmlOverlayMapAdapter;
    this.root = document.createElement('div');
    this.root.className = HTML_OVERLAY_ROOT_CLASS;
    this.root.style.position = 'absolute';
    this.root.style.inset = '0';
    this.root.style.pointerEvents = 'none';
    this.root.style.overflow = 'hidden';
    this.mapAdapter.getContainer().append(this.root);

    this.refreshListener = () => this.scheduleRefresh();
    this.addListeners();
  }

  add(definition: HtmlOverlayDefinition): void {
    this.upsert(definition);
  }

  upsert(definition: HtmlOverlayDefinition): void {
    if (this.destroyed) {
      return;
    }

    const normalizedDefinition = this.normalizeDefinitionSelection(cloneDefinition(definition));
    const existing = this.overlays.get(definition.id);

    if (existing) {
      existing.definition = normalizedDefinition;
      existing.element.updateDefinition(normalizedDefinition);
      this.reconcileSelection(definition.id, normalizedDefinition.selected === true);
      this.refresh();

      return;
    }

    const element = new HtmlOverlayElement(normalizedDefinition);

    this.overlays.set(definition.id, {
      definition: normalizedDefinition,
      element,
    });
    this.root.append(element.element);

    if (normalizedDefinition.selected === true) {
      this.applySingleSelection(definition.id);
    }

    this.refresh();
  }

  update(id: string, patch: Partial<HtmlOverlayDefinition>): void {
    if (this.destroyed) {
      return;
    }

    const storedOverlay = this.overlays.get(id);

    if (!storedOverlay) {
      return;
    }

    const definition = mergeDefinitionPatch(storedOverlay.definition, cloneDefinitionPatch(patch));

    storedOverlay.definition = definition;
    storedOverlay.element.updateDefinition(definition);

    if (Object.prototype.hasOwnProperty.call(patch, 'selected')) {
      this.reconcileSelection(id, patch.selected === true);
    }

    this.refresh();
  }

  remove(id: string): void {
    const storedOverlay = this.overlays.get(id);

    if (!storedOverlay) {
      return;
    }

    storedOverlay.element.remove();
    this.overlays.delete(id);
  }

  get(id: string): HtmlOverlayDefinition | null {
    const definition = this.overlays.get(id)?.definition;

    return definition ? cloneDefinition(definition) : null;
  }

  getAll(): Array<HtmlOverlayDefinition> {
    return Array.from(this.overlays.values(), (storedOverlay) =>
      cloneDefinition(storedOverlay.definition),
    );
  }

  has(id: string): boolean {
    return this.overlays.has(id);
  }

  getSelected(): string | null {
    for (const [id, storedOverlay] of this.overlays) {
      if (storedOverlay.definition.selected === true) {
        return id;
      }
    }

    return null;
  }

  clear(): void {
    for (const storedOverlay of this.overlays.values()) {
      storedOverlay.element.remove();
    }

    this.overlays.clear();
  }

  setSelected(id: string | null): void {
    if (this.destroyed) {
      return;
    }

    this.applySingleSelection(id);
  }

  private normalizeDefinitionSelection(definition: HtmlOverlayDefinition): HtmlOverlayDefinition {
    if (definition.selected !== true) {
      return {
        ...definition,
        selected: false,
      };
    }

    return definition;
  }

  private applySingleSelection(id: string | null): void {
    let selectedOverlay: StoredOverlay | null = null;

    for (const [overlayId, storedOverlay] of this.overlays) {
      const selected = id !== null && overlayId === id;
      const definition = {
        ...storedOverlay.definition,
        selected,
      };

      storedOverlay.definition = definition;
      storedOverlay.element.updateDefinition(definition);

      if (selected) {
        selectedOverlay = storedOverlay;
      }
    }

    if (selectedOverlay) {
      this.root.append(selectedOverlay.element.element);
    }
  }

  private reconcileSelection(id: string, selected: boolean): void {
    if (selected) {
      this.applySingleSelection(id);
      return;
    }

    if (this.getSelected() === id) {
      this.applySingleSelection(null);
    }
  }

  refresh(): void {
    if (this.destroyed) {
      return;
    }

    const project = (lngLat: LngLatTuple): ScreenPoint => this.mapAdapter.project(lngLat);

    for (const storedOverlay of this.overlays.values()) {
      const { definition, element } = storedOverlay;
      const validation = validateHtmlOverlayCorners(definition.corners, project);

      if (!validation.valid) {
        element.updateFrame(null);
        continue;
      }

      const projectedQuad = getProjectedOverlayQuad(definition.corners, project);

      if (!projectedQuad) {
        element.updateFrame(null);
        continue;
      }

      const destinationQuad = toDestinationQuad(projectedQuad);
      const sourceRect = projectedBoundsSourceRect(projectedQuad);
      const transform = createCssQuadTransform(sourceRect, destinationQuad);

      element.updateFrame(transform);
    }
  }

  destroy(): void {
    if (this.destroyed) {
      return;
    }

    this.destroyed = true;
    this.removeListeners();
    this.cancelScheduledRefresh();
    this.clear();
    this.root.remove();
  }

  private addListeners(): void {
    for (const eventName of REFRESH_EVENTS) {
      this.mapAdapter.on(eventName, this.refreshListener);
    }
  }

  private removeListeners(): void {
    for (const eventName of REFRESH_EVENTS) {
      this.mapAdapter.off(eventName, this.refreshListener);
    }
  }

  private scheduleRefresh(): void {
    if (this.destroyed || this.animationFrameId !== null) {
      return;
    }

    this.animationFrameId = window.requestAnimationFrame(() => {
      this.animationFrameId = null;
      this.refresh();
    });
  }

  private cancelScheduledRefresh(): void {
    if (this.animationFrameId === null) {
      return;
    }

    window.cancelAnimationFrame(this.animationFrameId);
    this.animationFrameId = null;
  }
}

const mergeDefinitionPatch = (
  definition: HtmlOverlayDefinition,
  patch: Partial<HtmlOverlayDefinition>,
): HtmlOverlayDefinition => {
  const iframe = Object.prototype.hasOwnProperty.call(patch, 'iframe')
    ? mergeIframePatch(definition.iframe, patch.iframe)
    : definition.iframe;

  return {
    ...definition,
    ...patch,
    id: definition.id,
    iframe,
  };
};

const mergeIframePatch = (
  current: HtmlOverlayIframeOptions | null | undefined,
  patch: HtmlOverlayIframeOptions | null | undefined,
): HtmlOverlayIframeOptions | null | undefined => {
  if (patch === null) {
    return null;
  }

  if (patch === undefined) {
    return current;
  }

  return {
    ...(current ?? {}),
    ...patch,
  };
};

const cloneDefinitionPatch = (
  patch: Partial<HtmlOverlayDefinition>,
): Partial<HtmlOverlayDefinition> => {
  const clonedPatch: Partial<HtmlOverlayDefinition> = {
    ...patch,
  };

  if (patch.corners) {
    clonedPatch.corners = cloneCorners(patch.corners);
  }

  if (patch.iframe) {
    clonedPatch.iframe = cloneIframeOptions(patch.iframe);
  }

  return clonedPatch;
};

const cloneDefinition = (definition: HtmlOverlayDefinition): HtmlOverlayDefinition => ({
  ...definition,
  corners: cloneCorners(definition.corners),
  iframe: definition.iframe ? cloneIframeOptions(definition.iframe) : definition.iframe,
});

const cloneCorners = (
  corners: HtmlOverlayDefinition['corners'],
): HtmlOverlayDefinition['corners'] => ({
  topLeft: [...corners.topLeft],
  topRight: [...corners.topRight],
  bottomRight: [...corners.bottomRight],
  bottomLeft: [...corners.bottomLeft],
});

const cloneIframeOptions = (iframe: HtmlOverlayIframeOptions): HtmlOverlayIframeOptions => ({
  ...iframe,
  sandbox: iframe.sandbox ? [...iframe.sandbox] : iframe.sandbox,
});

const toDestinationQuad = (projectedQuad: HtmlOverlayProjectedQuad): Quad => ({
  topLeft: toPoint(projectedQuad[0]),
  topRight: toPoint(projectedQuad[1]),
  bottomRight: toPoint(projectedQuad[2]),
  bottomLeft: toPoint(projectedQuad[3]),
});

const projectedBoundsSourceRect = (
  projectedQuad: HtmlOverlayProjectedQuad,
): { width: number; height: number } => {
  const xValues = projectedQuad.map((point) => point[0]);
  const yValues = projectedQuad.map((point) => point[1]);

  return {
    width: Math.max(1, Math.max(...xValues) - Math.min(...xValues)),
    height: Math.max(1, Math.max(...yValues) - Math.min(...yValues)),
  };
};

const toPoint = (point: ScreenPoint): { x: number; y: number } => ({
  x: point[0],
  y: point[1],
});

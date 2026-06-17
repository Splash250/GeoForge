import DOMPurify from 'dompurify';
import type { Geoman } from '@/main.ts';
import type {
  GeomanContextPanelDefinition,
  GeomanContextPanelOpenData,
  GeomanContextPanelRenderContext,
} from './types.ts';

export type ContextPanelManagerOptions = {
  mapAdapter: Geoman['mapAdapter'];
};

type ContextPanelClearOptions = {
  preserveRestoreFocusElement?: boolean;
  restoreFocus?: boolean;
};

let contextPanelTitleIdCounter = 0;

function getFocusableElements(root: HTMLElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      [
        'button:not([disabled])',
        '[href]',
        'input:not([disabled])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"])',
      ].join(','),
    ),
  ).filter((element) => !element.hasAttribute('hidden'));
}

export class ContextPanelManager {
  private readonly mapAdapter: Geoman['mapAdapter'];
  private root: HTMLElement | null = null;
  private restoreFocusElement: HTMLElement | null = null;
  private closeCurrent: (() => void) | null = null;
  private readonly documentKeydownHandler = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || !this.root) {
      return;
    }

    event.preventDefault();
    this.closeCurrent?.();
  };

  constructor(options: ContextPanelManagerOptions) {
    this.mapAdapter = options.mapAdapter;
  }

  render<TData extends GeomanContextPanelOpenData>(
    definition: GeomanContextPanelDefinition<TData>,
    context: GeomanContextPanelRenderContext<TData>,
  ): void {
    const activeElement =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousRoot = this.root;
    const nextRestoreFocusElement = previousRoot
      ? previousRoot.contains(activeElement) && this.restoreFocusElement?.isConnected
        ? this.restoreFocusElement
        : activeElement
      : this.restoreFocusElement?.isConnected
        ? this.restoreFocusElement
        : activeElement;

    this.clear({ preserveRestoreFocusElement: true, restoreFocus: false });
    this.restoreFocusElement = nextRestoreFocusElement;
    this.closeCurrent = context.close;

    const root = document.createElement('aside');
    const header = document.createElement('header');
    const title = document.createElement('h2');
    const closeButton = document.createElement('button');
    const body = document.createElement('div');
    const titleId = `gm-context-panel-title-${++contextPanelTitleIdCounter}`;

    root.className = ['gm-context-panel', definition.className].filter(Boolean).join(' ');
    root.dataset.panelId = definition.id;
    root.tabIndex = -1;
    root.setAttribute('role', 'region');
    root.setAttribute('aria-labelledby', titleId);

    header.className = 'gm-context-panel__header';
    title.className = 'gm-context-panel__title';
    title.id = titleId;
    title.textContent = definition.title;

    closeButton.className = 'gm-context-panel__close';
    closeButton.type = 'button';
    closeButton.setAttribute('aria-label', `Close ${definition.title}`);
    closeButton.textContent = 'x';
    closeButton.addEventListener('click', context.close);

    body.className = 'gm-context-panel__body';

    const rendered = definition.render(context);

    if (typeof rendered === 'string') {
      body.innerHTML = DOMPurify.sanitize(rendered);
    } else if (rendered instanceof HTMLElement) {
      body.replaceChildren(rendered);
    }

    header.append(title, closeButton);
    root.append(header, body);
    this.mapAdapter.getContainer().append(root);
    this.root = root;

    document.addEventListener('keydown', this.documentKeydownHandler);

    const firstFocusable = getFocusableElements(body)[0];
    (firstFocusable ?? root).focus();
  }

  clear(options: ContextPanelClearOptions = {}): void {
    const preserveRestoreFocusElement = options.preserveRestoreFocusElement ?? false;
    const restoreFocus = options.restoreFocus ?? true;

    document.removeEventListener('keydown', this.documentKeydownHandler);
    this.root?.remove();
    this.root = null;
    this.closeCurrent = null;

    if (restoreFocus && this.restoreFocusElement?.isConnected) {
      this.restoreFocusElement.focus();
    }

    if (!preserveRestoreFocusElement) {
      this.restoreFocusElement = null;
    }
  }

  destroy(): void {
    this.clear({ restoreFocus: false });
  }
}

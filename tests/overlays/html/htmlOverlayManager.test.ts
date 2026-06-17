// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { HtmlOverlayManager } from '../../../src/overlays/html/htmlOverlayManager.ts';
import type {
  HtmlOverlayDefinition,
  HtmlOverlayIframeOptions,
} from '../../../src/overlays/html/types.ts';

const CORNERS = {
  topLeft: [0, 0],
  topRight: [1, 0],
  bottomRight: [1, 1],
  bottomLeft: [0, 1],
} satisfies HtmlOverlayDefinition['corners'];

type TestHtmlOverlayDefinition = Omit<HtmlOverlayDefinition, 'iframe'> & {
  iframe?: Partial<HtmlOverlayIframeOptions> | null;
};
type TestMapAdapter = ConstructorParameters<typeof HtmlOverlayManager>[0]['mapAdapter'] & {
  emit(type: string): void;
  listenerCounts(): Record<string, number>;
};

function definition(
  overrides: Partial<Omit<HtmlOverlayDefinition, 'iframe'>> & {
    iframe?: Partial<HtmlOverlayIframeOptions> | null;
  } = {},
): TestHtmlOverlayDefinition {
  return {
    id: 'overlay-a',
    corners: CORNERS,
    html: '<main>first</main>',
    iframe: {
      title: 'Overlay A',
    },
    ...overrides,
  };
}

function evaluateManager<T>(
  callback: (definitionValue: HtmlOverlayDefinition, input: unknown) => T,
  definitionValue: TestHtmlOverlayDefinition = definition(),
  input: unknown = null,
): T {
  return callback(definitionValue as HtmlOverlayDefinition, input);
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('HtmlOverlayManager', () => {
  it('add creates root and one overlay', () => {
    const result = evaluateManager((definitionValue) => {
      const container = document.createElement('div');
      const mapAdapter = createMapAdapter(container);
      const manager = new HtmlOverlayManager({ mapAdapter });

      manager.add(definitionValue);

      const root = container.querySelector('.gm-html-overlay-root');
      const overlay = root?.querySelector('.gm-html-overlay');

      return {
        rootCount: container.querySelectorAll('.gm-html-overlay-root').length,
        rootParentIsContainer: root?.parentElement === container,
        overlayCount: root?.querySelectorAll('.gm-html-overlay').length,
        overlayId: overlay?.getAttribute('data-overlay-id'),
        iframeHtml: overlay?.querySelector('iframe')?.srcdoc,
      };
    });

    expect(result).toEqual({
      rootCount: 1,
      rootParentIsContainer: true,
      overlayCount: 1,
      overlayId: 'overlay-a',
      iframeHtml: '<main>first</main>',
    });
  });

  it('update changes iframe HTML, iframe options, and corners without replacing iframe node', () => {
    const result = evaluateManager(
      (definitionValue, input) => {
        const container = document.createElement('div');
        const mapAdapter = createMapAdapter(container);
        const manager = new HtmlOverlayManager({ mapAdapter });

        manager.add(definitionValue);
        const overlay = container.querySelector('.gm-html-overlay') as HTMLDivElement;
        const iframe = overlay.querySelector('iframe') as HTMLIFrameElement;
        const before = {
          iframe,
          left: overlay.style.left,
          title: iframe.title,
          allow: iframe.getAttribute('allow'),
        };

        manager.update(definitionValue.id, input as Partial<HtmlOverlayDefinition>);

        return {
          sameIframe: overlay.querySelector('iframe') === before.iframe,
          srcdoc: iframe.srcdoc,
          title: iframe.title,
          allow: iframe.getAttribute('allow'),
          leftChanged: overlay.style.left !== before.left,
        };
      },
      definition({
        html: '<p>before</p>',
        iframe: {
          title: 'Before',
          allow: 'fullscreen',
        },
      }),
      {
        html: '<p>after</p>',
        corners: {
          topLeft: [2, 2],
          topRight: [4, 2],
          bottomRight: [4, 4],
          bottomLeft: [2, 4],
        },
        iframe: {
          title: 'After',
        },
      },
    );

    expect(result).toEqual({
      sameIframe: true,
      srcdoc: '<p>after</p>',
      title: 'After',
      allow: 'fullscreen',
      leftChanged: true,
    });
  });

  it('refresh updates position after corner changes', () => {
    const result = evaluateManager((definitionValue) => {
      const container = document.createElement('div');
      const mapAdapter = createMapAdapter(container);
      const manager = new HtmlOverlayManager({ mapAdapter });

      manager.add(definitionValue);
      const overlay = container.querySelector('.gm-html-overlay') as HTMLDivElement;
      const before = {
        left: overlay.style.left,
        top: overlay.style.top,
      };

      manager.update(definitionValue.id, {
        corners: {
          topLeft: [3, 4],
          topRight: [5, 4],
          bottomRight: [5, 6],
          bottomLeft: [3, 6],
        },
      });
      manager.refresh();

      return {
        before,
        after: {
          left: overlay.style.left,
          top: overlay.style.top,
        },
      };
    });

    expect(result).toEqual({
      before: {
        left: '0px',
        top: '0px',
      },
      after: {
        left: '300px',
        top: '400px',
      },
    });
  });

  it('setSelected changes selected dataset for one overlay only and clears previous', () => {
    const result = evaluateManager((definitionValue) => {
      const container = document.createElement('div');
      const mapAdapter = createMapAdapter(container);
      const manager = new HtmlOverlayManager({ mapAdapter });

      manager.add(definitionValue);
      manager.add({
        ...definitionValue,
        id: 'overlay-b',
        html: '<main>second</main>',
      });

      manager.setSelected('overlay-a');
      const afterFirst = selectedStates(container);

      manager.setSelected('overlay-b');
      const afterSecond = selectedStates(container);
      const orderAfterSecond = overlayOrder(container);

      manager.setSelected(null);

      return {
        afterFirst,
        afterSecond,
        orderAfterSecond,
        afterClear: selectedStates(container),
      };
    });

    expect(result).toEqual({
      afterFirst: {
        'overlay-a': 'true',
        'overlay-b': 'false',
      },
      afterSecond: {
        'overlay-a': 'false',
        'overlay-b': 'true',
      },
      orderAfterSecond: ['overlay-a', 'overlay-b'],
      afterClear: {
        'overlay-a': 'false',
        'overlay-b': 'false',
      },
    });
  });

  it('selection and reorder updates do not rewrite unchanged iframe srcdoc', () => {
    const result = evaluateManager((definitionValue) => {
      const descriptor = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'srcdoc');
      const writes: Array<string> = [];

      Object.defineProperty(HTMLIFrameElement.prototype, 'srcdoc', {
        configurable: true,
        get(this: HTMLIFrameElement) {
          return descriptor?.get?.call(this) ?? this.getAttribute('srcdoc') ?? '';
        },
        set(this: HTMLIFrameElement, value: string) {
          writes.push(value);
          descriptor?.set?.call(this, value);
        },
      });

      try {
        const container = document.createElement('div');
        const mapAdapter = createMapAdapter(container);
        const manager = new HtmlOverlayManager({ mapAdapter });

        manager.add({
          ...definitionValue,
          id: 'overlay-a',
          html: '<main>stable A</main>',
        });
        manager.add({
          ...definitionValue,
          id: 'overlay-b',
          html: '<main>stable B</main>',
        });

        manager.setSelected('overlay-a');
        manager.setSelected('overlay-b');
        manager.update('overlay-b', {
          selected: true,
        });
        manager.update('overlay-b', {
          iframe: {
            title: 'Retitled B',
          },
        });

        const overlayB = container.querySelector(
          '[data-overlay-id="overlay-b"] iframe',
        ) as HTMLIFrameElement;

        return {
          writes,
          order: overlayOrder(container),
          states: selectedStates(container),
          overlayBTitle: overlayB.title,
          overlayBSrcdoc: overlayB.srcdoc,
        };
      } finally {
        if (descriptor) {
          Object.defineProperty(HTMLIFrameElement.prototype, 'srcdoc', descriptor);
        }
      }
    });

    expect(result).toEqual({
      writes: ['<main>stable A</main>', '<main>stable B</main>'],
      order: ['overlay-a', 'overlay-b'],
      states: {
        'overlay-a': 'false',
        'overlay-b': 'true',
      },
      overlayBTitle: 'Retitled B',
      overlayBSrcdoc: '<main>stable B</main>',
    });
  });

  it('add, update, and accessors preserve a single selected overlay', () => {
    const result = evaluateManager((definitionValue) => {
      const container = document.createElement('div');
      const mapAdapter = createMapAdapter(container);
      const manager = new HtmlOverlayManager({ mapAdapter });

      manager.add({
        ...definitionValue,
        selected: true,
      });
      manager.add({
        ...definitionValue,
        id: 'overlay-b',
        html: '<main>second</main>',
        selected: true,
      });

      const afterAdd = {
        hasA: manager.has('overlay-a'),
        hasMissing: manager.has('missing'),
        selected: manager.getSelected(),
        states: selectedStates(container),
        allIds: manager.getAll().map((overlay) => overlay.id),
        getASelected: manager.get('overlay-a')?.selected,
        getBSelected: manager.get('overlay-b')?.selected,
      };
      const mutableAccessorResult = manager.get('overlay-b');

      if (mutableAccessorResult) {
        mutableAccessorResult.html = '<main>mutated</main>';
        mutableAccessorResult.corners.topLeft[0] = 99;
        mutableAccessorResult.iframe = {
          title: 'Mutated',
          sandbox: ['allow-scripts'],
        };
        mutableAccessorResult.iframe.sandbox?.push('allow-forms');
      }

      manager.update('overlay-a', {
        selected: true,
      });
      const afterSelectA = {
        selected: manager.getSelected(),
        states: selectedStates(container),
        order: overlayOrder(container),
      };
      const afterAccessorMutation = {
        html: manager.get('overlay-b')?.html,
        topLeftLng: manager.get('overlay-b')?.corners.topLeft[0],
        iframeTitle: manager.get('overlay-b')?.iframe?.title,
        sandbox: manager.get('overlay-b')?.iframe?.sandbox,
      };

      manager.update('overlay-a', {
        selected: false,
      });
      const afterClearSelection = {
        selected: manager.getSelected(),
        states: selectedStates(container),
      };

      manager.setSelected('overlay-a');
      manager.add({
        ...definitionValue,
        id: 'overlay-c',
        html: '<main>third</main>',
      });
      manager.update('overlay-c', {
        selected: false,
      });
      const afterUnselectedMutation = {
        selected: manager.getSelected(),
        states: selectedStates(container),
      };

      return {
        afterAdd,
        afterSelectA,
        afterAccessorMutation,
        afterClearSelection,
        afterUnselectedMutation,
        missing: manager.get('missing'),
      };
    });

    expect(result).toEqual({
      afterAdd: {
        hasA: true,
        hasMissing: false,
        selected: 'overlay-b',
        states: {
          'overlay-a': 'false',
          'overlay-b': 'true',
        },
        allIds: ['overlay-a', 'overlay-b'],
        getASelected: false,
        getBSelected: true,
      },
      afterSelectA: {
        selected: 'overlay-a',
        states: {
          'overlay-b': 'false',
          'overlay-a': 'true',
        },
        order: ['overlay-b', 'overlay-a'],
      },
      afterAccessorMutation: {
        html: '<main>second</main>',
        topLeftLng: 0,
        iframeTitle: 'Overlay A',
        sandbox: undefined,
      },
      afterClearSelection: {
        selected: null,
        states: {
          'overlay-b': 'false',
          'overlay-a': 'false',
        },
      },
      afterUnselectedMutation: {
        selected: 'overlay-a',
        states: {
          'overlay-b': 'false',
          'overlay-a': 'true',
          'overlay-c': 'false',
        },
      },
      missing: null,
    });
  });

  it('clear removes all overlay elements', () => {
    const result = evaluateManager((definitionValue) => {
      const container = document.createElement('div');
      const mapAdapter = createMapAdapter(container);
      const manager = new HtmlOverlayManager({ mapAdapter });

      manager.add(definitionValue);
      manager.add({ ...definitionValue, id: 'overlay-b' });

      manager.clear();

      return {
        rootCount: container.querySelectorAll('.gm-html-overlay-root').length,
        overlayCount: container.querySelectorAll('.gm-html-overlay').length,
      };
    });

    expect(result).toEqual({
      rootCount: 1,
      overlayCount: 0,
    });
  });

  it('destroy removes root and is idempotent', () => {
    const result = evaluateManager((definitionValue) => {
      const container = document.createElement('div');
      const mapAdapter = createMapAdapter(container);
      const manager = new HtmlOverlayManager({ mapAdapter });

      manager.add(definitionValue);
      manager.destroy();
      const afterFirst = {
        rootCount: container.querySelectorAll('.gm-html-overlay-root').length,
        overlayCount: container.querySelectorAll('.gm-html-overlay').length,
      };

      manager.destroy();

      return {
        afterFirst,
        afterSecond: {
          rootCount: container.querySelectorAll('.gm-html-overlay-root').length,
          overlayCount: container.querySelectorAll('.gm-html-overlay').length,
        },
      };
    });

    expect(result).toEqual({
      afterFirst: {
        rootCount: 0,
        overlayCount: 0,
      },
      afterSecond: {
        rootCount: 0,
        overlayCount: 0,
      },
    });
  });

  it('listeners and requestAnimationFrame are cleaned up on destroy', () => {
    const result = evaluateManager((definitionValue) => {
      const container = document.createElement('div');
      const mapAdapter = createMapAdapter(container);
      const originalRequestAnimationFrame = window.requestAnimationFrame;
      const originalCancelAnimationFrame = window.cancelAnimationFrame;
      const requested: Array<number> = [];
      const canceled: Array<number> = [];
      let nextFrameId = 1;

      window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
        const frameId = nextFrameId;
        nextFrameId += 1;
        requested.push(frameId);
        void callback;

        return frameId;
      }) as typeof window.requestAnimationFrame;
      window.cancelAnimationFrame = ((frameId: number) => {
        canceled.push(frameId);
      }) as typeof window.cancelAnimationFrame;

      try {
        const manager = new HtmlOverlayManager({ mapAdapter });

        manager.add(definitionValue);
        mapAdapter.emit('move');

        const listenerCountsBeforeDestroy = mapAdapter.listenerCounts();

        manager.destroy();
        mapAdapter.emit('move');

        return {
          listenerCountsBeforeDestroy,
          listenerCountsAfterDestroy: mapAdapter.listenerCounts(),
          requested,
          canceled,
        };
      } finally {
        window.requestAnimationFrame = originalRequestAnimationFrame;
        window.cancelAnimationFrame = originalCancelAnimationFrame;
      }
    });

    expect(result).toEqual({
      listenerCountsBeforeDestroy: {
        render: 1,
        move: 1,
        zoom: 1,
        rotate: 1,
        pitch: 1,
        resize: 1,
      },
      listenerCountsAfterDestroy: {
        render: 0,
        move: 0,
        zoom: 0,
        rotate: 0,
        pitch: 0,
        resize: 0,
      },
      requested: [1],
      canceled: [1],
    });
  });

  it('multiple overlays do not recreate iframe nodes on refresh', () => {
    const result = evaluateManager((definitionValue) => {
      const container = document.createElement('div');
      const mapAdapter = createMapAdapter(container);
      const manager = new HtmlOverlayManager({ mapAdapter });

      manager.add(definitionValue);
      manager.add({ ...definitionValue, id: 'overlay-b' });
      const before = Array.from(container.querySelectorAll('iframe'));

      manager.refresh();
      manager.refresh();

      return Array.from(container.querySelectorAll('iframe')).map(
        (iframe, index) => iframe === before[index],
      );
    });

    expect(result).toEqual([true, true]);
  });

  it('invalid corners hide overlay', () => {
    const result = evaluateManager(
      (definitionValue) => {
        const container = document.createElement('div');
        const mapAdapter = createMapAdapter(container);
        const manager = new HtmlOverlayManager({ mapAdapter });

        manager.add(definitionValue);
        const overlay = container.querySelector('.gm-html-overlay') as HTMLDivElement;

        return {
          display: overlay.style.display,
          frameState: overlay.dataset.frameState,
        };
      },
      definition({
        corners: {
          topLeft: [0, 0],
          topRight: [1, 0],
          bottomRight: [0, 1],
          bottomLeft: [1, 1],
        },
      }),
    );

    expect(result).toEqual({
      display: 'none',
      frameState: 'hidden',
    });
  });
});

function selectedStates(container: HTMLElement): Record<string, string | undefined> {
  return Object.fromEntries(
    Array.from(container.querySelectorAll<HTMLElement>('.gm-html-overlay')).map((overlay) => [
      overlay.dataset.overlayId ?? '',
      overlay.dataset.selected,
    ]),
  );
}

function overlayOrder(container: HTMLElement): Array<string | undefined> {
  return Array.from(container.querySelectorAll<HTMLElement>('.gm-html-overlay')).map(
    (overlay) => overlay.dataset.overlayId,
  );
}

function createMapAdapter(container: HTMLElement): TestMapAdapter {
  const listeners = new Map<string, Set<() => void>>();

  return {
    getContainer: () => container,
    project: ([lng, lat]: [number, number]) => [lng * 100, lat * 100],
    on: (type: string, listener: () => void) => {
      const typeListeners = listeners.get(type) ?? new Set<() => void>();

      typeListeners.add(listener);
      listeners.set(type, typeListeners);
    },
    off: (type: string, listener: () => void) => {
      listeners.get(type)?.delete(listener);
    },
    emit: (type: string) => {
      listeners.get(type)?.forEach((listener) => listener());
    },
    listenerCounts: () =>
      Object.fromEntries(
        ['render', 'move', 'zoom', 'rotate', 'pitch', 'resize'].map((type) => [
          type,
          listeners.get(type)?.size ?? 0,
        ]),
      ),
  } as unknown as TestMapAdapter;
}

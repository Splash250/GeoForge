// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CssQuadTransform } from '../../../src/overlays/html/homography.ts';
import { HtmlOverlayElement } from '../../../src/overlays/html/htmlOverlayElement.ts';
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

function definition(
  overrides: Partial<Omit<HtmlOverlayDefinition, 'iframe'>> & {
    iframe?: Partial<HtmlOverlayIframeOptions>;
  } = {},
): TestHtmlOverlayDefinition {
  const iframe = overrides.iframe ?? {
    title: 'Overlay title',
  };

  return {
    id: 'overlay-a',
    corners: CORNERS,
    html: '<main>hello</main>',
    ...overrides,
    iframe,
  };
}

function evaluateOverlay<T>(
  callback: (definitionValue: HtmlOverlayDefinition, input: unknown) => T,
  definitionValue: TestHtmlOverlayDefinition = definition(),
  input: unknown = null,
): T {
  return callback(definitionValue as HtmlOverlayDefinition, input);
}

const VALID_TRANSFORM: CssQuadTransform = {
  width: 640,
  height: 360,
  boundsWidth: 700,
  boundsHeight: 410,
  left: 12,
  top: 34,
  transform: 'matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 8, 9, 0, 1)',
  transformOrigin: '0 0',
};

afterEach(() => {
  document.body.innerHTML = '';
  delete document.body.dataset.pwned;
  delete document.body.dataset.scriptRan;
});

describe('HtmlOverlayElement', () => {
  it('creates sandboxed iframe with srcdoc and fallback/default attributes', () => {
    const result = evaluateOverlay(
      (definitionValue) => {
        const overlay = new HtmlOverlayElement(definitionValue);

        return {
          id: overlay.id,
          className: overlay.element.className,
          overlayId: overlay.element.dataset.overlayId,
          selected: overlay.element.dataset.selected,
          interactable: overlay.element.dataset.interactable,
          pointerMode: overlay.element.dataset.pointerMode,
          childCount: overlay.element.children.length,
          childIsIframe: overlay.element.firstElementChild === overlay.iframe,
          srcdoc: overlay.iframe.srcdoc,
          title: overlay.iframe.title,
          sandbox: overlay.iframe.getAttribute('sandbox'),
          allow: overlay.iframe.getAttribute('allow'),
          referrerPolicy: overlay.iframe.getAttribute('referrerpolicy'),
          loading: overlay.iframe.loading,
        };
      },
      definition({
        html: '<section>safe default</section>',
        iframe: {},
      }),
    );

    expect(result).toEqual({
      id: 'overlay-a',
      className: 'gm-html-overlay',
      overlayId: 'overlay-a',
      selected: 'false',
      interactable: 'false',
      pointerMode: 'selected',
      childCount: 1,
      childIsIframe: true,
      srcdoc: '<section>safe default</section>',
      title: 'HTML map overlay',
      sandbox: '',
      allow: null,
      referrerPolicy: 'no-referrer',
      loading: 'lazy',
    });
  });

  it('falls back for blank and nullish iframe titles', () => {
    const result = evaluateOverlay(() => {
      const baseDefinition = {
        id: 'overlay-title-fallback',
        corners: {
          topLeft: [0, 0],
          topRight: [1, 0],
          bottomRight: [1, 1],
          bottomLeft: [0, 1],
        } satisfies HtmlOverlayDefinition['corners'],
        html: '<p>title</p>',
      };
      const variants = [
        { ...baseDefinition, iframe: {} },
        { ...baseDefinition, iframe: { title: '' } },
        { ...baseDefinition, iframe: { title: '   ' } },
        { ...baseDefinition, iframe: { title: undefined } },
        { ...baseDefinition, iframe: { title: null } },
        { ...baseDefinition },
        { ...baseDefinition, iframe: null },
      ];

      return variants.map(
        (variant) => new HtmlOverlayElement(variant as HtmlOverlayDefinition).iframe.title,
      );
    }, definition());

    expect(result).toEqual([
      'HTML map overlay',
      'HTML map overlay',
      'HTML map overlay',
      'HTML map overlay',
      'HTML map overlay',
      'HTML map overlay',
      'HTML map overlay',
    ]);
  });

  it('updates HTML and iframe options without replacing wrapper or iframe', () => {
    const result = evaluateOverlay(
      (definitionValue, input) => {
        const overlay = new HtmlOverlayElement(definitionValue);
        const originalElement = overlay.element;
        const originalIframe = overlay.iframe;

        overlay.updateDefinition(input as HtmlOverlayDefinition);

        return {
          sameElement: overlay.element === originalElement,
          sameIframe: overlay.iframe === originalIframe,
          childCount: overlay.element.children.length,
          srcdoc: overlay.iframe.srcdoc,
          title: overlay.iframe.title,
          sandbox: overlay.iframe.getAttribute('sandbox'),
          allow: overlay.iframe.getAttribute('allow'),
          referrerPolicy: overlay.iframe.getAttribute('referrerpolicy'),
        };
      },
      definition({
        html: '<p>first</p>',
        iframe: {
          title: 'First',
          allow: 'fullscreen',
          sandbox: ['allow-forms'],
          referrerPolicy: 'origin',
        },
      }),
      definition({
        html: '<p>second</p>',
        iframe: {
          title: 'Second',
          sandbox: ['allow-popups', 'allow-same-origin'],
          referrerPolicy: 'strict-origin',
        },
      }),
    );

    expect(result).toEqual({
      sameElement: true,
      sameIframe: true,
      childCount: 1,
      srcdoc: '<p>second</p>',
      title: 'Second',
      sandbox: 'allow-popups allow-same-origin',
      allow: null,
      referrerPolicy: 'strict-origin',
    });
  });

  it('does not rewrite iframe srcdoc when HTML is unchanged', () => {
    const result = evaluateOverlay(
      (definitionValue, input) => {
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
          const overlay = new HtmlOverlayElement(definitionValue);

          overlay.updateDefinition(input as HtmlOverlayDefinition);

          return {
            srcdoc: overlay.iframe.srcdoc,
            writes,
            selected: overlay.element.dataset.selected,
            title: overlay.iframe.title,
          };
        } finally {
          if (descriptor) {
            Object.defineProperty(HTMLIFrameElement.prototype, 'srcdoc', descriptor);
          }
        }
      },
      definition({
        selected: false,
        html: '<p>stable</p>',
        iframe: {
          title: 'Before',
        },
      }),
      definition({
        selected: true,
        html: '<p>stable</p>',
        iframe: {
          title: 'After',
        },
      }),
    );

    expect(result).toEqual({
      srcdoc: '<p>stable</p>',
      writes: ['<p>stable</p>'],
      selected: 'true',
      title: 'After',
    });
  });

  it('falls back for invalid referrer policies', () => {
    const result = evaluateOverlay(
      (definitionValue, input) => {
        const overlay = new HtmlOverlayElement(definitionValue);
        const initialPolicy = overlay.iframe.getAttribute('referrerpolicy');

        overlay.updateDefinition(input as HtmlOverlayDefinition);

        return {
          initialPolicy,
          updatedPolicy: overlay.iframe.getAttribute('referrerpolicy'),
        };
      },
      definition({
        iframe: {
          title: 'Invalid policy',
          referrerPolicy: '' as HtmlOverlayIframeOptions['referrerPolicy'],
        },
      }),
      definition({
        iframe: {
          title: 'Typo policy',
          referrerPolicy: 'definitely-not-a-policy' as HtmlOverlayIframeOptions['referrerPolicy'],
        },
      }),
    );

    expect(result).toEqual({
      initialPolicy: 'no-referrer',
      updatedPolicy: 'no-referrer',
    });
  });

  it('updates selected, interactable, and pointer mode data attributes', () => {
    const result = evaluateOverlay(
      (definitionValue, input) => {
        const overlay = new HtmlOverlayElement(definitionValue);
        const before = {
          selected: overlay.element.dataset.selected,
          interactable: overlay.element.dataset.interactable,
          pointerMode: overlay.element.dataset.pointerMode,
        };

        overlay.updateDefinition(input as HtmlOverlayDefinition);

        return {
          before,
          after: {
            selected: overlay.element.dataset.selected,
            interactable: overlay.element.dataset.interactable,
            pointerMode: overlay.element.dataset.pointerMode,
          },
        };
      },
      definition({
        selected: false,
        iframe: {
          title: 'Off',
          interactable: false,
          pointerMode: 'none',
        },
      }),
      definition({
        selected: true,
        iframe: {
          title: 'On',
          interactable: true,
          pointerMode: 'always',
        },
      }),
    );

    expect(result).toEqual({
      before: {
        selected: 'false',
        interactable: 'false',
        pointerMode: 'none',
      },
      after: {
        selected: 'true',
        interactable: 'true',
        pointerMode: 'always',
      },
    });
  });

  it('reflects interactable off versus on in data attributes', () => {
    const result = evaluateOverlay(
      (definitionValue, input) => {
        const overlay = new HtmlOverlayElement(definitionValue);
        const off = {
          interactable: overlay.element.dataset.interactable,
          wrapperPointerEvents: overlay.element.style.pointerEvents,
          iframePointerEvents: overlay.iframe.style.pointerEvents,
        };

        overlay.updateDefinition(input as HtmlOverlayDefinition);

        return {
          off,
          on: {
            interactable: overlay.element.dataset.interactable,
            wrapperPointerEvents: overlay.element.style.pointerEvents,
            iframePointerEvents: overlay.iframe.style.pointerEvents,
          },
        };
      },
      definition(),
      definition({ iframe: { title: 'Interactive', interactable: true, pointerMode: 'always' } }),
    );

    expect(result).toEqual({
      off: {
        interactable: 'false',
        wrapperPointerEvents: 'none',
        iframePointerEvents: 'none',
      },
      on: {
        interactable: 'true',
        wrapperPointerEvents: 'auto',
        iframePointerEvents: 'auto',
      },
    });
  });

  it('applies valid frame transform using source dimensions', () => {
    const result = evaluateOverlay(
      (definitionValue, input) => {
        const overlay = new HtmlOverlayElement(definitionValue);

        overlay.updateFrame(input as CssQuadTransform);

        return {
          display: overlay.element.style.display,
          position: overlay.element.style.position,
          left: overlay.element.style.left,
          top: overlay.element.style.top,
          width: overlay.element.style.width,
          height: overlay.element.style.height,
          transform: overlay.element.style.transform,
          transformOrigin: overlay.element.style.transformOrigin,
          overflow: overlay.element.style.overflow,
          iframeWidth: overlay.iframe.style.width,
          iframeHeight: overlay.iframe.style.height,
          iframeBorder: overlay.iframe.style.border,
          iframeDisplay: overlay.iframe.style.display,
          frameState: overlay.element.dataset.frameState,
        };
      },
      definition(),
      VALID_TRANSFORM,
    );

    expect(result).toEqual({
      display: '',
      position: 'absolute',
      left: '12px',
      top: '34px',
      width: '640px',
      height: '360px',
      transform: VALID_TRANSFORM.transform,
      transformOrigin: '0 0',
      overflow: 'hidden',
      iframeWidth: '100%',
      iframeHeight: '100%',
      iframeBorder: '0px',
      iframeDisplay: 'block',
      frameState: 'visible',
    });
  });

  it('hides element for null frame transform', () => {
    const result = evaluateOverlay((definitionValue) => {
      const overlay = new HtmlOverlayElement(definitionValue);

      overlay.updateFrame(null);

      return {
        display: overlay.element.style.display,
        frameState: overlay.element.dataset.frameState,
      };
    });

    expect(result).toEqual({
      display: 'none',
      frameState: 'hidden',
    });
  });

  it('hides visible false overlays even with valid frame transform', () => {
    const result = evaluateOverlay(
      (definitionValue, input) => {
        const overlay = new HtmlOverlayElement(definitionValue);

        overlay.updateFrame(input as CssQuadTransform);

        return {
          display: overlay.element.style.display,
          frameState: overlay.element.dataset.frameState,
        };
      },
      definition({
        visible: false,
      }),
      VALID_TRANSFORM,
    );

    expect(result).toEqual({
      display: 'none',
      frameState: 'hidden',
    });
  });

  it('keeps hostile HTML inside iframe srcdoc only', () => {
    const hostileHtml =
      '<img src=x onerror="document.body.dataset.pwned=true"><script>document.body.dataset.scriptRan=true</script>';
    const result = evaluateOverlay(
      (definitionValue) => {
        const overlay = new HtmlOverlayElement(definitionValue);

        return {
          srcdoc: overlay.iframe.srcdoc,
          childCount: overlay.element.children.length,
          iframeIsOnlyChild: overlay.element.firstElementChild === overlay.iframe,
          outerImages: overlay.element.querySelectorAll(':scope > img').length,
          outerScripts: overlay.element.querySelectorAll(':scope > script').length,
          bodyPwned: document.body.dataset.pwned,
          bodyScriptRan: document.body.dataset.scriptRan,
        };
      },
      definition({
        html: hostileHtml,
      }),
    );

    expect(result.srcdoc).toBe(hostileHtml);
    expect(result.childCount).toBe(1);
    expect(result.iframeIsOnlyChild).toBe(true);
    expect(result.outerImages).toBe(0);
    expect(result.outerScripts).toBe(0);
    expect(result.bodyPwned).toBeUndefined();
    expect(result.bodyScriptRan).toBeUndefined();
  });

  it('warns when iframe sandbox combines scripts with same-origin', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      const overlay = new HtmlOverlayElement(
        definition({
          iframe: {
            title: 'Risky',
            sandbox: ['allow-scripts', 'allow-same-origin'],
          },
        }) as HtmlOverlayDefinition,
      );

      expect(overlay.iframe.getAttribute('sandbox')).toBe('allow-scripts allow-same-origin');
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('allow-scripts'),
        expect.objectContaining({ overlayId: 'overlay-a' }),
      );
    } finally {
      warn.mockRestore();
    }
  });

  it('remove detaches element and is idempotent', () => {
    const result = evaluateOverlay((definitionValue) => {
      const overlay = new HtmlOverlayElement(definitionValue);

      document.body.append(overlay.element);
      const beforeRemove = document.body.contains(overlay.element);

      overlay.remove();
      const afterFirstRemove = document.body.contains(overlay.element);

      overlay.remove();

      return {
        beforeRemove,
        afterFirstRemove,
        afterSecondRemove: document.body.contains(overlay.element),
      };
    });

    expect(result).toEqual({
      beforeRemove: true,
      afterFirstRemove: false,
      afterSecondRemove: false,
    });
  });
});

import { describe, expect, test } from 'vitest';
import {
  ADVANCED_CUSTOM_SYMBOL_IMAGE_ID,
  addAdvancedDecorator,
  applyAdvancedLineStyleToFeatures,
  buildDecoratorFromAdvancedState,
  clearAdvancedDecorators,
  createAdvancedCustomSvgImageManager,
  createAdvancedDecoratorState,
  getAdvancedDecoratorCode,
  getAdvancedDecoratorLineFeature,
  getAdvancedDecoratorRenderState,
  mergeSvgCss,
  parseIterationCount,
  removeAdvancedDecorator,
  syncAdvancedDecorators,
  type AdvancedDecoratorSyncTarget,
  validateSvgMarkup,
  type AdvancedDecoratorState,
} from '../../examples/playground/src/demo-studio/demos/line-decorators/advancedDecoratorAuthoring.ts';

describe('advanced decorator authoring helpers', () => {
  test('validates SVG markup for live previews', () => {
    expect(validateSvgMarkup('<svg xmlns="http://www.w3.org/2000/svg"></svg>')).toEqual({
      valid: true,
      message: 'Live',
    });
    expect(validateSvgMarkup('  ')).toEqual({
      valid: false,
      message: 'Paste SVG markup',
    });
    expect(validateSvgMarkup('<span>not svg</span>')).toEqual({
      valid: false,
      message: 'Invalid SVG',
    });
    expect(validateSvgMarkup('<svg><path></svg>')).toEqual({
      valid: false,
      message: 'Invalid SVG',
    });
  });

  test('merges custom SVG CSS into a single opening style tag', () => {
    const svg = '<svg viewBox="0 0 32 32"><path class="mark"/></svg>';
    const css = '.mark { fill: red; }';

    expect(mergeSvgCss(svg, css)).toBe(
      '<svg viewBox="0 0 32 32"><style>.mark { fill: red; }</style><path class="mark"/></svg>',
    );
    expect(mergeSvgCss(svg, '  ')).toBe(svg);
    expect(mergeSvgCss('<svg><style>.old {}</style><path /></svg>', css)).toBe(
      '<svg><style>.old {}</style><path /></svg>',
    );
  });

  test('builds symbol decorators with placement, rotation, and enabled animation', () => {
    const state: AdvancedDecoratorState = {
      ...createAdvancedDecoratorState(),
      kind: 'symbol',
      frequency: '80px',
      segment: 'all',
      anchor: 'back',
      offsetPercent: 18,
      lineOffsetPx: -12,
      startOffset: '20px',
      endOffset: '30px',
      rotateMode: 'viewport',
      rotateAngle: 15,
      symbolColor: '#123456',
      symbolSize: 1.25,
      symbolOpacity: 0.75,
      animationEnabled: true,
      animationProperties: ['rotate', 'fontSize', 'size'],
      animationFrom: 0,
      animationTo: 360,
      animationDurationMs: 1500,
      animationDelayMs: 120,
      animationIterationCount: '3',
      animationDirection: 'alternate',
      animationEasing: 'ease-in-out',
    };

    expect(buildDecoratorFromAdvancedState(state, 'custom-image')).toEqual({
      kind: 'symbol',
      imageId: 'custom-image',
      color: '#123456',
      size: 1.25,
      opacity: 0.75,
      frequency: '80px',
      offsets: { start: '20px', end: '30px' },
      segment: 'all',
      anchor: 'back',
      offsetPercent: 18,
      lineOffsetPx: -12,
      rotate: { mode: 'viewport', angle: 15 },
      animation: [
        {
          property: 'rotate',
          from: 0,
          to: 360,
          durationMs: 1500,
          delayMs: 120,
          iterationCount: 3,
          direction: 'alternate',
          easing: 'ease-in-out',
        },
        {
          property: 'size',
          from: 0,
          to: 360,
          durationMs: 1500,
          delayMs: 120,
          iterationCount: 3,
          direction: 'alternate',
          easing: 'ease-in-out',
        },
      ],
    });
  });

  test('uses the Demo Studio chevron image for default symbol decorators', () => {
    expect(buildDecoratorFromAdvancedState(createAdvancedDecoratorState())).toMatchObject({
      kind: 'symbol',
      imageId: 'gf-demo-chevron',
    });
  });

  test('builds text decorators from advanced state', () => {
    const state: AdvancedDecoratorState = {
      ...createAdvancedDecoratorState(),
      kind: 'text',
      frequency: 'single',
      text: 'FLOW',
      textColor: '#be123c',
      fontSize: 18,
      textOpacity: 0.8,
      haloColor: '#ffffff',
      haloWidth: 3,
      haloBlur: 1,
      rotateMode: 'line',
      rotateAngle: -90,
      animationEnabled: true,
      animationProperties: ['opacity', 'size', 'fontSize'],
      animationFrom: 12,
      animationTo: 20,
    };

    expect(buildDecoratorFromAdvancedState(state)).toMatchObject({
      kind: 'text',
      text: 'FLOW',
      color: '#be123c',
      fontSize: 18,
      opacity: 0.8,
      haloColor: '#ffffff',
      haloWidth: 3,
      haloBlur: 1,
      frequency: 'single',
      segment: 'middle',
      anchor: 'middle',
      offsetPercent: 0,
      lineOffsetPx: 0,
      rotate: { mode: 'line', angle: -90 },
      animation: [
        expect.objectContaining({ property: 'opacity' }),
        expect.objectContaining({ property: 'fontSize' }),
      ],
    });
  });

  test('builds arrowhead decorators from advanced state', () => {
    const state: AdvancedDecoratorState = {
      ...createAdvancedDecoratorState(),
      kind: 'arrowhead',
      frequency: 'single',
      startOffset: '5m',
      endOffset: '',
      arrowColor: '#f97316',
      arrowFillColor: '#fed7aa',
      arrowSize: '22px',
      arrowYawn: 84,
      arrowWeight: 3,
      arrowOpacity: 0.9,
      arrowFillOpacity: 0.45,
      arrowFill: false,
      arrowProportional: true,
    };

    expect(buildDecoratorFromAdvancedState(state)).toEqual({
      kind: 'arrowhead',
      frequency: 'endonly',
      offsets: { start: '5m' },
      color: '#f97316',
      fillColor: '#fed7aa',
      fill: false,
      size: '22px',
      yawn: 84,
      weight: 3,
      opacity: 0.9,
      fillOpacity: 0.45,
      proportionalToTotal: true,
    });
  });

  test('normalizes whitespace around distance values and iteration keywords', () => {
    const state: AdvancedDecoratorState = {
      ...createAdvancedDecoratorState(),
      kind: 'symbol',
      frequency: ' 80px ',
      startOffset: ' 5m ',
      endOffset: ' 12px ',
      animationEnabled: true,
      animationIterationCount: ' infinite ',
    };

    expect(buildDecoratorFromAdvancedState(state)).toMatchObject({
      kind: 'symbol',
      frequency: '80px',
      offsets: { start: '5m', end: '12px' },
      animation: [expect.objectContaining({ iterationCount: 'infinite' })],
    });
    expect(parseIterationCount(' 4 ')).toBe(4);
    expect(parseIterationCount(' garbage ')).toBe(1);
  });

  test('omits invalid optional placement fields instead of emitting invalid API values', () => {
    const state: AdvancedDecoratorState = {
      ...createAdvancedDecoratorState(),
      kind: 'text',
      frequency: ' sometimes ',
      startOffset: '10%',
      endOffset: 'eventually',
    };

    expect(buildDecoratorFromAdvancedState(state)).toMatchObject({
      kind: 'text',
      text: 'DN 300',
      segment: 'middle',
      anchor: 'middle',
    });
    expect(buildDecoratorFromAdvancedState(state)).not.toHaveProperty('frequency');
    expect(buildDecoratorFromAdvancedState(state)).not.toHaveProperty('offsets');
  });

  test('normalizes arrowhead frequency, size, and offsets against public units', () => {
    const validState: AdvancedDecoratorState = {
      ...createAdvancedDecoratorState(),
      kind: 'arrowhead',
      frequency: ' 40m ',
      startOffset: ' 2px ',
      endOffset: ' 3m ',
      arrowSize: ' 50% ',
    };
    const invalidState: AdvancedDecoratorState = {
      ...validState,
      frequency: 'single',
      startOffset: '-2px',
      endOffset: '10%',
      arrowSize: 'huge',
    };

    expect(buildDecoratorFromAdvancedState(validState)).toMatchObject({
      kind: 'arrowhead',
      frequency: '40m',
      offsets: { start: '2px', end: '3m' },
      size: '50%',
    });
    expect(buildDecoratorFromAdvancedState(invalidState)).toMatchObject({
      kind: 'arrowhead',
      frequency: 'endonly',
    });
    expect(buildDecoratorFromAdvancedState(invalidState)).not.toHaveProperty('offsets');
    expect(buildDecoratorFromAdvancedState(invalidState)).not.toHaveProperty('size');
  });

  test('creates defaults covering the legacy advanced controls', () => {
    expect(createAdvancedDecoratorState()).toEqual({
      selectedLineId: null,
      interactionMode: 'select',
      layerPosition: 'above-lines',
      lineStyle: {
        color: '#0f766e',
        width: 6,
        opacity: 0.86,
      },
      kind: 'symbol',
      frequency: 'single',
      segment: 'middle',
      anchor: 'middle',
      offsetPercent: 0,
      lineOffsetPx: 0,
      startOffset: '0px',
      endOffset: '0px',
      rotateMode: 'line',
      rotateAngle: -90,
      symbolPreset: 'chevron',
      symbolColor: '#0f766e',
      symbolSize: 1,
      symbolOpacity: 1,
      customSvg: expect.stringContaining('<svg'),
      customSvgCss: expect.stringContaining('.mark'),
      text: 'DN 300',
      textColor: '#172554',
      fontSize: 16,
      textOpacity: 1,
      haloColor: '#ffffff',
      haloWidth: 2,
      haloBlur: 0,
      arrowColor: '#f97316',
      arrowFillColor: '#f97316',
      arrowSize: '16px',
      arrowYawn: 60,
      arrowWeight: 2,
      arrowOpacity: 1,
      arrowFillOpacity: 0.22,
      arrowFill: true,
      arrowProportional: false,
      animationEnabled: false,
      animationProperties: ['rotate'],
      animationFrom: 0,
      animationTo: 360,
      animationDurationMs: 1200,
      animationDelayMs: 0,
      animationIterationCount: 'infinite',
      animationDirection: 'normal',
      animationEasing: 'linear',
    });
  });

  test('builds a seeded line import feature with style and state decorators', () => {
    const decorators = [
      buildDecoratorFromAdvancedState({
        ...createAdvancedDecoratorState(),
        kind: 'text',
        text: 'FLOW',
      }),
    ];
    const state: AdvancedDecoratorState = {
      ...createAdvancedDecoratorState(),
      lineStyle: {
        color: '#be123c',
        width: 9,
        opacity: 0.64,
      },
      decorators,
    };

    expect(getAdvancedDecoratorLineFeature(state)).toEqual({
      type: 'Feature',
      id: 'advanced-decorator-line',
      geometry: {
        type: 'LineString',
        coordinates: [
          [19.025, 47.491],
          [19.04, 47.497],
          [19.055, 47.493],
          [19.071, 47.501],
        ],
      },
      properties: {
        lineColor: '#be123c',
        lineWidth: 9,
        lineOpacity: 0.64,
        decorators,
      },
    });
  });

  test('falls back to the authored decorator when a line feature has no decorator list', () => {
    const state = {
      ...createAdvancedDecoratorState(),
      kind: 'arrowhead' as const,
      arrowColor: '#2563eb',
    };

    expect(getAdvancedDecoratorLineFeature(state).properties?.decorators).toEqual([
      buildDecoratorFromAdvancedState(state),
    ]);
  });

  test('builds an advanced decorator code snippet with import and sync calls', () => {
    const state = {
      ...createAdvancedDecoratorState(),
      layerPosition: 'below-lines' as const,
      decorators: [
        buildDecoratorFromAdvancedState({
          ...createAdvancedDecoratorState(),
          kind: 'symbol',
          symbolColor: '#123456',
        }),
      ],
    };
    const code = getAdvancedDecoratorCode(state);

    expect(code).toContain('geoForge.features.importGeoJson(lineFeature');
    expect(code).toContain(
      'geoForge.decorators.lines.configure({ layerPosition: "below-lines" });',
    );
    expect(code).toContain('geoForge.decorators.lines.syncFromFeatures(features, (feature) =>');
    expect(code).toContain('feature.properties?.decorators');
    expect(code).toContain('"decorators"');
  });

  test('adds, removes, and clears decorators without mutating the original state', () => {
    const state = createAdvancedDecoratorState();
    const first = buildDecoratorFromAdvancedState(state);
    const second = buildDecoratorFromAdvancedState({ ...state, kind: 'text', text: 'FLOW' });

    const withFirst = addAdvancedDecorator(state, first);
    const withSecond = addAdvancedDecorator(withFirst, second);
    const withoutFirst = removeAdvancedDecorator(withSecond, 0);
    const afterOutOfRangeRemove = removeAdvancedDecorator(withSecond, 20);
    const cleared = clearAdvancedDecorators(withSecond);

    expect(state).not.toHaveProperty('decorators');
    expect(withFirst.decorators).toEqual([first]);
    expect(withSecond.decorators).toEqual([first, second]);
    expect(withoutFirst.decorators).toEqual([second]);
    expect(afterOutOfRangeRemove).toEqual(withSecond);
    expect(afterOutOfRangeRemove).not.toBe(withSecond);
    expect(cleared.decorators).toEqual([]);
  });

  test('captures a stable image id and SVG source when adding custom SVG decorators', () => {
    const customState: AdvancedDecoratorState = {
      ...createAdvancedDecoratorState(),
      symbolPreset: 'custom',
      customSvg: '<svg xmlns="http://www.w3.org/2000/svg"><path class="mark"/></svg>',
      customSvgCss: '.mark { fill: red; }',
    };
    const withSavedCustom = addAdvancedDecorator(
      customState,
      buildDecoratorFromAdvancedState(customState),
    );

    expect(withSavedCustom.decorators?.[0]).toMatchObject({
      kind: 'symbol',
      imageId: 'gf-demo-custom-advanced-saved-1',
    });
    expect(withSavedCustom.customSymbolImages).toEqual({
      'gf-demo-custom-advanced-saved-1': {
        svg: '<svg xmlns="http://www.w3.org/2000/svg"><style>.mark { fill: red; }</style><path class="mark"/></svg>',
      },
    });
  });

  test('removes saved custom SVG metadata when decorators are removed or cleared', () => {
    const customState: AdvancedDecoratorState = {
      ...createAdvancedDecoratorState(),
      symbolPreset: 'custom',
      customSvg: '<svg xmlns="http://www.w3.org/2000/svg"><path class="mark"/></svg>',
      customSvgCss: '.mark { fill: red; }',
    };
    const withSavedCustom = addAdvancedDecorator(
      customState,
      buildDecoratorFromAdvancedState(customState),
    );

    expect(removeAdvancedDecorator(withSavedCustom, 0).customSymbolImages).toBeUndefined();
    expect(clearAdvancedDecorators(withSavedCustom).customSymbolImages).toBeUndefined();
  });

  test('clones added decorators so later nested mutations do not change state', () => {
    const decorator = buildDecoratorFromAdvancedState(createAdvancedDecoratorState());
    const nextState = addAdvancedDecorator(createAdvancedDecoratorState(), decorator);

    if (decorator.kind === 'symbol' && decorator.rotate) {
      decorator.rotate.angle = 45;
    }

    expect(nextState.decorators?.[0]).toMatchObject({
      kind: 'symbol',
      rotate: { mode: 'line', angle: -90 },
    });
  });

  test('clones decorators without relying on structuredClone', () => {
    const originalStructuredClone = globalThis.structuredClone;
    globalThis.structuredClone = (() => {
      throw new DOMException('could not be cloned', 'DataCloneError');
    }) as typeof structuredClone;

    try {
      const decorator = buildDecoratorFromAdvancedState(createAdvancedDecoratorState());
      const nextState = addAdvancedDecorator(createAdvancedDecoratorState(), decorator);

      expect(nextState.decorators?.[0]).toMatchObject({
        kind: 'symbol',
        rotate: { mode: 'line', angle: -90 },
      });
    } finally {
      globalThis.structuredClone = originalStructuredClone;
    }
  });

  test('clones surviving decorators when removing from state', () => {
    const first = buildDecoratorFromAdvancedState({
      ...createAdvancedDecoratorState(),
      kind: 'text',
      text: 'FLOW',
    });
    const second = buildDecoratorFromAdvancedState(createAdvancedDecoratorState());
    const state: AdvancedDecoratorState = {
      ...createAdvancedDecoratorState(),
      decorators: [first, second],
    };
    const nextState = removeAdvancedDecorator(state, 0);

    const survivingDecorator = state.decorators?.[1];
    if (survivingDecorator?.kind === 'symbol' && survivingDecorator.rotate) {
      survivingDecorator.rotate.angle = 45;
    }

    expect(nextState.decorators?.[0]).toMatchObject({
      kind: 'symbol',
      rotate: { mode: 'line', angle: -90 },
    });
  });

  test('clones line feature decorators so later nested mutations do not change output', () => {
    const decorator = buildDecoratorFromAdvancedState(createAdvancedDecoratorState());
    const feature = getAdvancedDecoratorLineFeature({
      ...createAdvancedDecoratorState(),
      decorators: [decorator],
    });

    if (decorator.kind === 'symbol' && decorator.rotate) {
      decorator.rotate.angle = 45;
    }

    expect(feature.properties.decorators[0]).toMatchObject({
      kind: 'symbol',
      rotate: { mode: 'line', angle: -90 },
    });
  });

  test('sync adapter configures layer position and syncs decorators from current state', () => {
    const oldDecorators = [buildDecoratorFromAdvancedState(createAdvancedDecoratorState())];
    const currentDecorators = [
      buildDecoratorFromAdvancedState({
        ...createAdvancedDecoratorState(),
        kind: 'text',
        text: 'LIVE',
      }),
    ];
    const feature = getAdvancedDecoratorLineFeature({
      ...createAdvancedDecoratorState(),
      decorators: oldDecorators,
    });
    const calls: unknown[] = [];
    const geoForge: AdvancedDecoratorSyncTarget = {
      decorators: {
        lines: {
          configure: (options) => calls.push(['configure', options]),
          syncFromFeatures: (features, getDecorators) =>
            calls.push(['syncFromFeatures', features, getDecorators(feature)]),
        },
      },
    };

    syncAdvancedDecorators({
      geoForge,
      state: {
        ...createAdvancedDecoratorState(),
        layerPosition: 'below-lines',
        decorators: currentDecorators,
      },
      features: [feature],
    });

    expect(calls).toEqual([
      ['configure', { layerPosition: 'below-lines' }],
      ['syncFromFeatures', [feature], currentDecorators],
    ]);
  });

  test('sync adapter clones state decorators before returning them to GeoForge', () => {
    const oldDecorator = buildDecoratorFromAdvancedState({
      ...createAdvancedDecoratorState(),
      kind: 'text',
      text: 'OLD',
    });
    const decorator = buildDecoratorFromAdvancedState(createAdvancedDecoratorState());
    const feature = getAdvancedDecoratorLineFeature({
      ...createAdvancedDecoratorState(),
      decorators: [oldDecorator],
    });
    const state = {
      ...createAdvancedDecoratorState(),
      decorators: [decorator],
    };
    let resolvedDecorators: unknown;
    const geoForge: AdvancedDecoratorSyncTarget = {
      decorators: {
        lines: {
          configure: () => {},
          syncFromFeatures: (features, getDecorators) => {
            resolvedDecorators = getDecorators(features[0]);
          },
        },
      },
    };

    syncAdvancedDecorators({
      geoForge,
      state,
      features: [feature],
    });

    const firstDecorator = state.decorators[0];
    if (firstDecorator?.kind === 'symbol' && firstDecorator.rotate) {
      firstDecorator.rotate.angle = 45;
    }

    expect(resolvedDecorators).toMatchObject([
      {
        kind: 'symbol',
        rotate: { mode: 'line', angle: -90 },
      },
    ]);
  });

  test('applies current line style to imported feature targets', () => {
    const updates: unknown[] = [];
    const featureTargets = [
      {
        updateProperties: (properties: unknown) => updates.push(properties),
      },
      {
        updateProperties: (properties: unknown) => updates.push(properties),
      },
    ];
    const state: AdvancedDecoratorState = {
      ...createAdvancedDecoratorState(),
      lineStyle: {
        color: '#be123c',
        width: 11,
        opacity: 0.45,
      },
    };

    applyAdvancedLineStyleToFeatures(featureTargets, state);

    expect(updates).toEqual([
      {
        lineColor: '#be123c',
        lineWidth: 11,
        lineOpacity: 0.45,
      },
      {
        lineColor: '#be123c',
        lineWidth: 11,
        lineOpacity: 0.45,
      },
    ]);
  });

  test('custom SVG image manager replaces changed content and removes image on cleanup', async () => {
    const calls: unknown[] = [];
    const images = new Map<string, unknown>();
    const map = {
      hasImage: (id: string) => images.has(id),
      addImage: (id: string, image: unknown) => {
        calls.push(['addImage', id, image]);
        images.set(id, image);
      },
      removeImage: (id: string) => {
        calls.push(['removeImage', id]);
        images.delete(id);
      },
    };
    const loadedSvg: string[] = [];
    const imageManager = createAdvancedCustomSvgImageManager(async (svg) => {
      loadedSvg.push(svg);
      return { svg };
    });
    const firstState: AdvancedDecoratorState = {
      ...createAdvancedDecoratorState(),
      symbolPreset: 'custom',
      customSvg: '<svg xmlns="http://www.w3.org/2000/svg"><path class="mark"/></svg>',
      customSvgCss: '.mark { fill: red; }',
    };
    const secondState: AdvancedDecoratorState = {
      ...firstState,
      customSvgCss: '.mark { fill: blue; }',
    };

    await imageManager.ensure(map, firstState);
    await imageManager.ensure(map, firstState);
    await imageManager.ensure(map, secondState);
    imageManager.cleanup(map);

    expect(loadedSvg).toEqual([
      '<svg xmlns="http://www.w3.org/2000/svg"><style>.mark { fill: red; }</style><path class="mark"/></svg>',
      '<svg xmlns="http://www.w3.org/2000/svg"><style>.mark { fill: blue; }</style><path class="mark"/></svg>',
    ]);
    expect(calls).toEqual([
      ['addImage', ADVANCED_CUSTOM_SYMBOL_IMAGE_ID, { svg: loadedSvg[0] }],
      ['removeImage', ADVANCED_CUSTOM_SYMBOL_IMAGE_ID],
      ['addImage', ADVANCED_CUSTOM_SYMBOL_IMAGE_ID, { svg: loadedSvg[1] }],
      ['removeImage', ADVANCED_CUSTOM_SYMBOL_IMAGE_ID],
    ]);
  });

  test('custom SVG image manager skips stale async registrations', async () => {
    const calls: unknown[] = [];
    const images = new Map<string, unknown>();
    const map = {
      hasImage: (id: string) => images.has(id),
      addImage: (id: string, image: unknown) => {
        calls.push(['addImage', id, image]);
        images.set(id, image);
      },
      removeImage: (id: string) => {
        calls.push(['removeImage', id]);
        images.delete(id);
      },
    };
    const loads = new Map<string, Deferred<{ svg: string }>>();
    const imageManager = createAdvancedCustomSvgImageManager((svg) => {
      const deferred = createDeferred<{ svg: string }>();
      loads.set(svg, deferred);
      return deferred.promise;
    });
    const firstState: AdvancedDecoratorState = {
      ...createAdvancedDecoratorState(),
      symbolPreset: 'custom',
      customSvg: '<svg xmlns="http://www.w3.org/2000/svg"><path class="mark"/></svg>',
      customSvgCss: '.mark { fill: red; }',
    };
    const secondState: AdvancedDecoratorState = {
      ...firstState,
      customSvgCss: '.mark { fill: blue; }',
    };
    const firstSvg =
      '<svg xmlns="http://www.w3.org/2000/svg"><style>.mark { fill: red; }</style><path class="mark"/></svg>';
    const secondSvg =
      '<svg xmlns="http://www.w3.org/2000/svg"><style>.mark { fill: blue; }</style><path class="mark"/></svg>';

    const firstEnsure = imageManager.ensure(map, firstState, { isCurrent: () => false });
    const secondEnsure = imageManager.ensure(map, secondState, { isCurrent: () => true });

    loads.get(secondSvg)?.resolve({ svg: secondSvg });
    await secondEnsure;
    loads.get(firstSvg)?.resolve({ svg: firstSvg });
    await firstEnsure;

    expect(calls).toEqual([['addImage', ADVANCED_CUSTOM_SYMBOL_IMAGE_ID, { svg: secondSvg }]]);
    expect(images.get(ADVANCED_CUSTOM_SYMBOL_IMAGE_ID)).toEqual({ svg: secondSvg });
  });

  test('custom SVG image manager propagates loader failures without mutating images', async () => {
    const calls: unknown[] = [];
    const images = new Map<string, unknown>();
    const map = {
      hasImage: (id: string) => images.has(id),
      addImage: (id: string, image: unknown) => {
        calls.push(['addImage', id, image]);
        images.set(id, image);
      },
      removeImage: (id: string) => {
        calls.push(['removeImage', id]);
        images.delete(id);
      },
    };
    const imageManager = createAdvancedCustomSvgImageManager(async () => {
      throw new Error('decode failed');
    });
    const state: AdvancedDecoratorState = {
      ...createAdvancedDecoratorState(),
      symbolPreset: 'custom',
      customSvg: '<svg xmlns="http://www.w3.org/2000/svg"><path class="mark"/></svg>',
      customSvgCss: '.mark { fill: red; }',
    };

    await expect(imageManager.ensure(map, state)).rejects.toThrow('decode failed');

    expect(calls).toEqual([]);
    expect(images.has(ADVANCED_CUSTOM_SYMBOL_IMAGE_ID)).toBe(false);
  });

  test('custom SVG image manager removes a registered image when current SVG is invalid', async () => {
    const calls: unknown[] = [];
    const images = new Map<string, unknown>();
    const map = {
      hasImage: (id: string) => images.has(id),
      addImage: (id: string, image: unknown) => {
        calls.push(['addImage', id, image]);
        images.set(id, image);
      },
      removeImage: (id: string) => {
        calls.push(['removeImage', id]);
        images.delete(id);
      },
    };
    const imageManager = createAdvancedCustomSvgImageManager(async (svg) => ({ svg }));
    const validState: AdvancedDecoratorState = {
      ...createAdvancedDecoratorState(),
      symbolPreset: 'custom',
      customSvg: '<svg xmlns="http://www.w3.org/2000/svg"><path class="mark"/></svg>',
      customSvgCss: '.mark { fill: red; }',
    };
    const invalidState: AdvancedDecoratorState = {
      ...validState,
      customSvg: '<span>not svg</span>',
    };

    await imageManager.ensure(map, validState);
    await imageManager.ensure(map, invalidState);

    expect(calls).toEqual([
      [
        'addImage',
        ADVANCED_CUSTOM_SYMBOL_IMAGE_ID,
        {
          svg: '<svg xmlns="http://www.w3.org/2000/svg"><style>.mark { fill: red; }</style><path class="mark"/></svg>',
        },
      ],
      ['removeImage', ADVANCED_CUSTOM_SYMBOL_IMAGE_ID],
    ]);
    expect(images.has(ADVANCED_CUSTOM_SYMBOL_IMAGE_ID)).toBe(false);
  });

  test('sync output falls back after a registered custom SVG becomes invalid', async () => {
    const images = new Map<string, unknown>();
    const map = {
      hasImage: (id: string) => images.has(id),
      addImage: (id: string, image: unknown) => images.set(id, image),
      removeImage: (id: string) => images.delete(id),
    };
    const imageManager = createAdvancedCustomSvgImageManager(async (svg) => ({ svg }));
    const validState: AdvancedDecoratorState = {
      ...createAdvancedDecoratorState(),
      symbolPreset: 'custom',
      customSvg: '<svg xmlns="http://www.w3.org/2000/svg"><path class="mark"/></svg>',
      customSvgCss: '.mark { fill: red; }',
    };
    const invalidState: AdvancedDecoratorState = {
      ...validState,
      customSvg: '<span>not svg</span>',
      decorators: [buildDecoratorFromAdvancedState(validState)],
    };
    let resolvedDecorators: unknown;
    const geoForge: AdvancedDecoratorSyncTarget = {
      decorators: {
        lines: {
          configure: () => {},
          syncFromFeatures: (features, getDecorators) => {
            resolvedDecorators = getDecorators(features[0]);
          },
        },
      },
    };

    await imageManager.ensure(map, validState);
    const result = await imageManager.ensure(map, invalidState);
    syncAdvancedDecorators({
      geoForge,
      state: getAdvancedDecoratorRenderState(invalidState, {
        customImageReady: result.customImageReady,
      }),
      features: [getAdvancedDecoratorLineFeature(invalidState)],
    });

    expect(images.has(ADVANCED_CUSTOM_SYMBOL_IMAGE_ID)).toBe(false);
    expect(resolvedDecorators).toMatchObject([{ kind: 'symbol', imageId: 'gf-demo-chevron' }]);
    expect(resolvedDecorators).not.toMatchObject([
      { kind: 'symbol', imageId: ADVANCED_CUSTOM_SYMBOL_IMAGE_ID },
    ]);
  });

  test('custom SVG image manager removes a registered image when changed SVG loading fails', async () => {
    const calls: unknown[] = [];
    const images = new Map<string, unknown>();
    const map = {
      hasImage: (id: string) => images.has(id),
      addImage: (id: string, image: unknown) => {
        calls.push(['addImage', id, image]);
        images.set(id, image);
      },
      removeImage: (id: string) => {
        calls.push(['removeImage', id]);
        images.delete(id);
      },
    };
    const validSvg =
      '<svg xmlns="http://www.w3.org/2000/svg"><style>.mark { fill: red; }</style><path class="mark"/></svg>';
    const imageManager = createAdvancedCustomSvgImageManager(async (svg) => {
      if (svg !== validSvg) {
        throw new Error('decode failed');
      }

      return { svg };
    });
    const validState: AdvancedDecoratorState = {
      ...createAdvancedDecoratorState(),
      symbolPreset: 'custom',
      customSvg: '<svg xmlns="http://www.w3.org/2000/svg"><path class="mark"/></svg>',
      customSvgCss: '.mark { fill: red; }',
    };
    const failingState: AdvancedDecoratorState = {
      ...validState,
      customSvgCss: '.mark { fill: blue; }',
    };

    await imageManager.ensure(map, validState);
    await expect(imageManager.ensure(map, failingState)).rejects.toThrow('decode failed');

    expect(calls).toEqual([
      ['addImage', ADVANCED_CUSTOM_SYMBOL_IMAGE_ID, { svg: validSvg }],
      ['removeImage', ADVANCED_CUSTOM_SYMBOL_IMAGE_ID],
    ]);
    expect(images.has(ADVANCED_CUSTOM_SYMBOL_IMAGE_ID)).toBe(false);
  });

  test('sync output falls back after a registered custom SVG replacement fails loading', async () => {
    const images = new Map<string, unknown>();
    const map = {
      hasImage: (id: string) => images.has(id),
      addImage: (id: string, image: unknown) => images.set(id, image),
      removeImage: (id: string) => images.delete(id),
    };
    const validSvg =
      '<svg xmlns="http://www.w3.org/2000/svg"><style>.mark { fill: red; }</style><path class="mark"/></svg>';
    const imageManager = createAdvancedCustomSvgImageManager(async (svg) => {
      if (svg !== validSvg) {
        throw new Error('decode failed');
      }

      return { svg };
    });
    const validState: AdvancedDecoratorState = {
      ...createAdvancedDecoratorState(),
      symbolPreset: 'custom',
      customSvg: '<svg xmlns="http://www.w3.org/2000/svg"><path class="mark"/></svg>',
      customSvgCss: '.mark { fill: red; }',
    };
    const failingState: AdvancedDecoratorState = {
      ...validState,
      customSvgCss: '.mark { fill: blue; }',
      decorators: [buildDecoratorFromAdvancedState(validState)],
    };
    let resolvedDecorators: unknown;
    const geoForge: AdvancedDecoratorSyncTarget = {
      decorators: {
        lines: {
          configure: () => {},
          syncFromFeatures: (features, getDecorators) => {
            resolvedDecorators = getDecorators(features[0]);
          },
        },
      },
    };

    await imageManager.ensure(map, validState);
    await expect(imageManager.ensure(map, failingState)).rejects.toThrow('decode failed');
    syncAdvancedDecorators({
      geoForge,
      state: getAdvancedDecoratorRenderState(failingState, { customImageReady: false }),
      features: [getAdvancedDecoratorLineFeature(failingState)],
    });

    expect(images.has(ADVANCED_CUSTOM_SYMBOL_IMAGE_ID)).toBe(false);
    expect(resolvedDecorators).toMatchObject([{ kind: 'symbol', imageId: 'gf-demo-chevron' }]);
    expect(resolvedDecorators).not.toMatchObject([
      { kind: 'symbol', imageId: ADVANCED_CUSTOM_SYMBOL_IMAGE_ID },
    ]);
  });

  test('custom SVG image manager keeps saved custom decorators when draft is not custom', async () => {
    const images = new Map<string, unknown>();
    const map = {
      hasImage: (id: string) => images.has(id),
      addImage: (id: string, image: unknown) => images.set(id, image),
      removeImage: (id: string) => images.delete(id),
    };
    const imageManager = createAdvancedCustomSvgImageManager(async (svg) => ({ svg }));
    const customState: AdvancedDecoratorState = {
      ...createAdvancedDecoratorState(),
      symbolPreset: 'custom',
      customSvg: '<svg xmlns="http://www.w3.org/2000/svg"><path class="mark"/></svg>',
      customSvgCss: '.mark { fill: red; }',
    };
    const textDraftState: AdvancedDecoratorState = {
      ...customState,
      kind: 'text',
      symbolPreset: 'chevron',
      decorators: [buildDecoratorFromAdvancedState(customState)],
    };
    let resolvedDecorators: unknown;
    const geoForge: AdvancedDecoratorSyncTarget = {
      decorators: {
        lines: {
          configure: () => {},
          syncFromFeatures: (features, getDecorators) => {
            resolvedDecorators = getDecorators(features[0]);
          },
        },
      },
    };

    await imageManager.ensure(map, customState);
    const result = await imageManager.ensure(map, textDraftState);
    syncAdvancedDecorators({
      geoForge,
      state: getAdvancedDecoratorRenderState(textDraftState, result),
      features: [getAdvancedDecoratorLineFeature(textDraftState)],
    });

    expect(result.customImageReady).toBe(true);
    expect(images.has(ADVANCED_CUSTOM_SYMBOL_IMAGE_ID)).toBe(true);
    expect(resolvedDecorators).toMatchObject([
      { kind: 'symbol', imageId: ADVANCED_CUSTOM_SYMBOL_IMAGE_ID },
    ]);
  });

  test('saved custom SVG decorator keeps captured image after draft SVG changes', async () => {
    const images = new Map<string, unknown>();
    const map = {
      hasImage: (id: string) => images.has(id),
      addImage: (id: string, image: unknown) => images.set(id, image),
      removeImage: (id: string) => images.delete(id),
      updateImage: (id: string, image: unknown) => images.set(id, image),
    };
    const imageManager = createAdvancedCustomSvgImageManager(async (svg) => ({ svg }));
    const firstState: AdvancedDecoratorState = {
      ...createAdvancedDecoratorState(),
      symbolPreset: 'custom',
      customSvg: '<svg xmlns="http://www.w3.org/2000/svg"><path class="mark"/></svg>',
      customSvgCss: '.mark { fill: red; }',
    };
    const savedState = addAdvancedDecorator(
      firstState,
      buildDecoratorFromAdvancedState(firstState),
    );
    const changedDraftState: AdvancedDecoratorState = {
      ...savedState,
      customSvgCss: '.mark { fill: blue; }',
    };
    let resolvedDecorators: unknown;
    const geoForge: AdvancedDecoratorSyncTarget = {
      decorators: {
        lines: {
          configure: () => {},
          syncFromFeatures: (features, getDecorators) => {
            resolvedDecorators = getDecorators(features[0]);
          },
        },
      },
    };

    const result = await imageManager.ensure(map, changedDraftState);
    syncAdvancedDecorators({
      geoForge,
      state: getAdvancedDecoratorRenderState(changedDraftState, result),
      features: [getAdvancedDecoratorLineFeature(changedDraftState)],
    });

    expect(images.get('gf-demo-custom-advanced-saved-1')).toEqual({
      svg: '<svg xmlns="http://www.w3.org/2000/svg"><style>.mark { fill: red; }</style><path class="mark"/></svg>',
    });
    expect(images.get(ADVANCED_CUSTOM_SYMBOL_IMAGE_ID)).toEqual({
      svg: '<svg xmlns="http://www.w3.org/2000/svg"><style>.mark { fill: blue; }</style><path class="mark"/></svg>',
    });
    expect(resolvedDecorators).toMatchObject([
      { kind: 'symbol', imageId: 'gf-demo-custom-advanced-saved-1' },
    ]);
  });

  test('saved custom SVG decorator remains valid when draft custom SVG is invalid', async () => {
    const images = new Map<string, unknown>();
    const map = {
      hasImage: (id: string) => images.has(id),
      addImage: (id: string, image: unknown) => images.set(id, image),
      removeImage: (id: string) => images.delete(id),
    };
    const imageManager = createAdvancedCustomSvgImageManager(async (svg) => ({ svg }));
    const validState: AdvancedDecoratorState = {
      ...createAdvancedDecoratorState(),
      symbolPreset: 'custom',
      customSvg: '<svg xmlns="http://www.w3.org/2000/svg"><path class="mark"/></svg>',
      customSvgCss: '.mark { fill: red; }',
    };
    const savedState = addAdvancedDecorator(validState, buildDecoratorFromAdvancedState(validState));
    const invalidDraftState: AdvancedDecoratorState = {
      ...savedState,
      customSvg: '<span>not svg</span>',
    };
    let resolvedDecorators: unknown;
    const geoForge: AdvancedDecoratorSyncTarget = {
      decorators: {
        lines: {
          configure: () => {},
          syncFromFeatures: (features, getDecorators) => {
            resolvedDecorators = getDecorators(features[0]);
          },
        },
      },
    };

    const result = await imageManager.ensure(map, invalidDraftState);
    syncAdvancedDecorators({
      geoForge,
      state: getAdvancedDecoratorRenderState(invalidDraftState, result),
      features: [getAdvancedDecoratorLineFeature(invalidDraftState)],
    });

    expect(images.has(ADVANCED_CUSTOM_SYMBOL_IMAGE_ID)).toBe(false);
    expect(images.has('gf-demo-custom-advanced-saved-1')).toBe(true);
    expect(resolvedDecorators).toMatchObject([
      { kind: 'symbol', imageId: 'gf-demo-custom-advanced-saved-1' },
    ]);
  });

  test('saved custom SVG decorator remains valid when draft custom SVG loading rejects', async () => {
    const images = new Map<string, unknown>();
    const map = {
      hasImage: (id: string) => images.has(id),
      addImage: (id: string, image: unknown) => images.set(id, image),
      removeImage: (id: string) => images.delete(id),
    };
    const savedSvg =
      '<svg xmlns="http://www.w3.org/2000/svg"><style>.mark { fill: red; }</style><path class="mark"/></svg>';
    const failingSvg =
      '<svg xmlns="http://www.w3.org/2000/svg"><style>.mark { fill: blue; }</style><path class="mark"/></svg>';
    const imageManager = createAdvancedCustomSvgImageManager(async (svg) => {
      if (svg === failingSvg) {
        throw new Error('decode failed');
      }

      return { svg };
    });
    const validState: AdvancedDecoratorState = {
      ...createAdvancedDecoratorState(),
      symbolPreset: 'custom',
      customSvg: '<svg xmlns="http://www.w3.org/2000/svg"><path class="mark"/></svg>',
      customSvgCss: '.mark { fill: red; }',
    };
    const savedState = addAdvancedDecorator(validState, buildDecoratorFromAdvancedState(validState));
    const failingDraftState: AdvancedDecoratorState = {
      ...savedState,
      customSvgCss: '.mark { fill: blue; }',
    };
    let resolvedDecorators: unknown;
    const geoForge: AdvancedDecoratorSyncTarget = {
      decorators: {
        lines: {
          configure: () => {},
          syncFromFeatures: (features, getDecorators) => {
            resolvedDecorators = getDecorators(features[0]);
          },
        },
      },
    };

    let readyImageIds: string[] | undefined;
    await imageManager.ensure(map, failingDraftState).catch((error: unknown) => {
      readyImageIds = (error as { readyImageIds?: string[] }).readyImageIds;
    });
    syncAdvancedDecorators({
      geoForge,
      state: getAdvancedDecoratorRenderState(failingDraftState, {
        customImageReady: false,
        readyImageIds,
      }),
      features: [getAdvancedDecoratorLineFeature(failingDraftState)],
    });

    expect(images.get('gf-demo-custom-advanced-saved-1')).toEqual({ svg: savedSvg });
    expect(images.has(ADVANCED_CUSTOM_SYMBOL_IMAGE_ID)).toBe(false);
    expect(readyImageIds).toContain('gf-demo-custom-advanced-saved-1');
    expect(resolvedDecorators).toMatchObject([
      { kind: 'symbol', imageId: 'gf-demo-custom-advanced-saved-1' },
    ]);
  });

  test('custom SVG image manager removes saved images that are no longer referenced', async () => {
    const images = new Map<string, unknown>();
    const map = {
      hasImage: (id: string) => images.has(id),
      addImage: (id: string, image: unknown) => images.set(id, image),
      removeImage: (id: string) => images.delete(id),
    };
    const imageManager = createAdvancedCustomSvgImageManager(async (svg) => ({ svg }));
    const customState: AdvancedDecoratorState = {
      ...createAdvancedDecoratorState(),
      symbolPreset: 'custom',
      customSvg: '<svg xmlns="http://www.w3.org/2000/svg"><path class="mark"/></svg>',
      customSvgCss: '.mark { fill: red; }',
    };
    const savedState = addAdvancedDecorator(customState, buildDecoratorFromAdvancedState(customState));
    const removedState: AdvancedDecoratorState = {
      ...removeAdvancedDecorator(savedState, 0),
      kind: 'text',
      symbolPreset: 'chevron',
    };

    await imageManager.ensure(map, savedState);
    expect(images.has('gf-demo-custom-advanced-saved-1')).toBe(true);

    await imageManager.ensure(map, removedState);

    expect(images.has('gf-demo-custom-advanced-saved-1')).toBe(false);
    expect(images.has(ADVANCED_CUSTOM_SYMBOL_IMAGE_ID)).toBe(false);
  });
});

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
};

function createDeferred<T>(): Deferred<T> {
  let resolve: Deferred<T>['resolve'] = () => {};
  let reject: Deferred<T>['reject'] = () => {};
  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });

  return { promise, resolve, reject };
}

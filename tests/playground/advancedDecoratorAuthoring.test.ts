import { describe, expect, test } from 'vitest';
import {
  buildDecoratorFromAdvancedState,
  createAdvancedDecoratorState,
  mergeSvgCss,
  parseIterationCount,
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
});

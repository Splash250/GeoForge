import { describe, expect, it } from 'vitest';
import { normalizeLineDecorators } from '../../../src/decorators/line/index.ts';

describe('normalizeLineDecorators', () => {
  it('keeps non-arrow decorators and appends legacy arrowheads', () => {
    const decorators = normalizeLineDecorators({
      decorators: [{ kind: 'symbol', imageId: 'line-arrow', frequency: 'endonly' }],
      arrowheads: { frequency: '40px' },
    });

    expect(decorators).toEqual([
      expect.objectContaining({ kind: 'symbol', imageId: 'line-arrow' }),
      expect.objectContaining({ kind: 'arrowhead', frequency: '40px' }),
    ]);
  });

  it('uses explicit arrowhead decorators instead of legacy arrowheads', () => {
    const decorators = normalizeLineDecorators({
      decorators: [{ kind: 'arrowhead', frequency: 'endonly', size: '10px' }],
      arrowheads: { frequency: '40px', size: '8px' },
    });

    expect(decorators).toEqual([
      expect.objectContaining({ kind: 'arrowhead', frequency: 'endonly', size: '10px' }),
    ]);
  });

  it('normalizes legacy arrowheads into arrowhead decorators', () => {
    const decorators = normalizeLineDecorators({
      arrowheads: { frequency: 'endonly', size: '8px' },
    });

    expect(decorators).toEqual([
      expect.objectContaining({ kind: 'arrowhead', frequency: 'endonly', size: '8px' }),
    ]);
  });

  it('accepts symbol decorators with valid image ids', () => {
    expect(
      normalizeLineDecorators({
        decorators: [{ kind: 'symbol', imageId: 'line-arrow' }],
      }),
    ).toEqual([expect.objectContaining({ kind: 'symbol', imageId: 'line-arrow' })]);
  });

  it('accepts text decorators with non-blank text', () => {
    expect(
      normalizeLineDecorators({
        decorators: [{ kind: 'text', text: 'DN 300', frequency: 'single' }],
      }),
    ).toEqual([expect.objectContaining({ kind: 'text', text: 'DN 300' })]);
  });

  it('returns empty array for invalid decorator data without valid legacy arrowheads', () => {
    expect(normalizeLineDecorators({ decorators: 'bad' })).toEqual([]);
    expect(normalizeLineDecorators({ decorators: [{ kind: 'symbol', imageId: '' }] })).toEqual([]);
    expect(normalizeLineDecorators({ decorators: [{ kind: 'text', text: '' }] })).toEqual([]);
    expect(normalizeLineDecorators(undefined)).toEqual([]);
  });

  it('keeps valid legacy arrowheads when decorator data is invalid', () => {
    expect(
      normalizeLineDecorators({
        decorators: 'bad',
        arrowheads: { frequency: 'endonly' },
      }),
    ).toEqual([expect.objectContaining({ kind: 'arrowhead', frequency: 'endonly' })]);
  });
});

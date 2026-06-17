import { describe, expect, it } from 'vitest';
import {
  isInMeters,
  isInPercent,
  isInPixels,
  distanceBetween,
  destinationPoint,
} from '../../../../src/decorators/line/arrowheads/index.ts';

describe('maplibre-geoman arrowhead utilities', () => {
  it('detects size units', () => {
    expect(isInMeters('25m')).toBe(true);
    expect(isInPercent('15%')).toBe(true);
    expect(isInPixels('12px')).toBe(true);
    expect(isInMeters('20px')).toBe(false);
  });

  it('computes distances and destinations', () => {
    const paris: [number, number] = [2.3522, 48.8566];
    const london: [number, number] = [-0.1276, 51.5074];
    const distance = distanceBetween(paris, london);
    expect(Math.round(distance / 1000)).toBeGreaterThan(300);

    const destination = destinationPoint(paris, 90, 1000);
    expect(destination.lng).toBeGreaterThan(paris[0]);
  });
});

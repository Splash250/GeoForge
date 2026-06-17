import { describe, expect, it } from 'vitest';
import type { LngLatTuple, ScreenPoint } from '../../../src/types/map/index.ts';
import {
  closedRingToCorners,
  constrainDraggedRectangleCorner,
  cornersToClosedRing,
  getProjectedOverlayQuad,
  lngLatToWebMercatorPoint,
  validateHtmlOverlayCorners,
} from '../../../src/overlays/html/geometry.ts';
import type { HtmlOverlayCorners } from '../../../src/overlays/html/types.ts';

const WEB_MERCATOR_HALF_WORLD = 20037508.34;

const mercatorToLngLat = ([x, y]: ScreenPoint): LngLatTuple => [
  (x * 180) / WEB_MERCATOR_HALF_WORLD,
  (Math.atan(Math.exp((y * Math.PI) / WEB_MERCATOR_HALF_WORLD)) * 360) / Math.PI - 90,
];

const mercatorRect = ({
  center = [0, 0],
  width,
  height,
  angleDegrees = 0,
}: {
  center?: ScreenPoint;
  width: number;
  height: number;
  angleDegrees?: number;
}): HtmlOverlayCorners => {
  const angle = (angleDegrees * Math.PI) / 180;
  const right: ScreenPoint = [Math.cos(angle), Math.sin(angle)];
  const down: ScreenPoint = [-Math.sin(angle), Math.cos(angle)];
  const halfWidth = width / 2;
  const halfHeight = height / 2;

  const point = (rightScale: number, downScale: number): LngLatTuple =>
    mercatorToLngLat([
      center[0] + right[0] * rightScale + down[0] * downScale,
      center[1] + right[1] * rightScale + down[1] * downScale,
    ]);

  return {
    topLeft: point(-halfWidth, -halfHeight),
    topRight: point(halfWidth, -halfHeight),
    bottomRight: point(halfWidth, halfHeight),
    bottomLeft: point(-halfWidth, halfHeight),
  };
};

const projectMercator = (lngLat: LngLatTuple): ScreenPoint => {
  const [x, y] = lngLatToWebMercatorPoint(lngLat);
  return [x / 100, y / 100];
};

const unprojectMercator = ([x, y]: ScreenPoint): LngLatTuple =>
  mercatorToLngLat([x * 100, y * 100]);

describe('html overlay geometry', () => {
  it('validates an axis-aligned rectangle and returns projected quad order', () => {
    const corners = mercatorRect({ width: 2000, height: 1000 });

    expect(validateHtmlOverlayCorners(corners, projectMercator)).toEqual({ valid: true });
    expect(getProjectedOverlayQuad(corners, projectMercator)).toEqual([
      projectMercator(corners.topLeft),
      projectMercator(corners.topRight),
      projectMercator(corners.bottomRight),
      projectMercator(corners.bottomLeft),
    ]);
  });

  it('returns null for invalid projected overlay quads', () => {
    const corners = mercatorRect({ width: 2000, height: 1000 });

    expect(getProjectedOverlayQuad(corners, () => [Number.NaN, 0])).toBeNull();
    expect(
      getProjectedOverlayQuad(corners, () => {
        throw new Error('projection failed');
      }),
    ).toBeNull();
  });

  it('validates a square', () => {
    expect(
      validateHtmlOverlayCorners(mercatorRect({ width: 1200, height: 1200 }), projectMercator),
    ).toEqual({
      valid: true,
    });
  });

  it('validates a rotated WebMercator rectangle', () => {
    const corners = mercatorRect({ width: 2400, height: 900, angleDegrees: 32 });

    expect(validateHtmlOverlayCorners(corners, projectMercator)).toEqual({ valid: true });
  });

  it('rejects a skewed freeform quadrilateral', () => {
    const corners = mercatorRect({ width: 2000, height: 1000 });
    corners.topRight = mercatorToLngLat([1300, -500]);

    const result = validateHtmlOverlayCorners(corners, projectMercator);

    expect(result.valid).toBe(false);
    expect(result.valid ? [] : result.reasons).toContain('not-rectangle');
  });

  it('rejects a bow-tie self-intersecting quadrilateral', () => {
    const rectangle = mercatorRect({ width: 2000, height: 1000 });
    const corners: HtmlOverlayCorners = {
      topLeft: rectangle.topLeft,
      topRight: rectangle.bottomRight,
      bottomRight: rectangle.topRight,
      bottomLeft: rectangle.bottomLeft,
    };

    const result = validateHtmlOverlayCorners(corners, projectMercator);

    expect(result.valid).toBe(false);
    expect(result.valid ? [] : result.reasons).toContain('self-intersecting');
  });

  it('rejects missing and non-finite corners', () => {
    const missingCorner = {
      topLeft: [0, 0],
      topRight: [1, 0],
      bottomRight: [1, 1],
    } as HtmlOverlayCorners;
    const nonFinite = mercatorRect({ width: 2000, height: 1000 });
    nonFinite.bottomLeft = [Number.NaN, 0];

    const missingResult = validateHtmlOverlayCorners(missingCorner, projectMercator);
    const nonFiniteResult = validateHtmlOverlayCorners(nonFinite, projectMercator);

    expect(missingResult.valid).toBe(false);
    expect(missingResult.valid ? [] : missingResult.reasons).toContain('missing-corner');
    expect(nonFiniteResult.valid).toBe(false);
    expect(nonFiniteResult.valid ? [] : nonFiniteResult.reasons).toContain('non-finite');
  });

  it('rejects projected screen geometry smaller than eight pixels', () => {
    const corners = mercatorRect({ width: 7000, height: 7000 });
    const projectTiny = (lngLat: LngLatTuple): ScreenPoint => {
      const [x, y] = lngLatToWebMercatorPoint(lngLat);
      return [x / 1000, y / 1000];
    };

    const result = validateHtmlOverlayCorners(corners, projectTiny);

    expect(result.valid).toBe(false);
    expect(result.valid ? [] : result.reasons).toContain('too-small');
  });

  it('round trips a closed ring while preserving corner order', () => {
    const corners = mercatorRect({ width: 2000, height: 1000 });
    const ring = cornersToClosedRing(corners);

    expect(ring).toEqual([
      corners.topLeft,
      corners.topRight,
      corners.bottomRight,
      corners.bottomLeft,
      corners.topLeft,
    ]);
    expect(closedRingToCorners(ring)).toEqual(corners);
  });

  it('returns null for invalid rings', () => {
    const corners = mercatorRect({ width: 2000, height: 1000 });

    expect(
      closedRingToCorners([
        corners.topLeft,
        corners.topRight,
        corners.bottomRight,
        corners.bottomLeft,
      ]),
    ).toBeNull();
    expect(
      closedRingToCorners([
        corners.topLeft,
        corners.topRight,
        corners.bottomRight,
        corners.bottomLeft,
        corners.topRight,
      ]),
    ).toBeNull();
  });

  it('keeps dragged corner edits rectangular in the projected screen plane', () => {
    const corners = mercatorRect({ width: 2000, height: 1000 });
    const nextTopRight = unprojectMercator([4, -3]);

    const constrained = constrainDraggedRectangleCorner(
      corners,
      'topRight',
      nextTopRight,
      projectMercator,
      unprojectMercator,
    );

    expect(projectMercator(constrained.bottomLeft)).toEqual(projectMercator(corners.bottomLeft));
    expect(projectMercator(constrained.topRight)).toEqual(projectMercator(nextTopRight));
    expect(projectMercator(constrained.topLeft)).toEqual([
      projectMercator(corners.bottomLeft)[0],
      projectMercator(nextTopRight)[1],
    ]);
    expect(projectMercator(constrained.bottomRight)).toEqual([
      projectMercator(nextTopRight)[0],
      projectMercator(corners.bottomLeft)[1],
    ]);
    expect(validateHtmlOverlayCorners(constrained, projectMercator)).toEqual({ valid: true });
  });

  it('keeps the named opposite corner fixed when dragged corner crosses past it', () => {
    const corners: HtmlOverlayCorners = {
      topLeft: [0, 0],
      topRight: [10, 0],
      bottomRight: [10, 10],
      bottomLeft: [0, 10],
    };
    const identity = (point: LngLatTuple): ScreenPoint => point;
    const constrained = constrainDraggedRectangleCorner(
      corners,
      'topRight',
      [-5, 15],
      identity,
      identity,
    );

    expect(constrained.bottomLeft).toEqual(corners.bottomLeft);
    expect(constrained.topRight).toEqual([-5, 15]);
    expect(constrained.topLeft).toEqual([0, 15]);
    expect(constrained.bottomRight).toEqual([-5, 10]);
  });

  it('preserves the projected basis when dragging a rotated rectangle corner', () => {
    const corners = mercatorRect({ width: 2400, height: 900, angleDegrees: 30 });
    const fixed = projectMercator(corners.bottomLeft);
    const originalTopSide = vectorBetween(fixed, projectMercator(corners.topLeft));
    const originalRightSide = vectorBetween(fixed, projectMercator(corners.bottomRight));
    const expectedTopLeftPoint = addVector(fixed, scaleVector(originalTopSide, 1.4));
    const expectedBottomRightPoint = addVector(fixed, scaleVector(originalRightSide, 0.65));
    const nextTopRight = unprojectMercator(
      addVector(expectedTopLeftPoint, scaleVector(originalRightSide, 0.65)),
    );

    const constrained = constrainDraggedRectangleCorner(
      corners,
      'topRight',
      nextTopRight,
      projectMercator,
      unprojectMercator,
    );

    expect(projectMercator(constrained.bottomLeft)).toEqual(fixed);
    expect(projectMercator(constrained.topLeft)[0]).toBeCloseTo(expectedTopLeftPoint[0], 8);
    expect(projectMercator(constrained.topLeft)[1]).toBeCloseTo(expectedTopLeftPoint[1], 8);
    expect(projectMercator(constrained.bottomRight)[0]).toBeCloseTo(expectedBottomRightPoint[0], 8);
    expect(projectMercator(constrained.bottomRight)[1]).toBeCloseTo(expectedBottomRightPoint[1], 8);
    expect(validateHtmlOverlayCorners(constrained, projectMercator)).toEqual({ valid: true });
  });
});

const vectorBetween = (from: ScreenPoint, to: ScreenPoint): ScreenPoint => [
  to[0] - from[0],
  to[1] - from[1],
];

const addVector = (point: ScreenPoint, vector: ScreenPoint): ScreenPoint => [
  point[0] + vector[0],
  point[1] + vector[1],
];

const scaleVector = (vector: ScreenPoint, scale: number): ScreenPoint => [
  vector[0] * scale,
  vector[1] * scale,
];

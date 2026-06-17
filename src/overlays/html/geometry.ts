import type { LngLatTuple, ScreenPoint } from '@/types/map/index.ts';
import type {
  HtmlOverlayCornerName,
  HtmlOverlayCorners,
  HtmlOverlayValidationFailureReason,
  HtmlOverlayValidationResult,
} from './types.ts';

type OrderedHtmlOverlayLngLatCorners = [LngLatTuple, LngLatTuple, LngLatTuple, LngLatTuple];

export type HtmlOverlayProjectedQuad = [ScreenPoint, ScreenPoint, ScreenPoint, ScreenPoint];

const CORNER_ORDER: Array<HtmlOverlayCornerName> = [
  'topLeft',
  'topRight',
  'bottomRight',
  'bottomLeft',
];
const WEB_MERCATOR_HALF_WORLD = 20037508.34;
const RECTANGLE_TOLERANCE = 1e-3;
const MIN_PROJECTED_SIZE_PX = 8;

export const lngLatToWebMercatorPoint = ([lng, lat]: LngLatTuple): ScreenPoint => {
  const x = (lng * WEB_MERCATOR_HALF_WORLD) / 180;
  const y =
    (Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) / (Math.PI / 180)) *
    (WEB_MERCATOR_HALF_WORLD / 180);

  return [x, y];
};

export const cornersToClosedRing = (corners: HtmlOverlayCorners): Array<LngLatTuple> => [
  corners.topLeft,
  corners.topRight,
  corners.bottomRight,
  corners.bottomLeft,
  corners.topLeft,
];

export const closedRingToCorners = (ring: Array<LngLatTuple>): HtmlOverlayCorners | null => {
  if (ring.length !== 5 || !pointsEqual(ring[0], ring[4])) {
    return null;
  }

  return {
    topLeft: ring[0],
    topRight: ring[1],
    bottomRight: ring[2],
    bottomLeft: ring[3],
  };
};

export const getProjectedOverlayQuad = (
  corners: HtmlOverlayCorners,
  project: (lngLat: LngLatTuple) => ScreenPoint,
): HtmlOverlayProjectedQuad | null => {
  const points = getOrderedCorners(corners);
  if (!points) {
    return null;
  }

  const projected = safeProjectCorners(points, project);
  if (!projected) {
    return null;
  }

  return projected as HtmlOverlayProjectedQuad;
};

export const validateHtmlOverlayCorners = (
  corners: HtmlOverlayCorners,
  project: (lngLat: LngLatTuple) => ScreenPoint,
): HtmlOverlayValidationResult => {
  const reasons = new Set<HtmlOverlayValidationFailureReason>();
  const orderedCorners = getOrderedCorners(corners);

  if (!orderedCorners) {
    reasons.add('missing-corner');
    return invalidResult(reasons);
  }

  const mercatorPoints = orderedCorners.map(lngLatToWebMercatorPoint);
  const projectedPoints = safeProjectCorners(orderedCorners, project);

  if (
    !orderedCorners.every(isFinitePoint) ||
    !mercatorPoints.every(isFinitePoint) ||
    !projectedPoints
  ) {
    reasons.add('non-finite');
    return invalidResult(reasons);
  }

  if (isSelfIntersecting(mercatorPoints)) {
    reasons.add('self-intersecting');
  }

  if (!isRectangleLike(mercatorPoints)) {
    reasons.add('not-rectangle');
  }

  if (isProjectedTooSmall(projectedPoints)) {
    reasons.add('too-small');
  }

  return reasons.size === 0 ? { valid: true } : invalidResult(reasons);
};

export const constrainDraggedRectangleCorner = (
  corners: HtmlOverlayCorners,
  draggedCorner: HtmlOverlayCornerName,
  nextLngLat: LngLatTuple,
  project: (lngLat: LngLatTuple) => ScreenPoint,
  unproject: (point: ScreenPoint) => LngLatTuple,
): HtmlOverlayCorners => {
  const projected = {
    topLeft: project(corners.topLeft),
    topRight: project(corners.topRight),
    bottomRight: project(corners.bottomRight),
    bottomLeft: project(corners.bottomLeft),
  };
  const nextPoint = project(nextLngLat);
  const oppositeCorner = getOppositeCorner(draggedCorner);
  const fixedPoint = projected[oppositeCorner];
  const firstBasisCorner = getFirstBasisCorner(draggedCorner);
  const secondBasisCorner = getSecondBasisCorner(draggedCorner);
  const firstBasis = subtract(projected[firstBasisCorner], fixedPoint);
  const secondBasis = subtract(projected[secondBasisCorner], fixedPoint);
  const draggedVector = subtract(nextPoint, fixedPoint);
  const decomposed = decomposeVector(draggedVector, firstBasis, secondBasis);

  if (!decomposed) {
    return corners;
  }

  const firstAdjacent = unproject(add(fixedPoint, scale(firstBasis, decomposed.first)));
  const secondAdjacent = unproject(add(fixedPoint, scale(secondBasis, decomposed.second)));

  switch (draggedCorner) {
    case 'topLeft':
      return {
        topLeft: nextLngLat,
        topRight: firstAdjacent,
        bottomRight: corners.bottomRight,
        bottomLeft: secondAdjacent,
      };
    case 'topRight':
      return {
        topLeft: firstAdjacent,
        topRight: nextLngLat,
        bottomRight: secondAdjacent,
        bottomLeft: corners.bottomLeft,
      };
    case 'bottomRight':
      return {
        topLeft: corners.topLeft,
        topRight: secondAdjacent,
        bottomRight: nextLngLat,
        bottomLeft: firstAdjacent,
      };
    case 'bottomLeft':
      return {
        topLeft: secondAdjacent,
        topRight: corners.topRight,
        bottomRight: firstAdjacent,
        bottomLeft: nextLngLat,
      };
  }
};

const getOrderedCorners = (corners: HtmlOverlayCorners): OrderedHtmlOverlayLngLatCorners | null => {
  const ordered = CORNER_ORDER.map((cornerName) => corners[cornerName]);

  if (ordered.some((corner) => !Array.isArray(corner) || corner.length < 2)) {
    return null;
  }

  return ordered as OrderedHtmlOverlayLngLatCorners;
};

const safeProjectCorners = (
  corners: Array<LngLatTuple>,
  project: (lngLat: LngLatTuple) => ScreenPoint,
): Array<ScreenPoint> | null => {
  try {
    const projected = corners.map(project);
    return projected.every(isFinitePoint) ? projected : null;
  } catch {
    return null;
  }
};

const invalidResult = (
  reasons: Set<HtmlOverlayValidationFailureReason>,
): HtmlOverlayValidationResult => ({
  valid: false,
  reasons: Array.from(reasons),
});

const isFinitePoint = (point: LngLatTuple | ScreenPoint): boolean =>
  point.length >= 2 && Number.isFinite(point[0]) && Number.isFinite(point[1]);

const pointsEqual = (a: LngLatTuple | undefined, b: LngLatTuple | undefined): boolean =>
  Boolean(a && b && a[0] === b[0] && a[1] === b[1]);

const isRectangleLike = (points: Array<ScreenPoint>): boolean => {
  const sides = [
    subtract(points[1], points[0]),
    subtract(points[2], points[1]),
    subtract(points[3], points[2]),
    subtract(points[0], points[3]),
  ];
  const lengths = sides.map(length);

  if (lengths.some((sideLength) => sideLength === 0)) {
    return false;
  }

  const maxSideLength = Math.max(...lengths);
  const lengthTolerance = RECTANGLE_TOLERANCE * maxSideLength;
  const angleChecks = sides.every((side, index) => {
    const adjacent = sides[(index + 1) % sides.length];
    return (
      Math.abs(dot(side, adjacent)) <=
      RECTANGLE_TOLERANCE * lengths[index] * lengths[(index + 1) % lengths.length]
    );
  });
  const parallelChecks =
    Math.abs(cross(sides[0], sides[2])) <= RECTANGLE_TOLERANCE * lengths[0] * lengths[2] &&
    Math.abs(cross(sides[1], sides[3])) <= RECTANGLE_TOLERANCE * lengths[1] * lengths[3];
  const oppositeLengthChecks =
    Math.abs(lengths[0] - lengths[2]) <= lengthTolerance &&
    Math.abs(lengths[1] - lengths[3]) <= lengthTolerance;

  return angleChecks && parallelChecks && oppositeLengthChecks;
};

const isSelfIntersecting = (points: Array<ScreenPoint>): boolean =>
  segmentsIntersect(points[0], points[1], points[2], points[3]) ||
  segmentsIntersect(points[1], points[2], points[3], points[0]);

const segmentsIntersect = (
  a: ScreenPoint,
  b: ScreenPoint,
  c: ScreenPoint,
  d: ScreenPoint,
): boolean => {
  const orientationA = orientation(a, b, c);
  const orientationB = orientation(a, b, d);
  const orientationC = orientation(c, d, a);
  const orientationD = orientation(c, d, b);

  if (orientationA === 0 && isPointOnSegment(c, a, b)) {
    return true;
  }
  if (orientationB === 0 && isPointOnSegment(d, a, b)) {
    return true;
  }
  if (orientationC === 0 && isPointOnSegment(a, c, d)) {
    return true;
  }
  if (orientationD === 0 && isPointOnSegment(b, c, d)) {
    return true;
  }

  return orientationA !== orientationB && orientationC !== orientationD;
};

const orientation = (a: ScreenPoint, b: ScreenPoint, c: ScreenPoint): -1 | 0 | 1 => {
  const value = cross(subtract(b, a), subtract(c, a));

  if (Math.abs(value) <= Number.EPSILON) {
    return 0;
  }

  return value > 0 ? 1 : -1;
};

const isPointOnSegment = (point: ScreenPoint, start: ScreenPoint, end: ScreenPoint): boolean =>
  point[0] >= Math.min(start[0], end[0]) &&
  point[0] <= Math.max(start[0], end[0]) &&
  point[1] >= Math.min(start[1], end[1]) &&
  point[1] <= Math.max(start[1], end[1]);

const isProjectedTooSmall = (points: Array<ScreenPoint>): boolean => {
  const xValues = points.map((point) => point[0]);
  const yValues = points.map((point) => point[1]);
  const width = Math.max(...xValues) - Math.min(...xValues);
  const height = Math.max(...yValues) - Math.min(...yValues);

  return width < MIN_PROJECTED_SIZE_PX || height < MIN_PROJECTED_SIZE_PX;
};

const getOppositeCorner = (cornerName: HtmlOverlayCornerName): HtmlOverlayCornerName => {
  switch (cornerName) {
    case 'topLeft':
      return 'bottomRight';
    case 'topRight':
      return 'bottomLeft';
    case 'bottomRight':
      return 'topLeft';
    case 'bottomLeft':
      return 'topRight';
  }
};

const getFirstBasisCorner = (cornerName: HtmlOverlayCornerName): HtmlOverlayCornerName => {
  switch (cornerName) {
    case 'topLeft':
      return 'topRight';
    case 'topRight':
      return 'topLeft';
    case 'bottomRight':
      return 'bottomLeft';
    case 'bottomLeft':
      return 'bottomRight';
  }
};

const getSecondBasisCorner = (cornerName: HtmlOverlayCornerName): HtmlOverlayCornerName => {
  switch (cornerName) {
    case 'topLeft':
      return 'bottomLeft';
    case 'topRight':
      return 'bottomRight';
    case 'bottomRight':
      return 'topRight';
    case 'bottomLeft':
      return 'topLeft';
  }
};

const decomposeVector = (
  vector: ScreenPoint,
  firstBasis: ScreenPoint,
  secondBasis: ScreenPoint,
): { first: number; second: number } | null => {
  const determinant = cross(firstBasis, secondBasis);

  if (!Number.isFinite(determinant) || Math.abs(determinant) <= Number.EPSILON) {
    return null;
  }

  return {
    first: cross(vector, secondBasis) / determinant,
    second: cross(firstBasis, vector) / determinant,
  };
};

const add = (a: ScreenPoint, b: ScreenPoint): ScreenPoint => [a[0] + b[0], a[1] + b[1]];

const scale = (vector: ScreenPoint, scalar: number): ScreenPoint => [
  vector[0] * scalar,
  vector[1] * scalar,
];

const subtract = (a: ScreenPoint, b: ScreenPoint): ScreenPoint => [a[0] - b[0], a[1] - b[1]];

const length = (vector: ScreenPoint): number => Math.hypot(vector[0], vector[1]);

const dot = (a: ScreenPoint, b: ScreenPoint): number => a[0] * b[0] + a[1] * b[1];

const cross = (a: ScreenPoint, b: ScreenPoint): number => a[0] * b[1] - a[1] * b[0];

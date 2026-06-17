import type { LineString, MultiLineString, Position } from 'geojson';
import type { Map } from 'maplibre-gl';
import type { ArrowOffsetUnit } from '../arrowheads/types.ts';
import {
  bearingBetween,
  destinationPoint,
  distanceBetween,
  interpolateOnLine,
  pixelsToMeters,
  toLngLat,
  type NormalizedLngLat,
} from '../arrowheads/utils/geometry.ts';
import { isInMeters, isInPixels, parseNumeric } from '../arrowheads/utils/units.ts';
import type {
  LinePlacementFrequency,
  LineSymbolAnchor,
  LineSymbolSegmentTarget,
} from '../types.ts';

export type LinePlacementOptions = {
  frequency?: LinePlacementFrequency;
  offsets?: {
    start?: ArrowOffsetUnit;
    end?: ArrowOffsetUnit;
  };
  segment?: LineSymbolSegmentTarget;
  anchor?: LineSymbolAnchor;
  offsetPercent?: number;
  lineOffsetPx?: number;
};

export type LinePlacement = {
  index: number;
  point: NormalizedLngLat;
  bearing: number;
  segmentIndex: number;
  fraction: number;
  totalLength: number;
  averageSegmentLength: number;
};

export type CreateLinePlacementsOptions = {
  map: Map;
  line: LineString | MultiLineString;
  placement?: LinePlacementOptions;
};

type CoordinateSet = NormalizedLngLat[];

const DEFAULT_FREQUENCY: LinePlacementFrequency = '40px';

export function createLinePlacements({
  map,
  line,
  placement = {},
}: CreateLinePlacementsOptions): LinePlacement[] {
  let index = 0;
  return normalizeLine(line).flatMap((points) => {
    const placements = createPlacementsForSegment(map, points, placement, index);
    index += placements.length;
    return placements;
  });
}

function normalizeLine(line: LineString | MultiLineString): CoordinateSet[] {
  if (line.type === 'LineString') {
    return [line.coordinates.map(positionToLngLat)];
  }
  return line.coordinates.map((segment) => segment.map(positionToLngLat));
}

function positionToLngLat(position: Position): NormalizedLngLat {
  return toLngLat([position[0], position[1]]);
}

function createPlacementsForSegment(
  map: Map,
  points: CoordinateSet,
  placement: LinePlacementOptions,
  startIndex: number,
): LinePlacement[] {
  if (points.length < 2) {
    return [];
  }

  const trimmedPoints = applyOffsets(map, points, placement.offsets);
  if (trimmedPoints.length < 2) {
    return [];
  }

  const totalLength = computeTotalLength(trimmedPoints);
  if (totalLength === 0) {
    return [];
  }

  const averageSegmentLength = totalLength / Math.max(trimmedPoints.length - 1, 1);

  if (placement.frequency === 'single') {
    return createSingleSegmentPlacements({
      map,
      points: trimmedPoints,
      placement,
      startIndex,
      totalLength,
      averageSegmentLength,
    });
  }

  const samples = derivePlacementSamples(map, trimmedPoints, totalLength, placement.frequency);

  return samples.map((sample, sampleIndex) => ({
    index: startIndex + sampleIndex,
    point: sample.point,
    bearing: sample.bearing,
    segmentIndex: sample.segmentIndex,
    fraction: sample.fraction,
    totalLength,
    averageSegmentLength,
  }));
}

function applyOffsets(
  map: Map,
  points: CoordinateSet,
  offsets: LinePlacementOptions['offsets'],
): CoordinateSet {
  const startOffsetMeters = convertOffsetToMeters(map, offsets?.start, points[0]);
  const endOffsetMeters = convertOffsetToMeters(map, offsets?.end, points[points.length - 1]);
  return trimEnd(trimStart(points, startOffsetMeters), endOffsetMeters);
}

function convertOffsetToMeters(
  map: Map,
  value: ArrowOffsetUnit | undefined,
  reference: NormalizedLngLat,
): number {
  if (!value) {
    return 0;
  }
  if (isInMeters(value)) {
    return finiteOrZero(parseNumeric(value));
  }
  if (isInPixels(value)) {
    return finiteOrZero(pixelsToMeters(map, finiteOrZero(parseNumeric(value)), reference));
  }
  return 0;
}

function trimStart(points: CoordinateSet, offsetMeters: number): CoordinateSet {
  if (offsetMeters <= 0) {
    return points.slice();
  }

  const trimmed = points.slice();
  let remaining = offsetMeters;

  while (trimmed.length > 1 && remaining > 0) {
    const segmentLength = distanceBetween(trimmed[0], trimmed[1]);
    if (segmentLength === 0) {
      trimmed.shift();
      continue;
    }

    if (segmentLength <= remaining) {
      remaining -= segmentLength;
      trimmed.shift();
    } else {
      trimmed[0] = destinationPoint(trimmed[0], bearingBetween(trimmed[0], trimmed[1]), remaining);
      remaining = 0;
    }
  }

  return trimmed;
}

function trimEnd(points: CoordinateSet, offsetMeters: number): CoordinateSet {
  if (offsetMeters <= 0) {
    return points.slice();
  }

  const trimmed = points.slice();
  let remaining = offsetMeters;

  while (trimmed.length > 1 && remaining > 0) {
    const last = trimmed.length - 1;
    const segmentLength = distanceBetween(trimmed[last - 1], trimmed[last]);
    if (segmentLength === 0) {
      trimmed.pop();
      continue;
    }

    if (segmentLength <= remaining) {
      remaining -= segmentLength;
      trimmed.pop();
    } else {
      trimmed[last] = destinationPoint(
        trimmed[last],
        bearingBetween(trimmed[last], trimmed[last - 1]),
        remaining,
      );
      remaining = 0;
    }
  }

  return trimmed;
}

function computeTotalLength(points: CoordinateSet): number {
  let total = 0;
  for (let index = 0; index < points.length - 1; index += 1) {
    total += distanceBetween(points[index], points[index + 1]);
  }
  return total;
}

type PlacementSample = {
  point: NormalizedLngLat;
  bearing: number;
  segmentIndex: number;
  fraction: number;
};

function derivePlacementSamples(
  map: Map,
  points: CoordinateSet,
  totalLength: number,
  frequency: LinePlacementFrequency = DEFAULT_FREQUENCY,
): PlacementSample[] {
  if (frequency === 'single') {
    return [];
  }

  if (frequency === 'allvertices') {
    return points.slice(1).map((point, index) => ({
      point,
      bearing: bearingBetween(points[index], point),
      segmentIndex: index,
      fraction: 1,
    }));
  }

  if (frequency === 'endonly') {
    const lastIndex = points.length - 1;
    return [
      {
        point: points[lastIndex],
        bearing: bearingBetween(points[lastIndex - 1], points[lastIndex]),
        segmentIndex: lastIndex - 1,
        fraction: 1,
      },
    ];
  }

  const count = resolvePlacementCount(map, points, totalLength, frequency);
  if (count <= 0) {
    return [];
  }

  const spacing = 1 / count;
  const samples: PlacementSample[] = [];
  for (let index = 0; index < count; index += 1) {
    const result = interpolateOnLine(points, spacing * (index + 1));
    if (!result) {
      continue;
    }
    const nextIndex = Math.min(result.predecessor + 1, points.length - 1);
    samples.push({
      point: result.latLng,
      bearing: bearingBetween(points[result.predecessor], points[nextIndex]),
      segmentIndex: result.predecessor,
      fraction: result.fraction,
    });
  }
  return samples;
}

function resolvePlacementCount(
  map: Map,
  points: CoordinateSet,
  totalLength: number,
  frequency: LinePlacementFrequency,
): number {
  if (typeof frequency === 'number') {
    if (!Number.isFinite(frequency)) {
      return 0;
    }
    return Math.max(0, Math.floor(frequency));
  }
  if (isInMeters(frequency)) {
    const meters = finiteOrZero(parseNumeric(frequency));
    if (meters <= 0) {
      return 0;
    }
    return Math.floor(totalLength / meters);
  }
  if (isInPixels(frequency)) {
    const pixels = finiteOrZero(parseNumeric(frequency));
    if (pixels <= 0) {
      return 0;
    }
    const meters = finiteOrZero(pixelsToMeters(map, pixels, points[0]));
    if (meters <= 0) {
      return 0;
    }
    return Math.floor(totalLength / meters);
  }
  return 0;
}

type SegmentTarget = {
  start: NormalizedLngLat;
  end: NormalizedLngLat;
  index: number;
};

type CreateSingleSegmentPlacementOptions = {
  map: Map;
  points: CoordinateSet;
  placement: LinePlacementOptions;
  startIndex: number;
  totalLength: number;
  averageSegmentLength: number;
};

function createSingleSegmentPlacements({
  map,
  points,
  placement,
  startIndex,
  totalLength,
  averageSegmentLength,
}: CreateSingleSegmentPlacementOptions): LinePlacement[] {
  const segments = points.slice(0, -1).map((start, index) => ({
    start,
    end: points[index + 1],
    index,
  }));
  const selectedSegments = selectSegments(segments, placement.segment ?? 'middle');

  return selectedSegments.flatMap((segment, placementIndex) => {
    const startPoint = map.project(segment.start);
    const endPoint = map.project(segment.end);
    const dx = endPoint.x - startPoint.x;
    const dy = endPoint.y - startPoint.y;
    const projectedLength = Math.hypot(dx, dy);

    if (projectedLength === 0 || distanceBetween(segment.start, segment.end) === 0) {
      return [];
    }

    const offsetPercent = finiteOrZero(placement.offsetPercent);
    const fraction = clamp(
      resolveAnchorFraction(placement.anchor ?? 'middle') + offsetPercent / 100,
      0,
      1,
    );
    const baseX = startPoint.x + dx * fraction;
    const baseY = startPoint.y + dy * fraction;
    const lineOffsetPx = finiteOrZero(placement.lineOffsetPx);
    const normalX = -dy / projectedLength;
    const normalY = dx / projectedLength;
    const projectedPoint = [baseX + normalX * lineOffsetPx, baseY + normalY * lineOffsetPx] as [
      number,
      number,
    ];
    const unprojectedPoint = map.unproject(projectedPoint);

    return [
      {
        index: startIndex + placementIndex,
        point: toLngLat([unprojectedPoint.lng, unprojectedPoint.lat]),
        bearing: bearingBetween(segment.start, segment.end),
        segmentIndex: segment.index,
        fraction,
        totalLength,
        averageSegmentLength,
      },
    ];
  });
}

function selectSegments(
  segments: SegmentTarget[],
  target: LineSymbolSegmentTarget,
): SegmentTarget[] {
  if (target === 'all') {
    return segments;
  }

  if (segments.length === 0) {
    return [];
  }

  if (target === 'first') {
    return [segments[0]];
  }

  if (target === 'last') {
    return [segments[segments.length - 1]];
  }

  return [segments[Math.floor((segments.length - 1) / 2)]];
}

function resolveAnchorFraction(anchor: LineSymbolAnchor): number {
  if (anchor === 'front') {
    return 0;
  }
  if (anchor === 'back') {
    return 1;
  }
  return 0.5;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function finiteOrZero(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

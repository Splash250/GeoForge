import type {
  ArrowheadFeatureCollection,
  ArrowheadOptions,
  ArrowheadsGeneratorConfig,
  ArrowOffsetUnit,
  ArrowSizeUnit,
  InterpolatedPoint,
} from './types';
import {
  bearingBetween,
  destinationPoint,
  distanceBetween,
  interpolateOnLine,
  pixelsToMeters,
  toLngLat,
  type NormalizedLngLat,
} from './utils/geometry.ts';
import { isInMeters, isInPercent, isInPixels, parseNumeric } from './utils/units.ts';
import { definedProps, modulus } from './utils/misc.ts';
import type { Feature, LineString, MultiLineString, Position } from 'geojson';

const DEFAULT_ARROWHEAD_OPTIONS: Required<
  Pick<ArrowheadOptions, 'yawn' | 'size' | 'frequency' | 'proportionalToTotal' | 'fill'>
> = {
  yawn: 60,
  size: '8px',
  frequency: '40px',
  proportionalToTotal: false,
  fill: false,
};

type CoordinateSet = NormalizedLngLat[];

function positionToLngLat(position: Position): NormalizedLngLat {
  return toLngLat([position[0], position[1]]);
}

export function generateArrowheads({
  map,
  line,
  options,
}: ArrowheadsGeneratorConfig): ArrowheadFeatureCollection {
  const resolvedOptions: ArrowheadOptions = {
    ...DEFAULT_ARROWHEAD_OPTIONS,
    ...definedProps(options),
  };

  const coordinateSets = normalizeLine(line);
  const features = coordinateSets.flatMap((coords) =>
    buildArrowheadsForSegment(map, coords, resolvedOptions),
  );

  return {
    type: 'FeatureCollection',
    features,
  };
}

function normalizeLine(line: LineString | MultiLineString): CoordinateSet[] {
  if (line.type === 'LineString') {
    return [line.coordinates.map(positionToLngLat)];
  }
  return line.coordinates.map((segment) => segment.map(positionToLngLat));
}

function buildArrowheadsForSegment(
  map: ArrowheadsGeneratorConfig['map'],
  points: CoordinateSet,
  options: ArrowheadOptions,
) {
  if (points.length < 2) {
    return [];
  }

  const trimmedPoints = applyOffsets(map, points, options.offsets);
  if (trimmedPoints.length < 2) {
    return [];
  }

  const totalLength = computeTotalLength(trimmedPoints);
  if (totalLength === 0) {
    return [];
  }

  const { placements, bearings } = derivePlacements(map, trimmedPoints, totalLength, options);

  const averageSegmentLength = totalLength / Math.max(trimmedPoints.length - 1, 1);

  return placements
    .map((placement, index) =>
      buildArrowheadFeature({
        map,
        point: placement,
        bearing: bearings[index],
        totalLength,
        averageSegmentLength,
        index,
        options,
      }),
    )
    .filter((feature): feature is Feature => Boolean(feature));
}

function applyOffsets(
  map: ArrowheadsGeneratorConfig['map'],
  points: CoordinateSet,
  offsets: ArrowheadOptions['offsets'],
): CoordinateSet {
  const startOffsetMeters = convertOffsetToMeters(map, offsets?.start, points[0]);
  const endOffsetMeters = convertOffsetToMeters(map, offsets?.end, points[points.length - 1]);

  let trimmed = trimStart(points, startOffsetMeters);
  trimmed = trimEnd(trimmed, endOffsetMeters);

  return trimmed;
}

function convertOffsetToMeters(
  map: ArrowheadsGeneratorConfig['map'],
  value: ArrowOffsetUnit | undefined,
  reference: NormalizedLngLat,
): number {
  if (!value) {
    return 0;
  }
  if (isInMeters(value)) {
    return parseNumeric(value);
  }
  if (isInPixels(value)) {
    return pixelsToMeters(map, parseNumeric(value), reference);
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
      const bearing = bearingBetween(trimmed[0], trimmed[1]);
      const newStart = destinationPoint(trimmed[0], bearing, remaining);
      trimmed[0] = newStart;
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
      const bearing = bearingBetween(trimmed[last], trimmed[last - 1]);
      const newEnd = destinationPoint(trimmed[last], bearing, remaining);
      trimmed[last] = newEnd;
      remaining = 0;
    }
  }

  return trimmed;
}

function computeTotalLength(points: CoordinateSet): number {
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    total += distanceBetween(points[i], points[i + 1]);
  }
  return total;
}

function derivePlacements(
  map: ArrowheadsGeneratorConfig['map'],
  points: CoordinateSet,
  totalLength: number,
  options: ArrowheadOptions,
): { placements: NormalizedLngLat[]; bearings: number[] } {
  const frequency = options.frequency ?? DEFAULT_ARROWHEAD_OPTIONS.frequency;
  const placements: NormalizedLngLat[] = [];
  const bearings: number[] = [];

  if (frequency === 'allvertices') {
    for (let i = 1; i < points.length; i++) {
      placements.push(points[i]);
      const bearing = bearingBetween(points[modulus(i - 1, points.length)], points[i]);
      bearings.push(bearing + 180);
    }
    return { placements, bearings };
  }

  if (frequency === 'endonly') {
    const lastIndex = points.length - 1;
    placements.push(points[lastIndex]);
    const bearing = bearingBetween(points[lastIndex - 1], points[lastIndex]);
    bearings.push(bearing + 180);
    return { placements, bearings };
  }

  if (typeof frequency === 'number' && frequency > 0) {
    const spacing = 1 / frequency;
    return interpolatePlacements(points, spacing, frequency);
  }

  if (isInMeters(frequency)) {
    const meters = parseNumeric(frequency);
    const spacing = meters / totalLength;
    if (spacing <= 0) {
      return { placements, bearings };
    }
    const count = Math.floor(1 / spacing);
    if (count <= 0) {
      return { placements, bearings };
    }
    const normalizedSpacing = 1 / count;
    return interpolatePlacements(points, normalizedSpacing, count);
  }

  if (isInPixels(frequency)) {
    const meters = pixelsToMeters(map, parseNumeric(frequency), points[0]);
    const spacing = meters / totalLength;
    if (spacing <= 0) {
      return { placements, bearings };
    }
    const count = Math.floor(1 / spacing);
    if (count <= 0) {
      return { placements, bearings };
    }
    const normalizedSpacing = 1 / count;
    return interpolatePlacements(points, normalizedSpacing, count);
  }

  return { placements, bearings };
}

function interpolatePlacements(
  points: CoordinateSet,
  spacing: number,
  count: number,
): { placements: NormalizedLngLat[]; bearings: number[] } {
  const placements: NormalizedLngLat[] = [];
  const bearings: number[] = [];

  const samples: InterpolatedPoint[] = [];

  for (let i = 0; i < count; i++) {
    const result = interpolateOnLine(points, spacing * (i + 1));
    if (result) {
      samples.push(result);
      placements.push(result.latLng);
    }
  }

  for (let i = 0; i < samples.length; i++) {
    const predecessorIndex = samples[i].predecessor;
    const nextIndex = Math.min(predecessorIndex + 1, points.length - 1);
    const bearing = bearingBetween(points[predecessorIndex], points[nextIndex]);
    bearings.push(bearing);
  }

  return { placements, bearings };
}

type ArrowheadFeatureParams = {
  map: ArrowheadsGeneratorConfig['map'];
  point: NormalizedLngLat;
  bearing: number;
  totalLength: number;
  averageSegmentLength: number;
  index: number;
  options: ArrowheadOptions;
};

function buildArrowheadFeature({
  map,
  point,
  bearing,
  totalLength,
  averageSegmentLength,
  index,
  options,
}: ArrowheadFeatureParams): Feature | null {
  const { perArrowheadOptions, ...globalOptions } = options;
  const localOverrides = perArrowheadOptions ? definedProps(perArrowheadOptions(index) ?? {}) : {};

  const resolvedLocalOptions = definedProps({
    ...globalOptions,
    ...localOverrides,
  });

  const { color, fillColor, weight, opacity, fillOpacity } = resolvedLocalOptions;
  const fillFlag = resolvedLocalOptions.fill ?? DEFAULT_ARROWHEAD_OPTIONS.fill;

  const yawn = resolvedLocalOptions.yawn ?? DEFAULT_ARROWHEAD_OPTIONS.yawn;
  const sizeUnit = resolvedLocalOptions.size ?? DEFAULT_ARROWHEAD_OPTIONS.size;

  const sizeMeters = resolveArrowheadSize({
    map,
    sizeUnit,
    point,
    totalLength,
    averageSegmentLength,
    options: resolvedLocalOptions,
  });

  if (sizeMeters <= 0) {
    return null;
  }

  const orientedBearing = (bearing + 180) % 360;
  const leftWing = destinationPoint(point, orientedBearing - yawn / 2, sizeMeters);
  const rightWing = destinationPoint(point, orientedBearing + yawn / 2, sizeMeters);

  const baseCoordinates: Position[] = [
    [leftWing.lng, leftWing.lat],
    [point.lng, point.lat],
    [rightWing.lng, rightWing.lat],
  ];

  const properties = definedProps({
    index,
    fill: fillFlag,
    color,
    fillColor,
    weight,
    opacity,
    fillOpacity,
    yawn,
    size: sizeUnit,
  });

  if (fillFlag) {
    return {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[...baseCoordinates, baseCoordinates[0]]],
      },
      properties,
    };
  }

  return {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: baseCoordinates,
    },
    properties,
  };
}

type ResolveSizeParams = {
  map: ArrowheadsGeneratorConfig['map'];
  sizeUnit: ArrowSizeUnit;
  point: NormalizedLngLat;
  totalLength: number;
  averageSegmentLength: number;
  options: ArrowheadOptions;
};

function resolveArrowheadSize({
  map,
  sizeUnit,
  point,
  totalLength,
  averageSegmentLength,
  options,
}: ResolveSizeParams): number {
  if (isInMeters(sizeUnit)) {
    return parseNumeric(sizeUnit);
  }

  if (isInPercent(sizeUnit)) {
    const percent = parseNumeric(sizeUnit);
    if (options.frequency === 'endonly' && options.proportionalToTotal) {
      return (totalLength * percent) / 100;
    }
    return (averageSegmentLength * percent) / 100;
  }

  if (isInPixels(sizeUnit)) {
    return pixelsToMeters(map, parseNumeric(sizeUnit), point);
  }

  return 0;
}

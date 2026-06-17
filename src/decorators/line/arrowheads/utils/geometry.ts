import type { LngLatLike, Map } from 'maplibre-gl';

const EARTH_RADIUS = 6371000; // metres

export type NormalizedLngLat = { lng: number; lat: number };

type LngLatObject = { lat: number; lng: number } | { lat: number; lon: number };

function isLngLatObject(value: LngLatLike): value is LngLatObject {
  return (
    !Array.isArray(value) &&
    typeof value === 'object' &&
    value !== null &&
    'lat' in value &&
    ('lng' in value || 'lon' in value)
  );
}

export function toLngLat(value: LngLatLike): NormalizedLngLat {
  if (Array.isArray(value)) {
    return { lng: value[0], lat: value[1] };
  }

  if (isLngLatObject(value)) {
    return {
      lng: 'lng' in value ? value.lng : value.lon,
      lat: value.lat,
    };
  }

  // maplibre-gl LngLat instance shape
  return { lng: (value as { lng: number }).lng, lat: (value as { lat: number }).lat };
}

export function distanceBetween(a: LngLatLike, b: LngLatLike): number {
  const pointA = toLngLat(a);
  const pointB = toLngLat(b);

  const lat1 = degToRad(pointA.lat);
  const lat2 = degToRad(pointB.lat);
  const deltaLat = lat2 - lat1;
  const deltaLng = degToRad(pointB.lng - pointA.lng);

  const sinDeltaLat = Math.sin(deltaLat / 2);
  const sinDeltaLng = Math.sin(deltaLng / 2);

  const aTerm =
    sinDeltaLat * sinDeltaLat + Math.cos(lat1) * Math.cos(lat2) * sinDeltaLng * sinDeltaLng;

  const c = 2 * Math.atan2(Math.sqrt(aTerm), Math.sqrt(1 - aTerm));

  return EARTH_RADIUS * c;
}

export function bearingBetween(a: LngLatLike, b: LngLatLike): number {
  const pointA = toLngLat(a);
  const pointB = toLngLat(b);

  const lat1 = degToRad(pointA.lat);
  const lat2 = degToRad(pointB.lat);
  const deltaLng = degToRad(pointB.lng - pointA.lng);

  const y = Math.sin(deltaLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng);
  const theta = Math.atan2(y, x);
  return (radToDeg(theta) + 360) % 360;
}

export function destinationPoint(
  start: LngLatLike,
  bearingDegrees: number,
  distanceMeters: number,
): NormalizedLngLat {
  const startPoint = toLngLat(start);

  const angularDistance = distanceMeters / EARTH_RADIUS;
  const bearingRad = degToRad(bearingDegrees);

  const lat1 = degToRad(startPoint.lat);
  const lng1 = degToRad(startPoint.lng);

  const sinLat1 = Math.sin(lat1);
  const cosLat1 = Math.cos(lat1);

  const sinAngular = Math.sin(angularDistance);
  const cosAngular = Math.cos(angularDistance);

  const sinLat2 = sinLat1 * cosAngular + cosLat1 * sinAngular * Math.cos(bearingRad);
  const lat2 = Math.asin(sinLat2);

  const y = Math.sin(bearingRad) * sinAngular * cosLat1;
  const x = cosAngular - sinLat1 * sinLat2;
  const lng2 = lng1 + Math.atan2(y, x);

  return {
    lng: radToDeg(normalizeLongitude(lng2)),
    lat: radToDeg(lat2),
  };
}

export function interpolateOnLine(
  points: LngLatLike[],
  t: number,
): { latLng: NormalizedLngLat; predecessor: number; fraction: number } | null {
  if (points.length < 2) {
    return null;
  }

  const segments = [];
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const segmentLength = distanceBetween(points[i], points[i + 1]);
    segments.push(segmentLength);
    total += segmentLength;
  }

  if (total === 0) {
    return null;
  }

  const target = total * t;
  let accumulated = 0;

  for (let i = 0; i < segments.length; i++) {
    const segmentLength = segments[i];
    if (accumulated + segmentLength >= target) {
      const remainder = target - accumulated;
      const ratio = segmentLength === 0 ? 0 : remainder / segmentLength;

      const start = toLngLat(points[i]);
      const end = toLngLat(points[i + 1]);

      const lat = (1 - ratio) * start.lat + ratio * end.lat; // simple interpolation
      const lng = (1 - ratio) * start.lng + ratio * end.lng; // naive but acceptable for short segments

      return {
        latLng: { lng, lat },
        predecessor: i,
        fraction: ratio,
      };
    }
    accumulated += segmentLength;
  }

  return {
    latLng: toLngLat(points[points.length - 1]),
    predecessor: points.length - 2,
    fraction: 1,
  };
}

export function pixelsToMeters(map: Map, pixels: number, reference: LngLatLike): number {
  const anchorCandidate = map.getCenter?.();
  const anchor = anchorCandidate ? toLngLat(anchorCandidate) : toLngLat(reference);

  const origin = map.project(anchor);
  const displaced = map.unproject([origin.x + pixels, origin.y]);
  return distanceBetween(anchor, displaced);
}

function degToRad(value: number): number {
  return (value * Math.PI) / 180;
}

function radToDeg(value: number): number {
  return (value * 180) / Math.PI;
}

function normalizeLongitude(lngRad: number): number {
  const pi = Math.PI;
  return ((lngRad + pi) % (2 * pi)) - pi;
}

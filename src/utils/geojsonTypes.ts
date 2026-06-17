import type {
  Feature,
  Geometry,
  LineString,
  MultiLineString,
  MultiPoint,
  MultiPolygon,
  Point,
  Polygon,
} from 'geojson';

export const pointBasedGeometryType: Array<Geometry['type']> = ['Point', 'MultiPoint'];
export type PointBasedGeometryType = (typeof pointBasedGeometryType)[number];

export const lineBasedGeometryType: Array<Geometry['type']> = [
  'LineString',
  'MultiLineString',
  'Polygon',
  'MultiPolygon',
];
export type LineBasedGeometryType = (typeof lineBasedGeometryType)[number];

export const isPointBasedGeoJsonFeature = (
  feature: Feature,
): feature is Feature<Point | MultiPoint> => {
  return pointBasedGeometryType.includes(feature.geometry.type);
};

export const isLineBasedGeoJsonFeature = (
  feature: Feature,
): feature is Feature<LineString | MultiLineString | Polygon | MultiPolygon> => {
  return lineBasedGeometryType.includes(feature.geometry.type);
};

import type { FeatureCollection, LineString, MultiLineString } from 'geojson';
import type { LngLatLike, Map } from 'maplibre-gl';

export type ArrowSizeUnit = `${number}m` | `${number}%` | `${number}px`;

export type ArrowFrequencyUnit = number | `${number}m` | `${number}px` | 'allvertices' | 'endonly';

export type ArrowOffsetUnit = `${number}m` | `${number}px`;

export interface BaseArrowheadOptions {
  yawn?: number;
  size?: ArrowSizeUnit;
  fill?: boolean;
  color?: string;
  fillColor?: string;
  weight?: number;
  opacity?: number;
  fillOpacity?: number;
}

export interface ArrowheadOptions extends BaseArrowheadOptions {
  frequency?: ArrowFrequencyUnit;
  proportionalToTotal?: boolean;
  offsets?: {
    start?: ArrowOffsetUnit;
    end?: ArrowOffsetUnit;
  };
  perArrowheadOptions?: (
    index: number,
  ) => Partial<BaseArrowheadOptions & { size?: ArrowSizeUnit; yawn?: number }>;
}

export interface ArrowheadsGeneratorConfig {
  map: Map;
  line: LineString | MultiLineString;
  options: ArrowheadOptions;
}

export type ArrowheadFeatureCollection = FeatureCollection;

export interface InterpolatedPoint {
  latLng: LngLatLike;
  predecessor: number;
  fraction: number;
}

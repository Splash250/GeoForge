import { Geoman, type MapInstanceWithGeoman } from '@/main.ts';
import type * as geojsonUtils from '@/utils/geojson.ts';
export {
  isLineBasedGeoJsonFeature,
  isPointBasedGeoJsonFeature,
  lineBasedGeometryType,
  pointBasedGeometryType,
  type LineBasedGeometryType,
  type PointBasedGeometryType,
} from '@/utils/geojsonTypes.ts';

// Base interface for all event results
export interface BaseEventResult {
  listenerIsAttached: boolean;
  shape?: string | null;
  feature?: boolean;
  features?: boolean;
  originalFeature?: boolean;
  originalFeatures?: boolean;
  featureId?: number | string | undefined;
}

// Define a type for window.customData that allows for any property
// but still provides type checking for known properties
export interface CustomData {
  rawEventResults?: { [key: string]: unknown };
  eventResults?: { [key: string]: BaseEventResult };
  map?: MapInstanceWithGeoman;
}

declare global {
  interface Window {
    geoman: Geoman;
    customData: CustomData;
    geomanUtils: typeof geojsonUtils;
    turf?: {
      bbox?: (geoJson: unknown) => [number, number, number, number];
    };
  }
}

export const pointBasedFeatures = ['marker', 'circle_marker', 'text_marker'];
export type PointBasedFeature = (typeof pointBasedFeatures)[number];

export const lineBasedFeatures = ['circle', 'line', 'rectangle', 'polygon'];
export type LineBasedFeature = (typeof lineBasedFeatures)[number];

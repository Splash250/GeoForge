# GeoForge Features API

`gm.features` manages all geometries stored in GeoForge. Access it directly from the `GeoForge` instance after initialization.

```ts
import { GeoForge } from 'maplibre-geoforge';

const gm = new GeoForge(map, options);
const features = gm.features;
```

## Iteration

| Method | Returns | Description |
|--------|---------|-------------|
| `forEach((featureData, id, store) => void)` | `void` | Iterate over every feature in the main source. |

## Feature Management

| Method | Returns | Description |
|--------|---------|-------------|
| `add(featureData: FeatureData)` | `void` | Add a feature to the store. |
| `delete(featureData: FeatureData)` | `void` | Remove a feature from the store. |
| `has(sourceName: FeatureSourceName, featureId: FeatureId)` | `boolean` | Check if a feature exists in a source. |
| `get(sourceName: FeatureSourceName, featureId: FeatureId)` | `FeatureData \| null` | Retrieve a feature by id. |

## GeoJSON Operations

| Method | Returns | Description |
|--------|---------|-------------|
| `importGeoJson(geoJson)` | `{ stats: { total: number; success: number; failed: number; }; addedFeatures: Array<FeatureData>; }` | Import features from GeoJSON. |
| `exportGeoJson()` | `GeoJsonShapeFeatureCollection` | Export all features as a FeatureCollection. |
| `getSourceGeoJson(sourceName)` | `GeoJsonShapeFeatureCollection` | Export features from a specific source. |
| `setSourceGeoJson({ geoJson, sourceName })` | `void` | Replace a source with GeoJSON data. |

## Feature Creation

| Method | Returns | Description |
|--------|---------|-------------|
| `createFeature({ featureId, shapeGeoJson, parent, sourceName, imported })` | `FeatureData \| null` | Create a feature from GeoJSON. |
| `addGeoJsonFeature({ shapeGeoJson, sourceName, defaultSource })` | `FeatureData \| null` | Add a single GeoJSON feature. |

## Queries

| Method | Returns | Description |
|--------|---------|-------------|
| `getFeatureByMouseEvent({ event, sourceNames })` | `FeatureData \| null` | Feature at the pointer location. |
| `getFeaturesByGeoJsonBounds({ geoJson, sourceNames })` | `Array<FeatureData>` | Features intersecting a GeoJSON geometry. |
| `getFeaturesByScreenBounds({ bounds, sourceNames })` | `Array<FeatureData>` | Features within screen pixel bounds. |

## Source Management

| Method | Returns | Description |
|--------|---------|-------------|
| `setDefaultSourceName(sourceName)` | `void` | Change the default source for new features. |

## Marker Operations

| Method | Returns | Description |
|--------|---------|-------------|
| `createMarkerFeature({ type, coordinate, parentFeature, sourceName })` | `FeatureData \| null` | Create a new marker feature. |
| `updateMarkerFeaturePosition(markerFeatureData, coordinates)` | `void` | Move a marker feature. |

## Built-in Sources

- `gm_main`: permanent features.
- `gm_temporary`: temporary features during editing.
- `gm_standby`: standby storage.

```ts
type FeatureSourceName = 'gm_main' | 'gm_temporary' | 'gm_standby';
```

## Types

```ts
interface FeatureData {
  id: FeatureId;
  parent: FeatureData | null;
  shape: FeatureShape;
  markers: Map<MarkerId, MarkerData>;
  shapeProperties: FeatureShapeProperties;
  source: BaseSource;
  orders: FeatureOrders;
}
```

## Example Usage

```ts
const geoJson = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [0, 0] },
      properties: { shape: 'marker' },
    },
  ],
};

const result = gm.features.importGeoJson(geoJson);

gm.features.forEach(feature => {
  console.log(feature.id, feature.shape);
});

const exported = gm.features.exportGeoJson();

const bounds: [ScreenPoint, ScreenPoint] = [
  [0, 0],
  [100, 100],
];
const featuresInBounds = gm.features.getFeaturesByScreenBounds({
  bounds,
  sourceNames: ['gm_main'],
});
```

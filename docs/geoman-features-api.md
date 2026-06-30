# GeoForge Features API

`gm.features` manages all geometries stored in GeoForge. Access it directly from the `GeoForge` instance after initialization.

```ts
import { GeoForge } from 'maplibre-geoforge';

const gm = new GeoForge(map, options);
const features = gm.features;
```

## Iteration

| Method                                      | Returns | Description                                    |
| ------------------------------------------- | ------- | ---------------------------------------------- |
| `forEach((featureData, id, store) => void)` | `void`  | Iterate over every feature in the main source. |

## Feature Management

| Method                                                     | Returns               | Description                               |
| ---------------------------------------------------------- | --------------------- | ----------------------------------------- |
| `add(featureData: FeatureData)`                            | `void`                | Add a feature to the store.               |
| `delete(featureData: FeatureData, options?)`               | `void`                | Remove a feature from the store.          |
| `deleteAll(options?)`                                      | `void`                | Remove all features from the store.       |
| `deleteByOwner(ownerId: FeatureOwnerId, options?)`         | `GeomanFeatureRef[]`  | Remove all runtime features for an owner. |
| `getByOwner(ownerId: FeatureOwnerId)`                      | `FeatureData[]`       | Return runtime features for an owner.     |
| `has(sourceName: FeatureSourceName, featureId: FeatureId)` | `boolean`             | Check if a feature exists in a source.    |
| `get(sourceName: FeatureSourceName, featureId: FeatureId)` | `FeatureData \| null` | Retrieve a feature by id.                 |

## GeoJSON Operations

| Method                                      | Returns                                                                                              | Description                                 |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `importGeoJson(geoJson, options?)`          | `{ stats: { total: number; success: number; failed: number; }; addedFeatures: Array<FeatureData>; }` | Import features from GeoJSON.               |
| `importGeoJsonFeature(feature, options?)`   | `FeatureData \| null`                                                                                | Import one feature from GeoJSON.            |
| `exportGeoJson()`                           | `GeoJsonShapeFeatureCollection`                                                                      | Export all features as a FeatureCollection. |
| `getSourceGeoJson(sourceName)`              | `GeoJsonShapeFeatureCollection`                                                                      | Export features from a specific source.     |
| `setSourceGeoJson({ geoJson, sourceName })` | `void`                                                                                               | Replace a source with GeoJSON data.         |

### Owner-Scoped Imports

Pass `ownerId` when importing setup, preview, wizard, or demo data that should
be cleaned up as one group later.

```ts
const ownerId = 'route:network-preview';

gm.features.importGeoJson(networkPreview, { ownerId });

const livePreviewFeatures = gm.features.getByOwner(ownerId);

gm.features.deleteByOwner(ownerId);
```

`ownerId` is runtime metadata on `FeatureData`; it is not written into exported
GeoJSON properties.

### Operation-Level History Suppression

Feature import, delete, and update APIs record history by default. Pass
`history: false` to suppress history for one operation:

```ts
const result = gm.features.importGeoJson(networkPreview, {
  ownerId,
  history: false,
});

gm.features.delete(result.addedFeatures[0], { history: false });
gm.features.deleteByOwner(ownerId, { history: false });

const feature = result.addedFeatures[0];
feature.updateProperties({ status: 'preview' }, { history: false });
feature.updateGeometry(nextGeometry, { history: false });
```

Use `gm.history.suspend(...)` when suppressing history across a batch of mixed
operations.

## Feature Creation

| Method                                                                     | Returns               | Description                    |
| -------------------------------------------------------------------------- | --------------------- | ------------------------------ |
| `createFeature({ featureId, shapeGeoJson, parent, sourceName, imported })` | `FeatureData \| null` | Create a feature from GeoJSON. |
| `addGeoJsonFeature({ shapeGeoJson, sourceName, defaultSource })`           | `FeatureData \| null` | Add a single GeoJSON feature.  |

## Queries

| Method                                                 | Returns               | Description                               |
| ------------------------------------------------------ | --------------------- | ----------------------------------------- |
| `getFeatureByMouseEvent({ event, sourceNames })`       | `FeatureData \| null` | Feature at the pointer location.          |
| `getFeaturesByGeoJsonBounds({ geoJson, sourceNames })` | `Array<FeatureData>`  | Features intersecting a GeoJSON geometry. |
| `getFeaturesByScreenBounds({ bounds, sourceNames })`   | `Array<FeatureData>`  | Features within screen pixel bounds.      |

## Source Management

| Method                             | Returns | Description                                 |
| ---------------------------------- | ------- | ------------------------------------------- |
| `setDefaultSourceName(sourceName)` | `void`  | Change the default source for new features. |

## Marker Operations

| Method                                                                 | Returns               | Description                  |
| ---------------------------------------------------------------------- | --------------------- | ---------------------------- |
| `createMarkerFeature({ type, coordinate, parentFeature, sourceName })` | `FeatureData \| null` | Create a new marker feature. |
| `updateMarkerFeaturePosition(markerFeatureData, coordinates)`          | `void`                | Move a marker feature.       |

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

gm.features.forEach((feature) => {
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

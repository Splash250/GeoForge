# Importing GeoJSON Data

Import existing GeoJSON into GeoForge with the feature and collection helpers. Use `gm.features.importGeoJsonFeature` for individual features and `gm.features.importGeoJson` for entire collections.

## Import a Single Feature

```ts
export const demoFeature: GeoJsonImportFeature = {
  type: 'Feature',
  properties: {
    shape: 'polygon',
  },
  geometry: {
    type: 'MultiPolygon',
    coordinates: [
      [
        [
          [-8.151855468751137, 49.446665467090696],
          // ...
        ],
      ],
    ],
  },
};

gm.features.importGeoJsonFeature(demoFeature);
```

`demoFeature` can be loaded from an API, file, or database before importing.

## Import a FeatureCollection

```ts
const featureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {
        shape: 'polygon',
      },
      geometry: {
        type: 'MultiPolygon',
        coordinates: [
          [
            [
              [-8.151855468751137, 49.446665467090696],
              // ...
            ],
          ],
        ],
      },
    },
    // Additional features...
  ],
};

// Add each feature individually
featureCollection.features.forEach(shapeGeoJson => {
  gm.features.importGeoJsonFeature(shapeGeoJson);
});

// Or import the entire collection
gm.features.importGeoJson(featureCollection);
```

## Full Demo

See the [examples](examples.md) for end-to-end implementations that load fixtures and import them with `gm.features.importGeoJsonFeature`.

## API Reference

```ts
interface GeoJsonImportFeature {
  type: 'Feature';
  properties: {
    shape: string;
    [key: string]: unknown;
  };
  geometry: {
    type: string;
    coordinates: any[];
  };
}
```

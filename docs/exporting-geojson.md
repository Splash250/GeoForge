# Exporting GeoJSON

Geoman exports features as GeoJSON FeatureCollections. Export everything at once or filter by source or shape type depending on your workflow.

## Export All Features

```ts
const allFeatures = gm.features.exportGeoJson();
```

This returns a GeoJSON `FeatureCollection` with every feature managed by the instance.

## GeoJSON Structure

```ts
interface GeoJsonShapeFeatureCollection {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    geometry: {
      type: string;
      coordinates: unknown[];
    };
    properties: {
      __gm_id?: FeatureId;
      shape: FeatureShape;
      center?: LngLat;
      text?: string;
    };
  }>;
}
```

## Complete Example

```ts
const gm = new Geoman(map);

// Draw some features...

// Export all features
const allFeatures = gm.features.exportGeoJson();
console.log('All features:', allFeatures);

function downloadGeoJson(
  geojson: GeoJsonShapeFeatureCollection,
  filename: string,
) {
  const blob = new Blob([JSON.stringify(geojson)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

downloadGeoJson(allFeatures, 'all-features.geojson');
```

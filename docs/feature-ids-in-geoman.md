# Feature IDs in Geoman

Geoman uses feature IDs to track geometry across imports, edits, and exports. Understanding how IDs are assigned keeps your data consistent.

## ID Handling on Import

### Using Existing IDs

```ts
const feature = {
  type: 'Feature',
  id: 'custom-123', // Geoman will reuse this id
  properties: {
    shape: 'polygon',
  },
  geometry: {
    type: 'Polygon',
    coordinates: [/* ... */],
  },
};

gm.features.importGeoJsonFeature({ shapeGeoJson: feature });
```

### Auto-generated IDs

```ts
const feature = {
  type: 'Feature',
  properties: {
    shape: 'polygon',
  },
  geometry: {
    type: 'Polygon',
    coordinates: [/* ... */],
  },
};

const imported = gm.features.importGeoJsonFeature({ shapeGeoJson: feature });
// imported.id is generated when no id is provided
```

## Exported IDs and `__gm_id`

When exported, every feature includes a `__gm_id` property. If the original feature had an `id`, `__gm_id` matches it; otherwise the generated id is used.

```ts
const exported = gm.features.exportGeoJson();

const feature = exported.features[0];
console.log(feature.id); // custom id if present
console.log(feature.properties.__gm_id); // Geoman id mirror
```

## Reimporting Exported Features

```ts
const exported = gm.features.exportGeoJson();

exported.features.forEach(feature => {
  gm.features.importGeoJsonFeature({ shapeGeoJson: feature });
  // __gm_id keeps the feature identity intact
});
```

## Auto-generated Sequence

```ts
const feature1 = gm.features.importGeoJsonFeature({
  shapeGeoJson: {
    type: 'Feature',
    properties: { shape: 'polygon' },
    geometry: { /* ... */ },
  },
});

const feature2 = gm.features.importGeoJsonFeature({
  shapeGeoJson: {
    type: 'Feature',
    properties: { shape: 'line' },
    geometry: { /* ... */ },
  },
});

console.log(feature1.id); // '1', for example
console.log(feature2.id); // '2'
```

## Working with Feature IDs

### Type Definition

```ts
type FeatureId = string | number;
```

### Existence and Lookup

```ts
const hasFeature = gm.features.has('gm_main', 'custom-123');
const feature = gm.features.get('gm_main', 'custom-123');
```

### Iterating Features

```ts
gm.features.forEach((feature, id) => {
  console.log('Feature ID:', id);
  console.log('Feature:', feature);
});

const filterFn = (feature: FeatureData) => feature.shape === 'polygon';
const filteredIterator = gm.features.filteredForEach(filterFn);

filteredIterator((feature, id) => {
  console.log('Filtered ID:', id);
});
```

## Best Practices

- **Consistent schema**: keep ids predictable.

  ```ts
  const features = [
    {
      type: 'Feature',
      id: 'polygon-001',
      properties: { shape: 'polygon' },
      geometry: { /* ... */ },
    },
    {
      type: 'Feature',
      id: 'polygon-002',
      properties: { shape: 'polygon' },
      geometry: { /* ... */ },
    },
  ];
  ```

- **Preserve `__gm_id`** when exporting and reimporting.

  ```ts
  const exported = gm.features.exportGeoJson();
  // Persist exported somewhere safe

  const reimported = loadSavedFeatures();
  reimported.features.forEach(feature => {
    gm.features.importGeoJsonFeature({ shapeGeoJson: feature });
  });
  ```

- **Ensure uniqueness** before importing.

  ```ts
  const usedIds = new Set();

  features.forEach(feature => {
    if (usedIds.has(feature.id)) {
      throw new Error(`Duplicate id: ${feature.id}`);
    }
    usedIds.add(feature.id);
    gm.features.importGeoJsonFeature({ shapeGeoJson: feature });
  });
  ```

- **Stick to one id type** when possible.

  ```ts
  const stringIdFeature = { type: 'Feature', id: 'feature-123' };
  const numberIdFeature = { type: 'Feature', id: 123 };
  // Avoid mixing string and number ids unless required
  ```

## Error Handling

```ts
try {
  const feature = gm.features.get('gm_main', 'custom-123');

  if (!feature) {
    console.warn('Feature not found:', 'custom-123');
    return;
  }

  // Process feature...
} catch (error) {
  console.error('Error accessing feature:', error);
}
```

# Decorators

Line decorators render visual annotations on line features. New integrations
should prefer the high-level `geoman.decorators.lines` API and only use
`LineDecoratorManager` when the app needs direct ownership of the rendered
decorator sources.

## Geoman-owned line features

Use `geoman.decorators.lines.start(...)` when Geoman owns the line features.
The subsystem binds to Geoman create, edit, drag, remove, and render events and
keeps decorators synced from each line feature.

```ts
const geoman = new Geoman(map);

geoman.decorators.lines.start({
  sourceNames: ['gm_main'],
  resolveDecorators: (feature) => feature.properties?.decorators,
});
```

`resolveDecorators` returns line decorator definitions for each feature. The
feature is skipped when the callback returns `null`, `undefined`, or an empty
array. Use `sourceNames` when Geoman-managed decorator sync should read only a
specific set of Geoman sources.

## App-supplied features

Use `geoman.decorators.lines.syncFromFeatures(...)` when the app owns the
GeoJSON feature list and wants to push updates into Geoman's decorator renderer.

```ts
geoman.decorators.lines.syncFromFeatures(features, (feature) => {
  return feature.properties?.decorators;
});
```

For repeated manual syncs, configure resolvers once and call `sync()`.

```ts
geoman.decorators.lines.configureManualSync({
  resolveFeatures: () => features,
  resolveDecorators: (feature) => feature.properties?.decorators,
});

geoman.decorators.lines.sync();
```

## Low-level ownership

Use `LineDecoratorManager` directly only when the app owns the MapLibre sources,
feature lifecycle, and cleanup timing.

This manager is kept for advanced compatibility. New application code should use
`geoman.decorators.lines` unless it must manage decorator sources directly.

```ts
import { LineDecoratorManager } from '@sewergy/maplibre-geoman';

const manager = new LineDecoratorManager({ map });

manager.updateFromFeatures(features, (feature) => feature.properties?.decorators);
manager.destroy();
```

## Decorator options

Supported decorator kinds are `arrowhead`, `symbol`, and `text`. `symbol` and
`text` decorators support animation options through the `animation` property,
including `rotate`, `opacity`, `size`, `fontSize`, and `offset` animation
properties with CSS-like duration, delay, direction, easing, and iteration
settings.

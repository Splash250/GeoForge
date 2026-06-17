# Patch Log

GeoForge is a standalone MapLibre GL JS toolkit distributed as `maplibre-geoforge`.

## Local changes
- Forked package metadata (name, exports, local version).
- Type build tweaks: shared options moved to `src/config/options.ts` to avoid Vite type conflicts.
- Added `tsconfig.build.json` to isolate type generation from app/tooling configs.

## Line Decorators

GeoForge extends the Geoman-derived editing core with `src/decorators/line`.

- `LineDecoratorManager` is the public manager for line decorators.
- `arrowhead` decorators preserve the existing geometry-arrowhead behavior.
- `symbol` decorators render SVG/image-ready icons through MapLibre symbol layers.
- `text` decorators render stylable labels through MapLibre symbol text layers.
- `normalizeLineDecorators()` preserves legacy `feature.properties.arrowheads` while supporting `feature.properties.decorators`.
- The first editor UI adds one `symbol` decorator at a time to the selected line, using segment, anchor, percentage offset, and pixel line distance controls.
- The editor UI also adds one `text` decorator at a time with text content, size, color, halo, rotation mode, and the same placement controls.
- `/_line-decorator-playground` is a DEV-only playground for browser verification of SVG and text decorator placement.
- Text and symbol decorators support per-frame animation through the line decorator animation runner.

## Build
From the package root:

```sh
pnpm run build
```

This generates `dist/maplibre-geoforge.es.js`, `dist/maplibre-geoforge.umd.js`,
`dist/maplibre-geoforge.css`, and `dist/maplibre-geoforge.d.ts`.

## Upstream update policy
- Pull from upstream only for critical fixes or security issues.
- Rebase the fork onto the upstream commit, then rebuild and run editor smoke tests.

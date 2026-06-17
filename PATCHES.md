# Patch Log

This fork is used by the Sewergy frontend as `@sewergy/maplibre-geoman`.

## Local changes
- Forked package metadata (name, exports, local version).
- Type build tweaks: shared options moved to `src/config/options.ts` to avoid Vite type conflicts.
- Added `tsconfig.build.json` to isolate type generation from app/tooling configs.

## Line Decorators

Sewergy extends the local Geoman package with `src/decorators/line`.

- `LineDecoratorManager` is the public manager for line decorators.
- `arrowhead` decorators preserve the existing geometry-arrowhead behavior.
- `symbol` decorators render SVG/image-ready icons through MapLibre symbol layers.
- `text` decorators render stylable labels through MapLibre symbol text layers.
- `normalizeLineDecorators()` preserves legacy `feature.properties.arrowheads` while supporting `feature.properties.decorators`.
- The first editor UI adds one `symbol` decorator at a time to the selected line, using segment, anchor, percentage offset, and pixel line distance controls.
- The editor UI also adds one `text` decorator at a time with text content, size, color, halo, rotation mode, and the same placement controls.
- `/_line-decorator-playground` is a DEV-only playground for browser verification of SVG and text decorator placement.
- Animation config is typed but intentionally not rendered per-frame yet.

## Build
From `frontend/packages/maplibre-geoman`:

```sh
pnpm run build
```

This generates `dist/maplibre-geoman.es.js`, `dist/maplibre-geoman.umd.js`,
`dist/maplibre-geoman.css`, and `dist/maplibre-geoman.d.ts`.

## Upstream update policy
- Pull from upstream only for critical fixes or security issues.
- Rebase the fork onto the upstream commit, then rebuild and run editor smoke tests.

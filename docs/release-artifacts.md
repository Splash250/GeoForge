# Release Artifacts

GeoForge release builds publish compiled JavaScript, CSS, and type declaration artifacts from `dist/`. Sourcemaps are intentionally excluded from default production package builds and must be enabled explicitly when a maintainer needs them for release diagnostics.

## Sourcemaps

Production sourcemaps are off by default:

```powershell
pnpm run build
```

Enable sourcemaps only for an intentional diagnostic build:

```powershell
$env:GEOFORGE_BUILD_SOURCEMAPS='true'
pnpm run build
Remove-Item Env:\GEOFORGE_BUILD_SOURCEMAPS
```

Generated `.map` files are not included in the default bundle budget. When sourcemaps are enabled, the budget command reports their sizes as informational output so maintainers can notice unexpected map growth without blocking diagnostic builds.

## Bundle Budget

Run the bundle budget after a successful build:

```powershell
pnpm run build
pnpm run build:budget
```

The hard release limits are:

| Artifact          | File                            |           Limit |
| ----------------- | ------------------------------- | --------------: |
| ES bundle         | `dist/maplibre-geoforge.es.js`  | 1,250,000 bytes |
| UMD bundle        | `dist/maplibre-geoforge.umd.js` |   900,000 bytes |
| CSS               | `dist/maplibre-geoforge.css`    |    15,000 bytes |
| Type declarations | `dist/maplibre-geoforge.d.ts`   |   225,000 bytes |

The budget checker fails when a required artifact is missing or exceeds its hard limit. Update `scripts/check-bundle-budget.mjs` and this document together if a release intentionally changes the policy.

## Release Validation

Before publishing a release candidate, run:

```powershell
pnpm run build
pnpm run build:budget
pnpm run check
pnpm audit --prod
```

Validate sourcemap policy explicitly:

```powershell
Remove-Item -Recurse -Force dist
pnpm run build
Test-Path dist\maplibre-geoforge.es.js.map
```

The default sourcemap check should print `False`.

```powershell
Remove-Item -Recurse -Force dist
$env:GEOFORGE_BUILD_SOURCEMAPS='true'; pnpm run build; Remove-Item Env:\GEOFORGE_BUILD_SOURCEMAPS
Test-Path dist\maplibre-geoforge.es.js.map
```

The explicit sourcemap check should print `True`.

After this diagnostic check, restore the default release artifacts before packing or publishing:

```powershell
Remove-Item -Recurse -Force dist
pnpm run build
pnpm run build:budget
```

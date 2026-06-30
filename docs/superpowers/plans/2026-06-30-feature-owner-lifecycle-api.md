# Feature Owner Lifecycle API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add owner-scoped feature imports and cleanup so Demo Studio and external applications can stage setup, preview, or wizard data without storing every imported `FeatureData` reference for teardown.

**Architecture:** Extend the existing `Features` subsystem rather than adding a new top-level session namespace. Ownership is runtime metadata stored on `FeatureData`, forwarded from `importGeoJson(..., { ownerId })`, and queried or cleaned up through `geoForge.features.getByOwner(...)` and `geoForge.features.deleteByOwner(...)`.

**Audit findings addressed:** `Finding 2: Setup, teardown, and seeded-data lifecycle are app-owned everywhere`.

## Public API Contract

```ts
const ownerId = 'demo:network-preview';

geoForge.features.importGeoJson(sample, { ownerId });
geoForge.features.importGeoJsonFeature(feature, { ownerId });

const ownedFeatures = geoForge.features.getByOwner(ownerId);
const deletedRefs = geoForge.features.deleteByOwner(ownerId);
```

Behavior:

- `ownerId` is runtime metadata and is not exported into GeoJSON properties.
- `getByOwner(ownerId)` returns the current live `FeatureData` instances for that owner.
- `deleteByOwner(ownerId)` deletes only features with the matching owner and returns deleted `{ sourceName, featureId }` refs.
- Existing imports without `ownerId` keep the previous behavior.
- History suppression remains a separate audit item; callers can continue wrapping owner-scoped imports/deletes in `history.suspend(...)`.

## Tasks

- [x] Add owner metadata to `FeatureData` and `ImportGeoJsonOptions`.
- [x] Forward `ownerId` through `FeatureGeoJsonIO.importGeoJson(...)` and `importGeoJsonFeature(...)`.
- [x] Add `Features.getByOwner(...)` and `Features.deleteByOwner(...)`.
- [x] Add focused unit coverage in `tests/features/featureOwnership.test.ts`.
- [x] Extend `tests/features/featureGeoJsonIO.test.ts` for owner forwarding.
- [x] Migrate the Demo Studio geometry topology cleanup path to owner-scoped cleanup.
- [x] Document owner-scoped imports in `docs/geoman-features-api.md` and `docs/public-api-boundary.md`.

## Completion Evidence

- PASS: `pnpm exec vitest run tests/features/featureOwnership.test.ts tests/features/featureGeoJsonIO.test.ts tests/public-api/publicBarrel.test.ts tests/playground/geometryDemos.test.ts` - 17 tests.
- PASS: `pnpm run ts`.
- PASS: `pnpm run check` - formatter, lint, TypeScript, and 548 unit tests. Lint exits 0 with existing `@/utils/log` import-extension warnings.
- PASS: `pnpm run build` - Vite build and declaration bundling.
- PASS: `pnpm exec playwright test tests/smoke/@smoke.spec.ts tests/features/crud.spec.ts --workers=1 --reporter=list` - 25 tests.
- PASS: declaration bundle check with `rg -n "FeatureOwnerId|ownerId|getByOwner|deleteByOwner" dist/maplibre-geoforge.d.ts`.

## Remaining Risks

This slice intentionally does not add a full `geoForge.sessions` API. It removes one high-value cleanup pattern with a smaller compatible API. History operation options are still covered by the next audit finding.

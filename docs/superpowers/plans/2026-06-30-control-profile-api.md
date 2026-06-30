# Control Profile API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a stable `geoForge.control` profile API so applications can show workflow-specific controls without mutating `geoForge.options.controls` or manually refreshing the reactive controls panel.

**Architecture:** Add the public API to the existing `GMControl` subsystem in `src/core/controls/index.ts`, because Demo Studio already reaches `geoForge.control` and the audit explicitly prefers existing subsystems. The API is additive and keeps `geoForge.options.controls` as the backing state for compatibility. Demo Studio then calls `geoForge.control.applyProfile(...)` instead of directly mutating `uiEnabled` and calling `updateReactivePanel()`.

**Tech Stack:** TypeScript, Svelte, Vitest, Playwright, pnpm.

---

## Design Brief

**Audit findings addressed:** `Finding 1: Control profile configuration leaks internals`

**Current friction:** `examples/playground/src/demo-studio/map/controlProfiles.ts:46` iterates all control mode types, `examples/playground/src/demo-studio/map/controlProfiles.ts:59` mutates `control.uiEnabled`, `examples/playground/src/demo-studio/map/controlProfiles.ts:62` disables hidden active modes, and `examples/playground/src/demo-studio/map/controlProfiles.ts:67` calls `geoForge.control.updateReactivePanel()` manually.

**Target consumer API:**

```ts
geoForge.control.applyProfile({
  draw: ['marker', 'line', 'polygon'],
  edit: ['drag', 'change'],
  helper: ['snapping', 'zoom_to_features'],
  deactivateHidden: true,
});

geoForge.control.setModeVisibility('edit', 'cut', false, {
  deactivateIfActive: true,
});

const profile = geoForge.control.getProfile();
```

**Compatibility decision:** Existing `geoForge.options.controls`, `geoForge.options.enableMode(...)`, `geoForge.options.disableMode(...)`, and compatibility mode helpers keep working. The new API writes through the same control option objects and refreshes the reactive panel internally.

**Rejected alternatives:**

- `geoForge.controls.applyProfile(...)`: rejected because the current public instance exposes `control`, not `controls`.
- Demo-only wrapper around `applyDemoControlProfile(...)`: rejected because it leaves external consumers without a stable API.
- Replacing `geoForge.options.controls`: rejected because existing consumers may already mutate or inspect that structure.

**Demo Studio simplification target:** `examples/playground/src/demo-studio/map/controlProfiles.ts` no longer writes `control.uiEnabled` or calls `geoForge.control.updateReactivePanel()` directly.

**Test strategy:** Unit test `tests/controls/geomanControlProfiles.test.ts`; Playwright regression `tests/playground/demoMapLoad.test.ts`.

**Risk level:** `medium`; this touches control visibility and active mode deactivation, which affects interactive UI state.

## File Map

- Modify: `src/core/controls/index.ts` - define profile types and implement `applyProfile`, `setModeVisibility`, and `getProfile`.
- Modify: `examples/playground/src/demo-studio/map/controlProfiles.ts` - call the new public API from Demo Studio.
- Test: `tests/controls/geomanControlProfiles.test.ts` - unit coverage for profile application, granular visibility, active-mode deactivation, and snapshot reads.
- Existing test: `tests/playground/demoMapLoad.test.ts` - focused Demo Studio/controls smoke regression.
- Docs: `docs/public-api-boundary.md` - list the new stable control profile API.
- Docs: `docs/geoman-options-api.md` or `docs/geoman-instance-api.md` - add a short external-consumer snippet for control profiles.

## Public API Contract

Add these exported or public types in `src/core/controls/index.ts`:

```ts
export type GeomanControlProfile = Partial<Record<ModeType, readonly ModeName[]>> & {
  deactivateHidden?: boolean;
};

export type GeomanControlVisibilityOptions = {
  deactivateIfActive?: boolean;
};
```

Add these methods to `GMControl`:

```ts
applyProfile(profile: GeomanControlProfile): GeomanControlProfile;

setModeVisibility(
  modeType: ModeType,
  modeName: ModeName,
  visible: boolean,
  options?: GeomanControlVisibilityOptions,
): void;

getProfile(): Record<ModeType, ModeName[]>;
```

Behavior:

- `applyProfile(...)` treats omitted mode sections as empty visible sets.
- `applyProfile({ deactivateHidden: true })` disables an active mode when that mode is hidden.
- `applyProfile({ deactivateHidden: false })` hides an active control without disabling its active mode.
- `deactivateHidden` defaults to `true`, matching Demo Studio's current behavior.
- `setModeVisibility(...)` updates one control and refreshes the reactive panel.
- `setModeVisibility(..., { deactivateIfActive: true })` disables the active mode when hiding it.
- `getProfile()` returns currently visible mode names by mode type and does not expose mutable internal arrays.

## Tasks

### Task 1: Public API Contract And Unit Tests

**Files:**

- Create: `tests/controls/geomanControlProfiles.test.ts`
- Modify: `src/core/controls/index.ts`

- [x] **Step 1: Write failing API tests**

Create `tests/controls/geomanControlProfiles.test.ts` with Vitest tests that construct a small fake `Geoman` object and `GMControl`, then assert:

- `applyProfile({ draw: ['marker'], helper: ['zoom_to_features'] })` enables only those controls.
- `applyProfile(...)` calls `updateReactivePanel()` once.
- hidden active controls are disabled by default.
- hidden active controls stay active when `deactivateHidden: false`.
- `setModeVisibility('edit', 'cut', false, { deactivateIfActive: true })` hides and disables cut.
- `getProfile()` returns copies, so mutating returned arrays does not mutate control state.

Run: `pnpm exec vitest run tests/controls/geomanControlProfiles.test.ts`
Expected: FAIL because `applyProfile`, `setModeVisibility`, and `getProfile` do not exist.

- [x] **Step 2: Implement minimum API**

Modify `src/core/controls/index.ts` to add the public types and methods.

Run: `pnpm exec vitest run tests/controls/geomanControlProfiles.test.ts`
Expected: PASS.

- [x] **Step 3: Run focused control tests**

Run: `pnpm exec vitest run tests/controls`
Expected: PASS.

### Task 2: Demo Studio Migration

**Files:**

- Modify: `examples/playground/src/demo-studio/map/controlProfiles.ts`
- Existing test: `tests/playground/demoMapLoad.test.ts`

- [x] **Step 1: Replace direct mutation with public API**

Change `applyDemoControlProfile(...)` so it builds the existing per-category profile and calls:

```ts
geoForge.control.applyProfile({
  ...profile,
  deactivateHidden: true,
});
```

Remove direct writes to `control.uiEnabled` and remove the direct `geoForge.control.updateReactivePanel()` call from Demo Studio.

- [x] **Step 2: Run Demo Studio smoke regression**

Run: `pnpm exec playwright test tests/playground/demoMapLoad.test.ts`
Expected: PASS.

### Task 3: Documentation And Public Boundary

**Files:**

- Modify: `docs/public-api-boundary.md`
- Modify: `docs/geoman-instance-api.md` or `docs/geoman-options-api.md`

- [x] **Step 1: Document control profile API**

Add `geoForge.control.applyProfile(...)`, `setModeVisibility(...)`, and `getProfile()` to public API docs with a short snippet. Mention that the APIs are additive and backed by existing control options.

Run: `pnpm exec prettier --check docs/public-api-boundary.md docs/geoman-instance-api.md docs/geoman-options-api.md`
Expected: PASS.

### Task 4: Full Child-Plan Validation

- [x] **Step 1: Run focused unit tests**

Run: `pnpm exec vitest run tests/controls/geomanControlProfiles.test.ts`
Expected: PASS.

- [x] **Step 2: Run focused demo tests**

Run: `pnpm exec playwright test tests/playground/demoMapLoad.test.ts`
Expected: PASS.

- [x] **Step 3: Run full unit tests**

Run: `pnpm run test:unit`
Expected: PASS.

- [x] **Step 4: Run static checks**

Run: `pnpm run ts`
Expected: exit 0.

Run: `pnpm run lint`
Expected: exit 0.

- [x] **Step 5: Run build**

Run: `pnpm run build`
Expected: exit 0.

- [x] **Step 6: Run release gate for this child plan**

Run: `pnpm run check`
Expected: PASS.

Run: `pnpm run test:e2e`
Expected: PASS.

## Completion Evidence

**Implementer status:** complete. Task 1 implementation was completed by the API worker and then corrected by the coordinator after quality review. Task 2 migration was completed in `examples/playground/src/demo-studio/map/controlProfiles.ts` with a focused regression in `tests/playground/controlProfiles.test.ts`.

**Spec review status:** pass. Spec review reported no corrections after the initial API implementation.

**Quality review status:** corrected. Quality review found duplicate reactive panel refreshes when hidden active modes emitted lifecycle events during `applyProfile(...)`. The coordinator added batched refresh suppression for `applyProfile(...)` and `setModeVisibility(...)`, with mounted event-handler regressions in `tests/controls/geomanControlProfiles.test.ts`.

**Validation commands:**

- PASS: `pnpm exec vitest run tests/controls/geomanControlProfiles.test.ts tests/playground/controlProfiles.test.ts tests/public-api/publicBarrel.test.ts`
- PASS: `pnpm exec vitest run tests/controls`
- PASS: `pnpm exec tsc --noEmit`
- PASS: `pnpm run test:unit` - 64 files, 544 tests.
- PASS: `pnpm run check` - formatter, lint, TypeScript, unit tests. Lint exits 0 with existing extension warnings for `@/utils/log` imports.
- PASS: `pnpm run build`
- PASS: `pnpm exec playwright test tests/smoke/@smoke.spec.ts tests/controls/accessibility.spec.ts --workers=1 --reporter=list`
- PASS: `pnpm exec playwright test tests/draw/basic.spec.ts --workers=1 --reporter=list`
- PASS: `pnpm exec playwright test tests/events/create.spec.ts --workers=1 --reporter=list` - 7 tests.
- PASS: `pnpm exec playwright test tests/edit/change.spec.ts tests/events/change.spec.ts tests/edit/rotate.spec.ts tests/events/event-ordering.spec.ts -g "Change/Drag each shape type|Change events for all shape types|Rotate Polygon|Move Marker|multiple rapid drags" --workers=1 --reporter=list` - 5 tests.
- PASS: `pnpm exec playwright test tests/edit/rotate.spec.ts tests/events/rotate.spec.ts --workers=10 --reporter=list` - 3 tests.
- PASS: `pnpm exec playwright test tests/edit/change.spec.ts tests/events/change.spec.ts --workers=10 --reporter=list` - 2 tests.
- PASS: `pnpm exec playwright test tests/tools/playground-segment-length-tool.spec.ts --workers=10 --reporter=list` - 14 tests.
- PASS: `pnpm run test:e2e` - 256 tests.
- PASS: declaration bundle check with `rg -n "GeomanControlProfile|GeomanControlVisibilityOptions|applyProfile\(|setModeVisibility\(|getProfile\(" dist/maplibre-geoforge.d.ts`

**Demo Studio simplification confirmed:** `examples/playground/src/demo-studio/map/controlProfiles.ts` now calls `geoForge.control.applyProfile(controlProfiles[categoryId])` and no longer writes `control.uiEnabled`, calls `geoForge.options.disableMode(...)`, or calls `geoForge.control.updateReactivePanel()` manually.

**Remaining risks:** Full Playwright e2e is green after test-harness stabilization. The remaining known lint output is non-blocking, pre-existing `import/extensions` warnings for `@/utils/log` imports; `pnpm run check` exits 0.

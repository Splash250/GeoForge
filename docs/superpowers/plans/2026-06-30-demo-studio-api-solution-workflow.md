# Demo Studio API Solution Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Define the repeatable workflow for turning `docs/demo-studio-api-audit.md` into production-ready API designs, implementation plans, subagent work packets, and full validation.

**Architecture:** This is a master workflow plan, not a direct feature patch. It creates a controlled autonomous pipeline: audit item intake, design decision, child implementation plan, context pack, isolated subagent execution, two-stage review, integration, and full validation. Each child implementation plan must stand alone, modify a bounded file set, and remove one concrete source of Demo Studio glue identified by the audit.

**Tech Stack:** TypeScript, Svelte, MapLibre GL JS, Vitest, Playwright, ESLint, Prettier, pnpm, GeoForge public API docs.

---

## Source Of Truth

- Audit: `docs/demo-studio-api-audit.md`
- Public boundary: `docs/public-api-boundary.md`
- Instance API docs: `docs/geoman-instance-api.md`
- Feature API docs: `docs/geoman-features-api.md`
- Options API docs: `docs/geoman-options-api.md`
- Events docs: `docs/geoman-events.md`
- Demo Studio app: `examples/playground/src/demo-studio/DemoStudioApp.svelte`
- Demo registry: `examples/playground/src/demo-studio/registry/demoRegistry.ts`
- Package scripts: `package.json`

## Autonomous Execution Contract

The coordinator running this workflow must not stop to ask for ordinary implementation choices. The default behavior is to make the smallest compatible public API change that removes the audited Demo Studio glue, document the decision in the child plan, and continue.

Ask the user only when one of these hard blockers occurs:

- A change would intentionally break an existing stable public API.
- Two viable API designs have materially different downstream migration costs and neither is favored by `docs/demo-studio-api-audit.md`.
- Required validation cannot run because the local environment is missing dependencies or browser binaries.
- The same blocker repeats after three focused fix attempts.
- The requested scope expands beyond the audited API and Demo Studio integration work.

If none of those blockers applies, continue autonomously.

Default decision rules:

- Prefer methods on existing subsystems before creating new top-level namespaces.
- Prefer additive APIs over behavior changes.
- Preserve deprecated and compatibility exports unless a child design brief explicitly marks removal out of scope.
- Prefer operation-level options for single operations and session/batch APIs for multi-operation workflows.
- Prefer state snapshots and unsubscribe functions for UI-facing subscriptions.
- Prefer Demo Studio migrations that delete local glue rather than wrapping it.
- Prefer focused unit coverage before Playwright coverage.

## Coordinator Runbook

Run this loop for every audit item in execution order:

1. Read the audit finding and the current source files named by that finding.
2. Create the child plan from the template in this file.
3. Replace every template token with concrete API names, file paths, tests, commands, and expected results.
4. Run the child-plan self-check before dispatching implementation:
   - no `TBD`, `TODO`, `FIXME`, `fill in details`, `similar to`, or bracketed template tokens remain;
   - every file path exists or is explicitly listed as `Create:`;
   - every public API in the tasks appears in the design brief;
   - every test command references an existing script or concrete test path;
   - every worker task has disjoint ownership from any parallel worker.
5. Create a context pack for each worker.
6. Dispatch exactly one implementation worker at a time.
7. After implementer completion, run spec review.
8. After spec review passes, run quality review.
9. Integrate only after both reviews pass.
10. Run the validation ladder for the child plan.
11. Update the child plan checkboxes and append validation evidence.
12. Continue to the next audit item.

## Context Pack Requirements

Each worker context pack must include enough information to act without reading the whole repository.

Required context pack sections:

- Objective: one sentence.
- Audit excerpt: exact finding text and source references.
- Design brief: final target API and compatibility decision.
- Owned files: exact file paths the worker may edit.
- Read-only references: exact files the worker may inspect.
- Tests to write: exact test files and test names.
- Commands to run: exact commands and expected first failure/pass.
- Non-goals: explicit behaviors the worker must not change.
- Reporting contract: one of the statuses defined below.

Context packs must never say "use your judgment" without also listing the decision rule to apply.

## Subagent Status Protocol

Every implementer and reviewer must end with exactly one status label.

Implementer statuses:

- `DONE`: implementation and assigned focused tests completed.
- `DONE_WITH_CONCERNS`: implementation completed, but listed risks remain.
- `NEEDS_CONTEXT`: blocked by missing information that is not discoverable from assigned files.
- `BLOCKED`: cannot continue after applying the assigned decision rules.

Spec reviewer statuses:

- `SPEC_PASS`: implementation satisfies the child plan and audit acceptance criteria.
- `SPEC_FAIL`: implementation misses or exceeds requirements; include required corrections.

Quality reviewer statuses:

- `QUALITY_PASS`: implementation is maintainable, scoped, and compatible.
- `QUALITY_FAIL`: implementation has correctness, maintainability, typing, or test-quality issues; include required corrections.

Coordinator action rules:

- `DONE` -> run spec review.
- `DONE_WITH_CONCERNS` -> inspect concerns; if they are correctness or scope risks, send a targeted fix request before spec review; otherwise run spec review and keep concerns in integration notes.
- `NEEDS_CONTEXT` -> provide missing context once and re-dispatch.
- `BLOCKED` -> split the task, revise the child plan, or escalate only if it matches a hard blocker.
- `SPEC_FAIL` -> send corrections to the same implementer, then rerun spec review.
- `QUALITY_FAIL` -> send corrections to the same implementer, then rerun quality review.
- `SPEC_PASS` and `QUALITY_PASS` -> run local validation before marking the task complete.

## Review Agent Prompt Templates

Use these review prompts after every implementer result.

### Spec Review Prompt

```markdown
You are the spec compliance reviewer for one GeoForge child plan task.

Context:

- Child plan section: insert the full task and design brief.
- Audit acceptance criteria: insert the relevant audit matrix row.
- Implementer summary: insert the implementer summary.
- Diff scope: insert the changed files list.

Review only whether the implementation satisfies the planned behavior and does not exceed scope.

Return exactly:
Status: SPEC_PASS or SPEC_FAIL
Findings:

- `file:line` issue, or `None`
  Required corrections:
- Specific correction, or `None`
```

### Quality Review Prompt

```markdown
You are the code quality reviewer for one GeoForge child plan task.

Context:

- Design brief: insert the final design brief.
- Changed files: insert the file list.
- Tests run: insert command results.

Review maintainability, type safety, compatibility, test strength, and accidental coupling. Do not reopen accepted design decisions unless implementation makes them unsafe.

Return exactly:
Status: QUALITY_PASS or QUALITY_FAIL
Findings:

- `file:line` issue, or `None`
  Required corrections:
- Specific correction, or `None`
```

## Audit-Derived Execution Order

Work must proceed in this order unless a later design brief proves a dependency is wrong.

| Wave | Audit item                             | Reason                                                                              | Child plan name                                 |
| ---- | -------------------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------- |
| P0-A | Public control profiles                | Removes direct `options.controls` mutation and manual `updateReactivePanel()` calls | `YYYY-MM-DD-control-profile-api.md`             |
| P0-B | History-free feature operations        | Removes repeated `runWithoutHistory(...)` wrappers from demos and snippets          | `YYYY-MM-DD-history-free-feature-operations.md` |
| P0-C | Feature/history/mode subscriptions     | Removes manual MapLibre event-name arrays from app UIs                              | `YYYY-MM-DD-state-subscriptions.md`             |
| P1-A | Public snapping configuration          | Removes `actionInstances.helper__snapping` access                                   | `YYYY-MM-DD-snapping-helper-api.md`             |
| P1-B | Session/owner lifecycle API            | Removes manual seeded-feature ownership and teardown bookkeeping                    | `YYYY-MM-DD-workflow-session-api.md`            |
| P1-C | Feature query/count APIs               | Removes direct `featureStore` iteration for app-level filters                       | `YYYY-MM-DD-feature-query-count-api.md`         |
| P1-D | Transaction form helper                | Reduces transaction lifecycle boilerplate for forms                                 | `YYYY-MM-DD-transaction-form-helper.md`         |
| P2-A | Raster state subscription/proxy helper | Makes raster-layer panels easier to externalize                                     | `YYYY-MM-DD-raster-layer-integration-api.md`    |
| P2-B | Decorator authoring session            | Makes advanced decorator editing reusable without bloating renderer core            | `YYYY-MM-DD-line-decorator-authoring-api.md`    |
| P2-C | Overlay upsert semantics               | Clarifies lifecycle behavior                                                        | `YYYY-MM-DD-overlay-upsert-semantics.md`        |
| P2-D | Demo shell reference links             | Turns Demo Studio into a stronger reference app                                     | `YYYY-MM-DD-demo-shell-reference-links.md`      |

## Global Acceptance Gates

Every child plan must satisfy these gates before implementation starts:

- It names the exact audit finding numbers it addresses.
- It lists every public API signature it intends to add or change.
- It identifies compatibility behavior for existing public exports and shortcuts.
- It lists all files likely to change and assigns clear ownership.
- It includes failing tests before implementation steps.
- It defines Demo Studio simplification acceptance criteria.
- It defines docs updates for the public API boundary and relevant feature docs.
- It defines validation commands, including unit tests, typecheck, lint, build, and relevant Playwright coverage.

Every implementation wave must satisfy these gates before it is considered integrated:

- Unit tests pass for touched subsystem.
- `pnpm run ts` passes.
- `pnpm run lint` passes.
- `pnpm run build` passes.
- Relevant Playwright tests pass.
- `pnpm run check` passes.
- `pnpm run test:e2e` passes before release or before claiming the full wave is production-ready.
- Demo Studio no longer uses the internal or repetitive pattern targeted by the wave.

## Dynamic Design Brief Template

Before writing a child implementation plan, create a design brief inside the child plan using this exact structure:

````markdown
## Design Brief

**Audit findings addressed:** `Finding N: exact title from docs/demo-studio-api-audit.md`

**Current friction:** `exact/file.ts:line` currently does `specific behavior`.

**Target consumer API:**

```ts
// complete proposed external API snippet with final method and option names
```

**Compatibility decision:** Existing `specific API` keeps working; new API is additive.

**Rejected alternatives:**

- `alternative API shape`: rejected because `specific reason`.

**Demo Studio simplification target:** `exact/file.ts` removes `specific old pattern`.

**Test strategy:** Unit test `tests/path/file.test.ts`; Playwright test `tests/path/file.spec.ts`.

**Risk level:** `low`, `medium`, or `high`; include one sentence explaining why.
````

The brief is complete only when a maintainer could review API shape without opening the implementation tasks.

## Child Implementation Plan Template

Each child plan must be saved to `docs/superpowers/plans/YYYY-MM-DD-<feature-name>.md` and must use this skeleton. Replace every angle-bracketed or example path before dispatching workers.

```markdown
# Concrete Feature Name Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One sentence describing the concrete API or integration improvement.

**Architecture:** Two or three sentences describing the chosen subsystem, compatibility rule, and Demo Studio migration.

**Tech Stack:** TypeScript, Svelte, Vitest, Playwright, pnpm.

---

## Design Brief

Paste the completed design brief here.

## File Map

- Modify: `src/exact/file.ts` - responsibility.
- Test: `tests/exact/file.test.ts` - coverage.
- Docs: `docs/exact-doc.md` - public guidance.

## Tasks

### Task 1: Public API Contract

**Files:**

- Test: `tests/exact/file.test.ts`
- Modify: `src/exact/file.ts`

- [ ] **Step 1: Write failing API test**

Run: `pnpm exec vitest run tests/exact/file.test.ts`
Expected: FAIL because `specific API or behavior` does not exist.

- [ ] **Step 2: Implement minimum API**

Run: `pnpm exec vitest run tests/exact/file.test.ts`
Expected: PASS.

- [ ] **Step 3: Run typecheck**

Run: `pnpm run ts`
Expected: exit 0.

### Task 2: Demo Studio Migration

**Files:**

- Modify: `examples/playground/src/demo-studio/exact-file.ts`
- Test: `tests/playground/exactDemo.test.ts`

- [ ] **Step 1: Write failing demo regression**

Run: `pnpm exec playwright test tests/playground/exactDemo.test.ts`
Expected: FAIL before migration.

- [ ] **Step 2: Replace old demo glue with new API**

Run: `pnpm exec playwright test tests/playground/exactDemo.test.ts`
Expected: PASS.

### Task 3: Documentation And Public Boundary

**Files:**

- Modify: `docs/public-api-boundary.md`
- Modify: `docs/exact-doc.md`

- [ ] **Step 1: Document new API and compatibility**

Run: `pnpm exec prettier --check docs/public-api-boundary.md docs/exact-doc.md`
Expected: PASS.

### Task 4: Full Validation

- [ ] **Step 1: Run focused unit tests**

Run: `pnpm exec vitest run tests/exact/file.test.ts`
Expected: PASS.

- [ ] **Step 2: Run full unit tests**

Run: `pnpm run test:unit`
Expected: PASS.

- [ ] **Step 3: Run static checks**

Run: `pnpm run ts`
Expected: exit 0.

Run: `pnpm run lint`
Expected: exit 0.

- [ ] **Step 4: Run build**

Run: `pnpm run build`
Expected: exit 0.

- [ ] **Step 5: Run relevant e2e tests**

Run: `pnpm exec playwright test tests/playground/exactDemo.test.ts`
Expected: PASS.

- [ ] **Step 6: Run full release gate**

Run: `pnpm run check`
Expected: PASS.

Run: `pnpm run test:e2e`
Expected: PASS.
```

## Subagent Execution Model

The coordinator owns sequencing, conflict control, validation, and final integration. Workers own bounded implementation or verification tasks. Once execution of this workflow has been requested, do not pause for routine approvals; follow the autonomous execution contract.

### Coordinator Responsibilities

- Create one child implementation plan per audit item or tightly coupled audit group.
- Keep implementation tasks serial unless a later coordinator explicitly switches to the parallel-exploration model below.
- Give each worker only the plan section, audit excerpts, and file paths needed for its task.
- Tell every worker the repo may contain unrelated user changes and they must not revert them.
- Review each worker result before merging concepts into the main line.
- Run the validation ladder locally after worker output is integrated.
- Keep a coordination log in the child plan with worker status, review status, validation commands, and remaining risks.

### Worker Prompt Template

Use this prompt shape for each worker:

```markdown
You are implementing one bounded slice of GeoForge.

Context:

- Audit: `docs/demo-studio-api-audit.md`
- Child plan: `docs/superpowers/plans/YYYY-MM-DD-feature-name.md`
- Assigned task: `Task N: exact title`

Ownership:

- You may modify: `exact/file.ts`, `exact/second-file.ts`.
- You may add tests under: `tests/exact/file.test.ts`.
- Do not modify unrelated files.
- Do not revert existing changes made by others.

Goal:
Implement `specific behavior` exactly as described in the design brief.

Required workflow:

1. Read the assigned plan task.
2. Write or update the failing test first.
3. Run the focused test and confirm the expected failure.
4. Implement the smallest production change.
5. Run the focused test and confirm pass.
6. Run any assigned static checks.
7. Return a summary with changed files, tests run, and unresolved risks.

Return:

- Status: DONE, DONE_WITH_CONCERNS, NEEDS_CONTEXT, or BLOCKED
- Changed files
- Behavior implemented
- Tests run with pass/fail result
- Any blockers
```

### Parallelization Rules

Default rule: implementation workers run serially. A task is implemented, spec-reviewed, quality-reviewed, locally validated, and integrated before the next implementation task starts.

Parallel workers are allowed only for read-only exploration, review, validation, or documentation tasks with disjoint ownership. Do not run two implementation workers in parallel against production code.

Allowed parallel splits:

- Explorer for control API file map: read-only `src/core/controls/**`, `tests/controls/**`.
- Explorer for feature operations file map: read-only `src/core/features/**`, `tests/features/**`.
- Verification worker for docs: `docs/**` only.
- Verification worker for one already-integrated focused test path.

Bad parallel splits:

- Two implementation workers changing production TypeScript.
- Two workers editing `src/main.ts`.
- One worker changing `FeatureData` while another changes feature import semantics.
- One worker updating Demo Studio while the public API it depends on is still unstable.

### Review Loop Per Worker

After each worker finishes:

- Inspect `git diff -- <owned-files>`.
- Run the worker's focused test commands locally.
- Check for accidental edits outside ownership.
- Check for public API drift from the child design brief.
- Either integrate, request a focused correction, or revert only the worker's own changes if the output is unusable.

## Child Plan Completion Evidence

Append this section to every child plan after implementation:

```markdown
## Completion Evidence

**Implementer status:** DONE

**Spec review status:** SPEC_PASS

**Quality review status:** QUALITY_PASS

**Validation commands:**

- `pnpm exec vitest run tests/exact/file.test.ts` - PASS
- `pnpm run ts` - PASS
- `pnpm run lint` - PASS
- `pnpm run build` - PASS
- `pnpm exec playwright test tests/playground/exactDemo.test.ts` - PASS

**Demo Studio simplification confirmed:** `exact/file.ts` no longer uses `old pattern`.

**Remaining risks:** None, or exact deferred risk with owner.
```

## Validation Ladder

Use the smallest meaningful validation first, then climb. Do not skip the final gates for a wave.

### Level 1: Focused Unit Validation

Use for each task:

```powershell
pnpm exec vitest run tests/controls
pnpm exec vitest run tests/features
pnpm exec vitest run tests/history
pnpm exec vitest run tests/modes
pnpm exec vitest run tests/layers
```

Run only the paths relevant to the current child plan.

### Level 2: Focused Demo Validation

Use when Demo Studio changes:

```powershell
pnpm exec playwright test tests/playground/demoMapLoad.test.ts
pnpm exec playwright test tests/playground/drawEditDemos.test.ts
pnpm exec playwright test tests/playground/geometryDemos.test.ts
pnpm exec playwright test tests/playground/workflowDemos.test.ts
pnpm exec playwright test tests/playground/customRasterLayers.test.ts
```

Run only the relevant files during task work. Run all touched demo files before integration.

### Level 3: Static And Build Validation

Use before accepting any child plan implementation:

```powershell
pnpm run ts
pnpm run lint
pnpm run build
```

### Level 4: Full Wave Validation

Use before marking a P0, P1, or P2 wave ready:

```powershell
pnpm run test:unit
pnpm run check
pnpm run test:e2e
```

`pnpm run check` includes formatter, lint, typecheck, and unit tests. `pnpm run test:e2e` is still required separately because `check` does not run Playwright.

## Wave-Specific Design And Test Requirements

### P0-A: Public Control Profiles

Design requirements:

- Add APIs to the existing `geoForge.control` subsystem.
- Keep `geoForge.options.controls` behavior compatible.
- Keep existing controls rendering behavior intact.
- Demo Studio must stop mutating `control.uiEnabled` directly.

Required tests:

- Unit test for applying a profile.
- Unit test for hiding an active mode with `deactivateHidden: true`.
- Unit test for leaving an active hidden mode alone with `deactivateHidden: false`.
- Playground regression that `applyDemoControlProfile(...)` no longer calls `updateReactivePanel()` manually.

Focused commands:

```powershell
pnpm exec vitest run tests/controls
pnpm exec playwright test tests/playground/demoMapLoad.test.ts
```

### P0-B: History-Free Feature Operations

Design requirements:

- Add `history: false` or equivalent operation-level recording control to feature mutations.
- Retain `geoForge.history.suspend(...)` for multi-operation batches.
- Demo snippets should prefer operation-level `history: false` for single imports/deletes.

Required tests:

- Import with `history: false` does not record undo entries.
- Delete with `history: false` does not record undo entries.
- Default import/delete behavior still records history where it currently does.
- Demo code no longer needs local `runWithoutHistory(...)` for single operations.

Focused commands:

```powershell
pnpm exec vitest run tests/features tests/history
pnpm exec playwright test tests/playground/featureDataDemos.test.ts
```

### P0-C: Feature, History, And Mode Subscriptions

Design requirements:

- Subscription APIs return cleanup functions.
- Subscription callbacks receive state snapshots that are safe for UI use.
- Subscriptions do not require consumers to know MapLibre event-name arrays.
- Existing MapLibre events remain available.

Required tests:

- Feature subscriber fires for create/update/delete.
- History subscriber fires for record/undo/redo/clear.
- Mode subscriber fires for enable/disable/toggle/disableAll.
- Unsubscribe prevents further callbacks.
- Demo inspectors can refresh from subscriptions.

Focused commands:

```powershell
pnpm exec vitest run tests/features tests/history tests/modes
pnpm exec playwright test tests/playground/drawEditDemos.test.ts tests/playground/geometryDemos.test.ts tests/playground/workflowDemos.test.ts
```

### P1-A: Public Snapping Configuration

Design requirements:

- Remove the need for `geoForge.actionInstances.helper__snapping` in consumer code.
- Choose either `geoForge.helpers.snapping` or a helper-specific API under an existing subsystem.
- Keep the existing snapping helper behavior unchanged.

Required tests:

- Endpoint snapping can be enabled through the public API.
- Endpoint snapping can be disabled through the public API.
- Geometry demo no longer reads `actionInstances`.

Focused commands:

```powershell
pnpm exec vitest run tests/helpers tests/geometry
pnpm exec playwright test tests/playground/geometryDemos.test.ts
```

### P1-B: Session Or Owner Lifecycle API

Design requirements:

- A caller can own imported features without storing every `FeatureData` reference.
- A caller can dispose owned features without broad `deleteAll()`.
- A caller can combine disposal with `history: false`.
- Sessions or owners must not hide raw feature APIs from advanced consumers.

Required tests:

- Import with owner id records ownership.
- Delete by owner deletes only owned features.
- Session disposal removes owned features and subscriptions.
- Existing feature import/export behavior stays compatible.

Focused commands:

```powershell
pnpm exec vitest run tests/features tests/history
pnpm exec playwright test tests/playground/drawEditDemos.test.ts tests/playground/geometryDemos.test.ts
```

### P1-C: Feature Query And Count APIs

Design requirements:

- Query by shape, source, temporary state, id, and custom predicate.
- Count uses the same filter contract as query.
- Return arrays or snapshots, not raw mutable store internals as the primary API.

Required tests:

- Query filters by shape.
- Query filters by source.
- Query excludes temporary features by default or by explicit option, according to the design brief.
- Count matches query length for equivalent filters.

Focused commands:

```powershell
pnpm exec vitest run tests/features
pnpm exec playwright test tests/playground/drawEditDemos.test.ts
```

### P1-D: Transaction Form Helper

Design requirements:

- Keep raw transactions available.
- Add a helper only for common form workflows.
- Centralize dirty-state, commit, cancel, undo, and redo rules.
- Preserve validation behavior from `GeomanTransaction`.

Required tests:

- Property edit previews through helper.
- Commit records history when dirty.
- Cancel restores original state.
- Undo/redo are blocked while dirty and work after commit.

Focused commands:

```powershell
pnpm exec vitest run tests/transactions tests/history tests/context-panels
pnpm exec playwright test tests/playground/workflowDemos.test.ts
```

### P2-A: Raster Layer Integration API

Design requirements:

- Add raster layer subscription or state event.
- Keep current add/remove/reorder/discover methods compatible.
- Add proxy configuration only as a declarative transform helper, not a hard-coded server path.

Required tests:

- Subscriber receives state after add/remove/reorder.
- Proxy transform preserves MapLibre tokens.
- Custom raster panel can render from subscription state.

Focused commands:

```powershell
pnpm exec vitest run tests/layers
pnpm exec playwright test tests/playground/customRasterLayers.test.ts
```

### P2-B: Line Decorator Authoring API

Design requirements:

- Keep `geoForge.decorators.lines.syncFromFeatures(...)` as the renderer-level API.
- Add optional authoring helpers for symbol image registration, line style application, decorator state sync, and disposal.
- Avoid moving UI-specific state into core renderer logic.

Required tests:

- Authoring session syncs decorators from state.
- Authoring session registers and cleans up symbol images.
- Existing decorator tests still pass.

Focused commands:

```powershell
pnpm exec vitest run tests/decorators
pnpm exec playwright test tests/playground/advancedDecoratorAuthoring.test.ts
```

### P2-C: Overlay Upsert Semantics

Design requirements:

- Decide whether `add(...)` is documented as upsert or whether a distinct `upsert(...)` method is added.
- Preserve existing behavior for current callers.
- Update docs and Demo Studio snippets to show the intended lifecycle.

Required tests:

- Repeated add/upsert behavior is explicit.
- Strict add behavior is tested if introduced.
- Update still patches existing overlays.

Focused commands:

```powershell
pnpm exec vitest run tests/overlays/html
pnpm exec playwright test tests/playground/overlayPointerModes.test.ts
```

### P2-D: Demo Shell Reference Links

Design requirements:

- Extend demo metadata with source/docs/GitHub/example links if needed.
- Docs button opens real docs.
- GitHub button opens real source or repository URL when available.
- Export snippet behavior remains clipboard-based.

Required tests:

- Toolbar actions use metadata URLs.
- Missing URL has a clear fallback.
- Existing reset/export behavior still works.

Focused commands:

```powershell
pnpm exec playwright test tests/playground/demoMapLoad.test.ts
pnpm exec playwright test tests/playground/legacyRetirement.test.ts
```

## Release Readiness Checklist

Use this checklist after all planned waves for a release batch are integrated.

- [ ] `docs/demo-studio-api-audit.md` still matches the implemented solution or has been updated.
- [ ] Every child plan has completed checkboxes or an explicit deferred section.
- [ ] `docs/public-api-boundary.md` lists new stable APIs and compatibility notes.
- [ ] Feature docs include at least one external-consumer snippet for each new public API.
- [ ] Demo Studio snippets use the new APIs instead of removed glue.
- [ ] No new recommended snippet uses `actionInstances`, direct `featureStore`, manual `updateReactivePanel()`, or local `runWithoutHistory(...)` for single operations.
- [ ] `pnpm run test:unit` passes.
- [ ] `pnpm run check` passes.
- [ ] `pnpm run build` passes.
- [ ] `pnpm run test:e2e` passes.
- [ ] `git status --short` has only intended files.

## Autonomous Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-30-demo-studio-api-solution-workflow.md`.

Default execution path:

1. Use `superpowers:subagent-driven-development`.
2. Create `docs/superpowers/plans/YYYY-MM-DD-control-profile-api.md` first.
3. Dispatch one implementer subagent for the first child-plan task.
4. Run spec review.
5. Run quality review.
6. Run the child-plan validation ladder.
7. Continue through the audit-derived execution order.

Fallback path:

- Use inline execution only when subagent tools are unavailable. Preserve the same child-plan, review, and validation gates.

First child plan: `YYYY-MM-DD-control-profile-api.md`, because it is the smallest P0 boundary leak and gives the workflow an early proving ground before touching feature/history internals.

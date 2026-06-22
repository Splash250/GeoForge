# GeoForge Demo Studio UX Design

## Design Brief

Designing a standalone web demo for GeoForge, a developer-facing MapLibre geometry/editing package.

Goal: let developers understand, test, and trust GeoForge capabilities by interacting with them directly on a live map.

Tone: Mapbox Studio-inspired, technical, premium, dark, map-first, precise.

Main risk: turning the package demo into a cluttered single-page control dump or a passive docs gallery.

Must remember: GeoForge should feel like a focused map editing workbench, not a marketing landing page.

Constraints:

- Use the current GeoForge package functionality from `docs/demo-functionality-inventory.md`.
- Keep the map as the dominant working surface.
- Avoid copying Mapbox branding directly; adapt the product patterns and visual discipline.
- The demo should work as a standalone package showcase, not only as a Sewergy-specific tool.

Research used:

- Refero style: Mapbox, "Satellite console at midnight".
- Refero screens: Mapbox Studio editor, Mapbox docs API page.
- Refero flow: Mapbox Studio custom font upload flow.
- Live Mapbox references: homepage, docs, Studio, GL JS, API playground/resource structure.

## Reference Lock

Primary reference direction: Mapbox Studio / Mapbox dark product ecosystem.

Preserve:

- Near-black canvas where the live map is the primary visual light source.
- Dark editor-style top toolbar.
- Fixed left navigation/layer-style sidebar.
- Large central map canvas.
- Contextual right inspector for the selected capability.
- Floating modal/panel/toast behavior over the map.
- Electric blue used only for primary actions, links, and active states.
- Pill-shaped primary actions and tabs.
- Sharper utility controls for map tools and compact buttons.

Borrow only:

- From Mapbox docs: structured category hierarchy, search, examples, docs links, and code/reference clarity.
- From developer-tool patterns: code snippets, state inspectors, event logs, and copyable usage samples.

Reject:

- A generic SaaS dashboard.
- A marketing landing page.
- A giant one-page playground where every feature is visible at once.
- Colorful multi-accent palettes.
- Decorative gradients that compete with the map.
- Cards inside cards or decorative card-heavy layouts.

Token commitments:

- Page background: `#0e1012`.
- Panel background: `#15171b`.
- Raised/nested panel: `#1c1f24`.
- Overlay/tooltips: `#23262d`.
- Primary text: `#ffffff`.
- Body text: `#a0aaba`.
- Muted text: `#566171`.
- Primary/active/action blue: `#007afc`.
- Success/new badge green: `#228a56`.
- Structural border: `#333943`.
- Radius: 100px for pills, 24px for map/panel cards, 4-6px for utility controls.

## Product Model

The demo is a "Demo Studio": an editor-like environment where categories load demos into the same map canvas.

The user should always understand four things:

- What category they are in.
- What sub-demo is active.
- What changed on the map.
- What API/code produced the result.

This means the demo is organized around a persistent shell instead of many separate full pages.

## Shell Layout

### Top Toolbar

Purpose: global identity and project-level actions.

Contents:

- GeoForge wordmark.
- Active breadcrumb, for example `Demo Studio / Line Decorators / Animated arrows`.
- Global actions:
  - Docs
  - Examples
  - GitHub
  - Reset demo
  - Export snippet

Behavior:

- Fixed height around 62px.
- Dark Mapbox-like toolbar.
- Primary action uses blue pill treatment.
- Secondary actions use transparent utility buttons.

### Left Sidebar

Purpose: category and subcategory navigation.

Contents:

- Small all-caps label: `Demo categories`.
- Short product framing headline.
- Search field for demos, APIs, and features.
- Category groups with nested sub-demos.

Behavior:

- Fixed-width desktop sidebar.
- Scrolls independently from the map.
- Active category uses a raised dark surface.
- Active sub-demo uses blue pill selection.
- Reserved/planned functionality should be hidden from default navigation or placed in a "planned" developer drawer, not mixed with working demos.

### Center Map Canvas

Purpose: the main experience.

Contents:

- Live MapLibre map.
- Seeded GeoForge features for each demo.
- Map controls.
- Coordinate/zoom/status readout.
- Optional floating explainer card for the active demo.
- Optional drawing/editing overlays.

Behavior:

- Always visible and dominant.
- Demos mutate the map, not only surrounding UI.
- Map has strong visual presence and should not be boxed into a small preview.
- Overlay cards must be sparse and contextual.

### Right Inspector

Purpose: controls, state, code, and explanation for the active sub-demo.

Contents:

- Active demo title.
- Control groups.
- Live state.
- Code snippet.
- Links to relevant docs/API.
- Warnings or validation messages when applicable.

Behavior:

- Only shows controls relevant to the active sub-demo.
- Uses progressive disclosure for advanced options.
- Keeps controls dense but readable.
- Avoids exposing every possible API option in the first view.

### Notification/Event Area

Purpose: feedback and observability.

Contents:

- Bottom-right notifications for short feedback.
- Optional collapsible event console for detailed event streams.

Behavior:

- Toasts confirm changes: sync complete, transaction committed, topology issue found, GeoJSON imported.
- Event console should be collapsible so it does not compete with the inspector.

## Category Information Architecture

### Draw And Edit

Sub-demos:

- Shapes.
- Drag, rotate, and cut.
- Single-feature edit.
- Snapping and shape markers.

Primary user outcome:

- Learn how GeoForge creates and modifies map features.

### Line Decorators

Sub-demos:

- Arrowheads.
- Text labels.
- Symbol placement.
- Animation.
- Manual sync.

Primary user outcome:

- See decorative line behavior directly on live route/utility/network lines.

### Overlays

Sub-demos:

- HTML iframe overlay.
- Corner editing.
- Pointer modes.
- Selection behavior.

Primary user outcome:

- Understand map-anchored HTML overlays and how interaction modes work.

### Feature Data

Sub-demos:

- Import GeoJSON.
- Export GeoJSON.
- Feature ids.
- Sources.

Primary user outcome:

- Understand package-safe data flow and identity preservation.

### Geometry Tools

Sub-demos:

- Segment measurement.
- Split, insert, and remove segment.
- Endpoint connection.
- Network topology.
- Merge plan.

Primary user outcome:

- See GeoForge as a serious geometry workflow package, not only a drawing toolbar.

### Workflow Systems

Sub-demos:

- Selection.
- Context panels.
- Transactions.
- History and undo/redo.
- Events console.

Primary user outcome:

- Understand how to build real application workflows on top of GeoForge.

## Interaction Principles

- The map is the product, not the background.
- Navigation changes should preserve spatial context where possible.
- Each sub-demo should start with seeded data that immediately demonstrates the feature.
- The first controls in the inspector should be safe, visible, and reversible.
- Advanced API settings should be one disclosure deeper.
- Every visible behavior should map to a short code snippet.
- Every mutating action should produce visible feedback.
- Reset should be globally available.
- Copy/export should be available only when the snippet is valid for the current demo state.

## Responsive Strategy

Desktop is the primary target because this is a developer/editor demo.

Desktop:

- Top toolbar.
- Left sidebar.
- Full map canvas.
- Right inspector.

Tablet:

- Left sidebar remains visible or collapses to icon rail.
- Right inspector becomes a slide-over drawer.

Mobile:

- Map first.
- Category selector becomes a bottom sheet.
- Inspector becomes a second bottom sheet.
- The mobile demo should remain useful, but full productivity editing is not the main target.

## Accessibility

- All icon-only controls need accessible labels and visible focus states.
- Keyboard users must be able to move through top toolbar, sidebar, map controls, inspector controls, and console.
- Active category/sub-demo state must not rely on color only.
- Text contrast must remain strong on dark surfaces.
- Toasts should use polite live regions.
- Motion and animated decorator demos must respect reduced-motion where feasible.

## Implementation Notes

Recommended scaffold:

- `examples/demo-studio/` or `src/playground/demo-studio/`, depending on existing repo playground conventions.
- Split shell from demo registry.
- Use a typed demo registry:
  - category id
  - sub-demo id
  - title
  - description
  - setup function
  - teardown/reset function
  - inspector component
  - code snippet provider
  - docs links
- Keep map initialization centralized.
- Each sub-demo owns only its seeded features, controls, and cleanup.
- Event logging should be shared infrastructure.
- Demo state should be serializable enough for reset and code snippet generation.

## Acceptance Criteria

- The first screen looks and behaves like a map editing workbench.
- Users can switch categories without visual clutter.
- Each category has nested sub-demos.
- The active sub-demo changes the live map.
- The right inspector never shows unrelated controls.
- Code snippets reflect the active demo.
- Users can reset demo state.
- Events and status feedback are visible but not dominant.
- The design clearly follows the Mapbox-inspired reference lock without copying Mapbox branding.

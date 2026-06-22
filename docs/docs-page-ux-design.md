# GeoForge Documentation Page UX Design

## Design Brief

Designing a documentation page system for GeoForge that matches the Mapbox-modelled Demo Studio direction while serving a different job: reading, learning, searching, and copying API examples.

Goal: make GeoForge docs feel like a serious developer product reference, with fast navigation from concept to runnable example to Demo Studio.

Tone: Mapbox-inspired, technical, dark, precise, readable, map-aware.

Main risk: making docs look like a generic markdown site or making them so dark/editor-like that long-form reading becomes tiring.

Must remember: the docs page should be the reference surface; Demo Studio should be the interactive surface. They should link into each other constantly.

## Reference Lock

Primary reference direction: Mapbox documentation structure adapted to the GeoForge dark product ecosystem.

Preserve:

- Top product toolbar.
- Left docs navigation with grouped sections.
- Central long-form content column.
- Right in-page table of contents.
- Strong code snippets.
- Clear breadcrumbs.
- Links from docs pages into the matching Demo Studio demo.
- Mapbox-style blue for active states, links, and primary actions.

Borrow from Demo Studio:

- Same dark color system.
- Same pill primary buttons.
- Same 24px content cards and code blocks.
- Same terminology for categories and sub-demos.

Reject:

- A white docs page that visually disconnects from Demo Studio.
- A generic markdown renderer with no product hierarchy.
- Overly large marketing hero sections.
- Dense sidebars without grouping.
- Docs pages that do not link to runnable demos.

## Visual System

Use the same token family as the Demo Studio:

- Page background: `#0e1012`.
- Sidebar/panel background: `#15171b`.
- Raised content surface: `#1c1f24`.
- Overlay/tooltips: `#23262d`.
- Primary text: `#ffffff`.
- Body text: `#a0aaba`.
- Muted text: `#566171`.
- Primary/active/action blue: `#007afc`.
- Structural border: `#333943`.
- Success/new badge green: `#228a56`.

Docs-specific usage:

- Body copy should use more line height than Demo Studio controls.
- Main content must stay narrower than the map studio inspector for readability.
- Code blocks should be dark and prominent, not low-contrast gray boxes.
- Callouts should use dark surfaces and border hierarchy, not colored background washes.

## Page Layout

### Top Toolbar

Purpose: product identity, search, and cross-surface navigation.

Contents:

- GeoForge wordmark.
- Active location label, for example `Documentation / Line Decorators / Getting started`.
- Search docs input.
- Demo Studio link.
- GitHub link.
- Copy install or Copy snippet action when contextually relevant.

Behavior:

- Fixed height around 62px.
- Stays visually aligned with Demo Studio.
- Primary contextual action uses blue pill treatment.

### Left Docs Sidebar

Purpose: documentation navigation.

Top-level groups:

- Start
- Capabilities
- Workflows
- Reference
- Migration / Compatibility

Recommended pages:

- Overview
- Installation
- Map setup
- Draw and edit
- Line decorators
- HTML overlays
- Feature data
- Geometry tools
- Context panels
- Transactions
- History
- Events
- Instance API
- Feature API
- Public exports
- Compatibility notes

Behavior:

- Fixed-width desktop sidebar.
- Scrolls independently.
- Active page uses blue pill state.
- Parent groups use stronger text weight.
- Avoid showing every heading from the page in the left nav; page headings belong in the right TOC.

### Main Content

Purpose: readable technical explanation and code.

Page structure:

- Breadcrumb.
- H1.
- Short intro paragraph.
- Primary actions:
  - Open in Demo Studio.
  - View API reference.
  - Copy snippet when relevant.
- Recommended-path callout.
- Installation/setup snippet.
- Concept explanation.
- Options table or cards.
- API reference section.
- Edge cases and lifecycle notes.
- Related demos and related docs.

Content rules:

- Start with the high-level GeoForge API, not advanced internals.
- Mark compatibility/advanced exports clearly.
- Every page that has an interactive equivalent should link to Demo Studio.
- Code snippets should be short enough to copy and test.
- Long API option lists should be grouped by purpose, not dumped alphabetically.

### Right Table Of Contents

Purpose: local page navigation and quick context.

Contents:

- Page headings.
- Active heading indicator.
- Related Demo Studio link card.
- Optional "API status" metadata for stable/advanced/deprecated.

Behavior:

- Sticky on desktop.
- Hidden behind a menu on tablet/mobile.
- Does not duplicate left sidebar categories.

## Docs Information Architecture

### Start

- Overview.
- Installation.
- Quick start.
- Map setup.
- Package exports.

### Capabilities

- Draw and edit.
- Line decorators.
- HTML overlays.
- Feature data and GeoJSON.
- Selection.
- Geometry tools.

### Workflows

- Context panels.
- Transactions.
- History and undo/redo.
- Events and diagnostics.
- Custom tools.

### Reference

- Instance API.
- Features API.
- Options and modes.
- Events.
- Types.
- Public API boundary.

### Compatibility

- Geoman compatibility alias.
- Advanced compatibility exports.
- Deprecated or low-level internals.
- Migration notes.

## Page Template

Each docs page should follow this sequence:

1. Breadcrumb.
2. H1 focused on the task or capability.
3. One-paragraph purpose.
4. Primary action row.
5. Recommended API callout.
6. Minimal working snippet.
7. Concept explanation.
8. Options grouped by practical use.
9. Lifecycle/cleanup section.
10. Events or state emitted by the feature.
11. Advanced/compatibility section when needed.
12. Related demos and docs.

## Relationship To Demo Studio

Docs pages explain and reference.

Demo Studio lets users try and manipulate.

Required cross-links:

- Docs page to matching Demo Studio sub-demo.
- Demo Studio inspector to matching docs page.
- Code snippet in Demo Studio should match or derive from the docs snippet.
- API reference sections should link back to practical guide pages.

Example:

- Docs page: `Line decorators`.
- Demo Studio category: `Line Decorators`.
- Sub-demos:
  - Arrowheads.
  - Text labels.
  - Symbol placement.
  - Animation.
  - Manual sync.

## Component Guidance

Use:

- Breadcrumbs.
- Search input.
- Left navigation groups.
- Right TOC.
- Dark code blocks.
- Copy buttons.
- Recommended-path callouts.
- Stable/advanced/deprecated badges.
- Option tables for dense API data.
- Small cards for feature group summaries.
- "Open in Demo Studio" blue pill button.

Avoid:

- Large hero imagery on docs pages.
- Marketing-style cards.
- Nested cards.
- Unexplained API dumps.
- Copy buttons without feedback.
- Low-contrast code.

## Responsive Strategy

Desktop:

- Three-column docs layout.
- Left navigation, main content, right TOC.

Tablet:

- Left navigation collapses to a drawer.
- Right TOC collapses into an "On this page" dropdown.

Mobile:

- Top search remains available.
- Docs nav and TOC become drawers/sheets.
- Main content is single-column.
- Code blocks scroll horizontally with visible affordance.

## Accessibility

- Keep body text contrast high on dark backgrounds.
- Do not use blue as the only active indicator; pair active state with shape/fill.
- Code copy buttons need accessible names and success feedback.
- Sidebar and TOC should be keyboard navigable.
- Heading hierarchy must be sequential.
- Long code blocks need readable font size and horizontal scrolling without trapping focus.

## Acceptance Criteria

- Docs feel visually related to Demo Studio.
- Docs are easier to read than the editor UI.
- Every major capability page links to its runnable demo.
- Left sidebar handles global docs navigation.
- Right TOC handles local page navigation.
- Code snippets are prominent, copyable, and accurate.
- Advanced compatibility APIs are clearly separated from preferred public APIs.
- The layout scales from desktop to mobile without horizontal page overflow.

# GeoForge Demo Studio Control System Plan

This plan defines every reusable UI control planned for the Mapbox-modelled GeoForge Demo Studio and docs surfaces. It is a design and implementation guide, not production code.

The control system should feel like a focused map editor: dark, precise, compact, map-first, and developer-friendly.

## Control System Principles

- The map remains visually dominant; controls support the canvas instead of competing with it.
- Blue means primary action, active state, or high-emphasis link only.
- Green means success, new, live, or completed status only.
- Pill controls are for navigation, activation, filters, and primary actions.
- Sharp 4-6px utility controls are for map tools, icon buttons, and compact editor actions.
- 24px radius containers are for major panels, cards, modals, code blocks, and contextual surfaces.
- Controls should be dense enough for expert use, but never ambiguous.
- Every icon-only control must have an accessible label and tooltip.
- Every mutating control must provide feedback through state, toast, event log, or visible map change.

## Tokens

### Color Tokens

| Token | Value | Role |
| --- | --- | --- |
| `--gf-void` | `#0e1012` | App background, toolbar background, deepest canvas |
| `--gf-panel` | `#15171b` | Sidebar, inspector, cards |
| `--gf-raised` | `#1c1f24` | Active category, nested panels, raised inputs |
| `--gf-overlay` | `#23262d` | Popovers, dropdown menus, tooltips |
| `--gf-line` | `#333943` | Borders and separators |
| `--gf-text` | `#ffffff` | Headings, active labels, icon foreground |
| `--gf-body` | `#a0aaba` | Body text and secondary labels |
| `--gf-muted` | `#566171` | Captions, metadata, inactive text |
| `--gf-blue` | `#007afc` | Primary actions, active states, key links |
| `--gf-green` | `#228a56` | New/live/success badges |
| `--gf-red` | `#e05252` | Destructive action and errors |
| `--gf-code` | `#0b0d10` | Code block background |

### Shape Tokens

| Token | Value | Role |
| --- | --- | --- |
| `--gf-radius-pill` | `100px` | Buttons, tabs, nav pills, segmented controls |
| `--gf-radius-card` | `24px` | Panels, modals, cards, code blocks |
| `--gf-radius-chip` | `12px` | Inline chips and compact tags |
| `--gf-radius-tool` | `6px` | Icon buttons, map controls, compact utility controls |
| `--gf-radius-badge` | `4px` | Status badges |

### Sizing Tokens

| Token | Value | Role |
| --- | --- | --- |
| `--gf-toolbar-height` | `62px` | Top toolbar |
| `--gf-sidebar-width` | `304px` | Demo Studio left sidebar |
| `--gf-inspector-width` | `364px` | Demo Studio right inspector |
| `--gf-control-height` | `34px` | Default compact controls |
| `--gf-control-height-lg` | `38px` | Primary action controls |
| `--gf-icon-control` | `36px` | Map and icon utility buttons |
| `--gf-gap-xs` | `6px` | Tight control grouping |
| `--gf-gap-sm` | `8px` | Related controls |
| `--gf-gap-md` | `12px` | Default stacked controls |
| `--gf-gap-lg` | `18px` | Panel sections |
| `--gf-gap-xl` | `24px` | Major surfaces |

## Component Inventory

### 1. Top Toolbar

Component name: `DemoTopToolbar`

Use for:

- Product identity.
- Active demo breadcrumb.
- Global actions.

Anatomy:

- GeoForge wordmark.
- Breadcrumb label.
- Optional unsaved/dirty indicator.
- Secondary utility buttons.
- One primary action.

States:

- Default.
- Demo dirty.
- Demo loading.
- Export unavailable.

Style:

- Height `62px`.
- Background `--gf-void`.
- Bottom border `--gf-line`.
- Subtle Mapbox-like dark bloom shadow.
- Wordmark in white, 18px, weight 800.
- Breadcrumb in `--gf-body`, 13px.

Accessibility:

- Use `<header>`.
- Breadcrumb should be readable text, not only visual.
- Global actions must be keyboard reachable.

### 2. Product Wordmark

Component name: `GeoForgeWordmark`

Use for:

- Top toolbar.
- Docs header.
- Optional loading/empty states.

Style:

- Text-only in first implementation.
- White, weight 800, tight tracking.
- No icon required until brand asset exists.

### 3. Breadcrumb

Component name: `BreadcrumbPath`

Use for:

- Top toolbar current location.
- Docs pages above H1.

Variants:

- Compact toolbar breadcrumb.
- Full docs breadcrumb.

Style:

- Toolbar: 13px `--gf-body`.
- Docs: 13px `--gf-muted`.
- Separator uses `/`.

### 4. Primary Pill Button

Component name: `PrimaryPillButton`

Use for:

- Export snippet.
- Open in Demo Studio.
- Copy install.
- Commit transaction.
- Confirm modal actions.

Style:

- Height 34-38px.
- Background `--gf-blue`.
- Text white.
- Radius `--gf-radius-pill`.
- Padding 16-18px.
- No shadow.

States:

- Default.
- Hover: slightly brighter blue or 1px inset highlight.
- Focus: visible blue/white outline.
- Disabled: background `--gf-raised`, text `--gf-muted`.
- Loading: spinner or text change, no layout shift.

Accessibility:

- Native `<button>`.
- Must expose loading state with `aria-busy` when async.

### 5. Secondary Pill Button

Component name: `SecondaryPillButton`

Use for:

- Docs.
- Examples.
- GitHub.
- View API reference.
- Cancel modal actions.

Style:

- Transparent background.
- Border `#bbc2ce` or `--gf-line`.
- Text white or `--gf-body` depending hierarchy.
- Radius pill.

States:

- Hover: border white, text white.
- Active: blue border/text or blue fill if acting as selected filter.
- Disabled: border `--gf-line`, text `--gf-muted`.

### 6. Utility Button

Component name: `UtilityButton`

Use for:

- Reset demo.
- Copy code.
- Collapse panel.
- Open event console.
- Inspector local actions.

Style:

- Height 34px.
- Radius 6px or pill depending placement.
- Border `--gf-line`.
- Background transparent or `--gf-raised`.
- Text `--gf-body`.

Rule:

- Use pill when the button reads as navigation/action text.
- Use 6px when it reads as a tool.

### 7. Icon Button

Component name: `IconButton`

Use for:

- Map zoom controls.
- Locate/fit bounds.
- Collapse/expand sidebar.
- Copy code.
- Clear event log.
- Undo/redo icon controls.

Style:

- 36x36px.
- Radius `--gf-radius-tool`.
- Background `rgba(21, 23, 27, 0.9)`.
- Border `--gf-line`.
- Icon white or `--gf-body`.

States:

- Hover: raised background.
- Active: blue fill.
- Disabled: muted icon and no pointer cursor.

Accessibility:

- Required `aria-label`.
- Required tooltip for non-obvious icons.

### 8. Search Input

Component name: `SearchInput`

Use for:

- Demo sidebar search.
- Docs search.
- Font/source/feature filtering.

Style:

- Height 34px.
- Radius pill.
- Transparent or raised background.
- Border `--gf-line`.
- Placeholder `--gf-muted`.
- Search icon left.

Behavior:

- Debounced input.
- Clear button appears when non-empty.
- Results should be scoped to current surface.

### 9. Sidebar Category Group

Component name: `DemoCategoryGroup`

Use for:

- Left Demo Studio navigation categories.

Anatomy:

- Category label.
- Optional count/new badge.
- Nested sub-demo links.
- Collapsible state.

Style:

- Active category: background `--gf-raised`, border `--gf-line`, radius 24px.
- Inactive category: transparent, no border.
- Category title: 14px, weight 700.

States:

- Collapsed.
- Expanded.
- Active.
- Contains active child.
- Disabled/planned.

### 10. Sub-Demo Nav Item

Component name: `SubDemoNavItem`

Use for:

- Nested demo routes inside each category.

Style:

- Height 30px.
- Radius pill.
- Active state: blue fill, white text.
- Inactive: transparent, `--gf-body`.

Accessibility:

- Current item should use `aria-current="page"` or equivalent.

### 11. Docs Sidebar Nav Item

Component name: `DocsNavItem`

Use for:

- Documentation global navigation.

Style:

- Similar to `SubDemoNavItem`.
- Parent groups use white text and stronger weight.
- Active docs page uses blue fill.

### 12. Right Inspector Shell

Component name: `InspectorPanel`

Use for:

- Active demo controls.
- State and code.
- Contextual docs links.

Anatomy:

- Header with eyebrow and title.
- Scrollable body.
- Control sections.
- Optional footer action strip.

Style:

- Width 364px desktop.
- Background `--gf-panel`.
- Left border `--gf-line`.

### 13. Inspector Section

Component name: `InspectorSection`

Use for:

- Grouping controls in the right inspector.

Examples:

- Placement.
- Animation.
- Selection.
- State.
- Code.
- Events.

Style:

- Background `--gf-raised`.
- Border `--gf-line`.
- Radius 24px.
- Padding 14px.
- Section title 14px, weight 700.

Behavior:

- Optional collapsible advanced state.
- Advanced sections closed by default when crowded.

### 14. Control Row

Component name: `ControlRow`

Use for:

- Label/value rows.
- Inline toggle rows.
- Compact state readouts.

Style:

- Min-height 34px.
- Top border except first row.
- Label `--gf-body`.
- Value white, weight 700.

### 15. Segmented Control

Component name: `SegmentedControl`

Use for:

- Decorator kind: arrowhead/text/symbol.
- Layer position: default/below/above.
- Rotation mode: line/fixed/viewport.
- Pointer mode: none/selected/always.
- Event filter groups.

Style:

- Pill outer frame.
- Background `--gf-raised`.
- Border `--gf-line`.
- Active segment blue fill.
- Inactive text `--gf-body`.

Behavior:

- Keyboard arrow navigation.
- Required label.

### 16. Toggle Switch

Component name: `ToggleSwitch`

Use for:

- Sync on render.
- Overlay visible.
- Iframe interactable.
- Selection active.
- History enabled.
- Snapping enabled.

Style:

- Pill track.
- Off: `--gf-overlay`.
- On: `--gf-blue`.
- Thumb white.

Accessibility:

- Use button with `role="switch"` or native checkbox styled as switch.
- Must expose checked state.

### 17. Checkbox

Component name: `CheckboxControl`

Use for:

- Multi-select options.
- Sandbox token lists.
- Allowed shapes.
- Event category filters.

Style:

- 16px square.
- Radius 4px.
- Checked fill blue.
- Focus ring visible.

Rule:

- Use checkbox for independent multi-select choices. Do not use toggles for large lists.

### 18. Radio Group

Component name: `RadioGroup`

Use for:

- Mutually exclusive options where all choices should be visible.

Examples:

- Metadata mode: duplicate/first/none.
- Transaction close behavior: cancel/commit/keep-active.

Style:

- Compact row or vertical list.
- Selected state blue dot or blue pill depending density.

### 19. Select Menu

Component name: `SelectMenu`

Use for:

- Long option sets.
- Easing selection.
- Source name selection.
- Feature selection by id.

Style:

- Height 34px.
- Background `--gf-raised`.
- Border `--gf-line`.
- Radius 6px.
- Chevron icon.

Behavior:

- Native select is acceptable for first implementation if styled consistently.
- Custom popover only if needed for search/multi-select.

### 20. Slider

Component name: `SliderControl`

Use for:

- Animation duration.
- Opacity.
- Size.
- Font size.
- Line offset.
- Max pixel distance.

Style:

- Track `--gf-line`.
- Filled track blue.
- Thumb white with blue focus ring.
- Numeric value shown at right.

Accessibility:

- Native range input.
- Visible numeric value.
- Supports keyboard increments.

### 21. Number Stepper

Component name: `NumberStepper`

Use for:

- Frequency number.
- Offset percent.
- Segment index.
- Max entries.
- Radius/size values when exact input matters.

Style:

- Input with adjacent minus/plus icon buttons.
- Height 34px.
- Radius 6px for tool-like exact entry.

### 22. Unit Input

Component name: `UnitInput`

Use for:

- Decorator frequency: number, `m`, `px`, special values.
- Offset start/end: `m` or `px`.
- Arrow size: `m`, `%`, `px`.

Anatomy:

- Numeric input.
- Unit select.
- Optional preset menu.

Style:

- Single grouped control with 6px radius.
- Unit segment separated by border.

### 23. Text Input

Component name: `TextInput`

Use for:

- Text decorator content.
- Overlay id.
- Iframe title.
- Feature property value.
- Search and filter text when not using `SearchInput`.

Style:

- Height 34px.
- Background `--gf-raised`.
- Border `--gf-line`.
- Radius 6px.
- Text white.
- Placeholder muted.

### 24. Textarea / Code Textarea

Component name: `TextareaControl`

Use for:

- Overlay HTML.
- GeoJSON import.
- Custom decorator resolver preview.
- Event payload display where editable.

Style:

- Dark code-like background for JSON/code.
- Radius 12-24px depending size.
- Monospace when code/data.

Behavior:

- Validation message below.
- Use fixed min-height to prevent layout jump.

### 25. Color Swatch Control

Component name: `ColorSwatchControl`

Use for:

- Decorator color.
- Text halo color.
- Selection highlight style.
- Overlay debug colors.

Style:

- Circular or 24px square swatch inside 34px row.
- Border `--gf-line`.
- Active swatch uses blue outline.

Rule:

- Do not let swatch palettes dominate the UI. Keep color controls inside inspector sections.

### 26. Action Strip

Component name: `ActionStrip`

Use for:

- Inspector footer actions.
- Transaction commit/cancel.
- Import/export actions.

Style:

- Horizontal flex row.
- Primary button on the right.
- Secondary/cancel button adjacent.
- Optional destructive action separated left.

### 27. Toolbar Button Group

Component name: `ToolbarButtonGroup`

Use for:

- Draw shape tools.
- Edit modes.
- Undo/redo.
- Map utility controls.

Style:

- Grouped 36px icon buttons.
- 6px radius on outer group.
- Internal separators with `--gf-line`.
- Active tool blue.

### 28. Shape Tool Button

Component name: `ShapeToolButton`

Use for:

- Marker, line, polygon, rectangle, circle, ellipse, text marker, circle marker.

Style:

- Icon button, 36px.
- Uses existing package control SVGs where suitable.
- Active draw mode blue fill.
- Disabled/reserved tools muted.

Accessibility:

- Label must include action, for example `Draw polygon`.

### 29. Map Control Button

Component name: `MapControlButton`

Use for:

- Zoom in.
- Zoom out.
- Fit features.
- Locate/center.
- Reset camera.

Style:

- Floating over map.
- 36px square.
- Radius 6px.
- Background translucent panel.
- Border line.

Rule:

- Keep map controls visually sharper than navigation pills to maintain Mapbox Studio tool feel.

### 30. Floating Map Card

Component name: `FloatingMapCard`

Use for:

- Short demo intro on the map.
- Feature selection summary.
- Topology issue preview.

Style:

- Background rgba panel.
- Border `--gf-line`.
- Radius 24px.
- Optional backdrop blur.
- Max width 360px.

Rule:

- Use sparingly. If it becomes a settings surface, move content to the inspector.

### 31. Status Badge

Component name: `StatusBadge`

Use for:

- New.
- Live.
- Stable.
- Advanced.
- Deprecated.
- Error/warning/success labels.

Style:

- Radius 4px.
- All-caps 9-10px.
- Wide letter spacing.

Color rules:

- New/live/success: green.
- Active/API stable: blue or neutral.
- Advanced: neutral dark.
- Deprecated/error: red.

### 32. Toast Notification

Component name: `ToastNotification`

Use for:

- Sync complete.
- Copied.
- Import success/failure.
- Transaction committed/cancelled.
- Topology validation result.

Placement:

- Bottom right above event console.

Style:

- Background `--gf-panel`.
- Border `--gf-line`.
- Radius 24px.
- Width around 284-320px.

Behavior:

- Auto-dismiss after 4-5 seconds unless error.
- Persistent errors until dismissed.
- Use polite live region.

### 33. Event Console Drawer

Component name: `EventConsoleDrawer`

Use for:

- Live event diagnostics.
- Filtering event types.
- Inspecting event payloads.

States:

- Collapsed: small bottom bar.
- Expanded: bottom drawer over map.
- Filtered.
- Empty.

Controls inside:

- Segmented filter.
- Search.
- Clear.
- Copy payload.
- Pause/resume stream.

Style:

- Dark panel over map.
- Border top `--gf-line`.
- Event rows use monospace event names.

### 34. Event Row

Component name: `EventRow`

Use for:

- Individual event line inside console.

Anatomy:

- Timestamp.
- Event name.
- Category badge.
- Summary.
- Expand chevron.

Style:

- Dense row, 32-40px.
- Monospace timestamp/event name.
- Expanded payload in code block.

### 35. Code Block

Component name: `CodeBlock`

Use for:

- Active demo snippet.
- Docs examples.
- Event payloads.

Style:

- Background `--gf-code`.
- Border `#252a31`.
- Radius 24px for major snippets, 12px for compact payloads.
- Monospace 12-13px.

Controls:

- Copy button.
- Optional language badge.
- Optional "Open docs" link.

### 36. Copy Button

Component name: `CopyButton`

Use for:

- Code snippets.
- GeoJSON export.
- Event payload.
- Install command.

Behavior:

- On success: label changes to `Copied` briefly and toast fires.
- On failure: error toast.

### 37. Data Table

Component name: `DataTable`

Use for:

- Feature list.
- Segment list.
- Topology issues.
- History entries.
- GeoJSON source list.

Style:

- Dark surface.
- Header muted uppercase.
- Rows separated by `--gf-line`.
- Active row raised or blue-left indicator.

Rule:

- Use tables for comparison and lists where scanning columns matters. Do not use cards for dense technical rows.

### 38. Feature List Row

Component name: `FeatureListRow`

Use for:

- Feature Data demo.
- Selection demo.
- Geometry Tools demo.

Anatomy:

- Shape icon.
- Feature id.
- Source name.
- Shape/type.
- Selected/editable state badge.

Behavior:

- Click selects feature and pans/highlights map.

### 39. Empty State

Component name: `EmptyState`

Use for:

- No events.
- No selected feature.
- No topology issues.
- Empty import result.

Style:

- Text-dominant.
- Optional small icon.
- One action max.
- No large illustrations.

### 40. Validation Message

Component name: `ValidationMessage`

Use for:

- Invalid GeoJSON.
- Transaction validation.
- Overlay corner validation.
- Topology issues.

Style:

- Compact text row.
- Error red for errors.
- Warning amber only if introduced as functional status, not as brand accent.
- Include icon and text; do not rely on color only.

### 41. Modal Dialog

Component name: `ModalDialog`

Use for:

- Import GeoJSON confirmation.
- Export/copy large payload.
- Reset demo confirmation.
- Advanced settings.

Style:

- Centered over map/shell.
- Dark panel, radius 24px.
- Scrim rgba black.
- Header, body, action strip.

Behavior:

- Escape closes unless action is destructive and confirmation is required.
- Focus trap.
- Restore focus on close.

### 42. Slide-Over Drawer

Component name: `SlideOverDrawer`

Use for:

- Tablet/mobile inspector.
- Docs nav on smaller screens.
- Advanced developer drawer.

Style:

- Right or bottom depending viewport.
- Dark panel.
- Border line.

### 43. Tooltip

Component name: `Tooltip`

Use for:

- Icon buttons.
- Advanced API option hints.
- Disabled control reasons.

Style:

- Background `--gf-overlay`.
- Text white/body.
- Radius 6px.
- No decorative arrow required.

Behavior:

- Hover and focus.
- Never the only source of critical information.

### 44. Popover Menu

Component name: `PopoverMenu`

Use for:

- Export options.
- More actions.
- Feature row context menu.
- Event row actions.

Style:

- Background `--gf-overlay`.
- Border `--gf-line`.
- Radius 12px or 24px depending size.
- Menu items 34px high.

### 45. File Dropzone

Component name: `FileDropzone`

Use for:

- GeoJSON import.
- Optional future sample uploads.

Style:

- Dashed border `--gf-line`.
- Radius 24px.
- Background `--gf-raised`.
- Primary select-files pill.

Behavior:

- Drag hover state.
- Selected file summary.
- Clear/reselect.
- Validation messages.

### 46. JSON Editor Panel

Component name: `JsonEditorPanel`

Use for:

- Import GeoJSON.
- Export GeoJSON.
- Feature property editing.

Style:

- Code textarea.
- Header with format, copy, validate.
- Footer validation/status.

Behavior:

- Validate on blur or explicit validate action.
- Do not validate aggressively on every keystroke for large payloads.

### 47. Property Editor Row

Component name: `PropertyEditorRow`

Use for:

- Feature properties.
- Segment metadata.
- Overlay iframe options.

Anatomy:

- Property key.
- Value control.
- Type badge.
- Reset/remove action.

### 48. Coordinate Input Group

Component name: `CoordinateInputGroup`

Use for:

- HTML overlay corners.
- Marker positioning.
- Endpoint coordinates.

Anatomy:

- Longitude input.
- Latitude input.
- Pick-from-map action.

Style:

- Compact grouped fields.
- Tool button for map pick.

### 49. Corner Editor

Component name: `CornerEditor`

Use for:

- HTML overlay `topLeft`, `topRight`, `bottomRight`, `bottomLeft`.

Controls:

- Four coordinate input groups.
- Pick all corners from map.
- Validate rectangle.
- Reset rectangle.

### 50. History Strip

Component name: `HistoryStrip`

Use for:

- Undo/redo demo.
- Inspector footer when history is relevant.

Controls:

- Undo icon button.
- Redo icon button.
- Undo/redo counts.
- Last entry label.

Style:

- Compact raised section.
- Disabled buttons muted.

### 51. Transaction Footer

Component name: `TransactionFooter`

Use for:

- Context panel transaction demos.

Controls:

- Dirty state indicator.
- Cancel.
- Commit.
- Validation messages.

Behavior:

- Commit disabled when invalid.
- Cancel restores preview state.
- Commit toast includes `historyEntryId` when available.

### 52. Progress / Loading Indicator

Component name: `LoadingIndicator`

Use for:

- Map loading.
- Demo setup.
- Import/export processing.

Style:

- Small inline spinner for controls.
- Skeleton/placeholder for panels.
- Avoid full-screen spinner unless initial map is not ready.

### 53. Split Button

Component name: `SplitButton`

Use for:

- Export snippet with options.
- Import with sample choices.

Style:

- Primary pill action plus small chevron segment.
- Same blue role rules.

### 54. Sample Preset Picker

Component name: `PresetPicker`

Use for:

- Seed data scenarios.
- Decorator presets.
- Overlay templates.
- Topology sample networks.

Style:

- Select menu for many presets.
- Segmented/pill group for 2-4 presets.

## Demo-Specific Control Mapping

### Draw And Edit

Controls:

- Shape tool button group.
- Edit mode segmented control.
- Snapping toggle.
- Clear/reset utility button.
- Feature list table.
- Selection state badge.

### Line Decorators

Controls:

- Decorator kind segmented control.
- Unit input for frequency and offsets.
- Select menu for special frequencies.
- Segment target segmented control.
- Anchor segmented control.
- Layer position segmented control.
- Rotation mode segmented control.
- Sliders for size, opacity, font size, offset.
- Color swatches for text/halo.
- Animation toggle.
- Animation property select.
- Duration slider/number stepper.
- Easing select.
- Code block with copy.

### HTML Overlays

Controls:

- Overlay visibility toggle.
- Selected overlay segmented/list selector.
- Corner editor.
- Textarea for HTML.
- Iframe interactable toggle.
- Pointer mode segmented control.
- Sandbox token checkboxes.
- Validation message list.

### Feature Data

Controls:

- File dropzone.
- JSON editor panel.
- Import/export action strip.
- Source select menu.
- Feature table.
- Copy GeoJSON button.

### Geometry Tools

Controls:

- Tool mode segmented control.
- Max pixel distance slider.
- Segment/vertex hit state panel.
- Topology issue data table.
- Endpoint connect action strip.
- Merge plan preview table.
- Validation badges.

### Workflow Systems

Controls:

- Selection toggle.
- Allowed shapes checkbox list.
- Context panel open/close buttons.
- Transaction footer.
- History strip.
- Event console drawer.
- Event filter segmented control.

## Implementation Scaffold

Recommended component locations:

```text
examples/demo-studio/src/ui/tokens.css
examples/demo-studio/src/ui/components/
examples/demo-studio/src/ui/controls/
examples/demo-studio/src/ui/panels/
examples/demo-studio/src/ui/map/
examples/demo-studio/src/demos/
```

Suggested first components:

1. `DemoTopToolbar`
2. `DemoSidebar`
3. `InspectorPanel`
4. `InspectorSection`
5. `PrimaryPillButton`
6. `IconButton`
7. `SegmentedControl`
8. `ToggleSwitch`
9. `SliderControl`
10. `CodeBlock`
11. `ToastNotification`
12. `EventConsoleDrawer`

Build order:

1. Tokens and base controls.
2. Shell controls.
3. Inspector controls.
4. Feedback controls.
5. Demo-specific composed controls.

## Acceptance Criteria

- Every demo control traces to this plan or a later approved addition.
- Controls follow the Mapbox-style token and radius rules.
- Icon-only controls have tooltips and accessible names.
- Blue is used only for primary/active/high-emphasis states.
- Control states include hover, focus, active, disabled, and loading where applicable.
- The inspector never becomes a miscellaneous control dump.
- Demo-specific controls compose from reusable primitives instead of ad hoc CSS.

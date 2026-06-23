# Demo Studio Navigation Organization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Demo Studio category ordering, legacy hash targeting, and WMS/WMTS layer management feel first-class and predictable enough to retire the legacy playground confidently.

**Architecture:** Keep Demo Studio registry-driven. Add a small navigation/ordering helper that maps hashes to category/demo selection and sorts categories/demos by explicit metadata. Promote WMS/WMTS from an always-injected inspector child into a registered `Map Layers` demo while retaining compact layer access in non-layer demos.

**Tech Stack:** Svelte 5, TypeScript, Vitest, Playwright/Vite playground, MapLibre GeoForge demo registry.

---

## File Structure

- Modify `examples/playground/src/demo-studio/registry/types.ts`
  - Add optional navigation metadata to categories and demos.
  - Add the new `map-layers` category id.
- Modify `examples/playground/src/demo-studio/registry/demoRegistry.ts`
  - Add explicit `navOrder` values.
  - Add the new `Map Layers` category between `Feature Data` and `Geometry Tools`.
  - Export a sorted registry instead of relying on raw array order.
- Create `examples/playground/src/demo-studio/registry/navigation.ts`
  - Own hash-to-selection mapping.
  - Own category/demo sorting helpers.
  - Keep route-family resolution separate in `main.ts`.
- Modify `examples/playground/src/demo-studio/DemoStudioApp.svelte`
  - Initialize from `resolveDemoSelectionFromHash(window.location.hash)`.
  - React to hash changes that stay inside Demo Studio.
  - Pass WMS/WMTS handlers into the map-layers demo inspector.
  - Keep compact custom raster access visible for non-layer demos.
- Create `examples/playground/src/demo-studio/demos/map-layers/mapLayerDemos.ts`
  - Register the WMS/WMTS demo definition.
- Create `examples/playground/src/demo-studio/demos/map-layers/MapLayersInspector.svelte`
  - Render the full `CustomRasterLayerPanel` as the primary active demo inspector.
- Modify `examples/playground/src/demo-studio/CustomRasterLayerPanel.svelte`
  - Add a `density` prop: `full` for the first-class demo, `compact` for the persistent panel.
- Modify `examples/playground/src/demo-studio/InspectorPanel.svelte`
  - Preserve current child slot behavior for compact layer access.
- Modify `tests/playground/legacyRetirement.test.ts`
  - Assert legacy hash destination, not only route family.
- Create `tests/playground/demoStudioNavigation.test.ts`
  - Assert ordering, sorting, aliases, and hash selection.
- Create `tests/playground/mapLayerDemos.test.ts`
  - Assert map layer demo metadata and no-op setup contract.
- Optional follow-on docs update: `docs/legacy-playground-gap-audit.md`
  - Update “current category coverage” and “Recommended Path” after implementation.

---

## Task 1: Add Registry Navigation Metadata And Sorting

**Files:**
- Modify: `examples/playground/src/demo-studio/registry/types.ts`
- Create: `examples/playground/src/demo-studio/registry/navigation.ts`
- Modify: `examples/playground/src/demo-studio/registry/demoRegistry.ts`
- Test: `tests/playground/demoStudioNavigation.test.ts`

- [ ] **Step 1: Write failing navigation tests**

Create `tests/playground/demoStudioNavigation.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { demoRegistry } from '../../examples/playground/src/demo-studio/registry/demoRegistry.ts';
import {
  findDemoSelection,
  resolveDemoSelectionFromHash,
  sortDemoCategories,
} from '../../examples/playground/src/demo-studio/registry/navigation.ts';
import type { DemoCategory } from '../../examples/playground/src/demo-studio/registry/types.ts';

describe('Demo Studio navigation registry', () => {
  it('orders categories around the user workflow', () => {
    expect(demoRegistry.map((category) => category.id)).toEqual([
      'draw-edit',
      'feature-data',
      'map-layers',
      'geometry-tools',
      'line-decorators',
      'overlays',
      'workflow-systems',
    ]);
  });

  it('sorts categories and demos by explicit navOrder', () => {
    const categories: DemoCategory[] = [
      {
        id: 'workflow-systems',
        title: 'Workflow Systems',
        description: 'Workflow demos',
        navOrder: 30,
        demos: [
          {
            id: 'workflow-b',
            title: 'Workflow B',
            description: 'Second',
            docsPath: '/docs/context-panels',
            navOrder: 2,
            code: () => '',
            inspector: (() => null) as never,
            setup: () => ({ teardown: () => {} }),
          },
          {
            id: 'workflow-a',
            title: 'Workflow A',
            description: 'First',
            docsPath: '/docs/context-panels',
            navOrder: 1,
            code: () => '',
            inspector: (() => null) as never,
            setup: () => ({ teardown: () => {} }),
          },
        ],
      },
      {
        id: 'draw-edit',
        title: 'Draw And Edit',
        description: 'Draw demos',
        navOrder: 10,
        demos: [],
      },
    ];

    const sorted = sortDemoCategories(categories);

    expect(sorted.map((category) => category.id)).toEqual(['draw-edit', 'workflow-systems']);
    expect(sorted[1]?.demos.map((demo) => demo.id)).toEqual(['workflow-a', 'workflow-b']);
  });

  it('resolves legacy hashes to migrated demos', () => {
    expect(resolveDemoSelectionFromHash('#decorators')).toEqual({
      categoryId: 'line-decorators',
      demoId: 'line-decorators-advanced-authoring',
    });
    expect(resolveDemoSelectionFromHash('#overlays')).toEqual({
      categoryId: 'overlays',
      demoId: 'overlays-pointer-modes',
    });
  });

  it('resolves layer hash aliases to the WMS/WMTS layer demo', () => {
    expect(resolveDemoSelectionFromHash('#layers')).toEqual({
      categoryId: 'map-layers',
      demoId: 'map-layers-wms-wmts',
    });
    expect(resolveDemoSelectionFromHash('#wms-wmts')).toEqual({
      categoryId: 'map-layers',
      demoId: 'map-layers-wms-wmts',
    });
  });

  it('falls back to the first registered demo for unknown hashes', () => {
    expect(resolveDemoSelectionFromHash('#missing')).toEqual({
      categoryId: 'draw-edit',
      demoId: 'draw-edit-modes',
    });
  });

  it('finds only valid category and demo pairs', () => {
    expect(findDemoSelection(demoRegistry, 'line-decorators', 'line-decorators-arrowheads')).toEqual({
      categoryId: 'line-decorators',
      demoId: 'line-decorators-arrowheads',
    });
    expect(findDemoSelection(demoRegistry, 'line-decorators', 'missing')).toBeNull();
    expect(findDemoSelection(demoRegistry, 'missing', 'line-decorators-arrowheads')).toBeNull();
  });
});
```

- [ ] **Step 2: Run the failing tests**

Run:

```bash
pnpm vitest run tests/playground/demoStudioNavigation.test.ts
```

Expected: fail because `navigation.ts`, `map-layers`, and `navOrder` do not exist yet.

- [ ] **Step 3: Extend registry types**

Modify `examples/playground/src/demo-studio/registry/types.ts`:

```ts
export type DemoCategoryId =
  | 'draw-edit'
  | 'feature-data'
  | 'map-layers'
  | 'geometry-tools'
  | 'line-decorators'
  | 'overlays'
  | 'workflow-systems';

export type DemoSelection = {
  categoryId: DemoCategoryId;
  demoId: string;
};
```

Then extend `DemoDefinition`:

```ts
export type DemoDefinition<TInspectorProps extends object = Record<string, unknown>> = {
  id: string;
  title: string;
  description: string;
  docsPath: string;
  navOrder?: number;
  aliases?: string[];
  code: () => string;
  inspector: Component<TInspectorProps>;
  setup: (context: DemoContext) => DemoSetupResult | Promise<DemoSetupResult>;
};
```

And extend `DemoCategory`:

```ts
export type DemoCategory = {
  id: DemoCategoryId;
  title: string;
  description: string;
  navOrder?: number;
  aliases?: string[];
  demos: RegisteredDemoDefinition[];
};
```

- [ ] **Step 4: Add navigation helper**

Create `examples/playground/src/demo-studio/registry/navigation.ts`:

```ts
import type { DemoCategory, DemoCategoryId, DemoSelection, RegisteredDemoDefinition } from './types.ts';

const defaultSelection: DemoSelection = {
  categoryId: 'draw-edit',
  demoId: 'draw-edit-modes',
};

const hashSelectionAliases = new Map<string, DemoSelection>([
  ['#demo-studio', defaultSelection],
  ['', defaultSelection],
  ['#draw-edit', defaultSelection],
  ['#decorators', {
    categoryId: 'line-decorators',
    demoId: 'line-decorators-advanced-authoring',
  }],
  ['#line-decorators', {
    categoryId: 'line-decorators',
    demoId: 'line-decorators-arrowheads',
  }],
  ['#overlays', {
    categoryId: 'overlays',
    demoId: 'overlays-pointer-modes',
  }],
  ['#layers', {
    categoryId: 'map-layers',
    demoId: 'map-layers-wms-wmts',
  }],
  ['#map-layers', {
    categoryId: 'map-layers',
    demoId: 'map-layers-wms-wmts',
  }],
  ['#wms', {
    categoryId: 'map-layers',
    demoId: 'map-layers-wms-wmts',
  }],
  ['#wmts', {
    categoryId: 'map-layers',
    demoId: 'map-layers-wms-wmts',
  }],
  ['#wms-wmts', {
    categoryId: 'map-layers',
    demoId: 'map-layers-wms-wmts',
  }],
]);

export function resolveDemoSelectionFromHash(hash: string): DemoSelection {
  const normalizedHash = hash.trim().toLowerCase();

  return hashSelectionAliases.get(normalizedHash) ?? defaultSelection;
}

export function findDemoSelection(
  categories: DemoCategory[],
  categoryId: string,
  demoId: string,
): DemoSelection | null {
  const category = categories.find((candidate) => candidate.id === categoryId);

  if (!category) {
    return null;
  }

  const demo = category.demos.find((candidate) => candidate.id === demoId);

  if (!demo) {
    return null;
  }

  return {
    categoryId: category.id,
    demoId: demo.id,
  };
}

export function sortDemoCategories(categories: DemoCategory[]): DemoCategory[] {
  return [...categories]
    .sort(compareNavItems)
    .map((category) => ({
      ...category,
      demos: sortDemos(category.demos),
    }));
}

function sortDemos(demos: RegisteredDemoDefinition[]) {
  return [...demos].sort(compareNavItems);
}

function compareNavItems(left: { title: string; navOrder?: number }, right: { title: string; navOrder?: number }) {
  const leftOrder = left.navOrder ?? Number.MAX_SAFE_INTEGER;
  const rightOrder = right.navOrder ?? Number.MAX_SAFE_INTEGER;

  if (leftOrder !== rightOrder) {
    return leftOrder - rightOrder;
  }

  return left.title.localeCompare(right.title);
}
```

- [ ] **Step 5: Add temporary map-layers category placeholder**

This task only adds ordering support. The full WMS/WMTS demo is implemented in Task 2. For now, add an import that Task 2 will satisfy:

```ts
import { mapLayerDemos } from '../demos/map-layers/mapLayerDemos.ts';
import { sortDemoCategories } from './navigation.ts';
```

Then rewrite `demoRegistry.ts` to use explicit order:

```ts
export const demoRegistry: DemoCategory[] = sortDemoCategories([
  {
    id: 'draw-edit',
    title: 'Draw And Edit',
    description: 'Create and modify GeoForge map features with drawing, edit, snapping, and marker helpers.',
    navOrder: 10,
    demos: drawEditDemos
  },
  {
    id: 'feature-data',
    title: 'Feature Data',
    description: 'Import, export, identify, and inspect GeoForge features across package-safe data flows.',
    navOrder: 20,
    demos: featureDataDemos
  },
  {
    id: 'map-layers',
    title: 'Map Layers',
    description: 'Discover, add, reorder, and remove WMS/WMTS raster layers above the basemap.',
    navOrder: 30,
    aliases: ['wms', 'wmts', 'raster', 'layers'],
    demos: mapLayerDemos
  },
  {
    id: 'geometry-tools',
    title: 'Geometry Tools',
    description: 'Measure, edit, connect, and validate line geometry for serious map editing workflows.',
    navOrder: 40,
    demos: geometryDemos
  },
  {
    id: 'line-decorators',
    title: 'Line Decorators',
    description: 'Render arrows, labels, symbols, and animated decorations on route and network lines.',
    navOrder: 50,
    demos: lineDecoratorDemos
  },
  {
    id: 'overlays',
    title: 'Overlays',
    description: 'Anchor iframe-backed HTML overlays to map coordinates and inspect interaction behavior.',
    navOrder: 60,
    demos: overlayDemos
  },
  {
    id: 'workflow-systems',
    title: 'Workflow Systems',
    description: 'Build application workflows with selection, panels, transactions, history, and diagnostics.',
    navOrder: 70,
    demos: workflowDemos
  }
]);
```

- [ ] **Step 6: Add navOrder to existing demos**

Use these values:

```ts
// drawEditDemos.ts
navOrder: 10,

// featureDataDemos.ts
navOrder: 10,
aliases: ['geojson', 'import', 'export', 'feature store'],

// geometryDemos.ts
navOrder: 10,
aliases: ['topology', 'network', 'validation'],

// workflowDemos.ts
navOrder: 10,
aliases: ['transactions', 'history', 'undo', 'redo'],

// lineDecoratorDemos.ts
// Arrowheads demo
navOrder: 10,
aliases: ['decorators', 'arrows', 'route'],

// Advanced decorator authoring demo
navOrder: 20,
aliases: ['legacy', 'decorators', 'svg', 'symbols', 'animation'],

// overlayDemos.ts
// HTML iframe overlay
navOrder: 10,
aliases: ['iframe', 'html'],

// Overlay pointer modes
navOrder: 20,
aliases: ['legacy', 'iframe', 'pointer events'],
```

- [ ] **Step 7: Run navigation tests**

Run:

```bash
pnpm vitest run tests/playground/demoStudioNavigation.test.ts
```

Expected: pass after Task 2 creates `mapLayerDemos.ts`; until then the failure should only be the missing map-layers module.

- [ ] **Step 8: Commit**

Commit after Task 2 if this task cannot compile independently because of the new import. If Task 2 is done in the same worktree, commit both tasks together:

```bash
git add examples/playground/src/demo-studio/registry tests/playground/demoStudioNavigation.test.ts examples/playground/src/demo-studio/demos
git commit -m "feat: add demo studio navigation metadata"
```

---

## Task 2: Promote WMS/WMTS To A First-Class Map Layers Demo

**Files:**
- Create: `examples/playground/src/demo-studio/demos/map-layers/MapLayersInspector.svelte`
- Create: `examples/playground/src/demo-studio/demos/map-layers/mapLayerDemos.ts`
- Modify: `examples/playground/src/demo-studio/CustomRasterLayerPanel.svelte`
- Modify: `examples/playground/src/demo-studio/DemoStudioApp.svelte`
- Test: `tests/playground/mapLayerDemos.test.ts`

- [ ] **Step 1: Write failing map layer demo tests**

Create `tests/playground/mapLayerDemos.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { mapLayerDemos } from '../../examples/playground/src/demo-studio/demos/map-layers/mapLayerDemos.ts';
import type { DemoContext } from '../../examples/playground/src/demo-studio/registry/types.ts';

describe('map layer demos', () => {
  it('registers the WMS/WMTS custom layer demo', () => {
    expect(mapLayerDemos).toHaveLength(1);
    expect(mapLayerDemos[0]).toMatchObject({
      id: 'map-layers-wms-wmts',
      title: 'WMS/WMTS custom layers',
      docsPath: '/docs/custom-raster-layers',
      navOrder: 10,
    });
    expect(mapLayerDemos[0]?.aliases).toEqual(
      expect.arrayContaining(['wms', 'wmts', 'raster', 'z-index']),
    );
  });

  it('uses a no-op setup because layer state is owned by DemoStudioApp', () => {
    const setCode = vi.fn();
    const setupResult = mapLayerDemos[0]?.setup({
      setCode,
      signal: new AbortController().signal,
      isCurrent: () => true,
      notify: vi.fn(),
      logEvent: vi.fn(),
      setInspectorProps: vi.fn(),
      map: {} as DemoContext['map'],
      geoForge: {} as DemoContext['geoForge'],
    });

    expect(setupResult).toMatchObject({ teardown: expect.any(Function) });
    expect(setCode).toHaveBeenCalledWith(expect.stringContaining('geoForge.layers.addRasterLayer'));
  });
});
```

- [ ] **Step 2: Run failing test**

Run:

```bash
pnpm vitest run tests/playground/mapLayerDemos.test.ts
```

Expected: fail because `map-layers` files do not exist.

- [ ] **Step 3: Create MapLayersInspector**

Create `examples/playground/src/demo-studio/demos/map-layers/MapLayersInspector.svelte`:

```svelte
<script lang="ts">
  import type { DiscoveredRasterLayer, GeomanRasterLayer } from 'maplibre-geoforge';
  import CustomRasterLayerPanel from '../../CustomRasterLayerPanel.svelte';

  type MapLayersInspectorProps = {
    layers: GeomanRasterLayer[];
    disabled?: boolean;
    onDiscover: (url: string) => Promise<DiscoveredRasterLayer[]>;
    onAdd: (input: { name: string; url: string }) => void;
    onAddMany: (layers: Array<{ name: string; url: string }>) => void;
    onMove: (layerId: string, direction: -1 | 1) => void;
    onRemove: (layerId: string) => void;
  };

  let {
    layers,
    disabled = false,
    onDiscover,
    onAdd,
    onAddMany,
    onMove,
    onRemove,
  }: MapLayersInspectorProps = $props();
</script>

<CustomRasterLayerPanel
  density="full"
  {layers}
  {disabled}
  {onDiscover}
  {onAdd}
  {onAddMany}
  {onMove}
  {onRemove}
/>
```

- [ ] **Step 4: Create map layer demo definition**

Create `examples/playground/src/demo-studio/demos/map-layers/mapLayerDemos.ts`:

```ts
import type { DemoDefinition } from '../../registry/types.ts';
import MapLayersInspector from './MapLayersInspector.svelte';

export const mapLayerDemos: DemoDefinition[] = [
  {
    id: 'map-layers-wms-wmts',
    title: 'WMS/WMTS custom layers',
    description: 'Discover, add, remove, and reorder WMS/WMTS raster layers above the basemap and below GeoForge features.',
    docsPath: '/docs/custom-raster-layers',
    navOrder: 10,
    aliases: ['wms', 'wmts', 'raster', 'tile layers', 'z-index', 'layers'],
    code: buildMapLayersSnippet,
    inspector: MapLayersInspector,
    setup: (context) => {
      const code = buildMapLayersSnippet();
      context.setCode(code);

      return {
        code,
        teardown: () => {},
      };
    },
  },
];

function buildMapLayersSnippet() {
  return `geoForge.layers.configureRasterLayers({
  map,
  transformRequestUrl: buildCustomRasterTileUrl,
  transformTileUrl: buildCustomRasterTileUrl,
});

const discoveredLayers = await geoForge.layers.discoverRasterLayers(wmsOrWmtsUrl);

geoForge.layers.addRasterLayer({
  name: 'NUTS boundaries',
  url: discoveredLayers[0]?.url ?? wmsOrWmtsUrl,
});

// New layers are inserted at the top of the custom raster stack.
// Custom raster layers render above the base XYZ tilemap and below GeoForge feature layers.
geoForge.layers.reorderRasterLayer(layerId, -1);
geoForge.layers.removeRasterLayer(layerId);

const currentLayers = geoForge.layers.getRasterLayers();`;
}
```

- [ ] **Step 5: Add density prop to CustomRasterLayerPanel**

Modify `examples/playground/src/demo-studio/CustomRasterLayerPanel.svelte` props:

```ts
type CustomRasterLayerPanelProps = {
  layers: GeomanRasterLayer[];
  density?: 'compact' | 'full';
  disabled?: boolean;
  onDiscover: (url: string) => Promise<DiscoveredRasterLayer[]>;
  onAdd: (input: { name: string; url: string }) => void;
  onAddMany: (layers: Array<{ name: string; url: string }>) => void;
  onMove: (layerId: string, direction: -1 | 1) => void;
  onRemove: (layerId: string) => void;
};

let {
  layers,
  density = 'compact',
  disabled = false,
  onDiscover,
  onAdd,
  onAddMany,
  onMove,
  onRemove
}: CustomRasterLayerPanelProps = $props();
```

Modify root markup:

```svelte
<section
  class="custom-raster-panel"
  class:full-density={density === 'full'}
  aria-label="Custom WMS and WMTS layers"
>
```

Add full-density CSS:

```css
.full-density {
  background: color-mix(in srgb, var(--gf-raised) 86%, var(--gf-blue) 4%);
}

.full-density textarea {
  min-height: 120px;
}

.full-density .discovered-list {
  max-height: 320px;
}
```

- [ ] **Step 6: Wire map-layer inspector props in DemoStudioApp**

In `examples/playground/src/demo-studio/DemoStudioApp.svelte`, add derived props:

```ts
const isMapLayersDemo = $derived(activeDemo.id === 'map-layers-wms-wmts');
const activeInspectorProps = $derived(
  isMapLayersDemo
    ? {
        ...inspectorProps,
        layers: customRasterLayers,
        disabled: !geoForge,
        onDiscover: handleDiscoverCustomRasterLayers,
        onAdd: handleAddCustomRasterLayer,
        onAddMany: handleAddCustomRasterLayers,
        onMove: handleMoveCustomRasterLayer,
        onRemove: handleRemoveCustomRasterLayer,
      }
    : inspectorProps,
);
```

Pass `activeInspectorProps` into `InspectorPanel`:

```svelte
<InspectorPanel
  demo={activeDemo}
  code={code}
  inspectorProps={activeInspectorProps}
  inspectorKey={inspectorKey}
>
```

Render the compact global layer panel only outside the map-layers demo:

```svelte
{#if !isMapLayersDemo}
  <CustomRasterLayerPanel
    density="compact"
    layers={customRasterLayers}
    disabled={!geoForge}
    onDiscover={handleDiscoverCustomRasterLayers}
    onAdd={handleAddCustomRasterLayer}
    onAddMany={handleAddCustomRasterLayers}
    onMove={handleMoveCustomRasterLayer}
    onRemove={handleRemoveCustomRasterLayer}
  />
{/if}
```

- [ ] **Step 7: Run focused tests**

Run:

```bash
pnpm vitest run tests/playground/mapLayerDemos.test.ts tests/playground/demoStudioNavigation.test.ts
```

Expected: pass.

- [ ] **Step 8: Run typecheck for Svelte playground**

Run:

```bash
pnpm --dir examples/playground exec tsc --noEmit
```

Expected: pass.

- [ ] **Step 9: Commit**

```bash
git add examples/playground/src/demo-studio tests/playground/mapLayerDemos.test.ts tests/playground/demoStudioNavigation.test.ts
git commit -m "feat: promote wms wmts layers in demo studio"
```

---

## Task 3: Make Demo Studio Select The Correct Demo From Hashes

**Files:**
- Modify: `examples/playground/src/demo-studio/DemoStudioApp.svelte`
- Modify: `tests/playground/legacyRetirement.test.ts`
- Test: `tests/playground/demoStudioNavigation.test.ts`

- [ ] **Step 1: Extend legacy retirement tests**

Modify `tests/playground/legacyRetirement.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { resolveRouteFamilyFromHash } from '../../examples/playground/src/main.ts';
import { resolveDemoSelectionFromHash } from '../../examples/playground/src/demo-studio/registry/navigation.ts';

describe('legacy playground retirement', () => {
  it('routes legacy playground hashes to Demo Studio', () => {
    expect(resolveRouteFamilyFromHash('')).toBe('demo-studio');
    expect(resolveRouteFamilyFromHash('#decorators')).toBe('demo-studio');
    expect(resolveRouteFamilyFromHash('#overlays')).toBe('demo-studio');
    expect(resolveRouteFamilyFromHash('#demo-studio')).toBe('demo-studio');
    expect(resolveRouteFamilyFromHash('#control-board')).toBe('control-board');
  });

  it('selects migrated legacy demos for legacy hashes', () => {
    expect(resolveDemoSelectionFromHash('#decorators')).toEqual({
      categoryId: 'line-decorators',
      demoId: 'line-decorators-advanced-authoring',
    });
    expect(resolveDemoSelectionFromHash('#overlays')).toEqual({
      categoryId: 'overlays',
      demoId: 'overlays-pointer-modes',
    });
  });
});
```

- [ ] **Step 2: Run failing or incomplete route tests**

Run:

```bash
pnpm vitest run tests/playground/legacyRetirement.test.ts tests/playground/demoStudioNavigation.test.ts
```

Expected: helper tests pass after Task 1. UI behavior still needs implementation in `DemoStudioApp.svelte`.

- [ ] **Step 3: Initialize Studio state from hash**

Modify imports in `DemoStudioApp.svelte`:

```ts
import {
  findDemoSelection,
  resolveDemoSelectionFromHash,
} from './registry/navigation.ts';
```

Replace initial active state:

```ts
const initialSelection = findDemoSelection(
  categories,
  resolveDemoSelectionFromHash(window.location.hash).categoryId,
  resolveDemoSelectionFromHash(window.location.hash).demoId,
) ?? {
  categoryId: initialCategory?.id ?? '',
  demoId: initialDemo?.id ?? '',
};

let activeCategoryId = $state(initialSelection.categoryId);
let activeDemoId = $state(initialSelection.demoId);
```

If direct `window` access creates SSR/test friction, use:

```ts
const currentHash = typeof window === 'undefined' ? '' : window.location.hash;
```

- [ ] **Step 4: Handle hash changes inside mounted Demo Studio**

Add an effect or mount handler in `DemoStudioApp.svelte`:

```ts
$effect(() => {
  if (typeof window === 'undefined') {
    return;
  }

  const handleStudioHashChange = () => {
    const requestedSelection = resolveDemoSelectionFromHash(window.location.hash);
    const nextSelection = findDemoSelection(
      categories,
      requestedSelection.categoryId,
      requestedSelection.demoId,
    );

    if (!nextSelection) {
      return;
    }

    handleSelect(nextSelection.categoryId, nextSelection.demoId);
  };

  window.addEventListener('hashchange', handleStudioHashChange);

  return () => {
    window.removeEventListener('hashchange', handleStudioHashChange);
  };
});
```

- [ ] **Step 5: Run focused unit tests**

Run:

```bash
pnpm vitest run tests/playground/legacyRetirement.test.ts tests/playground/demoStudioNavigation.test.ts
```

Expected: pass.

- [ ] **Step 6: Browser smoke legacy hashes**

Start playground:

```bash
pnpm --dir examples/playground dev -- --host 127.0.0.1
```

Open these URLs:

```text
http://127.0.0.1:5177/#decorators
http://127.0.0.1:5177/#overlays
http://127.0.0.1:5177/#wms-wmts
```

Expected:
- `#decorators` opens `Line Decorators / Advanced decorator authoring`.
- `#overlays` opens `Overlays / Overlay pointer modes`.
- `#wms-wmts` opens `Map Layers / WMS/WMTS custom layers`.

- [ ] **Step 7: Commit**

```bash
git add examples/playground/src/demo-studio/DemoStudioApp.svelte tests/playground/legacyRetirement.test.ts
git commit -m "fix: target migrated demos from legacy hashes"
```

---

## Task 4: Improve Sidebar Search With Aliases

**Files:**
- Modify: `examples/playground/src/demo-studio/DemoSidebar.svelte`
- Test: `tests/playground/demoStudioNavigation.test.ts`

- [ ] **Step 1: Add search matching unit helpers**

If `DemoSidebar.svelte` keeps search logic private, create a helper in `examples/playground/src/demo-studio/registry/navigation.ts`:

```ts
export function getDemoSearchText(category: DemoCategory, demo?: RegisteredDemoDefinition) {
  const categoryText = [
    category.title,
    category.description,
    ...(category.aliases ?? []),
  ];

  if (!demo) {
    return categoryText.join(' ').toLowerCase();
  }

  return [
    ...categoryText,
    demo.title,
    demo.description,
    demo.docsPath,
    ...(demo.aliases ?? []),
  ].join(' ').toLowerCase();
}
```

Extend `tests/playground/demoStudioNavigation.test.ts`:

```ts
import { getDemoSearchText } from '../../examples/playground/src/demo-studio/registry/navigation.ts';

it('includes aliases in category and demo search text', () => {
  const category = demoRegistry.find((candidate) => candidate.id === 'map-layers');
  const demo = category?.demos.find((candidate) => candidate.id === 'map-layers-wms-wmts');

  expect(category).toBeDefined();
  expect(demo).toBeDefined();
  expect(getDemoSearchText(category!, demo)).toContain('wmts');
  expect(getDemoSearchText(category!, demo)).toContain('z-index');
});
```

- [ ] **Step 2: Run failing test**

Run:

```bash
pnpm vitest run tests/playground/demoStudioNavigation.test.ts
```

Expected: fail until helper is exported and used.

- [ ] **Step 3: Use helper in DemoSidebar**

Modify imports:

```ts
import { getDemoSearchText } from './registry/navigation.ts';
```

Replace search text logic:

```ts
const categoryMatches = getDemoSearchText(category).includes(searchTerm);
const demos = categoryMatches
  ? category.demos
  : category.demos.filter((demo) => getDemoSearchText(category, demo).includes(searchTerm));
```

- [ ] **Step 4: Run tests and typecheck**

Run:

```bash
pnpm vitest run tests/playground/demoStudioNavigation.test.ts
pnpm --dir examples/playground exec tsc --noEmit
```

Expected: pass.

- [ ] **Step 5: Browser smoke search**

In the running playground, search:

```text
wmts
z-index
legacy
svg
pointer events
```

Expected:
- `wmts` and `z-index` show `Map Layers / WMS/WMTS custom layers`.
- `legacy` shows advanced decorators and overlay pointer modes.
- `svg` shows advanced decorator authoring.
- `pointer events` shows overlay pointer modes.

- [ ] **Step 6: Commit**

```bash
git add examples/playground/src/demo-studio/DemoSidebar.svelte examples/playground/src/demo-studio/registry/navigation.ts tests/playground/demoStudioNavigation.test.ts
git commit -m "feat: search demo studio aliases"
```

---

## Task 5: Update Documentation And Responsive Browser QA

**Files:**
- Modify: `docs/legacy-playground-gap-audit.md`
- Test: browser responsive QA, no committed screenshots

- [ ] **Step 1: Update gap audit**

Modify `docs/legacy-playground-gap-audit.md` current coverage list to include:

```md
- Map Layers
```

Modify WMS/WMTS section to say:

```md
Demo Studio exposes WMS/WMTS layer management as a first-class Map Layers demo and keeps compact layer access available from other demos. The map layer stack remains synchronized through `geoForge.layers`, with custom raster layers above the base XYZ tilemap and below GeoForge feature layers.
```

Modify “Recommended Path” to include:

```md
- Routed legacy hashes to their migrated Demo Studio demos rather than only mounting the Studio shell.
- Promoted WMS/WMTS layer management into the Demo Studio registry under Map Layers.
```

- [ ] **Step 2: Run focused tests**

Run:

```bash
pnpm vitest run tests/playground/legacyRetirement.test.ts tests/playground/demoStudioNavigation.test.ts tests/playground/mapLayerDemos.test.ts tests/playground/customRasterLayers.test.ts
```

Expected: pass.

- [ ] **Step 3: Run playground typecheck**

Run:

```bash
pnpm --dir examples/playground exec tsc --noEmit
```

Expected: pass.

- [ ] **Step 4: Run repo verification**

Run:

```bash
pnpm run ts
pnpm run lint
pnpm run build
```

Expected:
- `pnpm run ts`: pass.
- `pnpm run lint`: exits 0. Existing import-extension warnings may still print if they predate this work.
- `pnpm run build`: pass.

- [ ] **Step 5: Responsive browser QA**

Start playground:

```bash
pnpm --dir examples/playground dev -- --host 127.0.0.1
```

Test these URLs:

```text
http://127.0.0.1:5177/#demo-studio
http://127.0.0.1:5177/#decorators
http://127.0.0.1:5177/#overlays
http://127.0.0.1:5177/#wms-wmts
```

At these viewports:

```text
XXL 1920x1080
XL 1440x1000
L 1200x900
M 900x900
S 640x900
XS 375x812
```

Expected:
- No app console errors or page errors.
- No Vite/framework overlay.
- No page-level horizontal overflow.
- `#decorators` visibly selects `Advanced decorator authoring`.
- `#overlays` visibly selects `Overlay pointer modes`.
- `#wms-wmts` visibly selects `Map Layers / WMS/WMTS custom layers`.
- Compact WMS/WMTS panel is absent inside the first-class map layer demo to avoid duplicate controls.
- Compact WMS/WMTS panel remains visible in non-layer demos.

- [ ] **Step 6: Commit**

```bash
git add docs/legacy-playground-gap-audit.md
git commit -m "docs: update demo studio retirement audit"
```

---

## Task 6: Optional Follow-On Plan For Splitting Broad Categories

This task should not block the production navigation fix. Only start it after Tasks 1-5 are merged and verified.

**Files:**
- Create a separate plan: `docs/superpowers/plans/2026-06-23-demo-studio-demo-splitting.md`
- No source changes in this task.

- [ ] **Step 1: Draft a separate plan for demo splitting**

Create a new plan that splits:

```text
Draw And Edit
- Shape drawing
- Global edit modes
- Snapping and helpers

Feature Data
- Import GeoJSON
- Export feature store
- Identify/inspect feature data

Geometry Tools
- Network topology
- Endpoint connection preview
- Segment measurement/query
```

- [ ] **Step 2: Include migration rules**

The follow-on plan must state:

```text
Existing demo ids must remain as aliases until browser QA confirms no linked docs, hashes, or tests depend on them.
```

- [ ] **Step 3: Stop**

Do not implement the follow-on plan in this branch unless explicitly requested. The current branch is for navigation ordering, legacy hash targeting, and WMS/WMTS discoverability.

---

## Final Verification Matrix

Run all of these before marking the branch complete:

```bash
pnpm vitest run tests/playground/legacyRetirement.test.ts tests/playground/demoStudioNavigation.test.ts tests/playground/mapLayerDemos.test.ts tests/playground/customRasterLayers.test.ts
pnpm --dir examples/playground exec tsc --noEmit
pnpm run ts
pnpm run lint
pnpm run build
```

Then run the browser QA from Task 5.

Expected final state:
- Legacy hashes target the migrated legacy demos.
- WMS/WMTS layer management appears in the sidebar as `Map Layers / WMS/WMTS custom layers`.
- Category order follows the workflow: Draw/Edit, Feature Data, Map Layers, Geometry, Decorators, Overlays, Workflow Systems.
- Search finds aliases such as `wmts`, `z-index`, `legacy`, `svg`, and `pointer events`.
- Custom raster layers remain above basemap layers and below GeoForge feature layers through the existing `geoForge.layers` implementation.
- No regressions in unit, type, lint, build, or browser responsive smoke checks.

## Self-Review

- Spec coverage: all audit findings are covered. Task 1 covers ordering metadata. Task 2 covers WMS/WMTS first-class navigation. Task 3 covers legacy hash targeting. Task 4 covers discoverability/search. Task 5 covers docs and browser QA. Task 6 captures broad demo splitting as a separate follow-on scope.
- Placeholder scan: no unresolved placeholders, TBDs, or “implement later” instructions remain in required tasks.
- Type consistency: `DemoSelection`, `DemoCategoryId`, `navOrder`, `aliases`, and `map-layers-wms-wmts` are introduced before they are used by later tasks.

# WMS/WMTS API Quality Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make GeoForge WMS/WMTS support production-grade while keeping sandbox usage straightforward and demonstrably native through `geoForge.layers`.

**Architecture:** Keep raster layer behavior inside `src/layers/raster.ts`, but add a small persistent configuration layer so applications do not pass the same options to every call. Demo Studio should become a consumer of the native API rather than manually wiring capabilities helpers. Tests should cover public behavior, URL preservation, collision-proof IDs, source refreshes, and WMTS metadata defaults.

**Tech Stack:** TypeScript, Svelte 5, MapLibre GL-compatible map API, Vitest with jsdom, Vite playground middleware.

---

## File Structure

- Modify `src/layers/raster.ts`: core API hardening, persistent raster defaults, URL handling, ID generation, source refresh, richer discovery metadata.
- Modify `src/layers/index.ts`: export any new public types/helpers.
- Modify `src/main.ts`: no new subsystem wiring expected, but verify `geoForge.layers` still exposes the updated class.
- Modify `examples/playground/src/demo-studio/DemoStudioApp.svelte`: own native discovery calls and pass discovered results into the panel.
- Modify `examples/playground/src/demo-studio/CustomRasterLayerPanel.svelte`: make this component presentational for discovery and layer ordering.
- Modify `examples/playground/src/demo-studio/map/customRasterLayers.ts`: keep only sandbox proxy URL transformation helpers.
- Modify `examples/playground/vite.config.ts`: add safer demo proxy constraints and timeout behavior.
- Modify `docs/wms-wmts-raster-layers.md`: document the simpler sandbox API and proxy caveats.
- Modify `tests/layers/geomanLayerSubsystem.test.ts`: add regression coverage for API behavior.
- Modify `tests/playground/customRasterLayers.test.ts`: keep proxy helper coverage.

---

### Task 1: Preserve Required Service Query Params

**Files:**
- Modify: `src/layers/raster.ts`
- Test: `tests/layers/geomanLayerSubsystem.test.ts`

- [ ] **Step 1: Write failing tests for preserved capabilities params**

Add these tests under `describe('raster layer helpers', ...)` in `tests/layers/geomanLayerSubsystem.test.ts`:

```ts
test('preserves service routing params when building a WMS capabilities URL', () => {
  expect(
    buildRasterCapabilitiesRequestUrl(
      'https://maps.example.test/wms?map=/srv/city.map&token=abc123&service=WMS&request=GetMap&layers=roads&bbox=1,2,3,4&width=256&height=256',
    ),
  ).toBe(
    'https://maps.example.test/wms?map=%2Fsrv%2Fcity.map&token=abc123&service=WMS&request=GetCapabilities',
  );
});

test('preserves service routing params when building a WMTS capabilities URL', () => {
  expect(
    buildRasterCapabilitiesRequestUrl(
      'https://tiles.example.test/wmts?tenant=demo&service=WMTS&request=GetTile&layer=population&tilematrix=4&tilerow=5&tilecol=6',
    ),
  ).toBe(
    'https://tiles.example.test/wmts?tenant=demo&service=WMTS&request=GetCapabilities',
  );
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
pnpm vitest run tests/layers/geomanLayerSubsystem.test.ts
```

Expected: the two new tests fail because `map`, `token`, and `tenant` are dropped.

- [ ] **Step 3: Implement tile-param stripping without dropping routing params**

In `src/layers/raster.ts`, add this helper near `buildRasterCapabilitiesRequestUrl`:

```ts
const rasterTileRequestParams = [
  'bbox',
  'crs',
  'exceptions',
  'format',
  'height',
  'i',
  'j',
  'layer',
  'layers',
  'row',
  'service',
  'srs',
  'style',
  'styles',
  'tilecol',
  'tilematrix',
  'tilematrixset',
  'tilerow',
  'transparent',
  'version',
  'width',
  'x',
  'y',
  'z',
];

function deleteSearchParamCaseInsensitive(url: URL, paramName: string): void {
  for (const key of Array.from(url.searchParams.keys())) {
    if (key.toLowerCase() === paramName) {
      url.searchParams.delete(key);
    }
  }
}
```

Replace `buildRasterCapabilitiesRequestUrl` with:

```ts
export function buildRasterCapabilitiesRequestUrl(rawUrl: string): string {
  let url: URL;

  try {
    url = new URL(rawUrl.trim());
  } catch {
    return rawUrl;
  }

  const service = inferRasterService(url);
  const capabilitiesUrl = new URL(url.toString());

  rasterTileRequestParams.forEach((param) => {
    deleteSearchParamCaseInsensitive(capabilitiesUrl, param);
  });
  deleteSearchParamCaseInsensitive(capabilitiesUrl, 'request');

  capabilitiesUrl.searchParams.set('service', service);
  capabilitiesUrl.searchParams.set('request', 'GetCapabilities');

  return capabilitiesUrl.toString();
}
```

- [ ] **Step 4: Run tests to verify pass**

Run:

```bash
pnpm vitest run tests/layers/geomanLayerSubsystem.test.ts
```

Expected: all layer subsystem tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/layers/raster.ts tests/layers/geomanLayerSubsystem.test.ts
git commit -m "fix: preserve raster capabilities routing params"
```

---

### Task 2: Add Persistent Raster Defaults for Sandbox-Friendly API

**Files:**
- Modify: `src/layers/raster.ts`
- Modify: `src/layers/index.ts`
- Modify: `docs/wms-wmts-raster-layers.md`
- Test: `tests/layers/geomanLayerSubsystem.test.ts`

- [ ] **Step 1: Write failing tests for configured defaults**

Add these tests under `describe('GeomanLayerSubsystem', ...)`:

```ts
test('uses configured raster defaults for discovery and layer sync', async () => {
  const { layers, map } = createLayerSubsystem(createMapStub(['base', 'gm_main-fill']));
  const fetchFn = vi.fn(async () => ({
    ok: true,
    status: 200,
    text: async () => `<?xml version="1.0"?>
      <WMS_Capabilities version="1.3.0">
        <Capability>
          <Layer>
            <Layer>
              <Name>nuts</Name>
              <Title>NUTS</Title>
            </Layer>
          </Layer>
        </Capability>
      </WMS_Capabilities>`,
  }));

  layers.configureRasterLayers({
    basemapLayerId: 'base',
    transformRequestUrl: (url) => `/capabilities?url=${encodeURIComponent(url)}`,
    transformTileUrl: (url) => `/tiles?url=${encodeURIComponent(url)}`,
  });

  const discovered = await layers.discoverRasterLayers('https://example.test/wms?service=WMS');
  layers.addRasterLayer({ name: discovered[0]!.title, url: discovered[0]!.url });

  expect(fetchFn).not.toHaveBeenCalled();
  expect(map.orderedLayerIds).toEqual(['base', expect.stringMatching(/^gm-raster-layer-/), 'gm_main-fill']);
  expect(map.sources.values().next().value?.tiles[0]).toContain('/tiles?url=');
});
```

Then revise the test to inject `fetchFn` through `configureRasterLayers` after adding that option type in Step 3:

```ts
layers.configureRasterLayers({
  basemapLayerId: 'base',
  fetchFn,
  transformRequestUrl: (url) => `/capabilities?url=${encodeURIComponent(url)}`,
  transformTileUrl: (url) => `/tiles?url=${encodeURIComponent(url)}`,
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
pnpm vitest run tests/layers/geomanLayerSubsystem.test.ts
```

Expected: TypeScript/Vitest fails because `configureRasterLayers` does not exist.

- [ ] **Step 3: Add public defaults type and method**

In `src/layers/raster.ts`, add:

```ts
export type RasterLayerDefaults = DiscoverRasterLayersOptions & RasterLayerSyncOptions;
```

Inside `GeomanLayerSubsystem`, add:

```ts
private rasterLayerDefaults: RasterLayerDefaults = {};

configureRasterLayers(defaults: RasterLayerDefaults): void {
  this.rasterLayerDefaults = { ...this.rasterLayerDefaults, ...defaults };
  if (this.rasterLayers.length > 0) {
    this.syncRasterLayers();
  }
}
```

Update `discoverRasterLayers` to merge defaults:

```ts
const mergedOptions = { ...this.rasterLayerDefaults, ...options };
const capabilitiesUrl = buildRasterCapabilitiesRequestUrl(serviceUrl);
const requestUrl = mergedOptions.transformRequestUrl?.(capabilitiesUrl) ?? capabilitiesUrl;
const fetchFn = mergedOptions.fetchFn ?? getGlobalFetch();
```

Update `addRasterLayers`, `removeRasterLayer`, `reorderRasterLayer`, and `syncRasterLayers` to merge sync options:

```ts
const mergedOptions = { ...this.rasterLayerDefaults, ...options };
```

Use `mergedOptions` for `basemapLayerId` and calls to `syncRasterLayers`.

- [ ] **Step 4: Export the defaults type**

In `src/layers/index.ts`, export the new type:

```ts
type RasterLayerDefaults,
```

- [ ] **Step 5: Run tests to verify pass**

Run:

```bash
pnpm vitest run tests/layers/geomanLayerSubsystem.test.ts tests/public-api/publicBarrel.test.ts
```

Expected: tests pass after updating public API expectations if needed.

- [ ] **Step 6: Update docs with simple sandbox usage**

In `docs/wms-wmts-raster-layers.md`, add a section before “Discover Available Layers”:

```md
## Configure Once

```ts
geoForge.layers.configureRasterLayers({
  basemapLayerId: 'dark-basemap',
  transformRequestUrl: (url) => `/api/geoforge-raster-proxy?url=${encodeURIComponent(url)}`,
  transformTileUrl: (url) => `/api/geoforge-raster-proxy?url=${encodeURIComponent(url)}`,
});
```

After configuration, calls such as `discoverRasterLayers`, `addRasterLayer`, `addRasterLayers`,
`reorderRasterLayer`, and `removeRasterLayer` can be used without repeating proxy or basemap options.
```

- [ ] **Step 7: Commit**

```bash
git add src/layers/raster.ts src/layers/index.ts docs/wms-wmts-raster-layers.md tests/layers/geomanLayerSubsystem.test.ts tests/public-api/publicBarrel.test.ts
git commit -m "feat: add raster layer defaults"
```

---

### Task 3: Make Layer IDs Collision-Proof and Stable for Discovered Layers

**Files:**
- Modify: `src/layers/raster.ts`
- Test: `tests/layers/geomanLayerSubsystem.test.ts`

- [ ] **Step 1: Write failing tests for duplicate names in one batch**

Add:

```ts
test('generates unique ids for duplicate layer names added in one batch', () => {
  const { layers } = createLayerSubsystem(createMapStub(['base', 'gm_main-fill']));

  layers.addRasterLayers(
    [
      { name: 'Duplicate', url: 'https://example.test/a/{z}/{x}/{y}.png' },
      { name: 'Duplicate', url: 'https://example.test/b/{z}/{x}/{y}.png' },
    ],
    { basemapLayerId: 'base' },
  );

  const stored = layers.getRasterLayers();

  expect(stored).toHaveLength(2);
  expect(new Set(stored.map((layer) => layer.id)).size).toBe(2);
});
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
pnpm vitest run tests/layers/geomanLayerSubsystem.test.ts -t "duplicate layer names"
```

Expected: the test can fail intermittently with the current timestamp approach; if it does not fail on the first run, continue because the implementation is still non-deterministically unsafe.

- [ ] **Step 3: Replace timestamp IDs with an instance counter**

In `GeomanLayerSubsystem`, add:

```ts
private rasterLayerIdSequence = 0;
```

Change ID creation in `addRasterLayers`:

```ts
id: input.id ?? this.createRasterLayerId(name),
```

Move `createRasterLayerId` into the class:

```ts
private createRasterLayerId(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);

  this.rasterLayerIdSequence += 1;
  return `${rasterLayerPrefix}${slug || 'overlay'}-${this.rasterLayerIdSequence.toString(36)}`;
}
```

Delete the standalone `createRasterLayerId` function.

- [ ] **Step 4: Run tests**

Run:

```bash
pnpm vitest run tests/layers/geomanLayerSubsystem.test.ts
```

Expected: all layer subsystem tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/layers/raster.ts tests/layers/geomanLayerSubsystem.test.ts
git commit -m "fix: generate unique raster layer ids"
```

---

### Task 4: Refresh Sources When Tile URL Transform Changes

**Files:**
- Modify: `src/layers/raster.ts`
- Test: `tests/layers/geomanLayerSubsystem.test.ts`

- [ ] **Step 1: Extend the map stub to record layer source IDs**

In `tests/layers/geomanLayerSubsystem.test.ts`, update `createMapStub` so `addLayer` stores layer objects:

```ts
const layersById = new Map<string, { id: string; source: string }>();
```

In `addLayer`:

```ts
layersById.set(layer.id, layer);
```

In `getLayer`:

```ts
getLayer: vi.fn((id: string) => layersById.get(id) ?? (orderedLayerIds.includes(id) ? { id } : undefined)),
```

In `removeLayer`:

```ts
layersById.delete(id);
```

Return `layersById` from the stub object for assertions.

- [ ] **Step 2: Write failing test for source refresh**

Add:

```ts
test('refreshes a raster source when transformed tile URL changes', () => {
  const { layers, map } = createLayerSubsystem(createMapStub(['base', 'gm_main-fill']));

  layers.addRasterLayer(
    {
      id: 'external-wms-nuts',
      name: 'NUTS boundaries',
      url: 'https://example.test/wms?service=WMS&request=GetMap&layers=nuts',
    },
    {
      basemapLayerId: 'base',
      transformTileUrl: (url) => `/proxy-a?url=${encodeURIComponent(url)}`,
    },
  );

  layers.syncRasterLayers({
    basemapLayerId: 'base',
    transformTileUrl: (url) => `/proxy-b?url=${encodeURIComponent(url)}`,
  });

  expect(map.sources.values().next().value?.tiles[0]).toContain('/proxy-b?url=');
});
```

- [ ] **Step 3: Run test to verify failure**

Run:

```bash
pnpm vitest run tests/layers/geomanLayerSubsystem.test.ts -t "transformed tile URL changes"
```

Expected: the source still contains `/proxy-a`.

- [ ] **Step 4: Recreate layer/source when tile URL changes**

In `syncRasterLayers`, compute `tileUrl` before source handling:

```ts
const tileUrl = options.transformTileUrl?.(layer.url) ?? layer.url;
const existingSource = map.getSource(sourceId) as { tiles?: string[] } | undefined;

if (existingSource && existingSource.tiles?.[0] !== tileUrl) {
  removeRasterLayerFromMap(map, layer.id);
}

if (!map.getSource(sourceId)) {
  map.addSource(sourceId, {
    type: 'raster',
    tiles: [tileUrl],
    tileSize: defaultRasterTileSize,
  });
}
```

- [ ] **Step 5: Run tests**

Run:

```bash
pnpm vitest run tests/layers/geomanLayerSubsystem.test.ts
```

Expected: all layer subsystem tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/layers/raster.ts tests/layers/geomanLayerSubsystem.test.ts
git commit -m "fix: refresh raster sources when tile urls change"
```

---

### Task 5: Improve WMTS Metadata Parsing

**Files:**
- Modify: `src/layers/raster.ts`
- Test: `tests/layers/geomanLayerSubsystem.test.ts`
- Modify: `docs/wms-wmts-raster-layers.md`

- [ ] **Step 1: Add metadata to `DiscoveredRasterLayer`**

In `src/layers/raster.ts`, extend the type:

```ts
export type DiscoveredRasterLayer = {
  name: string;
  title: string;
  url: string;
  service: 'WMS' | 'WMTS';
  format?: string;
  style?: string;
  tileMatrixSet?: string;
};
```

- [ ] **Step 2: Update existing tests to expect `service`**

For WMS expectations, add:

```ts
service: 'WMS',
```

For WMTS expectations, add:

```ts
service: 'WMTS',
```

- [ ] **Step 3: Write failing WMTS metadata test**

Add:

```ts
test('builds WMTS KVP URLs from advertised style format and matrix set', () => {
  const layers = parseRasterCapabilities(
    `<?xml version="1.0"?>
    <Capabilities xmlns="http://www.opengis.net/wmts/1.0">
      <Contents>
        <Layer>
          <Title>Population</Title>
          <Identifier>population</Identifier>
          <Style isDefault="true">
            <Identifier>bright</Identifier>
          </Style>
          <Format>image/jpeg</Format>
          <TileMatrixSetLink>
            <TileMatrixSet>GoogleMapsCompatible</TileMatrixSet>
          </TileMatrixSetLink>
        </Layer>
      </Contents>
    </Capabilities>`,
    'https://tiles.test/wmts?service=WMTS&request=GetCapabilities',
  );

  expect(layers[0]).toEqual(
    expect.objectContaining({
      service: 'WMTS',
      format: 'image/jpeg',
      style: 'bright',
      tileMatrixSet: 'GoogleMapsCompatible',
    }),
  );
  expect(layers[0]?.url).toContain('style=bright');
  expect(layers[0]?.url).toContain('format=image%2Fjpeg');
  expect(layers[0]?.url).toContain('tilematrixset=GoogleMapsCompatible');
});
```

- [ ] **Step 4: Implement WMTS metadata helpers**

Add helpers:

```ts
function getWmtsDefaultStyle(layer: Element): string {
  const styles = findDirectChildrenByLocalName(layer, 'Style');
  return (
    styles.find((style) => style.getAttribute('isDefault') === 'true')
      ? getDirectChildText(styles.find((style) => style.getAttribute('isDefault') === 'true')!, 'Identifier')
      : ''
  ) || getDirectChildText(styles[0]!, 'Identifier') || 'default';
}

function getWmtsDefaultFormat(layer: Element): string {
  return getDirectChildText(layer, 'Format') || 'image/png';
}

function getWmtsDefaultTileMatrixSet(layer: Element): string {
  const links = findDirectChildrenByLocalName(layer, 'TileMatrixSetLink');
  return getDirectChildText(links[0]!, 'TileMatrixSet') || 'EPSG:3857';
}

function findDirectChildrenByLocalName(element: Element, childName: string): Element[] {
  return Array.from(element.children).filter((candidate) => candidate.localName === childName);
}
```

Update `parseWmtsCapabilities` to pass the parsed `style`, `format`, and `tileMatrixSet` into `buildWmtsKvpTileTemplateUrl`.

Update `buildWmtsKvpTileTemplateUrl` signature:

```ts
function buildWmtsKvpTileTemplateUrl(
  capabilitiesUrl: string,
  layerName: string,
  metadata: { style: string; format: string; tileMatrixSet: string },
): string
```

Use:

```ts
url.searchParams.set('style', metadata.style);
url.searchParams.set('tilematrixset', metadata.tileMatrixSet);
url.searchParams.set('format', metadata.format);
```

- [ ] **Step 5: Run tests**

Run:

```bash
pnpm vitest run tests/layers/geomanLayerSubsystem.test.ts
```

Expected: all layer subsystem tests pass.

- [ ] **Step 6: Update docs**

In `docs/wms-wmts-raster-layers.md`, add:

```md
Discovery results include `service`, and WMTS results may include `style`, `format`, and
`tileMatrixSet` when advertised by the capabilities document. Prefer adding discovered WMTS layers
instead of hand-writing KVP tile URLs.
```

- [ ] **Step 7: Commit**

```bash
git add src/layers/raster.ts docs/wms-wmts-raster-layers.md tests/layers/geomanLayerSubsystem.test.ts
git commit -m "feat: parse wmts layer defaults"
```

---

### Task 6: Make Demo Studio Use `geoForge.layers.discoverRasterLayers`

**Files:**
- Modify: `examples/playground/src/demo-studio/DemoStudioApp.svelte`
- Modify: `examples/playground/src/demo-studio/CustomRasterLayerPanel.svelte`
- Test: existing browser smoke; add unit coverage only if component tests exist locally

- [ ] **Step 1: Change panel props to make discovery a parent-owned operation**

In `CustomRasterLayerPanel.svelte`, remove imports:

```ts
buildRasterCapabilitiesRequestUrl,
parseRasterCapabilities,
```

Update props:

```ts
onDiscover: (url: string) => Promise<DiscoveredRasterLayer[]>;
```

Add `onDiscover` to the destructured props.

- [ ] **Step 2: Replace manual fetch in the panel**

Replace the body of `handleDiscover` with:

```ts
try {
  const nextLayers = await onDiscover(url);
  discoveredLayers = nextLayers;
  selectedLayerNames = [];
  discoveryStatus = nextLayers.length > 0 ? 'ready' : 'empty';
  discoveryMessage =
    nextLayers.length > 0
      ? `${nextLayers.length} layer${nextLayers.length === 1 ? '' : 's'} available`
      : 'No named layers found';
} catch (error) {
  discoveryStatus = 'error';
  discoveryMessage = error instanceof Error ? error.message : String(error);
}
```

- [ ] **Step 3: Add native discovery handler in Demo Studio**

In `DemoStudioApp.svelte`, import `DiscoveredRasterLayer`:

```ts
import type { DiscoveredRasterLayer, GeomanRasterLayer, RasterLayerSyncOptions } from 'maplibre-geoforge';
```

Add:

```ts
async function handleDiscoverCustomRasterLayers(url: string): Promise<DiscoveredRasterLayer[]> {
  if (!geoForge) {
    return [];
  }

  return geoForge.layers.discoverRasterLayers(url);
}
```

Pass it to the panel:

```svelte
onDiscover={handleDiscoverCustomRasterLayers}
```

- [ ] **Step 4: Configure raster defaults once**

After `const loadedGeoForge = await createdGeoForge.waitForGeomanLoaded();` and before assigning `geoForge = createdGeoForge`, call:

```ts
createdGeoForge.layers.configureRasterLayers({
  basemapLayerId: 'dark-basemap',
  transformRequestUrl: buildCustomRasterTileUrl,
  transformTileUrl: buildCustomRasterTileUrl
});
```

Then simplify `rasterLayerSyncOptions` to be removed entirely, and call:

```ts
geoForge.layers.addRasterLayer(input);
geoForge.layers.addRasterLayers(inputs);
geoForge.layers.reorderRasterLayer(layerId, direction);
geoForge.layers.removeRasterLayer(layerId);
currentGeoForge.layers.syncRasterLayers();
```

- [ ] **Step 5: Run type and focused tests**

Run:

```bash
pnpm --dir examples/playground exec tsc --noEmit
pnpm vitest run tests/layers/geomanLayerSubsystem.test.ts tests/playground/customRasterLayers.test.ts
```

Expected: commands pass.

- [ ] **Step 6: Browser smoke**

Start the playground if needed:

```bash
pnpm --dir examples/playground dev --host 127.0.0.1 --port 5199
```

Smoke path:

1. Open `http://127.0.0.1:5199/#demo-studio`.
2. Enter the Citiwatts WMS URL.
3. Click `Discover layers`.
4. Confirm many layers appear.
5. Select one layer.
6. Click `Add selected`.
7. Confirm one layer appears in the layer list and no console errors are emitted.

- [ ] **Step 7: Commit**

```bash
git add examples/playground/src/demo-studio/DemoStudioApp.svelte examples/playground/src/demo-studio/CustomRasterLayerPanel.svelte
git commit -m "refactor: use native raster discovery in demo studio"
```

---

### Task 7: Harden and Document the Demo Proxy

**Files:**
- Modify: `examples/playground/vite.config.ts`
- Modify: `docs/wms-wmts-raster-layers.md`
- Test: `tests/playground/customRasterLayers.test.ts`

- [ ] **Step 1: Add proxy constraints constants**

In `examples/playground/vite.config.ts`, near the top:

```ts
const rasterProxyTimeoutMs = 15000;
const rasterProxyMaxBytes = 8 * 1024 * 1024;
```

- [ ] **Step 2: Add timeout to fetch**

Inside the middleware:

```ts
const abortController = new AbortController();
const timeout = setTimeout(() => abortController.abort(), rasterProxyTimeoutMs);

let tileResponse: Response;

try {
  tileResponse = await fetch(parsedRemoteUrl, { signal: abortController.signal });
} finally {
  clearTimeout(timeout);
}
```

- [ ] **Step 3: Add response size check**

Before buffering:

```ts
const contentLength = Number(tileResponse.headers.get('content-length') ?? '0');

if (contentLength > rasterProxyMaxBytes) {
  response.statusCode = 502;
  response.end('Raster proxy response is too large.');
  return;
}

const body = Buffer.from(await tileResponse.arrayBuffer());

if (body.byteLength > rasterProxyMaxBytes) {
  response.statusCode = 502;
  response.end('Raster proxy response is too large.');
  return;
}

response.end(body);
```

- [ ] **Step 4: Document production proxy requirements**

In `docs/wms-wmts-raster-layers.md`, add:

```md
The playground Vite proxy is intentionally local-development-only. Production proxies should allowlist
trusted WMS/WMTS hosts, block private-network destinations, enforce response-size limits, and set
request timeouts.
```

- [ ] **Step 5: Run checks**

Run:

```bash
pnpm --dir examples/playground exec tsc --noEmit
pnpm vitest run tests/playground/customRasterLayers.test.ts
```

Expected: commands pass.

- [ ] **Step 6: Commit**

```bash
git add examples/playground/vite.config.ts docs/wms-wmts-raster-layers.md tests/playground/customRasterLayers.test.ts
git commit -m "docs: clarify raster proxy production requirements"
```

---

### Task 8: Final Verification

**Files:**
- Verify all files changed by Tasks 1-7.

- [ ] **Step 1: Run focused tests**

```bash
pnpm vitest run tests/layers/geomanLayerSubsystem.test.ts tests/playground/customRasterLayers.test.ts tests/public-api/publicBarrel.test.ts
```

Expected: all tests pass.

- [ ] **Step 2: Run package type check**

```bash
pnpm run ts
```

Expected: `tsc --noEmit` passes.

- [ ] **Step 3: Run playground type check**

```bash
pnpm --dir examples/playground exec tsc --noEmit
```

Expected: Svelte playground type check passes.

- [ ] **Step 4: Run targeted lint**

```bash
pnpm exec eslint src/layers/raster.ts src/layers/index.ts src/main.ts src/core/lifecycle/geomanLifecycleController.ts examples/playground/src/demo-studio/CustomRasterLayerPanel.svelte examples/playground/src/demo-studio/DemoStudioApp.svelte examples/playground/src/demo-studio/map/customRasterLayers.ts tests/layers/geomanLayerSubsystem.test.ts tests/playground/customRasterLayers.test.ts tests/public-api/publicBarrel.test.ts
```

Expected: no lint errors.

- [ ] **Step 5: Run production build**

```bash
pnpm run build
```

Expected: Vite build and declaration rollup pass.

- [ ] **Step 6: Browser smoke**

Use the Citiwatts URL:

```txt
https://geoserver.citiwatts.net/geoserver/hotmaps/wms?service=WMS&request=GetMap&layers=hotmaps%3Anuts&styles=&format=image%2Fpng8&transparent=true&version=1.3.0&cql_filter=stat_levl_%20%3D%202%20AND%20year%3D%272013-01-01%27&srs=EPSG%3A4326&width=256&height=256&crs=EPSG%3A3857&bbox=1252344.2714243277,6105178.3231936,1408887.3053523689,6261721.357121641
```

Expected:
- Demo Studio loads.
- Discovery returns named WMS layers.
- Adding a selected layer creates one custom raster layer.
- The selected layer URL remains on `https://geoserver.citiwatts.net/geoserver/hotmaps/wms`.
- No console errors.
- No failed tile requests.
- Layer section remains in the inspector, not in a modal.

- [ ] **Step 7: Final commit**

```bash
git status --short
git add src/layers docs/wms-wmts-raster-layers.md docs/public-api-boundary.md examples/playground/src/demo-studio examples/playground/vite.config.ts tests/layers tests/playground tests/public-api/publicBarrel.test.ts
git commit -m "feat: harden wms wmts raster layer api"
```

---

## Self-Review

- Spec coverage: The plan covers API simplicity, capabilities URL correctness, ID safety, source refresh, WMTS metadata, native Demo Studio discovery, proxy production guidance, docs, and final verification.
- Placeholder scan: No task uses open-ended “TODO” work; each task includes concrete files, snippets, commands, and expected outcomes.
- Type consistency: New public types are `RasterLayerDefaults` and extended `DiscoveredRasterLayer`; Demo Studio imports are updated consistently.


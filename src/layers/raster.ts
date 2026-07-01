import { GM_PREFIX } from '@/core/constants.ts';

const rasterLayerPrefix = `${GM_PREFIX}-raster-layer-`;
const rasterSourcePrefix = `${GM_PREFIX}-raster-source-`;
const defaultRasterTileSize = 256;
const rasterCapabilitiesRequestTileParams = new Set([
  'bbox',
  'crs',
  'exceptions',
  'format',
  'height',
  'i',
  'j',
  'layer',
  'layers',
  'request',
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
]);

export type GeomanRasterLayer = {
  id: string;
  name: string;
  url: string;
  basemapLayerId?: string;
};

export type DiscoveredRasterLayer = {
  name: string;
  title: string;
  url: string;
  service: 'WMS' | 'WMTS';
  format?: string;
  style?: string;
  tileMatrixSet?: string;
};

export type RasterLayerInput = {
  id?: string;
  name: string;
  url: string;
  basemapLayerId?: string;
};

export type DiscoverRasterLayersOptions = {
  fetchFn?: (
    url: string,
    init?: { signal?: AbortSignal },
  ) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;
  transformRequestUrl?: (url: string) => string;
  networkPolicy?: RasterNetworkPolicy;
};

export type RasterLayerSyncOptions = {
  transformTileUrl?: (url: string) => string;
  basemapLayerId?: string;
};

export type RasterLayerDefaults = DiscoverRasterLayersOptions & RasterLayerSyncOptions;

export type RasterLayerSubscriptionEvent = {
  type: 'initial' | 'configure' | 'add' | 'remove' | 'reorder' | 'destroy';
};

export type RasterLayerSubscriptionCallback = (
  layers: GeomanRasterLayer[],
  event: RasterLayerSubscriptionEvent,
) => void;

export type RasterProxyOptions = {
  path: string;
  origin?: string;
  parameterName?: string;
};

export type RasterNetworkDiagnosticEvent =
  | { type: 'request-start'; url: string; attempt: number }
  | { type: 'request-success'; url: string; attempt: number; status: number }
  | { type: 'request-retry'; url: string; attempt: number; status?: number; error?: unknown }
  | { type: 'request-blocked'; url: string; reason: string }
  | { type: 'request-timeout'; url: string; timeoutMs: number }
  | { type: 'request-abort'; url: string; reason?: unknown }
  | { type: 'request-failure'; url: string; attempt: number; status?: number; error?: unknown };

export type RasterNetworkPolicy = {
  timeoutMs?: number;
  signal?: AbortSignal;
  retryCount?: number;
  allowUrl?: (url: string) => boolean;
  onDiagnostic?: (event: RasterNetworkDiagnosticEvent) => void;
};

export type RasterProxyPolicyOptions = RasterProxyOptions & {
  allowedOrigins?: readonly string[];
  timeoutMs?: number;
  retryCount?: number;
  signal?: AbortSignal;
  onDiagnostic?: (event: RasterNetworkDiagnosticEvent) => void;
};

export type RasterProxyPolicy = {
  transformRequestUrl: (url: string) => string;
  transformTileUrl: (url: string) => string;
  networkPolicy: RasterNetworkPolicy;
};

const rasterNetworkPolicyBlockedReasons = new WeakMap<
  RasterNetworkPolicy,
  (url: string) => string | undefined
>();

type RasterMap = {
  addLayer: (
    layer: {
      id: string;
      type: 'raster';
      source: string;
      paint: Record<string, never>;
    },
    beforeId?: string,
  ) => unknown;
  addSource: (
    id: string,
    source: {
      type: 'raster';
      tiles: string[];
      tileSize: number;
    },
  ) => unknown;
  getLayer: (id: string) => unknown;
  getSource: (id: string) => unknown;
  getStyle: () => { layers?: Array<{ id: string }> };
  moveLayer: (id: string, beforeId?: string) => unknown;
  removeLayer: (id: string) => unknown;
  removeSource: (id: string) => unknown;
};

export class GeomanLayerSubsystem {
  private rasterLayers: GeomanRasterLayer[] = [];
  private rasterLayerDefaults: RasterLayerDefaults = {};
  private rasterLayerIdSequence = 0;
  private rasterLayerSubscriberIdSequence = 0;
  private readonly rasterLayerSubscribers = new Map<number, RasterLayerSubscriptionCallback>();

  constructor(
    private readonly options: {
      geoman: {
        mapAdapter: {
          getMapInstance(): unknown;
        };
      };
    },
  ) {}

  async discoverRasterLayers(
    serviceUrl: string,
    options: DiscoverRasterLayersOptions = {},
  ): Promise<DiscoveredRasterLayer[]> {
    const mergedOptions = this.getRasterLayerOptions(options);
    const capabilitiesUrl = buildRasterCapabilitiesRequestUrl(serviceUrl);
    const requestUrl = mergedOptions.transformRequestUrl?.(capabilitiesUrl) ?? capabilitiesUrl;
    const fetchFn = mergedOptions.fetchFn ?? getGlobalFetch();
    const xmlText = await fetchRasterCapabilitiesWithPolicy(
      requestUrl,
      fetchFn,
      mergedOptions.networkPolicy,
    );

    return parseRasterCapabilities(xmlText, capabilitiesUrl);
  }

  configureRasterLayers(defaults: RasterLayerDefaults): void {
    this.rasterLayerDefaults = {
      ...this.rasterLayerDefaults,
      ...defaults,
    };

    if (this.rasterLayers.length > 0) {
      const map = this.getRasterMap();

      this.rasterLayers.forEach((layer) => {
        removeRasterLayerFromMap(map, layer.id);
      });
      syncRasterLayers(map, this.rasterLayers, this.rasterLayerDefaults);
      this.notifyRasterLayerSubscribers({ type: 'configure' });
    }
  }

  addRasterLayer(
    input: RasterLayerInput,
    options: RasterLayerSyncOptions = {},
  ): GeomanRasterLayer | null {
    const nextLayers = this.addRasterLayers([input], options);
    return nextLayers[0] ?? null;
  }

  addRasterLayers(
    inputs: RasterLayerInput[],
    options: RasterLayerSyncOptions = {},
  ): GeomanRasterLayer[] {
    const mergedOptions = this.getRasterLayerOptions(options);
    const nextLayers = inputs.flatMap((input) => {
      const name = input.name.trim();
      const url = normalizeRasterTileUrl(input.url.trim());

      if (!name || !url) {
        return [];
      }

      return [
        {
          id: input.id ?? this.createRasterLayerId(name),
          name,
          url,
          basemapLayerId: input.basemapLayerId ?? options.basemapLayerId,
        },
      ];
    });

    const replacementIds = new Set(nextLayers.map((layer) => layer.id));

    if (replacementIds.size === 0) {
      return [];
    }

    const map = this.getRasterMap();

    replacementIds.forEach((layerId) => {
      removeRasterLayerFromMap(map, layerId);
    });

    this.rasterLayers = [
      ...dedupeRasterLayersById(nextLayers),
      ...this.rasterLayers.filter((layer) => !replacementIds.has(layer.id)),
    ];
    this.syncRasterLayers(mergedOptions);
    this.notifyRasterLayerSubscribers({ type: 'add' });
    return nextLayers;
  }

  removeRasterLayer(layerId: string, options: RasterLayerSyncOptions = {}): void {
    if (!this.rasterLayers.some((layer) => layer.id === layerId)) {
      return;
    }

    removeRasterLayerFromMap(this.getRasterMap(), layerId);
    this.rasterLayers = this.rasterLayers.filter((layer) => layer.id !== layerId);
    this.syncRasterLayers(options);
    this.notifyRasterLayerSubscribers({ type: 'remove' });
  }

  reorderRasterLayer(
    layerId: string,
    direction: -1 | 1,
    options: RasterLayerSyncOptions = {},
  ): void {
    const index = this.rasterLayers.findIndex((layer) => layer.id === layerId);
    const targetIndex = index + direction;

    if (index < 0 || targetIndex < 0 || targetIndex >= this.rasterLayers.length) {
      return;
    }

    const next = [...this.rasterLayers];
    const [layer] = next.splice(index, 1);
    next.splice(targetIndex, 0, layer);
    this.rasterLayers = next;
    this.syncRasterLayers(options);
    this.notifyRasterLayerSubscribers({ type: 'reorder' });
  }

  getRasterLayers(): GeomanRasterLayer[] {
    return this.createRasterLayerSnapshot();
  }

  subscribeRasterLayers(callback: RasterLayerSubscriptionCallback): () => void {
    const subscriberId = ++this.rasterLayerSubscriberIdSequence;
    let subscribed = true;

    this.rasterLayerSubscribers.set(subscriberId, callback);
    callback(this.createRasterLayerSnapshot(), { type: 'initial' });

    return () => {
      if (!subscribed) {
        return;
      }

      subscribed = false;
      this.rasterLayerSubscribers.delete(subscriberId);
    };
  }

  syncRasterLayers(options: RasterLayerSyncOptions = {}): void {
    syncRasterLayers(this.getRasterMap(), this.rasterLayers, this.getRasterLayerOptions(options));
  }

  destroy(): void {
    const map = this.getOptionalRasterMap();

    if (map) {
      this.rasterLayers.forEach((layer) => {
        removeRasterLayerFromMap(map, layer.id);
      });
    }
    const hadRasterLayers = this.rasterLayers.length > 0;
    this.rasterLayers = [];

    if (hadRasterLayers) {
      this.notifyRasterLayerSubscribers({ type: 'destroy' });
    }
  }

  private getRasterMap(): RasterMap {
    const map = this.options.geoman.mapAdapter.getMapInstance();

    if (!isRasterMap(map)) {
      throw new Error('Raster layers require a MapLibre-compatible map instance.');
    }

    return map;
  }

  private getOptionalRasterMap(): RasterMap | null {
    const map = this.options.geoman.mapAdapter.getMapInstance();
    return isRasterMap(map) ? map : null;
  }

  private getRasterLayerOptions<T extends RasterLayerDefaults>(
    options: T,
  ): RasterLayerDefaults & T {
    return {
      ...this.rasterLayerDefaults,
      ...options,
    };
  }

  private createRasterLayerId(name: string): string {
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48);

    this.rasterLayerIdSequence += 1;
    return `${rasterLayerPrefix}${slug || 'overlay'}-${this.rasterLayerIdSequence.toString(36)}`;
  }

  private createRasterLayerSnapshot(): GeomanRasterLayer[] {
    return this.rasterLayers.map((layer) => ({ ...layer }));
  }

  private notifyRasterLayerSubscribers(event: RasterLayerSubscriptionEvent): void {
    for (const subscriber of this.rasterLayerSubscribers.values()) {
      subscriber(this.createRasterLayerSnapshot(), event);
    }
  }
}

export function buildRasterCapabilitiesRequestUrl(rawUrl: string): string {
  let url: URL;

  try {
    url = new URL(rawUrl.trim());
  } catch {
    return rawUrl;
  }

  const service = inferRasterService(url);
  const baseUrl = new URL(url.origin + url.pathname);

  for (const [key, value] of url.searchParams) {
    if (!rasterCapabilitiesRequestTileParams.has(key.toLowerCase())) {
      baseUrl.searchParams.append(key, value);
    }
  }

  baseUrl.searchParams.set('service', service);
  baseUrl.searchParams.set('request', 'GetCapabilities');

  return baseUrl.toString();
}

export function normalizeRasterTileUrl(rawUrl: string): string {
  if (!rawUrl) {
    return '';
  }

  let url: URL;

  try {
    url = new URL(rawUrl);
  } catch {
    return rawUrl;
  }

  if (getSearchParamCaseInsensitive(url, 'service')?.toLowerCase() !== 'wms') {
    return rawUrl;
  }

  setSearchParamCaseInsensitive(url, 'service', 'WMS');
  setSearchParamCaseInsensitive(url, 'request', 'GetMap');
  url.searchParams.set('bbox', '{bbox-epsg-3857}');
  url.searchParams.set('width', String(defaultRasterTileSize));
  url.searchParams.set('height', String(defaultRasterTileSize));
  url.searchParams.set('crs', 'EPSG:3857');
  url.searchParams.set('srs', 'EPSG:3857');

  return decodeMapLibreTokens(url.toString());
}

export function buildRasterProxyUrl(tileUrl: string, options: RasterProxyOptions): string {
  if (!options.origin) {
    return tileUrl;
  }

  let targetUrl: URL;
  let originUrl: URL;

  try {
    targetUrl = new URL(tileUrl);
    originUrl = new URL(options.origin);
  } catch {
    return tileUrl;
  }

  if (!['http:', 'https:'].includes(targetUrl.protocol) || targetUrl.origin === originUrl.origin) {
    return tileUrl;
  }

  const parameterName = encodeURIComponent(options.parameterName ?? 'url');
  const encodedTarget = encodeRasterProxyTarget(tileUrl);
  const [proxyPath, proxyHash = ''] = options.path.split('#', 2);
  const separator = proxyPath.includes('?') ? '&' : '?';
  const hash = proxyHash ? `#${proxyHash}` : '';

  return `${proxyPath}${separator}${parameterName}=${encodedTarget}${hash}`;
}

export function createRasterProxyTransformer(
  options: RasterProxyOptions,
): (tileUrl: string) => string {
  return (tileUrl) => buildRasterProxyUrl(tileUrl, options);
}

export function createRasterProxyPolicy(options: RasterProxyPolicyOptions): RasterProxyPolicy {
  const transform = createRasterProxyTransformer(options);
  const parameterName = options.parameterName ?? 'url';
  const allowedOrigins = new Set(options.allowedOrigins);
  const hasAllowlist = allowedOrigins.size > 0;
  const origin = normalizeRasterProxyPolicyOrigin(options.origin);
  const getBlockedReason = (url: string) =>
    isRasterProxyPolicyUrlAllowed(url, parameterName, allowedOrigins, hasAllowlist, origin)
      ? undefined
      : 'Origin is not allowed by raster proxy policy.';
  const networkPolicy: RasterNetworkPolicy = {
    timeoutMs: options.timeoutMs,
    retryCount: options.retryCount,
    onDiagnostic: options.onDiagnostic,
    allowUrl: (url) => getBlockedReason(url) === undefined,
  };

  if (options.signal) {
    networkPolicy.signal = options.signal;
  }

  rasterNetworkPolicyBlockedReasons.set(networkPolicy, getBlockedReason);

  return {
    transformRequestUrl: transform,
    transformTileUrl: transform,
    networkPolicy,
  };
}

export function parseRasterCapabilities(
  xmlText: string,
  capabilitiesUrl: string,
): DiscoveredRasterLayer[] {
  const document = parseXmlDocument(xmlText);
  const service = inferCapabilitiesService(document, capabilitiesUrl);

  if (service === 'WMTS') {
    return parseWmtsCapabilities(document, capabilitiesUrl);
  }

  return parseWmsCapabilities(document, capabilitiesUrl);
}

export function syncRasterLayers(
  map: RasterMap,
  layers: GeomanRasterLayer[],
  options: RasterLayerSyncOptions = {},
): void {
  removeStaleRasterLayers(map, layers);

  for (const layer of [...layers].reverse()) {
    const sourceId = getRasterSourceId(layer.id);
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

    if (!map.getLayer(layer.id)) {
      map.addLayer(
        {
          id: layer.id,
          type: 'raster',
          source: sourceId,
          paint: {},
        },
        getFeatureLayerAnchorId(map, layer.id, layer.basemapLayerId ?? options.basemapLayerId),
      );
    }
  }

  moveRasterLayersIntoOverlayStack(map, layers, options);
}

function moveRasterLayersIntoOverlayStack(
  map: RasterMap,
  layers: GeomanRasterLayer[],
  options: RasterLayerSyncOptions,
): void {
  for (const layer of [...layers].reverse()) {
    if (map.getLayer(layer.id)) {
      map.moveLayer(
        layer.id,
        getFeatureLayerAnchorId(map, layer.id, layer.basemapLayerId ?? options.basemapLayerId),
      );
    }
  }
}

function removeStaleRasterLayers(map: RasterMap, layers: GeomanRasterLayer[]): void {
  const activeIds = new Set(layers.map((layer) => layer.id));
  const styleLayers = map.getStyle().layers ?? [];

  for (const layer of styleLayers) {
    if (layer.id.startsWith(rasterLayerPrefix) && !activeIds.has(layer.id)) {
      if (map.getLayer(layer.id)) {
        map.removeLayer(layer.id);
      }

      const sourceId = getRasterSourceId(layer.id);

      if (map.getSource(sourceId)) {
        map.removeSource(sourceId);
      }
    }
  }
}

function getFeatureLayerAnchorId(
  map: RasterMap,
  movingLayerId?: string,
  basemapLayerId?: string,
): string | undefined {
  const styleLayers = map.getStyle().layers ?? [];
  const rasterLayerIds = new Set(
    styleLayers.map((layer) => layer.id).filter((layerId) => layerId.startsWith(rasterLayerPrefix)),
  );
  const anchorCandidates = styleLayers.filter(
    (layer) => layer.id !== movingLayerId && !rasterLayerIds.has(layer.id),
  );

  if (basemapLayerId) {
    const basemapIndex = styleLayers.findIndex((layer) => layer.id === basemapLayerId);

    if (basemapIndex >= 0) {
      return anchorCandidates.find((layer) => {
        const layerIndex = styleLayers.findIndex((styleLayer) => styleLayer.id === layer.id);
        return layerIndex > basemapIndex;
      })?.id;
    }
  }

  return anchorCandidates.find((layer) => {
    if (layer.id === basemapLayerId) {
      return false;
    }

    if (!basemapLayerId && !layer.id.startsWith(`${GM_PREFIX}_`)) {
      return false;
    }

    return !rasterLayerIds.has(layer.id);
  })?.id;
}

function parseWmsCapabilities(
  document: Document,
  capabilitiesUrl: string,
): DiscoveredRasterLayer[] {
  const version = document.documentElement.getAttribute('version') || '1.3.0';
  const getMapUrl = getWmsGetMapEndpoint(document, capabilitiesUrl);

  return findElementsByLocalName(document, 'Layer')
    .map((layer): DiscoveredRasterLayer | null => {
      const name = getDirectChildText(layer, 'Name');

      if (!name) {
        return null;
      }

      const title = getDirectChildText(layer, 'Title') || name;

      return {
        name,
        service: 'WMS',
        title,
        url: buildWmsTileTemplateUrl(getMapUrl, name, version),
      };
    })
    .filter((layer): layer is DiscoveredRasterLayer => layer !== null);
}

function parseWmtsCapabilities(
  document: Document,
  capabilitiesUrl: string,
): DiscoveredRasterLayer[] {
  return findElementsByLocalName(document, 'Layer')
    .map((layer): DiscoveredRasterLayer | null => {
      const name = getDirectChildText(layer, 'Identifier');

      if (!name) {
        return null;
      }

      const title = getDirectChildText(layer, 'Title') || name;
      const metadata = getWmtsLayerMetadata(layer);
      const resourceUrl = Array.from(layer.children).find(
        (child) =>
          child.localName === 'ResourceURL' &&
          child.getAttribute('resourceType')?.toLowerCase() === 'tile',
      );
      const template = resourceUrl?.getAttribute('template');

      return {
        name,
        service: 'WMTS',
        title,
        ...metadata,
        url: template
          ? normalizeWmtsTemplateUrl(template, capabilitiesUrl, metadata)
          : buildWmtsKvpTileTemplateUrl(capabilitiesUrl, name, metadata),
      };
    })
    .filter((layer): layer is DiscoveredRasterLayer => layer !== null);
}

function getWmtsLayerMetadata(layer: Element): {
  style: string;
  format: string;
  tileMatrixSet: string;
} {
  const styles = findDirectChildrenByLocalName(layer, 'Style');
  const defaultStyle = styles.find((style) => style.getAttribute('isDefault') === 'true');
  const style =
    getDirectChildText(defaultStyle ?? styles[0], 'Identifier') ||
    getDirectChildText(styles[0], 'Identifier') ||
    'default';
  const format = getDirectChildText(layer, 'Format') || 'image/png';
  const tileMatrixSetLink = findDirectChildrenByLocalName(layer, 'TileMatrixSetLink')[0];
  const tileMatrixSet = getDirectChildText(tileMatrixSetLink, 'TileMatrixSet') || 'EPSG:3857';

  return {
    style,
    format,
    tileMatrixSet,
  };
}

function buildWmsTileTemplateUrl(
  capabilitiesUrl: string,
  layerName: string,
  version: string,
): string {
  const url = new URL(capabilitiesUrl);

  url.searchParams.set('service', 'WMS');
  url.searchParams.set('request', 'GetMap');
  url.searchParams.set('version', version);
  url.searchParams.set('layers', layerName);
  url.searchParams.set('styles', '');
  url.searchParams.set('format', 'image/png');
  url.searchParams.set('transparent', 'true');
  url.searchParams.set('width', String(defaultRasterTileSize));
  url.searchParams.set('height', String(defaultRasterTileSize));
  url.searchParams.set('crs', 'EPSG:3857');
  url.searchParams.set('srs', 'EPSG:3857');
  url.searchParams.set('bbox', '{bbox-epsg-3857}');

  return decodeMapLibreTokens(url.toString());
}

function buildWmtsKvpTileTemplateUrl(
  capabilitiesUrl: string,
  layerName: string,
  metadata: { style: string; format: string; tileMatrixSet: string },
): string {
  const url = new URL(capabilitiesUrl);

  url.searchParams.set('service', 'WMTS');
  url.searchParams.set('request', 'GetTile');
  url.searchParams.set('version', '1.0.0');
  url.searchParams.set('layer', layerName);
  url.searchParams.set('style', metadata.style);
  url.searchParams.set('tilematrixset', metadata.tileMatrixSet);
  url.searchParams.set('tilematrix', '{z}');
  url.searchParams.set('tilerow', '{y}');
  url.searchParams.set('tilecol', '{x}');
  url.searchParams.set('format', metadata.format);

  return decodeMapLibreTokens(url.toString());
}

function normalizeWmtsTemplateUrl(
  template: string,
  capabilitiesUrl: string,
  metadata: { style: string; tileMatrixSet: string },
): string {
  const style = encodeURIComponent(metadata.style);
  const tileMatrixSet = encodeURIComponent(metadata.tileMatrixSet);

  return resolveUrlTemplate(template, capabilitiesUrl)
    .replaceAll('{Style}', style)
    .replaceAll('{style}', style)
    .replaceAll('{TileMatrixSet}', tileMatrixSet)
    .replaceAll('{tilematrixset}', tileMatrixSet)
    .replaceAll('{TileMatrix}', '{z}')
    .replaceAll('{TileRow}', '{y}')
    .replaceAll('{TileCol}', '{x}')
    .replaceAll('{tilematrix}', '{z}')
    .replaceAll('{tilerow}', '{y}')
    .replaceAll('{tilecol}', '{x}')
    .replaceAll('%7BStyle%7D', style)
    .replaceAll('%7Bstyle%7D', style)
    .replaceAll('%7BTileMatrixSet%7D', tileMatrixSet)
    .replaceAll('%7Btilematrixset%7D', tileMatrixSet)
    .replaceAll('%7BTileMatrix%7D', '{z}')
    .replaceAll('%7BTileRow%7D', '{y}')
    .replaceAll('%7BTileCol%7D', '{x}')
    .replaceAll('%7Btilematrix%7D', '{z}')
    .replaceAll('%7Btilerow%7D', '{y}')
    .replaceAll('%7Btilecol%7D', '{x}');
}

function decodeMapLibreTokens(url: string): string {
  return url
    .replaceAll('%7Bbbox-epsg-3857%7D', '{bbox-epsg-3857}')
    .replaceAll('%7bbbox-epsg-3857%7d', '{bbox-epsg-3857}')
    .replaceAll('%7Bz%7D', '{z}')
    .replaceAll('%7Bx%7D', '{x}')
    .replaceAll('%7By%7D', '{y}');
}

function encodeRasterProxyTarget(tileUrl: string): string {
  return encodeURIComponent(tileUrl)
    .replaceAll('%7Bbbox-epsg-3857%7D', '{bbox-epsg-3857}')
    .replaceAll('%7bbbox-epsg-3857%7d', '{bbox-epsg-3857}')
    .replaceAll('%7Bz%7D', '{z}')
    .replaceAll('%7bz%7d', '{z}')
    .replaceAll('%7Bx%7D', '{x}')
    .replaceAll('%7bx%7d', '{x}')
    .replaceAll('%7By%7D', '{y}')
    .replaceAll('%7by%7d', '{y}');
}

function inferRasterService(url: URL): 'WMS' | 'WMTS' {
  return getSearchParamCaseInsensitive(url, 'service')?.toUpperCase() === 'WMTS' ? 'WMTS' : 'WMS';
}

function inferCapabilitiesService(document: Document, capabilitiesUrl: string): 'WMS' | 'WMTS' {
  const rootName = document.documentElement.localName.toLowerCase();

  if (rootName.includes('wmts')) {
    return 'WMTS';
  }

  try {
    const url = new URL(capabilitiesUrl);

    if (getSearchParamCaseInsensitive(url, 'service')?.toUpperCase() === 'WMTS') {
      return 'WMTS';
    }
  } catch {
    // Fall through to WMS for non-URL inputs.
  }

  return 'WMS';
}

function getSearchParamCaseInsensitive(url: URL, name: string): string | null {
  const normalizedName = name.toLowerCase();

  for (const [key, value] of url.searchParams) {
    if (key.toLowerCase() === normalizedName) {
      return value;
    }
  }

  return null;
}

function setSearchParamCaseInsensitive(url: URL, name: string, value: string): void {
  if (url.searchParams.has(name)) {
    url.searchParams.set(name, value);
    return;
  }

  for (const key of Array.from(url.searchParams.keys())) {
    if (key.toLowerCase() === name.toLowerCase()) {
      url.searchParams.delete(key);
    }
  }

  url.searchParams.set(name, value);
}

function parseXmlDocument(xmlText: string): Document {
  const Parser = getDomParser();
  const document = new Parser().parseFromString(xmlText, 'application/xml');
  const parserError = findFirstElementByLocalName(document, 'parsererror');

  if (parserError) {
    throw new Error(parserError.textContent?.trim() || 'Capabilities response is not valid XML.');
  }

  return document;
}

function getDomParser(): typeof DOMParser {
  if (typeof DOMParser !== 'undefined') {
    return DOMParser;
  }

  throw new Error('DOMParser is unavailable in this environment.');
}

async function fetchRasterCapabilitiesWithPolicy(
  requestUrl: string,
  fetchFn: NonNullable<DiscoverRasterLayersOptions['fetchFn']>,
  policy: RasterNetworkPolicy | undefined,
): Promise<string> {
  const blockedReason = getRasterNetworkPolicyBlockReason(policy, requestUrl);

  if (blockedReason) {
    emitRasterNetworkDiagnostic(policy, {
      type: 'request-blocked',
      url: requestUrl,
      reason: blockedReason,
    });
    throw new Error('Capabilities request blocked by raster network policy.');
  }

  const retryCount = Math.max(0, Math.floor(policy?.retryCount ?? 0));
  let finalHttpStatus: number | undefined;

  for (let attempt = 1; attempt <= retryCount + 1; attempt += 1) {
    const abortState = createRasterFetchAbortState(policy, requestUrl);

    try {
      emitRasterNetworkDiagnostic(policy, { type: 'request-start', url: requestUrl, attempt });
      const response = await (abortState.signal
        ? fetchFn(requestUrl, { signal: abortState.signal })
        : fetchFn(requestUrl));

      if (response.ok) {
        const text = await response.text();
        abortState.cleanup();
        emitRasterNetworkDiagnostic(policy, {
          type: 'request-success',
          url: requestUrl,
          attempt,
          status: response.status,
        });
        return text;
      }

      abortState.cleanup();
      finalHttpStatus = response.status;

      if (attempt <= retryCount) {
        emitRasterNetworkDiagnostic(policy, {
          type: 'request-retry',
          url: requestUrl,
          attempt,
          status: response.status,
        });
        continue;
      }

      emitRasterNetworkDiagnostic(policy, {
        type: 'request-failure',
        url: requestUrl,
        attempt,
        status: response.status,
      });
      break;
    } catch (error) {
      abortState.cleanup();

      if (abortState.timedOut) {
        throw new Error(`Capabilities request timed out after ${policy?.timeoutMs} ms.`);
      }

      if (isRasterAbortError(error, policy?.signal)) {
        emitRasterNetworkDiagnostic(policy, {
          type: 'request-abort',
          url: requestUrl,
          reason: policy?.signal?.reason ?? error,
        });
        throw new Error('Capabilities request aborted by raster network policy.');
      }

      if (attempt <= retryCount) {
        emitRasterNetworkDiagnostic(policy, {
          type: 'request-retry',
          url: requestUrl,
          attempt,
          error,
        });
        continue;
      }

      emitRasterNetworkDiagnostic(policy, {
        type: 'request-failure',
        url: requestUrl,
        attempt,
        error,
      });
      throw error;
    }
  }

  throw new Error(`Capabilities request failed with HTTP ${finalHttpStatus}.`);
}

function createRasterFetchAbortState(
  policy: RasterNetworkPolicy | undefined,
  requestUrl: string,
): {
  cleanup: () => void;
  signal?: AbortSignal;
  timedOut: boolean;
} {
  if (!policy?.timeoutMs && !policy?.signal) {
    return {
      cleanup: () => {},
      timedOut: false,
    };
  }

  const controller = new AbortController();
  let timedOut = false;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const abortFromCaller = () => {
    controller.abort(policy.signal?.reason);
  };

  if (policy.signal) {
    if (policy.signal.aborted) {
      abortFromCaller();
    } else {
      policy.signal.addEventListener('abort', abortFromCaller, { once: true });
    }
  }

  if (policy.timeoutMs) {
    timeoutId = setTimeout(() => {
      timedOut = true;
      emitRasterNetworkDiagnostic(policy, {
        type: 'request-timeout',
        url: requestUrl,
        timeoutMs: policy.timeoutMs!,
      });
      controller.abort(new Error(`Capabilities request timed out after ${policy.timeoutMs} ms.`));
    }, policy.timeoutMs);
  }

  return {
    get timedOut() {
      return timedOut;
    },
    signal: controller.signal,
    cleanup: () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      policy.signal?.removeEventListener('abort', abortFromCaller);
    },
  };
}

function getRasterNetworkPolicyBlockReason(
  policy: RasterNetworkPolicy | undefined,
  requestUrl: string,
): string | undefined {
  if (!policy?.allowUrl) {
    return undefined;
  }

  if (policy.allowUrl(requestUrl)) {
    return undefined;
  }

  const reason = rasterNetworkPolicyBlockedReasons.get(policy)?.(requestUrl);
  return reason ?? 'URL is not allowed by raster network policy.';
}

function emitRasterNetworkDiagnostic(
  policy: RasterNetworkPolicy | undefined,
  event: RasterNetworkDiagnosticEvent,
): void {
  try {
    policy?.onDiagnostic?.(event);
  } catch {
    // Diagnostics must not affect raster request behavior.
  }
}

function isRasterAbortError(error: unknown, signal: AbortSignal | undefined): boolean {
  return signal?.aborted === true || (error instanceof DOMException && error.name === 'AbortError');
}

function isRasterProxyPolicyUrlAllowed(
  url: string,
  parameterName: string,
  allowedOrigins: Set<string>,
  hasAllowlist: boolean,
  origin: string | undefined,
): boolean {
  if (!hasAllowlist) {
    return true;
  }

  const targetUrl = getRasterProxyPolicyTargetUrl(url, parameterName) ?? url;

  try {
    const targetOrigin = new URL(targetUrl, origin).origin;
    return targetOrigin === origin || allowedOrigins.has(targetOrigin);
  } catch {
    return false;
  }
}

function normalizeRasterProxyPolicyOrigin(origin: string | undefined): string | undefined {
  if (!origin) {
    return undefined;
  }

  try {
    return new URL(origin).origin;
  } catch {
    return origin;
  }
}

function getRasterProxyPolicyTargetUrl(url: string, parameterName: string): string | undefined {
  try {
    const parsed = new URL(url, 'http://geoforge.local');
    return parsed.searchParams.get(parameterName) ?? undefined;
  } catch {
    return undefined;
  }
}

function getGlobalFetch(): NonNullable<DiscoverRasterLayersOptions['fetchFn']> {
  if (typeof fetch === 'function') {
    return fetch;
  }

  throw new Error('fetch is unavailable. Pass discoverRasterLayers(..., { fetchFn }).');
}

function getDirectChildText(element: Element | undefined, childName: string): string {
  const child = element ? findDirectChildrenByLocalName(element, childName)[0] : undefined;
  return child?.textContent?.trim() ?? '';
}

function findDirectChildrenByLocalName(element: Element, childName: string): Element[] {
  return Array.from(element.children).filter((candidate) => candidate.localName === childName);
}

function getWmsGetMapEndpoint(document: Document, capabilitiesUrl: string): string {
  const getMap = findFirstElementByLocalName(document, 'GetMap');
  const onlineResource = getMap ? findFirstElementByLocalName(getMap, 'OnlineResource') : undefined;
  const href =
    onlineResource?.getAttribute('xlink:href') ??
    onlineResource?.getAttribute('href') ??
    onlineResource?.getAttributeNS('http://www.w3.org/1999/xlink', 'href');

  if (!href) {
    return capabilitiesUrl;
  }

  try {
    const resolvedUrl = new URL(href, capabilitiesUrl);
    const sourceUrl = new URL(capabilitiesUrl);

    if (
      sourceUrl.protocol === 'https:' &&
      resolvedUrl.protocol === 'http:' &&
      resolvedUrl.origin !== sourceUrl.origin
    ) {
      return capabilitiesUrl;
    }

    return resolvedUrl.toString();
  } catch {
    return capabilitiesUrl;
  }
}

function resolveUrlTemplate(template: string, baseUrl: string): string {
  try {
    return new URL(template, baseUrl).toString();
  } catch {
    return template;
  }
}

function findFirstElementByLocalName(root: ParentNode, localName: string): Element | undefined {
  return findElementsByLocalName(root, localName)[0];
}

function findElementsByLocalName(root: ParentNode, localName: string): Element[] {
  return Array.from(root.querySelectorAll('*')).filter(
    (element) => element.localName === localName,
  );
}

function getRasterSourceId(layerId: string): string {
  return `${rasterSourcePrefix}${sanitizeIdSegment(layerId)}`;
}

function isRasterMap(map: unknown): map is RasterMap {
  return !!(
    map &&
    typeof map === 'object' &&
    'addSource' in map &&
    'addLayer' in map &&
    'moveLayer' in map &&
    'getStyle' in map
  );
}

function removeRasterLayerFromMap(map: RasterMap, layerId: string): void {
  if (map.getLayer(layerId)) {
    map.removeLayer(layerId);
  }

  const sourceId = getRasterSourceId(layerId);

  if (map.getSource(sourceId)) {
    map.removeSource(sourceId);
  }
}

function dedupeRasterLayersById(layers: GeomanRasterLayer[]): GeomanRasterLayer[] {
  const seen = new Set<string>();
  const deduped: GeomanRasterLayer[] = [];

  for (const layer of layers) {
    if (!seen.has(layer.id)) {
      seen.add(layer.id);
      deduped.push(layer);
    }
  }

  return deduped;
}

function sanitizeIdSegment(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]+/g, '-');
}

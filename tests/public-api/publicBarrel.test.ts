import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, expectTypeOf, it, test, vi } from 'vitest';
import { createGeoForgeSsrServer } from '../utils/viteSsrServer.ts';
import type {
  ArrowheadManagerOptions,
  ArrowheadOptions,
  FeatureOwnerId,
  GeomanSession,
  GeomanSessionOptions,
  GeomanSessionSubsystemOptions,
  GeomanEndpointSnappingConfigureOptions,
  GeomanEndpointSnappingFacade,
  GeomanEndpointSnappingState,
  GeomanControlProfile,
  GeomanControlVisibilityOptions,
  GeomanFeaturePropertyEditor,
  GeomanFeaturePropertyEditorOptions,
  GeomanFeaturePropertyEditorState,
  GeomanLineDecoratorSubsystemOptions,
  GeomanRasterLayer,
  HtmlOverlayDefinition,
  HtmlOverlayIframeOptions,
  LineDecoratorGeomanSyncOptions,
  LineDecoratorLayerPosition,
  LineDecoratorManagerOptions,
  LineDecoratorOptions,
  RasterLayerSubscriptionCallback,
  RasterLayerSubscriptionEvent,
  RasterLayerDefaults,
  RasterProxyOptions,
  SymbolDecoratorRendererOptions,
  TextDecoratorRendererOptions,
} from '../../src/index.ts';

const STABLE_ROOT_EXPORTS = [
  'GeoForge',
  'Geoman',
  'createGeomanInstance',
  'GeomanGeometrySubsystem',
  'GeomanContextPanelSubsystem',
  'GeomanToolsSubsystem',
  'GeomanSelectionSubsystem',
  'GeomanTransactionSubsystem',
  'GeomanTransaction',
  'GeomanFeaturePropertyEditor',
  'GeomanHistorySubsystem',
  'GeomanSessionSubsystem',
  'GeomanLayerSubsystem',
  'buildRasterProxyUrl',
  'createRasterProxyTransformer',
  'defineGeomanContextPanel',
  'createContextPanelValidationList',
  'createContextPanelActionButton',
  'SOURCES',
  'GM_PREFIX',
] as const;

const ADVANCED_COMPATIBILITY_EXPORTS = [
  'LineDecoratorManager',
  'GeomanLineDecoratorSubsystem',
  'HtmlOverlayManager',
  'GeomanHtmlOverlaySubsystem',
] as const;

const DEPRECATED_COMPATIBILITY_EXPORTS = [
  'BaseAction',
  'BaseDraw',
  'BaseDrag',
  'BaseGroupEdit',
  'BaseEdit',
  'BaseHelper',
  'LineDrawer',
  'MarkerPointer',
  'HtmlOverlayElement',
  'ArrowheadManager',
  'generateArrowheads',
  'isInMeters',
  'isInPercent',
  'isInPixels',
  'parseNumeric',
  'distanceBetween',
  'bearingBetween',
  'destinationPoint',
  'interpolateOnLine',
  'pixelsToMeters',
  'toLngLat',
  'definedProps',
  'modulus',
  'ensureArrowheadSource',
  'resolveIds',
  'updateArrowheadSource',
  'clearArrowheadSource',
  'ensureSymbolDecoratorSource',
  'resolveSymbolDecoratorIds',
  'updateSymbolDecoratorSource',
  'clearSymbolDecoratorSource',
  'ensureSymbolImage',
  'ensureTextDecoratorSource',
  'resolveTextDecoratorIds',
  'updateTextDecoratorSource',
  'clearTextDecoratorSource',
  'SymbolDecoratorRenderer',
  'TextDecoratorRenderer',
  'normalizeLineDecorators',
  'addLineDecoratorLayer',
  'positionLineDecoratorLayers',
  'createLinePlacements',
] as const;

describe('public API barrel', () => {
  it('re-exports public bindings from the main module', async () => {
    const { TextEncoder } = await import('node:util');
    const textEncoderDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'TextEncoder');
    const uint8ArrayDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'Uint8Array');
    const originalGeomanVersion = process.env.VITE_GEOFORGE_VERSION;

    Object.defineProperty(globalThis, 'TextEncoder', {
      configurable: true,
      value: TextEncoder,
    });
    Object.defineProperty(globalThis, 'Uint8Array', {
      configurable: true,
      value: new TextEncoder().encode('').constructor,
    });
    process.env.VITE_GEOFORGE_VERSION = 'free';

    const layerStyleStubId = '\0public-api-layer-style-stub';
    const server = await createGeoForgeSsrServer({
      layerStyleStubId,
      layerStyleStubModule: 'export default {};',
    });

    try {
      const mainModule = await server.ssrLoadModule('/src/main.ts');
      const publicBarrel = await server.ssrLoadModule('/src/index.ts');

      expect(publicBarrel.GeoForge).toBeDefined();
      expect(publicBarrel.GeoForge).toBe(mainModule.Geoman);
      expect(publicBarrel.Geoman).toBe(mainModule.Geoman);

      for (const exportName of STABLE_ROOT_EXPORTS) {
        expect(publicBarrel[exportName], `stable export ${exportName}`).toBeDefined();
        expect(publicBarrel[exportName], `stable export ${exportName}`).toBe(
          mainModule[exportName],
        );
      }

      for (const exportName of ADVANCED_COMPATIBILITY_EXPORTS) {
        expect(
          publicBarrel[exportName],
          `advanced compatibility export ${exportName}`,
        ).toBeDefined();
        expect(publicBarrel[exportName], `advanced compatibility export ${exportName}`).toBe(
          mainModule[exportName],
        );
      }

      for (const exportName of DEPRECATED_COMPATIBILITY_EXPORTS) {
        expect(
          publicBarrel[exportName],
          `deprecated compatibility export ${exportName}`,
        ).toBeDefined();
        expect(publicBarrel[exportName], `deprecated compatibility export ${exportName}`).toBe(
          mainModule[exportName],
        );
      }

      expect(publicBarrel.Geoman).toBe(mainModule.Geoman);
      expect('undoPolygonVertex' in mainModule.Geoman.prototype).toBe(false);
      expect('redoPolygonVertex' in mainModule.Geoman.prototype).toBe(false);
      expect('canUndoPolygonVertex' in mainModule.Geoman.prototype).toBe(false);
      expect('canRedoPolygonVertex' in mainModule.Geoman.prototype).toBe(false);

      expect('useArrowheads' in publicBarrel, 'react hook excluded from root').toBe(false);

      const transactions = new publicBarrel.GeomanTransactionSubsystem({
        geoman: Object.create(mainModule.Geoman.prototype),
      });
      expect(typeof transactions.featureProperties).toBe('function');
      const transaction = transactions.start({ id: 'public-api-status-hardening' });

      expect(transaction.status).toBe('active');
      expect(Object.prototype.hasOwnProperty.call(transaction, '_status')).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(transaction, 'onDone')).toBe(false);
      expect(Reflect.set(transaction, 'status', 'cancelled')).toBe(false);
      expect(transaction.status).toBe('active');
      expect(() => transactions.start()).toThrow('A Geoman transaction is already active.');

      transaction.cancel();
      expect(transaction.status).toBe('cancelled');
      expect(transactions.getActive()).toBeNull();

      const tools = { destroy: vi.fn() };
      const geoman = Object.assign(Object.create(mainModule.Geoman.prototype), {
        destroyed: false,
        loaded: false,
        mapAdapterInstance: null,
        tools,
        decorators: { lines: { destroy: vi.fn() } },
        overlays: { html: { destroy: vi.fn() } },
        contextPanels: { destroy: vi.fn() },
        transactions: { destroy: vi.fn() },
        selection: { destroy: vi.fn() },
        events: { bus: { detachAllEvents: vi.fn() } },
        features: { sources: {} },
      });

      await geoman.destroy();

      expect(tools.destroy).toHaveBeenCalledTimes(1);
      expect(geoman.transactions.destroy).toHaveBeenCalledTimes(1);
    } finally {
      await server.close();

      if (textEncoderDescriptor) {
        Object.defineProperty(globalThis, 'TextEncoder', textEncoderDescriptor);
      } else {
        Reflect.deleteProperty(globalThis, 'TextEncoder');
      }

      if (uint8ArrayDescriptor) {
        Object.defineProperty(globalThis, 'Uint8Array', uint8ArrayDescriptor);
      } else {
        Reflect.deleteProperty(globalThis, 'Uint8Array');
      }

      if (originalGeomanVersion === undefined) {
        delete process.env.VITE_GEOFORGE_VERSION;
      } else {
        process.env.VITE_GEOFORGE_VERSION = originalGeomanVersion;
      }
    }
  });
});

test('keeps internal React bindings out of public package metadata', async () => {
  const packageRoot = process.cwd();
  const packageJson = JSON.parse(
    await readFile(path.join(packageRoot, 'package.json'), 'utf8'),
  ) as {
    exports?: Record<string, unknown>;
    peerDependencies?: Record<string, unknown>;
    peerDependenciesMeta?: Record<string, unknown>;
  };

  expect(
    Object.prototype.hasOwnProperty.call(packageJson.exports ?? {}, './react'),
    'react subpath export',
  ).toBe(false);
  expect(
    Object.prototype.hasOwnProperty.call(packageJson.peerDependencies ?? {}, 'react'),
    'react peer dependency',
  ).toBe(false);
  expect(
    Object.prototype.hasOwnProperty.call(packageJson.peerDependenciesMeta ?? {}, 'react'),
    'react peer dependency metadata',
  ).toBe(false);
});

test('keeps package subpath exports limited to root and CSS', async () => {
  const packageRoot = process.cwd();
  const packageJson = JSON.parse(
    await readFile(path.join(packageRoot, 'package.json'), 'utf8'),
  ) as {
    exports?: Record<string, unknown>;
  };

  expect(Object.keys(packageJson.exports ?? {}).sort()).toEqual([
    '.',
    './dist/maplibre-geoforge.css',
  ]);
  expect(packageJson.exports?.['./dist/maplibre-geoforge.css']).toEqual({
    types: './dist/maplibre-geoforge.css.d.ts',
    default: './dist/maplibre-geoforge.css',
  });
});

test('documents public API boundary guidance and unsupported subpaths', async () => {
  const packageRoot = process.cwd();
  const publicApiBoundaryDoc = await readFile(
    path.join(packageRoot, 'docs/public-api-boundary.md'),
    'utf8',
  );

  expect(publicApiBoundaryDoc).toContain('## Stable Root Exports');
  expect(publicApiBoundaryDoc).toContain('## Advanced Compatibility Exports');
  expect(publicApiBoundaryDoc).toContain('## Deprecated Compatibility Exports');
  expect(publicApiBoundaryDoc).toContain('## Unsupported Public Surfaces');
  expect(publicApiBoundaryDoc).toContain('maplibre-geoforge/dist/maplibre-geoforge.css');
  expect(publicApiBoundaryDoc).toContain('does not provide a supported `./react` subpath export');

  for (const exportName of STABLE_ROOT_EXPORTS) {
    expect(publicApiBoundaryDoc, `documented stable export ${exportName}`).toContain(
      `\`${exportName}\``,
    );
  }

  for (const exportName of ADVANCED_COMPATIBILITY_EXPORTS) {
    expect(publicApiBoundaryDoc, `documented advanced export ${exportName}`).toContain(
      `\`${exportName}\``,
    );
  }

  for (const exportName of DEPRECATED_COMPATIBILITY_EXPORTS) {
    expect(publicApiBoundaryDoc, `documented deprecated export ${exportName}`).toContain(
      `\`${exportName}\``,
    );
  }
});

test('exports public compatibility types from the root barrel', () => {
  expectTypeOf<ArrowheadOptions>().toMatchTypeOf<object>();
  expectTypeOf<ArrowheadManagerOptions>().toMatchTypeOf<object>();
  expectTypeOf<FeatureOwnerId>().toMatchTypeOf<string | number>();
  expectTypeOf<GeomanSession>().toMatchTypeOf<object>();
  expectTypeOf<GeomanSessionOptions>().toMatchTypeOf<object>();
  expectTypeOf<GeomanSessionSubsystemOptions>().toMatchTypeOf<object>();
  expectTypeOf<GeomanEndpointSnappingConfigureOptions>().toMatchTypeOf<object>();
  expectTypeOf<GeomanEndpointSnappingFacade>().toMatchTypeOf<object>();
  expectTypeOf<GeomanEndpointSnappingState>().toMatchTypeOf<object>();
  expectTypeOf<GeomanControlProfile>().toMatchTypeOf<object>();
  expectTypeOf<GeomanControlVisibilityOptions>().toMatchTypeOf<object>();
  expectTypeOf<GeomanFeaturePropertyEditor>().toMatchTypeOf<object>();
  expectTypeOf<GeomanFeaturePropertyEditorOptions>().toMatchTypeOf<object>();
  expectTypeOf<GeomanFeaturePropertyEditorState>().toMatchTypeOf<object>();
  expectTypeOf<LineDecoratorOptions>().toMatchTypeOf<object>();
  expectTypeOf<LineDecoratorLayerPosition>().toMatchTypeOf<string>();
  expectTypeOf<LineDecoratorManagerOptions>().toMatchTypeOf<object>();
  expectTypeOf<LineDecoratorGeomanSyncOptions>().toMatchTypeOf<object>();
  expectTypeOf<GeomanLineDecoratorSubsystemOptions>().toMatchTypeOf<object>();
  expectTypeOf<SymbolDecoratorRendererOptions>().toMatchTypeOf<object>();
  expectTypeOf<TextDecoratorRendererOptions>().toMatchTypeOf<object>();
  expectTypeOf<HtmlOverlayDefinition>().toMatchTypeOf<object>();
  expectTypeOf<HtmlOverlayIframeOptions>().toMatchTypeOf<object>();
  expectTypeOf<RasterLayerDefaults>().toMatchTypeOf<object>();
  expectTypeOf<RasterLayerSubscriptionCallback>().parameters.toEqualTypeOf<
    [GeomanRasterLayer[], RasterLayerSubscriptionEvent]
  >();
  expectTypeOf<RasterLayerSubscriptionEvent>().toMatchTypeOf<object>();
  expectTypeOf<RasterLayerSubscriptionEvent['type']>().toEqualTypeOf<
    'initial' | 'configure' | 'add' | 'remove' | 'reorder' | 'destroy'
  >();
  expectTypeOf<RasterProxyOptions>().toMatchTypeOf<object>();
});

test('exports context panel and geometry helper types', async () => {
  const layerStyleStubId = '\0public-api-context-panel-layer-style-stub';
  const server = await createGeoForgeSsrServer({
    layerStyleStubId,
    layerStyleStubModule: 'export default {};',
  });

  try {
    const publicApi = await server.ssrLoadModule('/src/index.ts');

    expect(publicApi.GeomanContextPanelSubsystem).toBeDefined();
    expect(publicApi.defineGeomanContextPanel).toBeDefined();
    expect(publicApi.createContextPanelValidationList).toBeDefined();
    expect(publicApi.createContextPanelActionButton).toBeDefined();
  } finally {
    await server.close();
  }
});

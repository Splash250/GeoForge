// @vitest-environment jsdom

import { SOURCES } from '@/core/features/constants.ts';
import { Features } from '@/core/features/index.ts';
import { GeomanSessionSubsystem } from '@/sessions/index.ts';
import type { BaseSource } from '@/core/map/base/source.ts';
import type { Geoman } from '@/main.ts';
import type { FeatureId } from '@/types/features.ts';
import type { GeoJsonImportFeature, GeoJsonImportFeatureCollection } from '@/types/geojson.ts';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/core/options/layers/style.ts', () => ({ default: {} }));
vi.mock('@/main.ts', () => ({
  includesWithType: (value: unknown, items: readonly unknown[]) => items.includes(value),
  typedKeys: Object.keys,
}));

function createGeomanDouble() {
  const geoman = {
    options: {
      settings: {
        throttlingDelay: 0,
        idGenerator: null,
      },
      layerStyles: {},
    },
    history: { record: vi.fn() },
    mapAdapter: {
      queryFeaturesByScreenCoordinates: vi.fn(() => []),
      coordBoundsToScreenBounds: vi.fn(),
    },
    events: { fire: vi.fn() },
    isFeatureEditable: vi.fn(() => true),
  } as unknown as Geoman;
  const features = new Features(geoman);

  geoman.features = features;
  features.sources[SOURCES.main] = createSource(SOURCES.main) as unknown as BaseSource;
  features.sources[SOURCES.temporary] = createSource(SOURCES.temporary) as unknown as BaseSource;
  features.updateManager.updateSource = vi.fn(({ diff, sourceName }) => {
    const source = features.sources[sourceName] as unknown as ReturnType<typeof createSource>;
    diff?.add?.forEach((feature: GeoJsonImportFeature) => source.addGeoJson(feature));
    diff?.update?.forEach((feature: GeoJsonImportFeature) => source.updateGeoJson(feature));
    diff?.remove?.forEach((featureId: FeatureId) => source.removeGeoJson(featureId));
  });

  const sessions = new GeomanSessionSubsystem({ geoman });

  return { geoman, features, sessions };
}

function createSource(id: string) {
  const geoJsonFeatures = new Map<string | number, GeoJsonImportFeature>();

  return {
    id,
    addGeoJson: vi.fn((feature: GeoJsonImportFeature) => {
      geoJsonFeatures.set(feature.id ?? String(geoJsonFeatures.size + 1), feature);
    }),
    updateGeoJson: vi.fn((feature: GeoJsonImportFeature) => {
      geoJsonFeatures.set(feature.id ?? String(geoJsonFeatures.size + 1), feature);
    }),
    removeGeoJson: vi.fn((featureId: string | number) => {
      geoJsonFeatures.delete(featureId);
    }),
    getGeoJson: vi.fn(() => ({
      type: 'FeatureCollection' as const,
      features: Array.from(geoJsonFeatures.values()),
    })),
    getGmGeoJson: vi.fn(() => ({
      type: 'FeatureCollection' as const,
      features: Array.from(geoJsonFeatures.values()),
    })),
  };
}

function createFeature(id: string): GeoJsonImportFeature {
  return {
    type: 'Feature',
    id,
    properties: { shape: 'marker' },
    geometry: { type: 'Point', coordinates: [0, 0] },
  };
}

function createFeatureCollection(...ids: string[]): GeoJsonImportFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: ids.map(createFeature),
  };
}

describe('Geoman sessions', () => {
  it('starts sessions with generated stable owner ids and caller-provided owner ids', () => {
    const { sessions } = createGeomanDouble();

    const generated = sessions.start();
    const secondGenerated = sessions.start();
    const callerOwned = sessions.start({ ownerId: 'demo:owned' });

    expect(generated.ownerId).toMatch(/^session:/);
    expect(secondGenerated.ownerId).toMatch(/^session:/);
    expect(secondGenerated.ownerId).not.toBe(generated.ownerId);
    expect(generated.ownerId).toBe(generated.ownerId);
    expect(callerOwned.ownerId).toBe('demo:owned');
    expect(generated.disposed).toBe(false);
  });

  it('scopes import, query, count, getAll, and deleteAll to the session owner by default', () => {
    const { sessions, features } = createGeomanDouble();
    const session = sessions.start({ ownerId: 'demo:session' });

    features.importGeoJson(createFeature('outside'), { ownerId: 'demo:outside' });
    const imported = session.features.importGeoJson(createFeatureCollection('owned-a', 'owned-b'));

    expect(imported.stats.success).toBe(2);
    expect(imported.addedFeatures.map((feature) => feature.ownerId)).toEqual([
      'demo:session',
      'demo:session',
    ]);
    expect(session.features.query().map((feature) => feature.id)).toEqual(['owned-a', 'owned-b']);
    expect(session.features.count()).toBe(2);
    expect(session.features.getAll().features.map((feature) => feature.id)).toEqual([
      'owned-a',
      'owned-b',
    ]);

    const deletedRefs = session.features.deleteAll();

    expect(deletedRefs.map((ref) => ref.featureId)).toEqual(['owned-a', 'owned-b']);
    expect(features.get(SOURCES.main, 'outside')).not.toBeNull();
    expect(features.count({ ownerId: 'demo:session', includeTemporary: true })).toBe(0);
  });

  it('scopes single feature imports and lets per-operation owner/history override session defaults', () => {
    const { sessions, features, geoman } = createGeomanDouble();
    const session = sessions.start({ ownerId: 'demo:session', history: false });

    const owned = session.features.importGeoJsonFeature(createFeature('owned-single'));
    const override = session.features.importGeoJsonFeature(createFeature('override-single'), {
      ownerId: 'demo:override',
      history: true,
    });

    expect(owned?.ownerId).toBe('demo:session');
    expect(override?.ownerId).toBe('demo:override');
    expect(features.query({ ownerId: 'demo:session' }).map((feature) => feature.id)).toEqual([
      'owned-single',
    ]);
    expect(geoman.history.record).toHaveBeenNthCalledWith(1, []);
    expect(geoman.history.record).toHaveBeenNthCalledWith(
      2,
      expect.arrayContaining([expect.objectContaining({ kind: 'create' })]),
      { label: 'feature.create' },
    );
  });

  it('disposes idempotently, unsubscribes session subscriptions, and deletes only session-owned features', () => {
    const { sessions, features } = createGeomanDouble();
    const session = sessions.start({ ownerId: 'demo:session' });
    const callback = vi.fn();

    features.importGeoJson(createFeature('outside'), { ownerId: 'demo:outside' });
    session.features.importGeoJson(createFeature('inside'));
    session.features.subscribe(callback);
    session.features.importGeoJsonFeature(createFeature('inside-after-subscribe'));

    expect(callback).toHaveBeenCalledTimes(1);

    session.dispose();
    session.dispose();
    session.features.importGeoJsonFeature(createFeature('inside-after-dispose'));

    expect(session.disposed).toBe(true);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(features.get(SOURCES.main, 'outside')).not.toBeNull();
    expect(features.get(SOURCES.main, 'inside')).toBeNull();
    expect(features.get(SOURCES.main, 'inside-after-subscribe')).toBeNull();
    expect(features.get(SOURCES.main, 'inside-after-dispose')).not.toBeNull();
  });

  it('can disable dispose cleanup and can opt cleanup history back in', () => {
    const { sessions, features, geoman } = createGeomanDouble();
    const retained = sessions.start({ ownerId: 'demo:retained', cleanup: false });
    const historyEnabledCleanup = sessions.start({
      ownerId: 'demo:cleanup-history',
      cleanupHistory: true,
    });

    retained.features.importGeoJsonFeature(createFeature('retained'), { history: false });
    historyEnabledCleanup.features.importGeoJsonFeature(createFeature('history-delete'), {
      history: false,
    });
    const historyRecord = geoman.history.record as unknown as ReturnType<typeof vi.fn>;
    historyRecord.mockClear();

    retained.dispose();
    historyEnabledCleanup.dispose();

    expect(features.get(SOURCES.main, 'retained')).not.toBeNull();
    expect(features.get(SOURCES.main, 'history-delete')).toBeNull();
    expect(geoman.history.record).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ kind: 'delete' })]),
      { label: 'feature.delete' },
    );
  });

  it('uses history:false for dispose cleanup by default', () => {
    const { sessions, geoman } = createGeomanDouble();
    const session = sessions.start({ ownerId: 'demo:session' });

    session.features.importGeoJsonFeature(createFeature('cleanup-default'), { history: false });
    const historyRecord = geoman.history.record as unknown as ReturnType<typeof vi.fn>;
    historyRecord.mockClear();

    session.dispose();

    expect(geoman.history.record).toHaveBeenCalledWith([]);
    expect(geoman.history.record).not.toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ kind: 'delete' })]),
      { label: 'feature.delete' },
    );
  });
});

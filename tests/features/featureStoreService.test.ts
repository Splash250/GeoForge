import { describe, expect, it, vi } from 'vitest';
import log from '../../src/utils/log.ts';
import { FeatureStoreService } from '../../src/core/features/featureStoreService.ts';
import type { FeatureData } from '../../src/core/features/feature-data.ts';
import type {
  FeatureId,
  FeatureStore,
  GeoJsonShapeFeature,
  SourcesStorage,
} from '../../src/main.ts';
import type { BaseSource } from '../../src/core/map/base/source.ts';

const MAIN_SOURCE = 'gm_main';
const TEMPORARY_SOURCE = 'gm_temporary';
const HOT_SOURCE = 'gm_hot';

function createSource(id: string): BaseSource {
  return { id } as BaseSource;
}

function createFeatureData({
  id,
  source,
  temporary = false,
}: {
  id: FeatureId;
  source: BaseSource;
  temporary?: boolean;
}): FeatureData {
  return {
    id,
    source,
    sourceName: source.id,
    temporary,
    delete: vi.fn(),
  } as unknown as FeatureData;
}

function createShapeGeoJson(): GeoJsonShapeFeature {
  return {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [1, 2],
    },
    properties: {},
  };
}

function createSources(): SourcesStorage {
  return {
    [MAIN_SOURCE]: createSource(MAIN_SOURCE),
    [TEMPORARY_SOURCE]: createSource(TEMPORARY_SOURCE),
  } as SourcesStorage;
}

describe('FeatureStoreService', () => {
  it('generates feature IDs by incrementing the counter and skipping existing store IDs', () => {
    const sources = createSources();
    const service = new FeatureStoreService({ sources });
    service.featureStore.set(
      'feature-2',
      createFeatureData({ id: 'feature-2', source: sources[MAIN_SOURCE] as BaseSource }),
    );

    expect(service.getNewFeatureId(createShapeGeoJson())).toBe('feature-1');
    expect(service.getNewFeatureId(createShapeGeoJson())).toBe('feature-3');
    expect(service.featureCounter).toBe(3);
  });

  it('increments the counter before delegating to a custom id generator', () => {
    const sources = createSources();
    const idGenerator = vi.fn(() => 'custom-id');
    const service = new FeatureStoreService({ sources, idGenerator });
    const shapeGeoJson = createShapeGeoJson();

    expect(service.getNewFeatureId(shapeGeoJson)).toBe('custom-id');
    expect(idGenerator).toHaveBeenCalledWith(shapeGeoJson);
    expect(service.featureCounter).toBe(1);
  });

  it('reads dynamic id generators at ID creation time', () => {
    const sources = createSources();
    let idGenerator = vi.fn(() => 'first-id');
    const service = new FeatureStoreService({
      sources,
      getIdGenerator: () => idGenerator,
    });

    expect(service.getNewFeatureId(createShapeGeoJson())).toBe('first-id');

    idGenerator = vi.fn(() => 'second-id');

    expect(service.getNewFeatureId(createShapeGeoJson())).toBe('second-id');
  });

  it('does not share the default allowed sources array between instances', () => {
    const sources = createSources();
    const firstService = new FeatureStoreService({ sources });
    const secondService = new FeatureStoreService({ sources });

    firstService.allowedSources.length = 0;

    expect(secondService.allowedSources).toEqual([MAIN_SOURCE, TEMPORARY_SOURCE]);
  });

  it('only stores feature data from allowed main and temporary sources', () => {
    const sources = createSources();
    const service = new FeatureStoreService({ sources });
    const mainFeature = createFeatureData({
      id: 'main',
      source: sources[MAIN_SOURCE] as BaseSource,
    });
    const temporaryFeature = createFeatureData({
      id: 'temporary',
      source: sources[TEMPORARY_SOURCE] as BaseSource,
    });
    const hotFeature = createFeatureData({
      id: 'hot',
      source: createSource(HOT_SOURCE),
    });

    service.add(mainFeature);
    service.add(temporaryFeature);
    service.add(hotFeature);

    expect(service.get(MAIN_SOURCE, 'main')).toBe(mainFeature);
    expect(service.get(TEMPORARY_SOURCE, 'temporary')).toBe(temporaryFeature);
    expect(service.get(HOT_SOURCE as never, 'hot')).toBeNull();
  });

  it('stores features with the same id in different sources independently', () => {
    const sources = createSources();
    const service = new FeatureStoreService({ sources });
    const mainFeature = createFeatureData({
      id: 'shared-id',
      source: sources[MAIN_SOURCE] as BaseSource,
    });
    const temporaryFeature = createFeatureData({
      id: 'shared-id',
      source: sources[TEMPORARY_SOURCE] as BaseSource,
    });

    service.add(mainFeature);
    service.add(temporaryFeature);

    expect(service.get(MAIN_SOURCE, 'shared-id')).toBe(mainFeature);
    expect(service.get(TEMPORARY_SOURCE, 'shared-id')).toBe(temporaryFeature);
  });

  it('matches get and has by source object identity from the sources storage', () => {
    const sources = createSources();
    const service = new FeatureStoreService({ sources });
    const matchingSourceFeature = createFeatureData({
      id: 'matching',
      source: sources[MAIN_SOURCE] as BaseSource,
    });
    const sameIdDifferentObjectSourceFeature = createFeatureData({
      id: 'same-source-id',
      source: createSource(MAIN_SOURCE),
    });

    service.add(matchingSourceFeature);
    service.add(sameIdDifferentObjectSourceFeature);

    expect(service.has(MAIN_SOURCE, 'matching')).toBe(true);
    expect(service.get(MAIN_SOURCE, 'matching')).toBe(matchingSourceFeature);
    expect(service.has(MAIN_SOURCE, 'same-source-id')).toBe(false);
    expect(service.get(MAIN_SOURCE, 'same-source-id')).toBeNull();
  });

  it('filters iteration and keeps the original store in the callback', () => {
    const sources = createSources();
    const service = new FeatureStoreService({ sources });
    const featureStore: FeatureStore = new Map();
    const permanentFeature = createFeatureData({
      id: 'permanent',
      source: sources[MAIN_SOURCE] as BaseSource,
    });
    const temporaryFeature = createFeatureData({
      id: 'temporary',
      source: sources[TEMPORARY_SOURCE] as BaseSource,
      temporary: true,
    });
    service.featureStore = featureStore;
    service.add(permanentFeature);
    service.add(temporaryFeature);
    const callback = vi.fn();

    service.filteredForEach((featureData) => !featureData.temporary)(callback);

    expect(callback).toHaveBeenCalledOnce();
    expect(callback).toHaveBeenCalledWith(permanentFeature, 'permanent', featureStore);
  });

  it('deletes stored feature data by id or instance and clears all stored features', () => {
    const sources = createSources();
    const service = new FeatureStoreService({ sources });
    const firstFeature = createFeatureData({
      id: 'first',
      source: sources[MAIN_SOURCE] as BaseSource,
    });
    const secondFeature = createFeatureData({
      id: 'second',
      source: sources[MAIN_SOURCE] as BaseSource,
    });
    service.add(firstFeature);
    service.add(secondFeature);

    service.delete('first');

    expect(service.get(MAIN_SOURCE, 'first')).toBeNull();
    expect(firstFeature.delete).toHaveBeenCalledOnce();

    service.delete(secondFeature);

    expect(service.get(MAIN_SOURCE, 'second')).toBeNull();
    expect(secondFeature.delete).toHaveBeenCalledOnce();

    service.add(firstFeature);
    service.add(secondFeature);
    service.clear();

    expect(service.featureStore.size).toBe(0);
    expect(firstFeature.delete).toHaveBeenCalledTimes(2);
    expect(secondFeature.delete).toHaveBeenCalledTimes(2);
  });

  it('delete by source-aware feature ref removes only the matching source feature', () => {
    const sources = createSources();
    const service = new FeatureStoreService({ sources });
    const mainFeature = createFeatureData({
      id: 'shared-id',
      source: sources[MAIN_SOURCE] as BaseSource,
    });
    const temporaryFeature = createFeatureData({
      id: 'shared-id',
      source: sources[TEMPORARY_SOURCE] as BaseSource,
    });

    service.add(mainFeature);
    service.add(temporaryFeature);
    service.delete({ sourceName: MAIN_SOURCE, featureId: 'shared-id' });

    expect(service.get(MAIN_SOURCE, 'shared-id')).toBeNull();
    expect(service.get(TEMPORARY_SOURCE, 'shared-id')).toBe(temporaryFeature);
    expect(mainFeature.delete).toHaveBeenCalledOnce();
    expect(temporaryFeature.delete).not.toHaveBeenCalled();
  });

  it('ignores non-feature objects passed to delete', () => {
    const sources = createSources();
    const service = new FeatureStoreService({ sources });
    const logError = vi.spyOn(log, 'error').mockImplementation(() => undefined);

    try {
      expect(() => service.delete({ id: 'not-a-feature' } as never)).not.toThrow();
      expect(logError).toHaveBeenCalledWith('features.delete: feature "[object Object]" not found');
    } finally {
      logError.mockRestore();
    }
  });
});

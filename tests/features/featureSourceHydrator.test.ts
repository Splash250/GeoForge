import { describe, expect, it, vi } from 'vitest';
import { FEATURE_ID_PROPERTY, SOURCES } from '../../src/core/features/constants.ts';
import { FeatureSourceHydrator } from '../../src/core/features/featureSourceHydrator.ts';
import type { BaseSource } from '../../src/core/map/base/source.ts';
import type { FeatureData } from '../../src/core/features/feature-data.ts';
import type { FeatureId, SourcesStorage } from '../../src/main.ts';

vi.mock('@/core/constants.ts', () => ({
  GM_PREFIX: 'gm',
  GM_SYSTEM_PREFIX: 'gm',
  IS_PRO: false,
}));

vi.mock('../../src/core/features/feature-data.ts', () => ({
  FeatureData: class {
    gm: unknown;
    id: FeatureId;
    parent: FeatureData | null;
    source: BaseSource;
    geoJsonShapeFeature: ReturnType<typeof createPointFeature>;
    skipSourceUpdate: boolean | undefined;

    constructor(parameters: {
      gm: unknown;
      id: FeatureId;
      parent: FeatureData | null;
      source: BaseSource;
      geoJsonShapeFeature: ReturnType<typeof createPointFeature>;
      skipSourceUpdate?: boolean;
    }) {
      this.gm = parameters.gm;
      this.id = parameters.id;
      this.parent = parameters.parent;
      this.source = parameters.source;
      this.geoJsonShapeFeature = parameters.geoJsonShapeFeature;
      this.skipSourceUpdate = parameters.skipSourceUpdate;
    }

    getGeoJson() {
      return this.geoJsonShapeFeature;
    }
  },
}));

function createGm() {
  return {
    features: {
      getFeatureShapeByGeoJson: vi.fn(() => 'marker'),
      updateManager: {
        updateSource: vi.fn(),
      },
    },
  };
}

function createPointFeature(id: FeatureId) {
  return {
    type: 'Feature' as const,
    id,
    geometry: {
      type: 'Point' as const,
      coordinates: [0, 0],
    },
    properties: {
      [FEATURE_ID_PROPERTY]: id,
      shape: 'marker',
      label: 'original',
    },
  };
}

function createSources(source: BaseSource | null): SourcesStorage {
  return {
    [SOURCES.main]: source,
    [SOURCES.temporary]: null,
  } as SourcesStorage;
}

describe('FeatureSourceHydrator', () => {
  it('hydrates existing source features with cloned FeatureData and returns max generated counter', () => {
    const gm = createGm();
    const setFeature = vi.fn();
    const sourceFeature = createPointFeature('feature-7');
    const source = {
      id: SOURCES.main,
      getGeoJson: vi.fn(() => ({
        type: 'FeatureCollection',
        features: [sourceFeature],
      })),
    } as unknown as BaseSource;
    const hydrator = new FeatureSourceHydrator({
      gm: gm as never,
      sources: createSources(source),
      hasFeature: () => false,
      setFeature,
    });

    const result = hydrator.hydrate();

    expect(result.maxCounter).toBe(7);
    expect(setFeature).toHaveBeenCalledOnce();
    const [sourceName, featureId, featureData] = setFeature.mock.calls[0] as [
      string,
      FeatureId,
      FeatureData,
    ];
    expect(sourceName).toBe(SOURCES.main);
    expect(featureId).toBe('feature-7');
    expect(featureData.id).toBe('feature-7');
    expect(featureData.parent).toBeNull();
    expect(featureData.source).toBe(source);

    sourceFeature.properties.label = 'mutated';

    expect(featureData.getGeoJson().properties.label).toBe('original');
    expect(gm.features.updateManager.updateSource).not.toHaveBeenCalled();
  });

  it('skips source features already present in the feature store', () => {
    const setFeature = vi.fn();
    const source = {
      id: SOURCES.main,
      getGeoJson: vi.fn(() => ({
        type: 'FeatureCollection',
        features: [createPointFeature('feature-2')],
      })),
    } as unknown as BaseSource;
    const hydrator = new FeatureSourceHydrator({
      gm: createGm() as never,
      sources: createSources(source),
      hasFeature: () => true,
      setFeature,
    });

    const result = hydrator.hydrate();

    expect(result.maxCounter).toBe(2);
    expect(setFeature).not.toHaveBeenCalled();
  });

  it('tracks only numeric generated feature id counters', () => {
    const setFeature = vi.fn();
    const source = {
      id: SOURCES.main,
      getGeoJson: vi.fn(() => ({
        type: 'FeatureCollection',
        features: [
          createPointFeature('feature-10'),
          createPointFeature('feature-not-a-number'),
          createPointFeature('custom-99'),
        ],
      })),
    } as unknown as BaseSource;
    const hydrator = new FeatureSourceHydrator({
      gm: createGm() as never,
      sources: createSources(source),
      hasFeature: () => false,
      setFeature,
    });

    expect(hydrator.hydrate()).toEqual({ maxCounter: 10 });
  });

  it('ignores source read failures', () => {
    const setFeature = vi.fn();
    const source = {
      id: SOURCES.main,
      getGeoJson: vi.fn(() => {
        throw new Error('source is not ready');
      }),
    } as unknown as BaseSource;
    const hydrator = new FeatureSourceHydrator({
      gm: createGm() as never,
      sources: createSources(source),
      hasFeature: () => false,
      setFeature,
    });

    expect(() => hydrator.hydrate()).not.toThrow();
    expect(hydrator.hydrate()).toEqual({ maxCounter: 0 });
    expect(setFeature).not.toHaveBeenCalled();
  });
});

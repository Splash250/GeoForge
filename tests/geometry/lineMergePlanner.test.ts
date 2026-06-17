import {
  applyLineMergePlan,
  getLineMergePlan,
  type GeomanLineMergePlan,
} from '@/geometry/lineMergePlanner.ts';
import type { FeatureData } from '@/core/features/feature-data.ts';
import type { LngLatTuple } from '@/types/map/index.ts';
import { describe, expect, test, vi } from 'vitest';

const createFeature = (
  id: string,
  coordinates: Array<LngLatTuple>,
  properties: Record<string, unknown> = { shape: 'line' },
  sourceName = 'gm_main',
) => {
  const geoJson = {
    type: 'Feature' as const,
    id,
    properties,
    geometry: {
      type: 'LineString' as const,
      coordinates,
    },
  };

  return {
    id,
    sourceName,
    getGeoJson: vi.fn(() => geoJson),
    updateGeometry: vi.fn((geometry) => {
      geoJson.geometry = geometry;
    }),
    updateProperties: vi.fn((nextProperties) => {
      geoJson.properties = { ...geoJson.properties, ...nextProperties };
    }),
    restoreGeoJsonSnapshot: vi.fn((snapshot) => {
      geoJson.geometry = structuredClone(snapshot.geometry);
      geoJson.properties = structuredClone(snapshot.properties);
    }),
  } as unknown as FeatureData;
};

describe('line merge planner', () => {
  test('rejects selections with fewer than two features', () => {
    const lineA = createFeature('line-a', [
      [0, 0],
      [1, 0],
    ]);

    expect(getLineMergePlan([lineA])).toMatchObject({
      ok: false,
      reason: 'not-enough-features',
    });
  });

  test('plans an ordered merge for connected line strings', () => {
    const lineA = createFeature('line-a', [
      [0, 0],
      [1, 0],
    ]);
    const lineB = createFeature('line-b', [
      [1, 0],
      [2, 0],
    ]);

    expect(getLineMergePlan([lineA, lineB])).toMatchObject({
      ok: true,
      plan: expect.objectContaining({
        primaryFeature: lineA,
        removedFeatures: [lineB],
        geometry: {
          type: 'LineString',
          coordinates: [
            [0, 0],
            [1, 0],
            [2, 0],
          ],
        },
        properties: { shape: 'line' },
      }),
    });
  });

  test('orients reversed input lines into one path', () => {
    const lineA = createFeature('line-a', [
      [1, 0],
      [0, 0],
    ]);
    const lineB = createFeature('line-b', [
      [1, 0],
      [2, 0],
    ]);

    const result = getLineMergePlan([lineA, lineB]);

    expect(result.ok ? result.plan.geometry.coordinates : null).toEqual([
      [0, 0],
      [1, 0],
      [2, 0],
    ]);
  });

  test('rejects disconnected selections and branch nodes', () => {
    const lineA = createFeature('line-a', [
      [0, 0],
      [1, 0],
    ]);
    const lineB = createFeature('line-b', [
      [10, 0],
      [11, 0],
    ]);
    const branch = createFeature('line-c', [
      [1, 0],
      [1, 1],
    ]);

    expect(getLineMergePlan([lineA, lineB])).toMatchObject({
      ok: false,
      reason: 'not-connected',
    });
    expect(
      getLineMergePlan([
        lineA,
        createFeature('line-d', [
          [1, 0],
          [2, 0],
        ]),
        branch,
      ]),
    ).toMatchObject({
      ok: false,
      reason: 'branching-connection',
    });
  });

  test('connects nearby endpoints when coordinateDistanceTolerance is provided without snapping coordinates', () => {
    const lineA = createFeature('line-a', [
      [0, 0],
      [1, 0],
    ]);
    const lineB = createFeature('line-b', [
      [1.000001, 0],
      [2, 0],
    ]);

    const result = getLineMergePlan([lineA, lineB], {
      coordinateDistanceTolerance: 0.00001,
    });

    expect(result).toMatchObject({ ok: true });
    expect(result.ok ? result.plan.geometry.coordinates : null).toEqual([
      [0, 0],
      [1, 0],
      [1.000001, 0],
      [2, 0],
    ]);
  });

  test('accepts endpointTolerance as an alias for coordinateDistanceTolerance', () => {
    const lineA = createFeature('line-a', [
      [0, 0],
      [1, 0],
    ]);
    const lineB = createFeature('line-b', [
      [1.000001, 0],
      [2, 0],
    ]);

    expect(getLineMergePlan([lineA, lineB], { endpointTolerance: 0.00001 })).toMatchObject({
      ok: true,
    });
  });

  test('keeps exact endpoint matching by default and when tolerance is not positive', () => {
    const lineA = createFeature('line-a', [
      [0, 0],
      [1, 0],
    ]);
    const lineB = createFeature('line-b', [
      [1.000001, 0],
      [2, 0],
    ]);

    expect(getLineMergePlan([lineA, lineB])).toMatchObject({
      ok: false,
      reason: 'not-connected',
    });
    expect(getLineMergePlan([lineA, lineB], { coordinateDistanceTolerance: 0 })).toMatchObject({
      ok: false,
      reason: 'not-connected',
    });
    expect(
      getLineMergePlan([lineA, lineB], { coordinateDistanceTolerance: 0.0000001 }),
    ).toMatchObject({
      ok: false,
      reason: 'not-connected',
    });
  });

  test('rejects tolerance-created branch nodes', () => {
    const lineA = createFeature('line-a', [
      [0, 0],
      [1, 0],
    ]);
    const lineB = createFeature('line-b', [
      [1.000001, 0],
      [2, 0],
    ]);
    const lineC = createFeature('line-c', [
      [0.999999, 0],
      [1, 1],
    ]);

    expect(
      getLineMergePlan([lineA, lineB, lineC], { coordinateDistanceTolerance: 0.00001 }),
    ).toMatchObject({
      ok: false,
      reason: 'branching-connection',
    });
  });

  test('rejects unsupported geometries and cross-source merges by default', () => {
    const lineA = createFeature('line-a', [
      [0, 0],
      [1, 0],
    ]);
    const lineB = createFeature(
      'line-b',
      [
        [1, 0],
        [2, 0],
      ],
      { shape: 'line' },
      'gm_temporary',
    );
    const point = {
      ...lineA,
      id: 'point-a',
      getGeoJson: vi.fn(() => ({
        type: 'Feature',
        id: 'point-a',
        properties: { shape: 'marker' },
        geometry: { type: 'Point', coordinates: [0, 0] },
      })),
    } as unknown as FeatureData;

    const unsupportedResult = getLineMergePlan([lineA, point]);
    expect(unsupportedResult).toMatchObject({
      ok: false,
      reason: 'unsupported-geometry',
    });
    expect(unsupportedResult.ok ? null : unsupportedResult.feature).toBe(point);
    expect(getLineMergePlan([lineA, lineB])).toMatchObject({
      ok: false,
      reason: 'different-sources',
    });
  });

  test('rejects closed paths as unsupported merge selections', () => {
    const lineA = createFeature('line-a', [
      [0, 0],
      [1, 0],
    ]);
    const lineB = createFeature('line-b', [
      [1, 0],
      [1, 1],
    ]);
    const lineC = createFeature('line-c', [
      [1, 1],
      [0, 0],
    ]);

    expect(getLineMergePlan([lineA, lineB, lineC])).toMatchObject({
      ok: false,
      reason: 'branching-connection',
    });
  });

  test('preserves and reindexes segment metadata', () => {
    const lineA = createFeature(
      'line-a',
      [
        [0, 0],
        [1, 0],
      ],
      { shape: 'line', label: 'A', segments: [{ index: 0, segmentValue: 10 }] },
    );
    const lineB = createFeature(
      'line-b',
      [
        [1, 0],
        [2, 0],
        [3, 0],
      ],
      {
        shape: 'line',
        label: 'A',
        segments: [
          { index: 0, segmentValue: 20 },
          { index: 1, segmentValue: 30 },
        ],
      },
    );

    const result = getLineMergePlan([lineA, lineB], { propertyStrategy: 'merge-compatible' });

    expect(result.ok ? result.plan.properties.segments : null).toEqual([
      { index: 0, segmentValue: 10 },
      { index: 1, segmentValue: 20 },
      { index: 2, segmentValue: 30 },
    ]);
    expect(result.ok ? result.plan.properties.label : null).toBe('A');
  });

  test('reverses segment metadata when an input line is reversed in the merged path', () => {
    const lineA = createFeature(
      'line-a',
      [
        [0, 0],
        [1, 0],
      ],
      { shape: 'line', label: 'A', segments: [{ index: 0, segmentValue: 10 }] },
    );
    const lineB = createFeature(
      'line-b',
      [
        [3, 0],
        [2, 0],
        [1, 0],
      ],
      {
        shape: 'line',
        label: 'A',
        segments: [
          { index: 0, segmentValue: 30 },
          { index: 1, segmentValue: 20 },
        ],
      },
    );

    const result = getLineMergePlan([lineA, lineB], { propertyStrategy: 'merge-compatible' });

    expect(result.ok ? result.plan.geometry.coordinates : null).toEqual([
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
    ]);
    expect(result.ok ? result.plan.properties.segments : null).toEqual([
      { index: 0, segmentValue: 10 },
      { index: 1, segmentValue: 20 },
      { index: 2, segmentValue: 30 },
    ]);
  });

  test('rejects a primary feature that is not part of the merge selection', () => {
    const lineA = createFeature('line-a', [
      [0, 0],
      [1, 0],
    ]);
    const lineB = createFeature('line-b', [
      [1, 0],
      [2, 0],
    ]);
    const external = createFeature('line-external', [
      [10, 0],
      [11, 0],
    ]);

    expect(getLineMergePlan([lineA, lineB], { primaryFeature: external })).toMatchObject({
      ok: false,
      reason: 'invalid-primary-feature',
      feature: external,
    });
  });

  test('rejects property conflicts when merge-compatible strategy is requested', () => {
    const lineA = createFeature(
      'line-a',
      [
        [0, 0],
        [1, 0],
      ],
      { shape: 'line', label: 'A' },
    );
    const lineB = createFeature(
      'line-b',
      [
        [1, 0],
        [2, 0],
      ],
      { shape: 'line', label: 'B' },
    );

    expect(
      getLineMergePlan([lineA, lineB], { propertyStrategy: 'merge-compatible' }),
    ).toMatchObject({
      ok: false,
      reason: 'property-conflict',
      propertyName: 'label',
    });
  });

  test('applies a merge plan through feature update and delete callbacks', () => {
    const lineA = createFeature('line-a', [
      [0, 0],
      [1, 0],
    ]);
    const lineB = createFeature('line-b', [
      [1, 0],
      [2, 0],
    ]);
    const result = getLineMergePlan([lineA, lineB]);
    const removeFeature = vi.fn();

    applyLineMergePlan((result as { ok: true; plan: GeomanLineMergePlan }).plan, {
      removeFeature,
    });

    expect(lineA.updateGeometry).toHaveBeenCalledWith({
      type: 'LineString',
      coordinates: [
        [0, 0],
        [1, 0],
        [2, 0],
      ],
    });
    expect(removeFeature).toHaveBeenCalledWith(lineB);
  });

  test('rejects an invalid merge plan before mutating the primary feature', () => {
    const lineA = createFeature('line-a', [
      [0, 0],
      [1, 0],
    ]);
    const lineB = createFeature('line-b', [
      [1, 0],
      [2, 0],
    ]);
    const result = getLineMergePlan([lineA, lineB]);

    if (!result.ok) {
      throw new Error(result.message);
    }

    const invalidPlan: GeomanLineMergePlan = {
      ...result.plan,
      removedFeatures: [lineA],
    };

    expect(() =>
      applyLineMergePlan(invalidPlan, {
        removeFeature: vi.fn(),
      }),
    ).toThrow('Merge plan cannot remove the primary feature.');

    expect(lineA.updateGeometry).not.toHaveBeenCalled();
    expect(lineA.updateProperties).not.toHaveBeenCalled();
  });

  test('rejects duplicate removed features before mutating or removing features', () => {
    const lineA = createFeature('line-a', [
      [0, 0],
      [1, 0],
    ]);
    const lineB = createFeature('line-b', [
      [1, 0],
      [2, 0],
    ]);
    const result = getLineMergePlan([lineA, lineB]);

    if (!result.ok) {
      throw new Error(result.message);
    }

    const invalidPlan: GeomanLineMergePlan = {
      ...result.plan,
      removedFeatures: [lineB, lineB],
    };
    const removeFeature = vi.fn();

    expect(() =>
      applyLineMergePlan(invalidPlan, {
        removeFeature,
      }),
    ).toThrow('Merge plan cannot include duplicate features.');

    expect(lineA.updateGeometry).not.toHaveBeenCalled();
    expect(lineA.updateProperties).not.toHaveBeenCalled();
    expect(removeFeature).not.toHaveBeenCalled();
  });

  test('rejects a merge plan with removed features from another source before mutating', () => {
    const lineA = createFeature(
      'line-a',
      [
        [0, 0],
        [1, 0],
      ],
      {},
      'gm_main',
    );
    const lineB = createFeature(
      'line-b',
      [
        [1, 0],
        [2, 0],
      ],
      {},
      'gm_secondary',
    );
    const plan: GeomanLineMergePlan = {
      primaryFeature: lineA,
      removedFeatures: [lineB],
      sourceName: 'gm_main',
      geometry: {
        type: 'LineString',
        coordinates: [
          [0, 0],
          [1, 0],
          [2, 0],
        ],
      },
      properties: { shape: 'line' },
      orderedFeatures: [lineA, lineB],
    };

    expect(() =>
      applyLineMergePlan(plan, {
        removeFeature: vi.fn(),
      }),
    ).toThrow('Merge plan features must use the plan source.');

    expect(lineA.updateGeometry).not.toHaveBeenCalled();
    expect(lineA.updateProperties).not.toHaveBeenCalled();
  });

  test('rolls back primary feature updates when removeFeature throws', () => {
    const lineA = createFeature(
      'line-a',
      [
        [0, 0],
        [1, 0],
      ],
      { shape: 'line', label: 'A' },
    );
    const lineB = createFeature(
      'line-b',
      [
        [1, 0],
        [2, 0],
      ],
      { shape: 'line', label: 'A' },
    );
    const result = getLineMergePlan([lineA, lineB], { propertyStrategy: 'merge-compatible' });
    const error = new Error('remove failed');

    expect(() =>
      applyLineMergePlan((result as { ok: true; plan: GeomanLineMergePlan }).plan, {
        removeFeature: () => {
          throw error;
        },
      }),
    ).toThrow(error);

    expect(lineA.getGeoJson()).toMatchObject({
      properties: { shape: 'line', label: 'A' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [0, 0],
          [1, 0],
        ],
      },
    });
    expect(lineA.restoreGeoJsonSnapshot).toHaveBeenCalledTimes(1);
  });

  test('restores removed features when a later removeFeature call throws', () => {
    const lineA = createFeature(
      'line-a',
      [
        [0, 0],
        [1, 0],
      ],
      { shape: 'line', label: 'A' },
    );
    const lineB = createFeature(
      'line-b',
      [
        [1, 0],
        [2, 0],
      ],
      { shape: 'line', label: 'A' },
    );
    const lineC = createFeature(
      'line-c',
      [
        [2, 0],
        [3, 0],
      ],
      { shape: 'line', label: 'A' },
    );
    const result = getLineMergePlan([lineA, lineB, lineC], {
      propertyStrategy: 'merge-compatible',
    });
    const error = new Error('second remove failed');
    const removedFeatures = new Set<FeatureData>();
    const removeFeature = vi.fn((feature: FeatureData) => {
      if (feature === lineB) {
        removedFeatures.add(feature);
        feature.updateProperties({ removed: true });
        return;
      }

      throw error;
    });
    const restoreFeature = vi.fn((feature: FeatureData) => {
      removedFeatures.delete(feature);
    });

    expect(() =>
      applyLineMergePlan((result as { ok: true; plan: GeomanLineMergePlan }).plan, {
        removeFeature,
        restoreFeature,
      }),
    ).toThrow(error);

    expect(lineB.getGeoJson().properties).toEqual({ shape: 'line', label: 'A' });
    expect(removedFeatures.has(lineB)).toBe(false);
    expect(restoreFeature).toHaveBeenCalledWith(lineB);
    expect(lineB.restoreGeoJsonSnapshot).toHaveBeenCalledTimes(1);
    expect(lineC.restoreGeoJsonSnapshot).toHaveBeenCalledTimes(1);
  });
});

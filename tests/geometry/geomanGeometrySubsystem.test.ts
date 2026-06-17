import { GeomanGeometrySubsystem } from '@/geometry/geomanGeometrySubsystem.ts';
import type { FeatureData } from '@/core/features/feature-data.ts';
import type { Geoman } from '@/main.ts';
import type { LngLatTuple } from '@/types/map/index.ts';
import { describe, expect, test, vi } from 'vitest';

const createFeature = (
  coordinates: Array<LngLatTuple>,
  properties: Record<string, unknown> = { shape: 'line' },
) =>
  ({
    getGeoJson: vi.fn(() => ({
      type: 'Feature',
      id: 'line-1',
      properties,
      geometry: {
        type: 'LineString',
        coordinates,
      },
    })),
    updateProperties: vi.fn(),
  }) as unknown as FeatureData;

const createPointFeature = () =>
  ({
    getGeoJson: () => ({
      type: 'Feature',
      id: 'point-1',
      properties: { shape: 'marker' },
      geometry: {
        type: 'Point',
        coordinates: [0, 0],
      },
    }),
  }) as unknown as FeatureData;

const createStatefulMultiLineFeature = (coordinates: Array<Array<LngLatTuple>>) => {
  const geoJson = {
    type: 'Feature' as const,
    id: 'multi-line-1',
    properties: { shape: 'line' },
    geometry: {
      type: 'MultiLineString' as const,
      coordinates,
    },
  };

  return {
    id: 'multi-line-1',
    sourceName: 'gm_main',
    getGeoJson: vi.fn(() => geoJson),
    updateGeometry: vi.fn((geometry) => {
      geoJson.geometry = geometry;
    }),
    updateProperties: vi.fn(),
  } as unknown as FeatureData;
};

const createGeoman = () =>
  ({
    mapAdapter: {
      project: vi.fn(([lng, lat]: LngLatTuple) => [lng * 100, lat * 100]),
      unproject: vi.fn(([x, y]: [number, number]) => [x / 100, y / 100]),
    },
  }) as unknown as Geoman;

const getFixtureSegments = (feature: FeatureData) =>
  feature.getGeoJson().properties.segments as Array<Record<string, unknown>>;

const createStatefulFeature = (
  coordinates: Array<LngLatTuple>,
  properties: Record<string, unknown> = { shape: 'line' },
) => {
  const geoJson = {
    type: 'Feature' as const,
    id: 'line-1',
    properties,
    geometry: {
      type: 'LineString' as const,
      coordinates,
    },
  };

  return {
    getGeoJson: vi.fn(() => geoJson),
    updateGeometry: vi.fn((geometry) => {
      geoJson.geometry = geometry;
    }),
    updateProperties: vi.fn((nextProperties) => {
      geoJson.properties = {
        ...geoJson.properties,
        ...nextProperties,
      };
    }),
    restoreGeoJsonSnapshot: vi.fn((snapshot) => {
      geoJson.geometry = structuredClone(snapshot.geometry);
      geoJson.properties = structuredClone(snapshot.properties);
    }),
  } as unknown as FeatureData;
};

describe('GeomanGeometrySubsystem', () => {
  test('extracts line string segments with indexes and midpoints', () => {
    const subsystem = new GeomanGeometrySubsystem({ geoman: createGeoman() });
    const feature = createFeature([
      [0, 0],
      [1, 0],
      [1, 1],
    ]);

    const segments = subsystem.getLineSegments(feature);

    expect(segments).toHaveLength(2);
    expect(segments[0]).toMatchObject({
      feature,
      segmentIndex: 0,
      start: [0, 0],
      end: [1, 0],
      midpoint: [0.5, 0],
    });
    expect(segments[1]).toMatchObject({
      feature,
      segmentIndex: 1,
      start: [1, 0],
      end: [1, 1],
      midpoint: [1, 0.5],
    });
    expect(segments[0]?.lengthMeters).toBeGreaterThan(100000);
  });

  test('returns no line segments for unsupported geometries', () => {
    const subsystem = new GeomanGeometrySubsystem({ geoman: createGeoman() });

    expect(subsystem.getLineSegments(createPointFeature())).toEqual([]);
  });

  test('measures a segment in meters', () => {
    const subsystem = new GeomanGeometrySubsystem({ geoman: createGeoman() });

    const lengthMeters = subsystem.measureSegment({
      start: [0, 0],
      end: [0, 1],
    });

    expect(lengthMeters).toBeGreaterThan(110000);
    expect(lengthMeters).toBeLessThan(112000);
  });

  test('measures segment bearing in degrees', () => {
    const subsystem = new GeomanGeometrySubsystem({ geoman: createGeoman() });

    expect(
      subsystem.measureSegmentBearing({
        start: [0, 0],
        end: [1, 0],
      }),
    ).toBeCloseTo(90, 0);
    expect(
      subsystem.measureSegmentBearing({
        start: [0, 0],
        end: [0, 1],
      }),
    ).toBeCloseTo(0, 0);
  });

  test('formats segment measurements for meters and kilometers', () => {
    const subsystem = new GeomanGeometrySubsystem({ geoman: createGeoman() });

    expect(subsystem.formatDistanceMeters(215.245)).toBe('215.25 m');
    expect(subsystem.formatDistanceMeters(215245)).toBe('215.25 km');
    expect(
      subsystem.formatSegmentMeasurement({
        start: [0, 0],
        end: [0, 1],
      }),
    ).toMatch(/^111\.\d{2} km$/);
  });

  test('returns the nearest segment within max pixel distance', () => {
    const subsystem = new GeomanGeometrySubsystem({ geoman: createGeoman() });
    const feature = createFeature([
      [0, 0],
      [1, 0],
      [1, 1],
    ]);

    const hit = subsystem.getNearestSegment(feature, [100, 40], { maxPixelDistance: 50 });

    expect(hit).toMatchObject({
      feature,
      segmentIndex: 1,
      start: [1, 0],
      end: [1, 1],
      distancePixels: 0,
    });
  });

  test('returns null when the nearest segment is outside max pixel distance', () => {
    const subsystem = new GeomanGeometrySubsystem({ geoman: createGeoman() });
    const feature = createFeature([
      [0, 0],
      [1, 0],
    ]);

    expect(subsystem.getNearestSegment(feature, [100, 100], { maxPixelDistance: 10 })).toBeNull();
  });

  test('returns the nearest line vertex within max pixel distance', () => {
    const subsystem = new GeomanGeometrySubsystem({ geoman: createGeoman() });
    const feature = createFeature([
      [0, 0],
      [1, 0],
      [1, 1],
    ]);

    const hit = subsystem.getNearestVertex(feature, [102, 4], { maxPixelDistance: 10 });

    expect(hit).toMatchObject({
      feature,
      vertexIndex: 1,
      coordinate: [1, 0],
      distancePixels: expect.any(Number),
    });
    expect(hit?.distancePixels).toBeLessThan(5);
    expect(hit?.coordinate).not.toBe(feature.getGeoJson().geometry.coordinates[1]);
  });

  test('returns null for nearest line vertex on unsupported geometry or outside tolerance', () => {
    const subsystem = new GeomanGeometrySubsystem({ geoman: createGeoman() });

    expect(
      subsystem.getNearestVertex(createPointFeature(), [0, 0], { maxPixelDistance: 10 }),
    ).toBeNull();
    expect(
      subsystem.getNearestVertex(
        createFeature([
          [0, 0],
          [1, 0],
        ]),
        [100, 100],
        { maxPixelDistance: 8 },
      ),
    ).toBeNull();
  });

  test('returns nearest edge context as an alias over nearest segment hit testing', () => {
    const subsystem = new GeomanGeometrySubsystem({ geoman: createGeoman() });
    const feature = createFeature([
      [0, 0],
      [1, 0],
      [1, 1],
    ]);

    const edge = subsystem.getNearestEdge(feature, [100, 40], { maxPixelDistance: 50 });

    expect(edge).toMatchObject({
      feature,
      edgeIndex: 1,
      segmentIndex: 1,
      start: [1, 0],
      end: [1, 1],
      distancePixels: 0,
    });
    expect(edge?.start).not.toBe(feature.getGeoJson().geometry.coordinates[1]);
    expect(edge?.end).not.toBe(feature.getGeoJson().geometry.coordinates[2]);
    expect(edge?.midpoint).not.toBe(feature.getGeoJson().geometry.coordinates[1]);
  });

  test('returns cloned line segment metadata by segment index', () => {
    const subsystem = new GeomanGeometrySubsystem({ geoman: createGeoman() });
    const details = { lining: { material: 'PVC' } };
    const feature = createFeature(
      [
        [0, 0],
        [1, 0],
      ],
      {
        shape: 'line',
        segments: [{ index: 0, segmentValue: 300, details }],
      },
    );

    const metadata = subsystem.getLineSegmentMetadata(feature, 0);

    expect(metadata).toEqual({ index: 0, segmentValue: 300, details });
    expect(metadata).not.toBe(getFixtureSegments(feature)[0]);
    expect(metadata?.details).not.toBe(details);
  });

  test('returns a line segment metadata property by segment index', () => {
    const subsystem = new GeomanGeometrySubsystem({ geoman: createGeoman() });
    const feature = createFeature(
      [
        [0, 0],
        [1, 0],
      ],
      {
        shape: 'line',
        segments: [{ index: 0, segmentValue: 300 }],
      },
    );

    expect(subsystem.getLineSegmentProperty(feature, 0, 'segmentValue')).toBe(300);
    expect(subsystem.getLineSegmentProperty(feature, 1, 'segmentValue')).toBeUndefined();
  });

  test('updates a line segment metadata property with cloned segments', () => {
    const subsystem = new GeomanGeometrySubsystem({ geoman: createGeoman() });
    const segments = [
      { index: 0, segmentValue: 300 },
      { index: 1, material: 'PVC' },
    ];
    const feature = createFeature(
      [
        [0, 0],
        [1, 0],
        [2, 0],
      ],
      {
        shape: 'line',
        segments,
      },
    );

    subsystem.updateLineSegmentProperty(feature, 0, 'segmentValue', 450);

    expect(feature.updateProperties).toHaveBeenCalledWith({
      segments: [
        { index: 0, segmentValue: 450 },
        { index: 1, material: 'PVC' },
      ],
    });
    const nextSegments = vi.mocked(feature.updateProperties).mock.calls[0]?.[0].segments as Array<
      Record<string, unknown>
    >;
    expect(nextSegments).not.toBe(segments);
    expect(nextSegments[0]).not.toBe(segments[0]);
    expect(nextSegments[1]).not.toBe(segments[1]);
  });

  test('preserves legacy object records when updating line segment metadata', () => {
    const subsystem = new GeomanGeometrySubsystem({ geoman: createGeoman() });
    const feature = createFeature(
      [
        [0, 0],
        [1, 0],
      ],
      {
        shape: 'line',
        segments: [{ note: 'legacy' }, { index: 0, segmentValue: 300 }],
      },
    );

    subsystem.updateLineSegmentProperty(feature, 0, 'segmentValue', 450);

    expect(feature.updateProperties).toHaveBeenCalledWith({
      segments: [{ note: 'legacy' }, { index: 0, segmentValue: 450 }],
    });
  });

  test('deletes a line segment metadata property when value is undefined', () => {
    const subsystem = new GeomanGeometrySubsystem({ geoman: createGeoman() });
    const feature = createFeature(
      [
        [0, 0],
        [1, 0],
      ],
      {
        shape: 'line',
        segments: [{ index: 0, segmentValue: 300, material: 'PVC' }],
      },
    );

    subsystem.updateLineSegmentProperty(feature, 0, 'segmentValue', undefined);

    expect(feature.updateProperties).toHaveBeenCalledWith({
      segments: [{ index: 0, material: 'PVC' }],
    });
  });

  test('creates line segment metadata when updating a missing segment index', () => {
    const subsystem = new GeomanGeometrySubsystem({ geoman: createGeoman() });
    const feature = createFeature(
      [
        [0, 0],
        [1, 0],
      ],
      {
        shape: 'line',
      },
    );

    subsystem.updateLineSegmentProperty(feature, 0, 'segmentValue', 300);

    expect(feature.updateProperties).toHaveBeenCalledWith({
      segments: [{ index: 0, segmentValue: 300 }],
    });
  });

  test('does not create line segment metadata when deleting a missing property', () => {
    const subsystem = new GeomanGeometrySubsystem({ geoman: createGeoman() });
    const feature = createFeature(
      [
        [0, 0],
        [1, 0],
      ],
      {
        shape: 'line',
      },
    );

    subsystem.updateLineSegmentProperty(feature, 0, 'segmentValue', undefined);

    expect(feature.updateProperties).not.toHaveBeenCalled();
  });

  test('rejects updates to the line segment metadata index property', () => {
    const subsystem = new GeomanGeometrySubsystem({ geoman: createGeoman() });
    const feature = createFeature(
      [
        [0, 0],
        [1, 0],
      ],
      {
        shape: 'line',
        segments: [{ index: 0, segmentValue: 300 }],
      },
    );

    expect(() => subsystem.updateLineSegmentProperty(feature, 0, 'index', 1)).toThrow(
      'Segment metadata index cannot be updated.',
    );
    expect(feature.updateProperties).not.toHaveBeenCalled();
  });

  test('returns the nearest line segment context with metadata', () => {
    const subsystem = new GeomanGeometrySubsystem({ geoman: createGeoman() });
    const feature = createFeature(
      [
        [0, 0],
        [1, 0],
        [1, 1],
      ],
      {
        shape: 'line',
        segments: [{ index: 1, segmentValue: 300 }],
      },
    );

    const context = subsystem.getLineSegmentContext(feature, [100, 40], { maxPixelDistance: 50 });

    expect(context?.segment).toMatchObject({
      feature,
      segmentIndex: 1,
      start: [1, 0],
      end: [1, 1],
      distancePixels: 0,
    });
    expect(context?.metadata).toEqual({ index: 1, segmentValue: 300 });
    expect(context?.metadata).not.toBe(getFixtureSegments(feature)[0]);
  });

  test('plans line vertex insertion and duplicates split segment metadata by default', () => {
    const subsystem = new GeomanGeometrySubsystem({ geoman: createGeoman() });
    const feature = createFeature(
      [
        [0, 0],
        [2, 0],
        [4, 0],
      ],
      {
        shape: 'line',
        segments: [
          { index: 0, segmentValue: 300, material: 'PVC' },
          { index: 1, segmentValue: 450, material: 'Steel' },
        ],
      },
    );

    const insertion = subsystem.getLineVertexInsertion(feature, {
      segmentIndex: 0,
      coordinate: [1, 0],
    });

    expect(insertion).toEqual({
      geometry: {
        type: 'LineString',
        coordinates: [
          [0, 0],
          [1, 0],
          [2, 0],
          [4, 0],
        ],
      },
      properties: {
        segments: [
          { index: 0, segmentValue: 300, material: 'PVC' },
          { index: 1, segmentValue: 300, material: 'PVC' },
          { index: 2, segmentValue: 450, material: 'Steel' },
        ],
      },
    });
    expect(feature.updateProperties).not.toHaveBeenCalled();
  });

  test('plans line vertex insertion without duplicating split metadata when requested', () => {
    const subsystem = new GeomanGeometrySubsystem({ geoman: createGeoman() });
    const feature = createFeature(
      [
        [0, 0],
        [2, 0],
      ],
      {
        shape: 'line',
        segments: [{ index: 0, segmentValue: 300 }],
      },
    );

    const insertion = subsystem.getLineVertexInsertion(feature, {
      segmentIndex: 0,
      coordinate: [1, 0],
      metadataMode: 'first',
    });

    expect(insertion?.properties.segments).toEqual([{ index: 0, segmentValue: 300 }]);
  });

  test('plans line vertex insertion without split metadata when requested', () => {
    const subsystem = new GeomanGeometrySubsystem({ geoman: createGeoman() });
    const feature = createFeature(
      [
        [0, 0],
        [2, 0],
        [4, 0],
      ],
      {
        shape: 'line',
        segments: [
          { index: 0, segmentValue: 300 },
          { index: 1, segmentValue: 450 },
        ],
      },
    );

    const insertion = subsystem.getLineVertexInsertion(feature, {
      segmentIndex: 0,
      coordinate: [1, 0],
      metadataMode: 'none',
    });

    expect(insertion?.properties.segments).toEqual([{ index: 2, segmentValue: 450 }]);
  });

  test('clones duplicated line vertex insertion metadata records deeply', () => {
    const subsystem = new GeomanGeometrySubsystem({ geoman: createGeoman() });
    const details = { lining: { material: 'PVC' } };
    const feature = createFeature(
      [
        [0, 0],
        [2, 0],
      ],
      {
        shape: 'line',
        segments: [{ index: 0, segmentValue: 300, details }],
      },
    );

    const insertion = subsystem.getLineVertexInsertion(feature, {
      segmentIndex: 0,
      coordinate: [1, 0],
    });
    const segments = insertion?.properties.segments;

    expect(segments).toEqual([
      { index: 0, segmentValue: 300, details },
      { index: 1, segmentValue: 300, details },
    ]);
    expect(segments?.[0]?.details).not.toBe(details);
    expect(segments?.[1]?.details).not.toBe(details);
    expect(segments?.[0]?.details).not.toBe(segments?.[1]?.details);
  });

  test('preserves legacy segment metadata records during insertion planning', () => {
    const subsystem = new GeomanGeometrySubsystem({ geoman: createGeoman() });
    const feature = createFeature(
      [
        [0, 0],
        [2, 0],
      ],
      {
        shape: 'line',
        segments: [{ note: 'legacy' }, { index: 0, segmentValue: 300 }],
      },
    );

    const insertion = subsystem.getLineVertexInsertion(feature, {
      segmentIndex: 0,
      coordinate: [1, 0],
    });

    expect(insertion?.properties.segments).toEqual([
      { note: 'legacy' },
      { index: 0, segmentValue: 300 },
      { index: 1, segmentValue: 300 },
    ]);
  });

  test('preserves malformed numeric segment indexes during insertion planning', () => {
    const subsystem = new GeomanGeometrySubsystem({ geoman: createGeoman() });
    const feature = createFeature(
      [
        [0, 0],
        [2, 0],
      ],
      {
        shape: 'line',
        segments: [
          { index: Number.NaN, note: 'nan' },
          { index: Infinity, note: 'infinite' },
          { index: 0.5, note: 'fractional' },
          { index: -1, note: 'negative' },
          { index: 0, segmentValue: 300 },
        ],
      },
    );

    const insertion = subsystem.getLineVertexInsertion(feature, {
      segmentIndex: 0,
      coordinate: [1, 0],
    });

    expect(insertion?.properties.segments).toEqual([
      { index: Number.NaN, note: 'nan' },
      { index: Infinity, note: 'infinite' },
      { index: 0.5, note: 'fractional' },
      { index: -1, note: 'negative' },
      { index: 0, segmentValue: 300 },
      { index: 1, segmentValue: 300 },
    ]);
  });

  test('returns null when planning insertion for unsupported geometry or segment index', () => {
    const subsystem = new GeomanGeometrySubsystem({ geoman: createGeoman() });

    expect(
      subsystem.getLineVertexInsertion(createPointFeature(), {
        segmentIndex: 0,
        coordinate: [1, 0],
      }),
    ).toBeNull();
    expect(
      subsystem.getLineVertexInsertion(
        createFeature([
          [0, 0],
          [1, 0],
        ]),
        {
          segmentIndex: 2,
          coordinate: [1, 0],
        },
      ),
    ).toBeNull();
    expect(
      subsystem.getLineVertexInsertion(
        createFeature([
          [0, 0],
          [1, 0],
        ]),
        {
          segmentIndex: 0.5,
          coordinate: [1, 0],
        },
      ),
    ).toBeNull();
    expect(
      subsystem.getLineVertexInsertion(
        createFeature([
          [0, 0],
          [1, 0],
        ]),
        {
          segmentIndex: Number.NaN,
          coordinate: [1, 0],
        },
      ),
    ).toBeNull();
  });

  test('applies line vertex insertion to feature geometry and metadata', () => {
    const subsystem = new GeomanGeometrySubsystem({ geoman: createGeoman() });
    const feature = {
      ...createFeature(
        [
          [0, 0],
          [2, 0],
        ],
        {
          shape: 'line',
          segments: [{ index: 0, segmentValue: 300 }],
        },
      ),
      updateGeometry: vi.fn(),
    } as unknown as FeatureData;

    const result = subsystem.insertLineVertex(feature, {
      segmentIndex: 0,
      coordinate: [1, 0],
    });

    expect(result).not.toBeNull();
    expect(feature.updateGeometry).toHaveBeenCalledWith({
      type: 'LineString',
      coordinates: [
        [0, 0],
        [1, 0],
        [2, 0],
      ],
    });
    expect(feature.updateProperties).toHaveBeenCalledWith({
      segments: [
        { index: 0, segmentValue: 300 },
        { index: 1, segmentValue: 300 },
      ],
    });
  });

  test('applies line vertex insertion inside an atomic source update when available', () => {
    const withAtomicSourcesUpdate = vi.fn((callback: () => unknown) => callback());
    const subsystem = new GeomanGeometrySubsystem({
      geoman: {
        ...createGeoman(),
        features: {
          updateManager: { withAtomicSourcesUpdate },
        },
      } as unknown as Geoman,
    });
    const feature = createStatefulFeature(
      [
        [0, 0],
        [2, 0],
      ],
      {
        shape: 'line',
        segments: [{ index: 0, segmentValue: 300 }],
      },
    );

    subsystem.insertLineVertex(feature, {
      segmentIndex: 0,
      coordinate: [1, 0],
    });

    expect(withAtomicSourcesUpdate).toHaveBeenCalledTimes(1);
    expect(feature.getGeoJson()).toMatchObject({
      geometry: {
        type: 'LineString',
        coordinates: [
          [0, 0],
          [1, 0],
          [2, 0],
        ],
      },
      properties: {
        segments: [
          { index: 0, segmentValue: 300 },
          { index: 1, segmentValue: 300 },
        ],
      },
    });
  });

  test('isolates inserted feature state from returned insertion result mutations', () => {
    const subsystem = new GeomanGeometrySubsystem({ geoman: createGeoman() });
    const feature = createStatefulFeature(
      [
        [0, 0],
        [2, 0],
      ],
      {
        shape: 'line',
        segments: [{ index: 0, segmentValue: 300 }],
      },
    );

    const result = subsystem.insertLineVertex(feature, {
      segmentIndex: 0,
      coordinate: [1, 0],
    });

    result?.geometry.coordinates[1]?.splice(0, 2, 99, 99);
    result?.properties.segments.splice(0, 1, { index: 0, segmentValue: 999 });

    expect(feature.getGeoJson()).toMatchObject({
      geometry: {
        type: 'LineString',
        coordinates: [
          [0, 0],
          [1, 0],
          [2, 0],
        ],
      },
      properties: {
        segments: [
          { index: 0, segmentValue: 300 },
          { index: 1, segmentValue: 300 },
        ],
      },
    });
  });

  test('does not mutate feature when line vertex insertion cannot be planned', () => {
    const subsystem = new GeomanGeometrySubsystem({ geoman: createGeoman() });
    const feature = {
      ...createPointFeature(),
      updateGeometry: vi.fn(),
      updateProperties: vi.fn(),
    } as unknown as FeatureData;

    expect(
      subsystem.insertLineVertex(feature, {
        segmentIndex: 0,
        coordinate: [1, 0],
      }),
    ).toBeNull();
    expect(feature.updateGeometry).not.toHaveBeenCalled();
    expect(feature.updateProperties).not.toHaveBeenCalled();
  });

  test('plans metadata-safe line split at point by duplicating split metadata', () => {
    const subsystem = new GeomanGeometrySubsystem({ geoman: createGeoman() });
    const feature = createFeature(
      [
        [0, 0],
        [2, 0],
        [4, 0],
      ],
      {
        shape: 'line',
        segments: [
          { index: 0, segmentValue: 300 },
          { index: 1, segmentValue: 450 },
        ],
      },
    );

    const split = subsystem.getLineSplitAtPoint(feature, {
      segmentIndex: 0,
      coordinate: [1, 0],
    });

    expect(split).toEqual({
      geometry: {
        type: 'LineString',
        coordinates: [
          [0, 0],
          [1, 0],
          [2, 0],
          [4, 0],
        ],
      },
      properties: {
        segments: [
          { index: 0, segmentValue: 300 },
          { index: 1, segmentValue: 300 },
          { index: 2, segmentValue: 450 },
        ],
      },
    });
    expect(feature.updateProperties).not.toHaveBeenCalled();
  });

  test('plans line split at point from nearest segment context', () => {
    const subsystem = new GeomanGeometrySubsystem({ geoman: createGeoman() });
    const feature = createFeature(
      [
        [0, 0],
        [2, 0],
      ],
      {
        shape: 'line',
        segments: [{ index: 0, segmentValue: 300 }],
      },
    );

    const split = subsystem.getLineSplitAtPoint(feature, {
      point: [100, 0],
      maxPixelDistance: 20,
    });

    expect(split?.geometry.coordinates).toEqual([
      [0, 0],
      [1, 0],
      [2, 0],
    ]);
    expect(split?.properties.segments).toEqual([
      { index: 0, segmentValue: 300 },
      { index: 1, segmentValue: 300 },
    ]);
  });

  test('plans line split at projected point instead of segment midpoint', () => {
    const subsystem = new GeomanGeometrySubsystem({ geoman: createGeoman() });
    const feature = createFeature(
      [
        [0, 0],
        [4, 0],
      ],
      {
        shape: 'line',
        segments: [{ index: 0, segmentValue: 300 }],
      },
    );

    const split = subsystem.getLineSplitAtPoint(feature, {
      point: [100, 0],
      maxPixelDistance: 20,
    });

    expect(split?.geometry.coordinates).toEqual([
      [0, 0],
      [1, 0],
      [4, 0],
    ]);
  });

  test('returns null when line split at point cannot be planned', () => {
    const subsystem = new GeomanGeometrySubsystem({ geoman: createGeoman() });

    expect(
      subsystem.getLineSplitAtPoint(createPointFeature(), {
        segmentIndex: 0,
        coordinate: [1, 0],
      }),
    ).toBeNull();
    expect(
      subsystem.getLineSplitAtPoint(
        createFeature([
          [0, 0],
          [2, 0],
        ]),
        {
          segmentIndex: 0.5,
          coordinate: [1, 0],
        },
      ),
    ).toBeNull();
    expect(
      subsystem.getLineSplitAtPoint(
        createFeature([
          [0, 0],
          [2, 0],
        ]),
        {
          point: [500, 500],
          maxPixelDistance: 5,
        },
      ),
    ).toBeNull();
  });

  test('applies line split at point atomically and isolates returned result', () => {
    const withAtomicSourcesUpdate = vi.fn((callback: () => unknown) => callback());
    const subsystem = new GeomanGeometrySubsystem({
      geoman: {
        ...createGeoman(),
        features: {
          updateManager: { withAtomicSourcesUpdate },
        },
      } as unknown as Geoman,
    });
    const feature = createStatefulFeature(
      [
        [0, 0],
        [2, 0],
      ],
      {
        shape: 'line',
        segments: [{ index: 0, segmentValue: 300 }],
      },
    );

    const result = subsystem.splitLineAtPoint(feature, {
      segmentIndex: 0,
      coordinate: [1, 0],
    });

    result?.geometry.coordinates[1]?.splice(0, 2, 99, 99);
    result?.properties.segments.splice(0, 1, { index: 0, segmentValue: 999 });

    expect(withAtomicSourcesUpdate).toHaveBeenCalledTimes(1);
    expect(feature.getGeoJson()).toMatchObject({
      geometry: {
        type: 'LineString',
        coordinates: [
          [0, 0],
          [1, 0],
          [2, 0],
        ],
      },
      properties: {
        segments: [
          { index: 0, segmentValue: 300 },
          { index: 1, segmentValue: 300 },
        ],
      },
    });
  });

  test('plans line segment removal and shifts later metadata indexes', () => {
    const subsystem = new GeomanGeometrySubsystem({ geoman: createGeoman() });
    const feature = createFeature(
      [
        [0, 0],
        [1, 0],
        [2, 0],
        [3, 0],
      ],
      {
        shape: 'line',
        segments: [
          { index: 0, segmentValue: 300 },
          { index: 1, segmentValue: 450 },
          { index: 2, segmentValue: 600 },
        ],
      },
    );

    const removal = subsystem.getLineSegmentRemoval(feature, { segmentIndex: 1 });

    expect(removal).toEqual({
      geometry: {
        type: 'LineString',
        coordinates: [
          [0, 0],
          [1, 0],
          [3, 0],
        ],
      },
      properties: {
        segments: [
          { index: 0, segmentValue: 300 },
          { index: 1, segmentValue: 600 },
        ],
      },
    });
    expect(feature.updateProperties).not.toHaveBeenCalled();
  });

  test('preserves legacy segment metadata during line segment removal planning', () => {
    const subsystem = new GeomanGeometrySubsystem({ geoman: createGeoman() });
    const feature = createFeature(
      [
        [0, 0],
        [1, 0],
        [2, 0],
      ],
      {
        shape: 'line',
        segments: [
          { note: 'legacy' },
          { index: 0, segmentValue: 300 },
          { index: 1, segmentValue: 450 },
        ],
      },
    );

    const removal = subsystem.getLineSegmentRemoval(feature, { segmentIndex: 0 });

    expect(removal?.properties.segments).toEqual([
      { note: 'legacy' },
      { index: 0, segmentValue: 450 },
    ]);
  });

  test('preserves malformed segment metadata indexes during line segment removal planning', () => {
    const subsystem = new GeomanGeometrySubsystem({ geoman: createGeoman() });
    const feature = createFeature(
      [
        [0, 0],
        [1, 0],
        [2, 0],
      ],
      {
        shape: 'line',
        segments: [
          { index: Number.NaN, note: 'nan' },
          { index: Infinity, note: 'infinite' },
          { index: 0.5, note: 'fractional' },
          { index: -1, note: 'negative' },
          { index: 0, segmentValue: 300 },
          { index: 1, segmentValue: 450 },
        ],
      },
    );

    const removal = subsystem.getLineSegmentRemoval(feature, { segmentIndex: 0 });

    expect(removal?.properties.segments).toEqual([
      { index: Number.NaN, note: 'nan' },
      { index: Infinity, note: 'infinite' },
      { index: 0.5, note: 'fractional' },
      { index: -1, note: 'negative' },
      { index: 0, segmentValue: 450 },
    ]);
  });

  test('returns null for invalid line segment removal', () => {
    const subsystem = new GeomanGeometrySubsystem({ geoman: createGeoman() });

    expect(
      subsystem.getLineSegmentRemoval(createPointFeature(), {
        segmentIndex: 0,
      }),
    ).toBeNull();
    expect(
      subsystem.getLineSegmentRemoval(
        createFeature([
          [0, 0],
          [1, 0],
        ]),
        {
          segmentIndex: 0,
        },
      ),
    ).toBeNull();
    expect(
      subsystem.getLineSegmentRemoval(
        createFeature([
          [0, 0],
          [1, 0],
          [2, 0],
        ]),
        {
          segmentIndex: 2,
        },
      ),
    ).toBeNull();
    expect(
      subsystem.getLineSegmentRemoval(
        createFeature([
          [0, 0],
          [1, 0],
          [2, 0],
        ]),
        {
          segmentIndex: 0.5,
        },
      ),
    ).toBeNull();
  });

  test('applies line segment removal atomically and isolates returned result', () => {
    const withAtomicSourcesUpdate = vi.fn((callback: () => unknown) => callback());
    const subsystem = new GeomanGeometrySubsystem({
      geoman: {
        ...createGeoman(),
        features: {
          updateManager: { withAtomicSourcesUpdate },
        },
      } as unknown as Geoman,
    });
    const feature = createStatefulFeature(
      [
        [0, 0],
        [1, 0],
        [2, 0],
      ],
      {
        shape: 'line',
        segments: [
          { index: 0, segmentValue: 300 },
          { index: 1, segmentValue: 450 },
        ],
      },
    );

    const result = subsystem.removeLineSegment(feature, { segmentIndex: 0 });

    result?.geometry.coordinates[1]?.splice(0, 2, 99, 99);
    result?.properties.segments.splice(0, 1, { index: 0, segmentValue: 999 });

    expect(result).not.toBeNull();
    expect(withAtomicSourcesUpdate).toHaveBeenCalledTimes(1);
    expect(feature.getGeoJson()).toMatchObject({
      geometry: {
        type: 'LineString',
        coordinates: [
          [0, 0],
          [2, 0],
        ],
      },
      properties: {
        segments: [{ index: 0, segmentValue: 450 }],
      },
    });
  });

  test('builds line network graph through geometry subsystem', () => {
    const subsystem = new GeomanGeometrySubsystem({ geoman: createGeoman() });
    const lineA = {
      ...createFeature([
        [0, 0],
        [1, 0],
      ]),
      id: 'line-a',
      sourceName: 'gm_main',
    } as unknown as FeatureData;
    const lineB = {
      ...createFeature([
        [1, 0],
        [2, 0],
      ]),
      id: 'line-b',
      sourceName: 'gm_main',
    } as unknown as FeatureData;

    const graph = subsystem.getLineNetworkGraph([lineA, lineB], { endpointTolerance: 0 });

    expect(graph.nodes).toHaveLength(3);
    expect(graph.edges).toHaveLength(2);
    expect(graph.danglingEndpoints).toHaveLength(2);
  });

  test('validates line network topology through geometry subsystem', () => {
    const subsystem = new GeomanGeometrySubsystem({ geoman: createGeoman() });
    const line = {
      ...createFeature([
        [0, 0],
        [1, 0],
      ]),
      id: 'line-a',
      sourceName: 'gm_main',
    } as unknown as FeatureData;
    const graph = subsystem.getLineNetworkGraph([line], { endpointTolerance: 0 });

    expect(
      subsystem.validateLineNetworkTopology(graph, {
        danglingEndpoints: { severity: 'error' },
        duplicateEndpointGroups: false,
        disconnectedComponents: false,
      }).issues,
    ).toEqual([
      expect.objectContaining({ type: 'dangling-endpoint', severity: 'error' }),
      expect.objectContaining({ type: 'dangling-endpoint', severity: 'error' }),
    ]);
  });

  test('plans and applies line merges through geometry subsystem', () => {
    const subsystem = new GeomanGeometrySubsystem({ geoman: createGeoman() });
    const lineA = createStatefulFeature([
      [0, 0],
      [1, 0],
    ]);
    const lineB = createStatefulFeature([
      [1, 0],
      [2, 0],
    ]);
    const geoman = {
      ...createGeoman(),
      features: {
        delete: vi.fn(),
      },
    } as unknown as Geoman;
    const applyingSubsystem = new GeomanGeometrySubsystem({ geoman });

    const result = subsystem.getLineMergePlan([lineA, lineB]);
    expect(result).toMatchObject({ ok: true });

    if (!result.ok) {
      throw new Error(result.message);
    }

    applyingSubsystem.applyLineMergePlan(result.plan);

    expect(lineA.getGeoJson().geometry.coordinates).toEqual([
      [0, 0],
      [1, 0],
      [2, 0],
    ]);
    expect(geoman.features.delete).toHaveBeenCalledWith(lineB);
  });

  test('applies line merge plans inside an atomic source update when available', () => {
    const withAtomicSourcesUpdate = vi.fn((callback: () => unknown) => callback());
    const subsystem = new GeomanGeometrySubsystem({ geoman: createGeoman() });
    const lineA = createStatefulFeature([
      [0, 0],
      [1, 0],
    ]);
    const lineB = createStatefulFeature([
      [1, 0],
      [2, 0],
    ]);
    const geoman = {
      ...createGeoman(),
      features: {
        delete: vi.fn(),
        updateManager: { withAtomicSourcesUpdate },
      },
    } as unknown as Geoman;
    const applyingSubsystem = new GeomanGeometrySubsystem({ geoman });
    const result = subsystem.getLineMergePlan([lineA, lineB]);

    if (!result.ok) {
      throw new Error(result.message);
    }

    applyingSubsystem.applyLineMergePlan(result.plan);

    expect(withAtomicSourcesUpdate).toHaveBeenCalledTimes(1);
    expect(geoman.features.delete).toHaveBeenCalledWith(lineB);
  });

  test('restores removed line merge features through the feature store on apply failure', () => {
    const subsystem = new GeomanGeometrySubsystem({ geoman: createGeoman() });
    const lineA = createStatefulFeature(
      [
        [0, 0],
        [1, 0],
      ],
      { shape: 'line', label: 'A' },
    );
    const lineB = createStatefulFeature(
      [
        [1, 0],
        [2, 0],
      ],
      { shape: 'line', label: 'A' },
    );
    const lineC = createStatefulFeature(
      [
        [2, 0],
        [3, 0],
      ],
      { shape: 'line', label: 'A' },
    );
    const error = new Error('delete failed');
    const deletedFeatures = new Set<FeatureData>();
    const addGeoJson = vi.fn();
    (lineB as never as { addGeoJson: typeof addGeoJson }).addGeoJson = addGeoJson;
    const geoman = {
      ...createGeoman(),
      features: {
        delete: vi.fn((feature: FeatureData) => {
          if (feature === lineB) {
            deletedFeatures.add(feature);
            return;
          }

          throw error;
        }),
        add: vi.fn((feature: FeatureData) => {
          deletedFeatures.delete(feature);
        }),
      },
    } as unknown as Geoman;
    const applyingSubsystem = new GeomanGeometrySubsystem({ geoman });
    const result = subsystem.getLineMergePlan([lineA, lineB, lineC], {
      propertyStrategy: 'merge-compatible',
    });

    if (!result.ok) {
      throw new Error(result.message);
    }

    expect(() => applyingSubsystem.applyLineMergePlan(result.plan)).toThrow(error);

    expect(geoman.features.add).toHaveBeenCalledWith(lineB);
    expect(addGeoJson).toHaveBeenCalledWith(lineB.getGeoJson());
    expect(deletedFeatures.has(lineB)).toBe(false);
    expect(lineA.getGeoJson().geometry.coordinates).toEqual([
      [0, 0],
      [1, 0],
    ]);
  });

  test('returns the nearest line endpoint across features', () => {
    const subsystem = new GeomanGeometrySubsystem({ geoman: createGeoman() });
    const lineA = {
      ...createFeature([
        [0, 0],
        [1, 0],
      ]),
      id: 'line-a',
      sourceName: 'gm_main',
    } as unknown as FeatureData;
    const lineB = {
      ...createFeature([
        [1.1, 0],
        [2, 0],
      ]),
      id: 'line-b',
      sourceName: 'gm_main',
    } as unknown as FeatureData;

    const hit = subsystem.getNearestLineEndpoint([lineA, lineB], [112, 2], {
      maxPixelDistance: 12,
    });

    expect(hit).toMatchObject({
      feature: lineB,
      featureId: 'line-b',
      sourceName: 'gm_main',
      endpoint: 'start',
      vertexIndex: 0,
      coordinate: [1.1, 0],
      distancePixels: expect.any(Number),
    });
    expect(hit?.coordinate).not.toBe(lineB.getGeoJson().geometry.coordinates[0]);
  });

  test('filters nearest line endpoint by endpoint name and excluded features', () => {
    const subsystem = new GeomanGeometrySubsystem({ geoman: createGeoman() });
    const lineA = {
      ...createFeature([
        [0, 0],
        [1, 0],
      ]),
      id: 'line-a',
      sourceName: 'gm_main',
    } as unknown as FeatureData;
    const lineB = {
      ...createFeature([
        [1.1, 0],
        [2, 0],
      ]),
      id: 'line-b',
      sourceName: 'gm_main',
    } as unknown as FeatureData;

    expect(
      subsystem.getNearestLineEndpoint([lineA, lineB], [112, 2], {
        maxPixelDistance: 13,
        endpoints: ['end'],
      }),
    ).toMatchObject({ feature: lineA, endpoint: 'end' });
    expect(
      subsystem.getNearestLineEndpoint([lineA, lineB], [112, 2], {
        maxPixelDistance: 13,
        excludeFeatures: [lineB],
      }),
    ).toMatchObject({ feature: lineA, endpoint: 'end' });
  });

  test('returns null for nearest line endpoint misses and unsupported geometries', () => {
    const subsystem = new GeomanGeometrySubsystem({ geoman: createGeoman() });
    const line = createFeature([
      [0, 0],
      [1, 0],
    ]);

    expect(
      subsystem.getNearestLineEndpoint([createPointFeature(), line], [500, 500], {
        maxPixelDistance: 8,
      }),
    ).toBeNull();
    expect(
      subsystem.getNearestLineEndpoint([line], [100, 0], {
        maxPixelDistance: 12,
        endpoints: [],
      }),
    ).toBeNull();
  });

  test('line endpoint helpers identify MultiLineString part endpoints', () => {
    const subsystem = new GeomanGeometrySubsystem({ geoman: createGeoman() });
    const multiLine = createStatefulMultiLineFeature([
      [
        [0, 0],
        [1, 0],
      ],
    ]);
    const line = createFeature([
      [5, 0],
      [6, 0],
    ]);

    expect(subsystem.getNearestLineEndpoint([line, multiLine], [0, 0])).toMatchObject({
      feature: multiLine,
      featureId: 'multi-line-1',
      sourceName: 'gm_main',
      endpoint: 'start',
      partIndex: 0,
      vertexIndex: 0,
      coordinate: [0, 0],
    });
  });

  test('plans endpoint connection for one MultiLineString part without changing other parts', () => {
    const subsystem = new GeomanGeometrySubsystem({ geoman: createGeoman() });
    const multiLine = createStatefulMultiLineFeature([
      [
        [0, 0],
        [1, 0],
      ],
      [
        [10, 0],
        [11, 0],
      ],
    ]);
    const lineB = {
      ...createFeature([
        [2, 0],
        [3, 0],
      ]),
      id: 'line-b',
      sourceName: 'gm_main',
    } as unknown as FeatureData;

    const connection = subsystem.getLineEndpointConnection({
      from: { feature: multiLine, endpoint: 'end', partIndex: 0 },
      to: { feature: lineB, endpoint: 'start' },
    });

    expect(connection).toEqual({
      updates: [
        {
          feature: multiLine,
          geometry: {
            type: 'MultiLineString',
            coordinates: [
              [
                [0, 0],
                [2, 0],
              ],
              [
                [10, 0],
                [11, 0],
              ],
            ],
          },
          properties: {},
        },
      ],
    });
  });

  test('plans endpoint connection preview from screen point candidates', () => {
    const subsystem = new GeomanGeometrySubsystem({ geoman: createGeoman() });
    const lineA = {
      ...createFeature([
        [0, 0],
        [1, 0],
      ]),
      id: 'line-a',
      sourceName: 'gm_main',
    } as unknown as FeatureData;
    const lineB = {
      ...createFeature([
        [1.1, 0],
        [2, 0],
      ]),
      id: 'line-b',
      sourceName: 'gm_main',
    } as unknown as FeatureData;

    const preview = subsystem.getLineEndpointConnectionPreview({
      from: { feature: lineA, endpoint: 'end' },
      candidates: [lineA, lineB],
      point: [110, 0],
      maxPixelDistance: 12,
      excludeFeatures: [lineA],
    });

    expect(preview).toMatchObject({
      from: { feature: lineA, endpoint: 'end' },
      to: {
        feature: lineB,
        featureId: 'line-b',
        endpoint: 'start',
        coordinate: [1.1, 0],
      },
      connection: {
        updates: [
          {
            feature: lineA,
            geometry: {
              type: 'LineString',
              coordinates: [
                [0, 0],
                [1.1, 0],
              ],
            },
            properties: {},
          },
        ],
      },
    });
  });

  test('plans endpoint connection preview from MultiLineString part candidates', () => {
    const subsystem = new GeomanGeometrySubsystem({ geoman: createGeoman() });
    const lineA = {
      ...createFeature([
        [0, 0],
        [1, 0],
      ]),
      id: 'line-a',
      sourceName: 'gm_main',
    } as unknown as FeatureData;
    const multiLine = createStatefulMultiLineFeature([
      [
        [10, 0],
        [11, 0],
      ],
      [
        [1.1, 0],
        [2, 0],
      ],
    ]);

    const preview = subsystem.getLineEndpointConnectionPreview({
      from: { feature: lineA, endpoint: 'end' },
      candidates: [multiLine],
      point: [110, 0],
      maxPixelDistance: 12,
    });

    expect(preview).toMatchObject({
      from: { feature: lineA, endpoint: 'end' },
      to: {
        feature: multiLine,
        featureId: 'multi-line-1',
        endpoint: 'start',
        partIndex: 1,
        vertexIndex: 0,
        coordinate: [1.1, 0],
      },
      connection: {
        updates: [
          {
            feature: lineA,
            geometry: {
              type: 'LineString',
              coordinates: [
                [0, 0],
                [1.1, 0],
              ],
            },
            properties: {},
          },
        ],
      },
    });
  });

  test('returns null for endpoint connection preview without a target endpoint', () => {
    const subsystem = new GeomanGeometrySubsystem({ geoman: createGeoman() });
    const line = createFeature([
      [0, 0],
      [1, 0],
    ]);

    expect(
      subsystem.getLineEndpointConnectionPreview({
        from: { feature: line, endpoint: 'end' },
        candidates: [line],
        point: [500, 500],
        maxPixelDistance: 8,
        excludeFeatures: [line],
      }),
    ).toBeNull();
  });

  test('plans endpoint connection between two line features', () => {
    const subsystem = new GeomanGeometrySubsystem({ geoman: createGeoman() });
    const lineA = {
      ...createFeature([
        [0, 0],
        [1, 0],
      ]),
      id: 'line-a',
      sourceName: 'gm_main',
    } as unknown as FeatureData;
    const lineB = {
      ...createFeature([
        [1.1, 0],
        [2, 0],
      ]),
      id: 'line-b',
      sourceName: 'gm_main',
    } as unknown as FeatureData;

    const connection = subsystem.getLineEndpointConnection({
      from: { feature: lineA, endpoint: 'end' },
      to: { feature: lineB, endpoint: 'start' },
    });

    expect(connection).toEqual({
      updates: [
        {
          feature: lineA,
          geometry: {
            type: 'LineString',
            coordinates: [
              [0, 0],
              [1.1, 0],
            ],
          },
          properties: {},
        },
      ],
    });
    expect(lineA.updateProperties).not.toHaveBeenCalled();
    expect(lineB.updateProperties).not.toHaveBeenCalled();
  });

  test('returns endpoint connection plans isolated from feature geometry', () => {
    const subsystem = new GeomanGeometrySubsystem({ geoman: createGeoman() });
    const lineA = {
      ...createFeature([
        [0, 0],
        [1, 0],
      ]),
      id: 'line-a',
      sourceName: 'gm_main',
    } as unknown as FeatureData;
    const lineB = {
      ...createFeature([
        [1.1, 0],
        [2, 0],
      ]),
      id: 'line-b',
      sourceName: 'gm_main',
    } as unknown as FeatureData;

    const connection = subsystem.getLineEndpointConnection({
      from: { feature: lineA, endpoint: 'end' },
      to: { feature: lineB, endpoint: 'start' },
    });

    connection?.updates[0]?.geometry.coordinates[1]?.splice(0, 2, 99, 99);
    if (connection?.updates[0]) {
      connection.updates[0].properties.segmentValue = 999;
    }

    expect(lineA.getGeoJson().geometry.coordinates).toEqual([
      [0, 0],
      [1, 0],
    ]);
    expect(lineA.getGeoJson().properties).toEqual({ shape: 'line' });
    expect(lineB.getGeoJson().geometry.coordinates).toEqual([
      [1.1, 0],
      [2, 0],
    ]);
  });

  test('returns null for invalid endpoint connection planning', () => {
    const subsystem = new GeomanGeometrySubsystem({ geoman: createGeoman() });
    const point = createPointFeature();
    const line = createFeature([
      [0, 0],
      [1, 0],
    ]);

    expect(
      subsystem.getLineEndpointConnection({
        from: { feature: point, endpoint: 'end' },
        to: { feature: line, endpoint: 'start' },
      }),
    ).toBeNull();
    expect(
      subsystem.getLineEndpointConnection({
        from: { feature: line, endpoint: 'middle' as never },
        to: { feature: line, endpoint: 'start' },
      }),
    ).toBeNull();
  });

  test('applies endpoint connection updates atomically', () => {
    const withAtomicSourcesUpdate = vi.fn((callback: () => unknown) => callback());
    const subsystem = new GeomanGeometrySubsystem({
      geoman: {
        ...createGeoman(),
        features: {
          updateManager: { withAtomicSourcesUpdate },
        },
      } as unknown as Geoman,
    });
    const lineA = {
      ...createStatefulFeature([
        [0, 0],
        [1, 0],
      ]),
      id: 'line-a',
      sourceName: 'gm_main',
    } as unknown as FeatureData;
    const lineB = {
      ...createStatefulFeature([
        [1.1, 0],
        [2, 0],
      ]),
      id: 'line-b',
      sourceName: 'gm_main',
    } as unknown as FeatureData;

    const connection = subsystem.connectLineEndpoints({
      from: { feature: lineA, endpoint: 'end' },
      to: { feature: lineB, endpoint: 'start' },
    });

    expect(connection).not.toBeNull();
    expect(withAtomicSourcesUpdate).toHaveBeenCalledTimes(1);
    expect(lineA.getGeoJson().geometry).toEqual({
      type: 'LineString',
      coordinates: [
        [0, 0],
        [1.1, 0],
      ],
    });
    expect(lineB.getGeoJson().geometry).toEqual({
      type: 'LineString',
      coordinates: [
        [1.1, 0],
        [2, 0],
      ],
    });
  });
});

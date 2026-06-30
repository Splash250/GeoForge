import { describe, expect, it, vi } from 'vitest';
import { FeatureGeoJsonIO } from '../../src/core/features/featureGeoJsonIO.ts';
import { FEATURE_ID_PROPERTY, SOURCES } from '../../src/core/features/constants.ts';
import type { FeatureData } from '../../src/core/features/feature-data.ts';
import type { BaseSource } from '../../src/core/map/base/source.ts';
import type {
  FeatureId,
  FeatureShape,
  FeatureSourceName,
  GeoJsonImportFeature,
  GeoJsonShapeFeature,
} from '../../src/main.ts';

function createFeatureData({ id, shape = 'marker' }: { id: FeatureId; shape?: FeatureShape }) {
  return { id, shape } as FeatureData;
}

function createPointFeature({
  id,
  properties = {},
}: {
  id?: FeatureId;
  properties?: Record<string, unknown>;
} = {}): GeoJsonImportFeature {
  return {
    type: 'Feature',
    id,
    geometry: { type: 'Point', coordinates: [0, 0] },
    properties,
  };
}

function createSource({
  sourceGeoJsonFeatures = [],
  gmGeoJsonFeatures = [],
}: {
  sourceGeoJsonFeatures?: Array<GeoJsonShapeFeature>;
  gmGeoJsonFeatures?: Array<GeoJsonShapeFeature>;
} = {}): BaseSource {
  return {
    getGeoJson: vi.fn(() => ({
      type: 'FeatureCollection',
      features: sourceGeoJsonFeatures,
    })),
    getGmGeoJson: vi.fn(() => ({
      type: 'FeatureCollection',
      features: gmGeoJsonFeatures,
    })),
  } as unknown as BaseSource;
}

function createIO({
  createFeature = vi.fn((options: { featureId?: FeatureId }) =>
    createFeatureData({ id: options.featureId ?? 'created' }),
  ),
  deleteFeature = vi.fn(),
  hasFeature = vi.fn(() => false),
  getFeature = vi.fn(() => null),
  getSource = vi.fn(() => null),
  getShape = vi.fn(() => 'marker' as const),
}: Partial<ConstructorParameters<typeof FeatureGeoJsonIO>[0]> = {}) {
  return new FeatureGeoJsonIO({
    defaultSourceName: () => SOURCES.main,
    createFeature,
    deleteFeature,
    hasFeature,
    getFeature,
    getSource,
    getShape,
  });
}

describe('FeatureGeoJsonIO', () => {
  it('imports one fixed GeoJSON feature through the provided createFeature callback', () => {
    const addedFeature = createFeatureData({ id: 'feature-1' });
    const createFeature = vi.fn(() => addedFeature);
    const io = createIO({ createFeature });

    const result = io.importGeoJson(createPointFeature({ id: 'feature-1' }));

    expect(result.stats).toEqual({ total: 1, success: 1, failed: 0, overwritten: 0 });
    expect(result.addedFeatures).toEqual([addedFeature]);
    expect(createFeature).toHaveBeenCalledWith({
      featureId: 'feature-1',
      ownerId: undefined,
      shapeGeoJson: expect.objectContaining({ id: 'feature-1' }),
      sourceName: SOURCES.main,
      imported: true,
    });
  });

  it('deletes an existing feature before importing when overwrite is enabled', () => {
    const deleteFeature = vi.fn();
    const hasFeature = vi.fn(() => true);
    const io = createIO({ deleteFeature, hasFeature });

    const result = io.importGeoJson(createPointFeature({ id: 'same-id' }), { overwrite: true });

    expect(result.stats.overwritten).toBe(1);
    expect(hasFeature).toHaveBeenCalledWith('same-id');
    expect(deleteFeature).toHaveBeenCalledWith('same-id');
  });

  it('uses idPropertyName as the imported feature id', () => {
    const createFeature = vi.fn(() => createFeatureData({ id: 'external-id' }));
    const io = createIO({ createFeature });

    io.importGeoJson(createPointFeature({ properties: { externalId: 'external-id' } }), {
      idPropertyName: 'externalId',
    });

    expect(createFeature).toHaveBeenCalledWith(
      expect.objectContaining({
        featureId: 'external-id',
        ownerId: undefined,
        shapeGeoJson: expect.objectContaining({ id: 'external-id' }),
      }),
    );
  });

  it('forwards ownerId to created features during import', () => {
    const createFeature = vi.fn(() => createFeatureData({ id: 'owned-feature' }));
    const io = createIO({ createFeature });

    io.importGeoJson(createPointFeature({ id: 'owned-feature' }), {
      ownerId: 'demo:seed-data',
    });

    expect(createFeature).toHaveBeenCalledWith(
      expect.objectContaining({
        featureId: 'owned-feature',
        ownerId: 'demo:seed-data',
      }),
    );
  });

  it('filters exported features by shape', () => {
    const marker = {
      type: 'Feature',
      id: 'marker-id',
      geometry: { type: 'Point', coordinates: [0, 0] },
      properties: { [FEATURE_ID_PROPERTY]: 'marker-id' },
    } as GeoJsonShapeFeature;
    const line = {
      type: 'Feature',
      id: 'line-id',
      geometry: {
        type: 'LineString',
        coordinates: [
          [0, 0],
          [1, 1],
        ],
      },
      properties: { [FEATURE_ID_PROPERTY]: 'line-id' },
    } as GeoJsonShapeFeature;
    const source = createSource({ gmGeoJsonFeatures: [marker, line] });
    const getFeature = vi.fn((_sourceName: FeatureSourceName, featureId: FeatureId) =>
      featureId === 'marker-id'
        ? createFeatureData({ id: featureId, shape: 'marker' })
        : createFeatureData({ id: featureId, shape: 'line' }),
    );
    const io = createIO({
      getSource: vi.fn(() => source),
      getFeature,
    });

    const result = io.exportGeoJson({ allowedShapes: ['marker'] });

    expect(result.features).toEqual([{ ...marker, id: 'marker-id' }]);
  });

  it('can export from source data instead of the feature store snapshot', () => {
    const storeFeature = {
      type: 'Feature',
      id: 'store-id',
      geometry: { type: 'Point', coordinates: [0, 0] },
      properties: { [FEATURE_ID_PROPERTY]: 'store-id' },
    } as GeoJsonShapeFeature;
    const sourceFeature = {
      type: 'Feature',
      id: 'source-id',
      geometry: { type: 'Point', coordinates: [1, 1] },
      properties: { [FEATURE_ID_PROPERTY]: 'source-id' },
    } as GeoJsonShapeFeature;
    const source = createSource({
      gmGeoJsonFeatures: [storeFeature],
      sourceGeoJsonFeatures: [sourceFeature],
    });
    const getFeature = vi.fn((_sourceName: FeatureSourceName, featureId: FeatureId) =>
      createFeatureData({ id: featureId }),
    );
    const io = createIO({
      getSource: vi.fn(() => source),
      getFeature,
    });

    const storeExport = io.exportGeoJson();
    const sourceExport = io.exportGeoJsonFromSource();

    expect(storeExport.features).toEqual([{ ...storeFeature, id: 'store-id' }]);
    expect(sourceExport.features).toEqual([{ ...sourceFeature, id: 'source-id' }]);
    expect(source.getGmGeoJson).toHaveBeenCalled();
    expect(source.getGeoJson).toHaveBeenCalled();
  });

  it('mutates exported feature id properties when a custom id property name is used', () => {
    const feature = {
      type: 'Feature',
      id: 'feature-id',
      geometry: { type: 'Point', coordinates: [0, 0] },
      properties: { [FEATURE_ID_PROPERTY]: 'feature-id' },
    } as GeoJsonShapeFeature;
    const source = createSource({ gmGeoJsonFeatures: [feature] });
    const io = createIO({
      getSource: vi.fn(() => source),
      getFeature: vi.fn(() => createFeatureData({ id: 'feature-id' })),
    });

    const result = io.exportGeoJson({ idPropertyName: 'externalId' });

    expect(result.features[0]?.properties).toEqual({ externalId: 'feature-id' });
    expect(feature.properties).toEqual({ externalId: 'feature-id' });
  });
});

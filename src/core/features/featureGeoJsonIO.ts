import { IS_PRO } from '../constants.ts';
import { FEATURE_ID_PROPERTY, SOURCES } from './constants.ts';
import type { FeatureData } from './feature-data.ts';
import type { BaseSource } from '../map/base/source.ts';
import { SHAPE_NAMES } from '../../modes/constants.ts';
import type {
  FeatureId,
  FeatureShape,
  FeatureSourceName,
  ImportGeoJsonOptions,
} from '../../types/features.ts';
import type {
  GeoJsonImportFeature,
  GeoJsonImportFeatureCollection,
  GeoJsonShapeFeature,
  GeoJsonShapeFeatureCollection,
} from '../../types/geojson.ts';
import type { ShapeName } from '../../types/modes/index.ts';
import { fixGeoJsonFeature, getCustomFeatureId } from '../../utils/geojsonImport.ts';
import type { FeatureCollection } from 'geojson';
import log from 'loglevel';

type CreateFeatureOptions = {
  featureId?: FeatureId;
  shapeGeoJson: GeoJsonShapeFeature;
  sourceName: FeatureSourceName;
  imported?: boolean;
};

export type FeatureGeoJsonIOOptions = {
  defaultSourceName: () => FeatureSourceName;
  createFeature: (options: CreateFeatureOptions) => FeatureData | null;
  deleteFeature: (featureId: FeatureId) => void;
  hasFeature: (featureId: FeatureId) => boolean;
  getFeature: (sourceName: FeatureSourceName, featureId: FeatureId) => FeatureData | null;
  getSource: (sourceName: FeatureSourceName) => BaseSource | null;
  getShape: (feature: GeoJsonImportFeature) => ShapeName | null;
};

export class FeatureGeoJsonIO {
  private defaultSourceName: () => FeatureSourceName;
  private createFeature: (options: CreateFeatureOptions) => FeatureData | null;
  private deleteFeature: (featureId: FeatureId) => void;
  private hasFeature: (featureId: FeatureId) => boolean;
  private getFeature: (sourceName: FeatureSourceName, featureId: FeatureId) => FeatureData | null;
  private getSource: (sourceName: FeatureSourceName) => BaseSource | null;
  private getShape: (feature: GeoJsonImportFeature) => ShapeName | null;

  constructor(options: FeatureGeoJsonIOOptions) {
    this.defaultSourceName = options.defaultSourceName;
    this.createFeature = options.createFeature;
    this.deleteFeature = options.deleteFeature;
    this.hasFeature = options.hasFeature;
    this.getFeature = options.getFeature;
    this.getSource = options.getSource;
    this.getShape = options.getShape;
  }

  importGeoJson(
    geoJson: GeoJsonImportFeatureCollection | GeoJsonImportFeature,
    options?: ImportGeoJsonOptions,
  ) {
    const opts = options ?? {};

    const features = 'features' in geoJson ? geoJson.features : [geoJson];
    const result = {
      stats: {
        total: 0,
        success: 0,
        failed: 0,
        overwritten: 0,
      },
      addedFeatures: [] as Array<FeatureData>,
    };

    features.forEach((feature) => {
      let featureData: FeatureData | null = null;
      result.stats.total += 1;

      const featureGeoJson = fixGeoJsonFeature(feature);
      if (featureGeoJson) {
        if (opts.idPropertyName) {
          const customId = getCustomFeatureId(featureGeoJson, opts.idPropertyName);
          if (customId) {
            featureGeoJson.id = customId;
          }
        }

        if (opts.overwrite) {
          const featureId = (featureGeoJson.id ??
            featureGeoJson.properties?.[FEATURE_ID_PROPERTY]) as FeatureId | undefined;
          if (featureId && this.hasFeature(featureId)) {
            this.deleteFeature(featureId);
            result.stats.overwritten += 1;
          }
        }

        featureData = this.importGeoJsonFeature(featureGeoJson);
      }

      if (featureData) {
        result.addedFeatures.push(featureData);
        result.stats.success += 1;
      } else {
        result.stats.failed += 1;
      }
    });

    return result;
  }

  importGeoJsonFeature(shapeGeoJson: GeoJsonImportFeature): FeatureData | null {
    const sourceName = this.defaultSourceName();

    const shape = this.getShape(shapeGeoJson);
    if (!shape) {
      log.error('features.addGeoJsonFeature: unknown shape', shape);
      return null;
    }

    return this.createFeature({
      featureId: shapeGeoJson.id as FeatureId | undefined,
      shapeGeoJson,
      sourceName,
      imported: true,
    });
  }

  getAll(): FeatureCollection {
    return this.exportGeoJson();
  }

  exportGeoJson(
    {
      allowedShapes,
      idPropertyName,
    }: {
      allowedShapes?: Array<FeatureShape>;
      idPropertyName?: string;
    } = { allowedShapes: undefined },
  ): GeoJsonShapeFeatureCollection {
    return this.asGeoJsonFeatureCollection({
      sourceNames: [SOURCES.main, ...(IS_PRO ? [SOURCES.standby] : [])],
      shapeTypes: allowedShapes ? allowedShapes : [...SHAPE_NAMES],
      idPropertyName,
      useMapLibreSource: false,
    });
  }

  exportGeoJsonFromSource(
    {
      allowedShapes,
      idPropertyName,
    }: {
      allowedShapes?: Array<FeatureShape>;
      idPropertyName?: string;
    } = { allowedShapes: undefined },
  ): GeoJsonShapeFeatureCollection {
    return this.asGeoJsonFeatureCollection({
      sourceNames: [SOURCES.main, ...(IS_PRO ? [SOURCES.standby] : [])],
      shapeTypes: allowedShapes ? allowedShapes : [...SHAPE_NAMES],
      idPropertyName,
      useMapLibreSource: true,
    });
  }

  asGeoJsonFeatureCollection({
    shapeTypes,
    sourceNames,
    idPropertyName,
    useMapLibreSource = false,
  }: {
    shapeTypes?: Array<FeatureShape>;
    sourceNames: Array<FeatureSourceName>;
    idPropertyName?: string;
    useMapLibreSource?: boolean;
  }): GeoJsonShapeFeatureCollection {
    const resultFeatureCollection: GeoJsonShapeFeatureCollection = {
      type: 'FeatureCollection',
      features: [],
    };

    idPropertyName ??= FEATURE_ID_PROPERTY;

    sourceNames.forEach((sourceName) => {
      const source = this.getSource(sourceName);

      if (source) {
        const sourceFeatureCollection = useMapLibreSource
          ? source.getGeoJson()
          : source.getGmGeoJson();

        sourceFeatureCollection.features
          .filter((feature) => !!feature)
          .forEach((feature) => {
            const featureData = this.getFeature(sourceName, feature.id as FeatureId);
            if (!featureData) {
              return;
            }

            const id = feature.properties[FEATURE_ID_PROPERTY];

            if (idPropertyName !== FEATURE_ID_PROPERTY) {
              feature.properties[idPropertyName] = id;
              delete feature.properties[FEATURE_ID_PROPERTY];
            }

            if (shapeTypes === undefined || shapeTypes.includes(featureData.shape)) {
              resultFeatureCollection.features.push({ ...feature, id });
            }
          });
      }
    });

    return resultFeatureCollection;
  }
}

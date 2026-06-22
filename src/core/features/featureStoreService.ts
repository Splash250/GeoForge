import { GM_PREFIX } from '../constants.ts';
import type { FeatureData } from './feature-data.ts';
import type {
  FeatureId,
  FeatureSourceName,
  FeatureStore,
  ForEachFeatureDataCallbackFn,
  SourcesStorage,
} from '@/types/features.ts';
import type { GeoJsonShapeFeature } from '@/types/geojson.ts';
import log from '@/utils/log';

type FeatureIdGenerator = (shapeGeoJson: GeoJsonShapeFeature) => FeatureId;

type FeatureStoreServiceParameters = {
  sources: SourcesStorage;
  allowedSources?: Array<FeatureSourceName>;
  idGenerator?: FeatureIdGenerator | null;
  getIdGenerator?: () => FeatureIdGenerator | null | undefined;
};

type SourceAwareFeatureRef = {
  sourceName: FeatureSourceName;
  featureId: FeatureId;
};

const DEFAULT_ALLOWED_SOURCES: Array<FeatureSourceName> = [
  `${GM_PREFIX}_main`,
  `${GM_PREFIX}_temporary`,
];

export class FeatureStoreService {
  sources: SourcesStorage;
  allowedSources: Array<FeatureSourceName>;
  idGenerator: FeatureIdGenerator | null;
  getIdGenerator: () => FeatureIdGenerator | null | undefined;
  featureCounter: number = 0;
  featureStore: FeatureStore = new Map<string, FeatureData>();

  constructor({
    sources,
    allowedSources,
    idGenerator = null,
    getIdGenerator = () => idGenerator,
  }: FeatureStoreServiceParameters) {
    this.sources = sources;
    this.allowedSources = allowedSources ?? [...DEFAULT_ALLOWED_SOURCES];
    this.idGenerator = idGenerator;
    this.getIdGenerator = getIdGenerator;
  }

  getNewFeatureId(shapeGeoJson: GeoJsonShapeFeature): FeatureId {
    this.featureCounter += 1;

    const idGenerator = this.getIdGenerator() ?? this.idGenerator;
    if (idGenerator) {
      return idGenerator(shapeGeoJson);
    }

    let newFeatureId: FeatureId = `feature-${this.featureCounter}`;

    while (this.hasAnyFeatureId(newFeatureId)) {
      this.featureCounter += 1;
      newFeatureId = `feature-${this.featureCounter}`;
    }

    return newFeatureId;
  }

  filteredForEach(filterFn: (featureData: FeatureData) => boolean) {
    return (callbackfn: ForEachFeatureDataCallbackFn): void => {
      this.featureStore.forEach((featureData, _featureStoreKey, featureStore) => {
        if (filterFn(featureData)) {
          callbackfn(featureData, featureData.id, featureStore);
        }
      });
    };
  }

  has(sourceName: keyof SourcesStorage, featureId: FeatureId): boolean {
    const featureData = this.featureStore.get(getFeatureStoreKey(sourceName, featureId));
    return !!featureData && featureData.source === this.sources[sourceName];
  }

  get(sourceName: keyof SourcesStorage, featureId: FeatureId): FeatureData | null {
    const featureData = this.featureStore.get(getFeatureStoreKey(sourceName, featureId)) || null;

    if (featureData?.source === this.sources[sourceName]) {
      return featureData;
    }
    return null;
  }

  add(featureData: FeatureData) {
    const featureStoreKey = getFeatureStoreKey(featureData.sourceName, featureData.id);
    if (this.featureStore.has(featureStoreKey)) {
      log.error(
        `features.add: feature with the id "${featureData.id}" already exists in source "${featureData.sourceName}"`,
      );
      return;
    }

    if (this.allowedSources.includes(featureData.source.id as FeatureSourceName)) {
      this.featureStore.set(featureStoreKey, featureData);
    }
  }

  delete(featureIdOrFeatureData: FeatureData | FeatureId | SourceAwareFeatureRef) {
    let featureData: FeatureData | null;

    if (isFeatureDataLike(featureIdOrFeatureData)) {
      featureData = featureIdOrFeatureData;
    } else if (isSourceAwareFeatureRef(featureIdOrFeatureData)) {
      featureData = this.get(featureIdOrFeatureData.sourceName, featureIdOrFeatureData.featureId);
    } else {
      featureData = this.getFirstFeatureById(featureIdOrFeatureData) || null;
    }

    if (featureData) {
      this.featureStore.delete(getFeatureStoreKey(featureData.sourceName, featureData.id));
      featureData.delete();
    } else {
      log.error(`features.delete: feature "${featureIdOrFeatureData}" not found`);
    }
  }

  clear() {
    this.featureStore.forEach((featureData) => {
      featureData.delete();
    });
    this.featureStore.clear();
  }

  private hasAnyFeatureId(featureId: FeatureId): boolean {
    return this.getFirstFeatureById(featureId) !== null;
  }

  private getFirstFeatureById(featureId: FeatureId): FeatureData | null {
    for (const featureData of this.featureStore.values()) {
      if (featureData.id === featureId) {
        return featureData;
      }
    }
    return null;
  }
}

function isFeatureDataLike(value: unknown): value is FeatureData {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'delete' in value &&
    typeof (value as { delete?: unknown }).delete === 'function'
  );
}

function isSourceAwareFeatureRef(value: unknown): value is SourceAwareFeatureRef {
  return (
    typeof value === 'object' && value !== null && 'sourceName' in value && 'featureId' in value
  );
}

function getFeatureStoreKey(sourceName: FeatureSourceName, featureId: FeatureId): string {
  return `${sourceName}:${String(featureId)}`;
}

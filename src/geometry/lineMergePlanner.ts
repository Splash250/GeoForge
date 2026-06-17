import type { FeatureData } from '@/core/features/feature-data.ts';
import type { LngLatTuple } from '@/types/map/index.ts';

export type GeomanLineMergePropertyStrategy = 'primary' | 'merge-compatible';

export type GeomanLineMergePlanOptions = {
  primaryFeature?: FeatureData;
  requireSameSource?: boolean;
  propertyStrategy?: GeomanLineMergePropertyStrategy;
  coordinateDistanceTolerance?: number;
  endpointTolerance?: number;
};

export type GeomanLineMergePlan = {
  primaryFeature: FeatureData;
  removedFeatures: Array<FeatureData>;
  sourceName: string;
  geometry: {
    type: 'LineString';
    coordinates: Array<LngLatTuple>;
  };
  properties: Record<string, unknown>;
  orderedFeatures: Array<FeatureData>;
};

export type GeomanLineMergeRejectionReason =
  | 'not-enough-features'
  | 'unsupported-geometry'
  | 'invalid-primary-feature'
  | 'different-sources'
  | 'not-connected'
  | 'branching-connection'
  | 'property-conflict';

export type GeomanLineMergePlanResult =
  | {
      ok: true;
      plan: GeomanLineMergePlan;
    }
  | {
      ok: false;
      reason: GeomanLineMergeRejectionReason;
      message: string;
      feature?: FeatureData;
      propertyName?: string;
    };

export type GeomanLineMergeApplyOptions = {
  removeFeature: (feature: FeatureData) => void;
  restoreFeature?: (feature: FeatureData) => void;
};

type LineMergeFeatureRecord = {
  feature: FeatureData;
  sourceName: string;
  coordinates: Array<LngLatTuple>;
  properties: Record<string, unknown>;
  startCoordinateKey: string;
  endCoordinateKey: string;
  startKey: string;
  endKey: string;
};

type OrderedLineMergeFeatureRecord = {
  record: LineMergeFeatureRecord;
  reversed: boolean;
};

type EndpointOccurrence = {
  record: LineMergeFeatureRecord;
  endpoint: 'start' | 'end';
};

export function getLineMergePlan(
  features: Iterable<FeatureData>,
  options: GeomanLineMergePlanOptions = {},
): GeomanLineMergePlanResult {
  const featureList = Array.from(features);

  if (featureList.length < 2) {
    return reject('not-enough-features', 'At least two line features are required.');
  }

  const records: Array<LineMergeFeatureRecord> = [];
  for (const feature of featureList) {
    const geoJson = feature.getGeoJson();

    if (geoJson.geometry.type !== 'LineString' || geoJson.geometry.coordinates.length < 2) {
      return reject('unsupported-geometry', 'Only LineString features can be merged.', feature);
    }

    const coordinates = geoJson.geometry.coordinates.map(
      (coordinate) => [...coordinate] as LngLatTuple,
    );

    records.push({
      feature,
      sourceName: feature.sourceName,
      coordinates,
      properties: cloneRecord(geoJson.properties),
      startCoordinateKey: getCoordinateKey(coordinates[0]),
      endCoordinateKey: getCoordinateKey(coordinates[coordinates.length - 1]),
      startKey: getCoordinateKey(coordinates[0]),
      endKey: getCoordinateKey(coordinates[coordinates.length - 1]),
    });
  }

  const requireSameSource = options.requireSameSource ?? true;
  if (requireSameSource && new Set(records.map((record) => record.sourceName)).size > 1) {
    return reject('different-sources', 'Line features must use the same source.');
  }

  const endpointGroups = getEndpointGroups(records, getEndpointTolerance(options));
  const branchNode = Array.from(endpointGroups.values()).find((group) => group.length > 2);
  if (branchNode) {
    return reject('branching-connection', 'Line features must form a single non-branching path.');
  }

  const components = getFeatureComponents(records, endpointGroups);
  if (components.length !== 1) {
    return reject('not-connected', 'Line features must be connected by matching endpoints.');
  }

  const terminalGroups = Array.from(endpointGroups.values()).filter((group) => group.length === 1);
  if (terminalGroups.length !== 2) {
    return reject('branching-connection', 'Line features must form an open path.');
  }

  const orderedCoordinates = getOrderedCoordinates(terminalGroups[0][0], records, endpointGroups);
  if (!orderedCoordinates || orderedCoordinates.visitedFeatures.size !== records.length) {
    return reject('not-connected', 'Line features must be connected by matching endpoints.');
  }

  const primaryFeature = options.primaryFeature ?? records[0].feature;
  const primaryRecord = records.find((record) => record.feature === primaryFeature);
  if (!primaryRecord) {
    return reject(
      'invalid-primary-feature',
      'Primary feature must be included in the merge selection.',
      primaryFeature,
    );
  }
  const properties = getMergedProperties(
    orderedCoordinates.orderedRecords,
    options.propertyStrategy ?? 'primary',
    primaryRecord,
  );

  if (!properties.ok) {
    return properties;
  }

  return {
    ok: true,
    plan: {
      primaryFeature,
      removedFeatures: records
        .map((record) => record.feature)
        .filter((feature) => feature !== primaryFeature),
      sourceName: primaryRecord.sourceName,
      geometry: {
        type: 'LineString',
        coordinates: orderedCoordinates.coordinates,
      },
      properties: properties.properties,
      orderedFeatures: orderedCoordinates.orderedRecords.map(({ record }) => record.feature),
    },
  };
}

export function applyLineMergePlan(
  plan: GeomanLineMergePlan,
  options: GeomanLineMergeApplyOptions,
): void {
  validateLineMergePlanForApply(plan);

  const snapshots = new Map<FeatureData, ReturnType<FeatureData['getGeoJson']>>();
  const snapshotFeatures = [plan.primaryFeature, ...plan.removedFeatures];
  const removedFeatures: FeatureData[] = [];

  for (const feature of snapshotFeatures) {
    snapshots.set(feature, cloneValue(feature.getGeoJson()));
  }

  try {
    plan.primaryFeature.updateGeometry(plan.geometry);
    plan.primaryFeature.updateProperties(plan.properties);

    for (const feature of plan.removedFeatures) {
      options.removeFeature(feature);
      removedFeatures.push(feature);
    }
  } catch (error) {
    for (const feature of [...removedFeatures].reverse()) {
      try {
        options.restoreFeature?.(feature);
      } catch {
        // Preserve the original apply failure for callers.
      }
    }

    for (const feature of snapshotFeatures) {
      const snapshot = snapshots.get(feature);
      if (!snapshot) {
        continue;
      }

      try {
        feature.restoreGeoJsonSnapshot(snapshot);
      } catch {
        // Preserve the original apply failure for callers.
      }
    }

    throw error;
  }
}

function validateLineMergePlanForApply(plan: GeomanLineMergePlan): void {
  if (plan.removedFeatures.includes(plan.primaryFeature)) {
    throw new Error('Merge plan cannot remove the primary feature.');
  }

  const allFeatures = [plan.primaryFeature, ...plan.removedFeatures];
  if (allFeatures.length < 2) {
    throw new Error('Merge plan must include at least two features.');
  }

  if (new Set(allFeatures).size !== allFeatures.length) {
    throw new Error('Merge plan cannot include duplicate features.');
  }

  for (const feature of allFeatures) {
    if (feature.sourceName !== plan.sourceName) {
      throw new Error('Merge plan features must use the plan source.');
    }

    const geoJson = feature.getGeoJson();
    if (geoJson.geometry.type !== 'LineString') {
      throw new Error('Merge plan can only apply to current LineString features.');
    }
  }

  if (plan.geometry.type !== 'LineString' || plan.geometry.coordinates.length < 2) {
    throw new Error('Merge plan must provide a LineString geometry with at least two coordinates.');
  }

  for (const feature of plan.orderedFeatures) {
    if (!allFeatures.includes(feature)) {
      throw new Error('Merge plan ordered features must be part of the apply feature set.');
    }
  }
}

function getEndpointGroups(
  records: Array<LineMergeFeatureRecord>,
  coordinateDistanceTolerance: number,
) {
  const groups = new Map<string, Array<EndpointOccurrence>>();
  const endpoints = records.flatMap((record) => [
    {
      record,
      endpoint: 'start' as const,
      coordinate: record.coordinates[0],
      exactKey: record.startCoordinateKey,
    },
    {
      record,
      endpoint: 'end' as const,
      coordinate: record.coordinates[record.coordinates.length - 1],
      exactKey: record.endCoordinateKey,
    },
  ]);

  if (coordinateDistanceTolerance <= 0) {
    for (const endpoint of endpoints) {
      addEndpointOccurrence(groups, endpoint.exactKey, {
        record: endpoint.record,
        endpoint: endpoint.endpoint,
      });
    }

    return groups;
  }

  const parent = endpoints.map((_, index) => index);
  const findRoot = (index: number): number => {
    let root = index;
    while (parent[root] !== root) {
      root = parent[root] ?? root;
    }

    while (parent[index] !== index) {
      const next = parent[index] ?? index;
      parent[index] = root;
      index = next;
    }

    return root;
  };
  const union = (left: number, right: number): void => {
    const leftRoot = findRoot(left);
    const rightRoot = findRoot(right);
    if (leftRoot !== rightRoot) {
      parent[rightRoot] = leftRoot;
    }
  };

  for (let left = 0; left < endpoints.length; left += 1) {
    for (let right = left + 1; right < endpoints.length; right += 1) {
      const leftCoordinate = endpoints[left]?.coordinate;
      const rightCoordinate = endpoints[right]?.coordinate;
      if (
        leftCoordinate &&
        rightCoordinate &&
        getCoordinateDistance(leftCoordinate, rightCoordinate) <= coordinateDistanceTolerance
      ) {
        union(left, right);
      }
    }
  }

  const groupKeys = new Map<number, string>();
  let groupIndex = 0;
  for (let index = 0; index < endpoints.length; index += 1) {
    const endpoint = endpoints[index];
    if (!endpoint) {
      continue;
    }

    const root = findRoot(index);
    let groupKey = groupKeys.get(root);
    if (!groupKey) {
      groupKey = `tolerance:${groupIndex}`;
      groupKeys.set(root, groupKey);
      groupIndex += 1;
    }

    if (endpoint.endpoint === 'start') {
      endpoint.record.startKey = groupKey;
    } else {
      endpoint.record.endKey = groupKey;
    }

    addEndpointOccurrence(groups, groupKey, {
      record: endpoint.record,
      endpoint: endpoint.endpoint,
    });
  }

  return groups;
}

function getEndpointTolerance(options: GeomanLineMergePlanOptions): number {
  const tolerance = options.coordinateDistanceTolerance ?? options.endpointTolerance ?? 0;

  return Number.isFinite(tolerance) && tolerance > 0 ? tolerance : 0;
}

function getCoordinateDistance(left: LngLatTuple, right: LngLatTuple): number {
  return Math.hypot(left[0] - right[0], left[1] - right[1]);
}

function addEndpointOccurrence(
  groups: Map<string, Array<EndpointOccurrence>>,
  key: string,
  occurrence: EndpointOccurrence,
) {
  const group = groups.get(key) ?? [];
  group.push(occurrence);
  groups.set(key, group);
}

function getExactEndpointKey(record: LineMergeFeatureRecord, endpoint: 'start' | 'end'): string {
  return endpoint === 'start' ? record.startCoordinateKey : record.endCoordinateKey;
}

function getFeatureComponents(
  records: Array<LineMergeFeatureRecord>,
  endpointGroups: Map<string, Array<EndpointOccurrence>>,
) {
  const adjacency = new Map<LineMergeFeatureRecord, Set<LineMergeFeatureRecord>>();
  for (const record of records) {
    adjacency.set(record, new Set());
  }

  for (const group of endpointGroups.values()) {
    for (const occurrence of group) {
      for (const other of group) {
        if (occurrence.record !== other.record) {
          adjacency.get(occurrence.record)?.add(other.record);
        }
      }
    }
  }

  const visited = new Set<LineMergeFeatureRecord>();
  const components: Array<Array<LineMergeFeatureRecord>> = [];

  for (const record of records) {
    if (visited.has(record)) {
      continue;
    }

    const component: Array<LineMergeFeatureRecord> = [];
    const queue = [record];
    visited.add(record);

    for (let index = 0; index < queue.length; index += 1) {
      const current = queue[index];
      if (!current) {
        continue;
      }

      component.push(current);
      for (const next of adjacency.get(current) ?? []) {
        if (!visited.has(next)) {
          visited.add(next);
          queue.push(next);
        }
      }
    }

    components.push(component);
  }

  return components;
}

function getOrderedCoordinates(
  startOccurrence: EndpointOccurrence,
  records: Array<LineMergeFeatureRecord>,
  endpointGroups: Map<string, Array<EndpointOccurrence>>,
): {
  coordinates: Array<LngLatTuple>;
  orderedRecords: Array<OrderedLineMergeFeatureRecord>;
  visitedFeatures: Set<LineMergeFeatureRecord>;
} | null {
  let currentNodeKey =
    startOccurrence.endpoint === 'start'
      ? startOccurrence.record.startKey
      : startOccurrence.record.endKey;
  const visitedFeatures = new Set<LineMergeFeatureRecord>();
  const orderedRecords: Array<OrderedLineMergeFeatureRecord> = [];
  const coordinates: Array<LngLatTuple> = [];

  while (visitedFeatures.size < records.length) {
    const occurrence = (endpointGroups.get(currentNodeKey) ?? []).find(
      (candidate) => !visitedFeatures.has(candidate.record),
    );

    if (!occurrence) {
      return null;
    }

    const orientedCoordinates =
      occurrence.endpoint === 'start'
        ? occurrence.record.coordinates
        : occurrence.record.coordinates.slice().reverse();
    const reversed = occurrence.endpoint !== 'start';

    const entryKey = getExactEndpointKey(occurrence.record, occurrence.endpoint);
    const previousKey = getCoordinateKey(coordinates[coordinates.length - 1]);
    const coordinatesToAppend =
      coordinates.length > 0 && previousKey === entryKey
        ? orientedCoordinates.slice(1)
        : orientedCoordinates;

    coordinates.push(...coordinatesToAppend.map((coordinate) => [...coordinate] as LngLatTuple));

    orderedRecords.push({ record: occurrence.record, reversed });
    visitedFeatures.add(occurrence.record);
    currentNodeKey =
      occurrence.endpoint === 'start' ? occurrence.record.endKey : occurrence.record.startKey;
  }

  return { coordinates, orderedRecords, visitedFeatures };
}

function getMergedProperties(
  orderedRecords: Array<OrderedLineMergeFeatureRecord>,
  strategy: GeomanLineMergePropertyStrategy,
  primaryRecord: LineMergeFeatureRecord,
):
  | { ok: true; properties: Record<string, unknown> }
  | { ok: false; reason: 'property-conflict'; message: string; propertyName: string } {
  if (strategy === 'primary') {
    const properties = cloneRecord(primaryRecord.properties);
    const segments = getMergedSegments(orderedRecords);
    if (segments.length > 0) {
      properties.segments = segments;
    }

    return {
      ok: true,
      properties,
    };
  }

  const firstRecord = orderedRecords[0]?.record ?? primaryRecord;
  const properties = cloneRecord(firstRecord.properties);
  for (const { record } of orderedRecords.slice(1)) {
    for (const [name, value] of Object.entries(record.properties)) {
      if (name === 'segments') {
        continue;
      }

      if (properties[name] === undefined) {
        properties[name] = cloneValue(value);
        continue;
      }

      if (JSON.stringify(properties[name]) !== JSON.stringify(value)) {
        return {
          ok: false,
          reason: 'property-conflict',
          propertyName: name,
          message: `Line property "${name}" has conflicting values.`,
        };
      }
    }
  }

  const segments = getMergedSegments(orderedRecords);
  if (segments.length > 0) {
    properties.segments = segments;
  }
  return { ok: true, properties };
}

function getMergedSegments(
  orderedRecords: Array<OrderedLineMergeFeatureRecord>,
): Array<Record<string, unknown>> {
  const segments: Array<Record<string, unknown>> = [];

  for (const { record, reversed } of orderedRecords) {
    const sourceSegments = Array.isArray(record.properties.segments)
      ? record.properties.segments
      : [];
    const mergeableSegments = sourceSegments.filter(
      (segment): segment is Record<string, unknown> =>
        isRecord(segment) && Number.isInteger(segment.index),
    );
    const orderedSegments = reversed ? mergeableSegments.slice().reverse() : mergeableSegments;

    for (const segment of orderedSegments) {
      segments.push({
        ...cloneRecord(segment),
        index: segments.length,
      });
    }
  }

  return segments;
}

function getCoordinateKey(coordinate: LngLatTuple | undefined): string {
  return coordinate ? `${coordinate[0]},${coordinate[1]}` : '';
}

function reject(
  reason: GeomanLineMergeRejectionReason,
  message: string,
  feature?: FeatureData,
): GeomanLineMergePlanResult {
  return { ok: false, reason, message, feature };
}

function cloneRecord(record: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, cloneValue(value)]));
}

function cloneValue<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => cloneValue(item)) as T;
  }

  if (isRecord(value)) {
    return cloneRecord(value) as T;
  }

  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

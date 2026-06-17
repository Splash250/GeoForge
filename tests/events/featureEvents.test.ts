import { EventForwarder } from '@/core/events/forwarder.ts';
import { EventBus } from '@/core/events/bus.ts';
import { GM_SYSTEM_PREFIX } from '@/core/constants.ts';
import { SOURCES } from '@/core/features/constants.ts';
import type { FeatureData } from '@/core/features/feature-data.ts';
import type { GeoJsonShapeFeature } from '@/types/geojson.ts';
import type { Geoman, GmSystemEvent } from '@/main.ts';
import log from 'loglevel';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/core/options/layers/style.ts', () => ({ default: {} }));
vi.mock('@/main.ts', () => ({
  includesWithType: (value: unknown, items: readonly unknown[]) => items.includes(value),
  typedKeys: Object.keys,
}));

function createFeature(label: string | undefined): FeatureData {
  const geoJson: GeoJsonShapeFeature = {
    type: 'Feature',
    id: 'event-feature-1',
    geometry: { type: 'Point', coordinates: [0, 0] },
    properties: {
      shape: 'marker',
      ...(label === undefined ? {} : { label }),
    },
  };

  return {
    id: 'event-feature-1',
    sourceName: SOURCES.main,
    source: { id: SOURCES.main },
    shape: 'marker',
    getGeoJson: () => geoJson,
  } as unknown as FeatureData;
}

function createGeoJsonFeature(label: string): GeoJsonShapeFeature {
  return {
    type: 'Feature',
    id: 'event-feature-1',
    geometry: { type: 'Point', coordinates: [0, 0] },
    properties: {
      shape: 'marker',
      label,
    },
  };
}

describe('feature events', () => {
  it('continues forwarding later system events after one forwarded event rejects', async () => {
    const geoman = {
      mapAdapter: {
        getMapInstance: () => ({}),
      },
    } as unknown as Geoman;
    const bus = new EventBus(geoman);
    const eventName = `${GM_SYSTEM_PREFIX}:edit` as const;
    const before = createFeature(undefined);
    const after = createFeature('A');
    const firstPayload = {
      name: `${GM_SYSTEM_PREFIX}:edit:feature_updated`,
      level: 'system',
      actionType: 'edit',
      action: 'feature_updated',
      mode: 'change',
      sourceFeatures: [before],
      targetFeatures: [after],
      markerData: null,
    } satisfies GmSystemEvent;
    const secondPayload = {
      ...firstPayload,
      targetFeatures: [createFeature('B')],
    } satisfies GmSystemEvent;
    const processEvent = vi
      .fn()
      .mockRejectedValueOnce(new Error('forwarding failed'))
      .mockResolvedValueOnce(undefined);
    const logError = vi.spyOn(log, 'error').mockImplementation(() => undefined);

    try {
      bus.forwarder.processEvent = processEvent;
      bus.on(
        eventName,
        vi.fn(() => ({ next: true })),
      );

      bus.fireEvent(eventName, firstPayload);
      await (bus as unknown as { pendingForward: Promise<void> }).pendingForward.catch(
        () => undefined,
      );

      bus.fireEvent(eventName, secondPayload);
      await (bus as unknown as { pendingForward: Promise<void> }).pendingForward.catch(
        () => undefined,
      );

      expect(processEvent).toHaveBeenNthCalledWith(1, eventName, firstPayload);
      expect(processEvent).toHaveBeenNthCalledWith(2, eventName, secondPayload);
      expect(logError).toHaveBeenCalledWith(
        'EventsBus: event forwarding failed',
        eventName,
        expect.any(Error),
      );
    } finally {
      logError.mockRestore();
    }
  });

  it('gm:edit includes immutable source-aware change records and legacy feature fields', async () => {
    const fired: Array<{ name: string; payload: Record<string, unknown> }> = [];
    const waitForPendingUpdates = vi.fn();
    const geoman = {
      options: { settings: { awaitDataUpdatesOnEvents: true } },
      features: { updateManager: { waitForPendingUpdates } },
      mapAdapter: {
        getMapInstance: () => ({}),
        fire: (name: string, payload: Record<string, unknown>) => fired.push({ name, payload }),
      },
    } as unknown as Geoman;
    const forwarder = new EventForwarder(geoman);
    const before = createFeature(undefined);
    const after = createFeature('A');

    await forwarder.forwardFeatureUpdated({
      name: `${GM_SYSTEM_PREFIX}:edit:feature_updated`,
      level: 'system',
      actionType: 'edit',
      action: 'feature_updated',
      mode: 'change',
      sourceFeatures: [before],
      targetFeatures: [after],
      markerData: null,
    });

    after.getGeoJson().properties.label = 'mutated later';

    const event = fired.find((item) => item.name === 'gm:edit')?.payload;
    const changeRecord = (event?.changeRecords as Array<Record<string, unknown>> | undefined)?.[0];

    expect(event?.originalFeature).toBe(before);
    expect(event?.feature).toBe(after);
    expect(changeRecord?.ref).toEqual({
      sourceName: SOURCES.main,
      featureId: 'event-feature-1',
    });
    expect((changeRecord?.before as GeoJsonShapeFeature | null)?.properties.label).toBeUndefined();
    expect((changeRecord?.after as GeoJsonShapeFeature | null)?.properties.label).toBe('A');
    expect(event?.historyEntryId).toBeNull();
    expect(event?.transactionId).toBeNull();
    expect(waitForPendingUpdates).toHaveBeenCalledWith(SOURCES.main);
  });

  it('gm:edit uses source GeoJSON snapshots when source and target reference the same feature', async () => {
    const fired: Array<{ name: string; payload: Record<string, unknown> }> = [];
    const geoman = {
      options: { settings: { awaitDataUpdatesOnEvents: false } },
      features: { updateManager: { waitForPendingUpdates: vi.fn() } },
      mapAdapter: {
        getMapInstance: () => ({}),
        fire: (name: string, payload: Record<string, unknown>) => fired.push({ name, payload }),
      },
    } as unknown as Geoman;
    const forwarder = new EventForwarder(geoman);
    const feature = createFeature('after');
    const beforeSnapshot: GeoJsonShapeFeature = {
      ...feature.getGeoJson(),
      properties: {
        ...feature.getGeoJson().properties,
        label: 'before',
      },
    };

    await forwarder.forwardFeatureUpdated({
      name: `${GM_SYSTEM_PREFIX}:edit:feature_updated`,
      level: 'system',
      actionType: 'edit',
      action: 'feature_updated',
      mode: 'change',
      sourceFeatures: [feature],
      sourceGeoJsonFeatures: [beforeSnapshot],
      targetFeatures: [feature],
      markerData: null,
    });

    const event = fired.find((item) => item.name === 'gm:edit')?.payload;
    const changeRecord = (event?.changeRecords as Array<Record<string, unknown>> | undefined)?.[0];

    expect((changeRecord?.before as GeoJsonShapeFeature | null)?.properties.label).toBe('before');
    expect((changeRecord?.after as GeoJsonShapeFeature | null)?.properties.label).toBe('after');
  });

  it('gm:edit uses pending history operation snapshots when explicit source snapshots are absent', async () => {
    const fired: Array<{ name: string; payload: Record<string, unknown> }> = [];
    const feature = createFeature('after');
    const beforeSnapshot: GeoJsonShapeFeature = {
      ...feature.getGeoJson(),
      properties: {
        ...feature.getGeoJson().properties,
        label: 'before',
      },
    };
    const afterSnapshot = feature.getGeoJson();
    const geoman = {
      options: { settings: { awaitDataUpdatesOnEvents: false } },
      features: { updateManager: { waitForPendingUpdates: vi.fn() } },
      history: {
        getLastRecordedEntry: vi.fn(() => ({
          id: 'gm-history-999',
          createdAt: Date.now(),
          operations: [
            {
              kind: 'update',
              ref: { sourceName: SOURCES.main, featureId: 'event-feature-1' },
              before: beforeSnapshot,
              after: afterSnapshot,
            },
          ],
        })),
        consumeLastRecordedEntryId: vi.fn(() => 'gm-history-999'),
      },
      mapAdapter: {
        getMapInstance: () => ({}),
        fire: (name: string, payload: Record<string, unknown>) => fired.push({ name, payload }),
      },
    } as unknown as Geoman;
    const forwarder = new EventForwarder(geoman);

    await forwarder.forwardFeatureUpdated({
      name: `${GM_SYSTEM_PREFIX}:edit:feature_updated`,
      level: 'system',
      actionType: 'edit',
      action: 'feature_updated',
      mode: 'change',
      sourceFeatures: [feature],
      targetFeatures: [feature],
      markerData: null,
    });

    const event = fired.find((item) => item.name === 'gm:edit')?.payload;
    const changeRecord = (event?.changeRecords as Array<Record<string, unknown>> | undefined)?.[0];

    expect(event?.historyEntryId).toBe('gm-history-999');
    expect((changeRecord?.before as GeoJsonShapeFeature | null)?.properties.label).toBe('before');
    expect((changeRecord?.after as GeoJsonShapeFeature | null)?.properties.label).toBe('after');
  });

  it('gm:edit ignores history operations that do not match the target feature ref', async () => {
    const fired: Array<{ name: string; payload: Record<string, unknown> }> = [];
    const feature = createFeature('current');
    const staleBefore = createGeoJsonFeature('stale-before');
    const staleAfter = createGeoJsonFeature('stale-after');
    const geoman = {
      options: { settings: { awaitDataUpdatesOnEvents: false } },
      features: { updateManager: { waitForPendingUpdates: vi.fn() } },
      history: {
        getLastRecordedEntry: vi.fn(() => ({
          id: 'gm-history-stale',
          createdAt: Date.now(),
          operations: [
            {
              kind: 'update',
              ref: { sourceName: SOURCES.main, featureId: 'different-feature' },
              before: staleBefore,
              after: staleAfter,
            },
          ],
        })),
        consumeLastRecordedEntryId: vi.fn(() => 'gm-history-stale'),
      },
      mapAdapter: {
        getMapInstance: () => ({}),
        fire: (name: string, payload: Record<string, unknown>) => fired.push({ name, payload }),
      },
    } as unknown as Geoman;
    const forwarder = new EventForwarder(geoman);

    await forwarder.forwardFeatureUpdated({
      name: `${GM_SYSTEM_PREFIX}:edit:feature_updated`,
      level: 'system',
      actionType: 'edit',
      action: 'feature_updated',
      mode: 'change',
      sourceFeatures: [feature],
      targetFeatures: [feature],
      markerData: null,
    });

    const event = fired.find((item) => item.name === 'gm:edit')?.payload;
    const changeRecord = (event?.changeRecords as Array<Record<string, unknown>> | undefined)?.[0];

    expect((changeRecord?.before as GeoJsonShapeFeature | null)?.properties.label).toBe('current');
    expect((changeRecord?.after as GeoJsonShapeFeature | null)?.properties.label).toBe('current');
    expect(event?.historyEntryId).toBe('gm-history-stale');
  });

  it('gm:edit falls back to the source feature only when no snapshot or history operation exists', async () => {
    const fired: Array<{ name: string; payload: Record<string, unknown> }> = [];
    const feature = createFeature('current');
    const geoman = {
      options: { settings: { awaitDataUpdatesOnEvents: false } },
      features: { updateManager: { waitForPendingUpdates: vi.fn() } },
      history: {
        getLastRecordedEntry: vi.fn(() => null),
        consumeLastRecordedEntryId: vi.fn(() => null),
      },
      mapAdapter: {
        getMapInstance: () => ({}),
        fire: (name: string, payload: Record<string, unknown>) => fired.push({ name, payload }),
      },
    } as unknown as Geoman;
    const forwarder = new EventForwarder(geoman);

    await forwarder.forwardFeatureUpdated({
      name: `${GM_SYSTEM_PREFIX}:edit:feature_updated`,
      level: 'system',
      actionType: 'edit',
      action: 'feature_updated',
      mode: 'change',
      sourceFeatures: [feature],
      targetFeatures: [feature],
      markerData: null,
    });

    const event = fired.find((item) => item.name === 'gm:edit')?.payload;
    const changeRecord = (event?.changeRecords as Array<Record<string, unknown>> | undefined)?.[0];

    expect((changeRecord?.before as GeoJsonShapeFeature | null)?.properties.label).toBe('current');
    expect(event?.historyEntryId).toBeNull();
  });

  it('public mutation events include current history and transaction correlation metadata', async () => {
    const fired: Array<{ name: string; payload: Record<string, unknown> }> = [];
    const geoman = {
      options: { settings: { awaitDataUpdatesOnEvents: false } },
      features: { updateManager: { waitForPendingUpdates: vi.fn() } },
      history: { getLastRecordedEntryId: vi.fn(() => 'gm-history-456') },
      transactions: { getActive: vi.fn(() => ({ id: 'transaction-456' })) },
      mapAdapter: {
        getMapInstance: () => ({}),
        fire: (name: string, payload: Record<string, unknown>) => fired.push({ name, payload }),
      },
    } as unknown as Geoman;
    const forwarder = new EventForwarder(geoman);
    const before = createFeature(undefined);
    const after = createFeature('A');

    await forwarder.forwardFeatureCreated({
      name: `${GM_SYSTEM_PREFIX}:draw:feature_created`,
      level: 'system',
      actionType: 'draw',
      action: 'feature_created',
      mode: 'marker',
      featureData: after,
    });
    await forwarder.forwardFeatureRemoved({
      name: `${GM_SYSTEM_PREFIX}:edit:feature_removed`,
      level: 'system',
      actionType: 'edit',
      action: 'feature_removed',
      mode: 'marker',
      featureData: after,
    });
    await forwarder.forwardFeatureUpdated({
      name: `${GM_SYSTEM_PREFIX}:edit:feature_updated`,
      level: 'system',
      actionType: 'edit',
      action: 'feature_updated',
      mode: 'change',
      sourceFeatures: [before],
      targetFeatures: [after],
      markerData: null,
    });

    for (const eventName of ['gm:create', 'gm:remove', 'gm:edit']) {
      const event = fired.find((item) => item.name === eventName)?.payload;
      expect(event?.historyEntryId).toBe('gm-history-456');
      expect(event?.transactionId).toBe('transaction-456');
    }
  });

  it('consumes pending history ids so later mutation events do not reuse stale correlation metadata', async () => {
    const fired: Array<{ name: string; payload: Record<string, unknown> }> = [];
    let pendingHistoryEntryId: string | null = 'gm-history-789';
    const geoman = {
      options: { settings: { awaitDataUpdatesOnEvents: false } },
      features: { updateManager: { waitForPendingUpdates: vi.fn() } },
      history: {
        consumeLastRecordedEntryId: vi.fn(() => {
          const entryId = pendingHistoryEntryId;
          pendingHistoryEntryId = null;
          return entryId;
        }),
      },
      transactions: { getActive: vi.fn(() => null) },
      mapAdapter: {
        getMapInstance: () => ({}),
        fire: (name: string, payload: Record<string, unknown>) => fired.push({ name, payload }),
      },
    } as unknown as Geoman;
    const forwarder = new EventForwarder(geoman);
    const before = createFeature(undefined);
    const after = createFeature('A');

    await forwarder.forwardFeatureUpdated({
      name: `${GM_SYSTEM_PREFIX}:edit:feature_updated`,
      level: 'system',
      actionType: 'edit',
      action: 'feature_updated',
      mode: 'change',
      sourceFeatures: [before],
      targetFeatures: [after],
      markerData: null,
    });
    await forwarder.forwardFeatureUpdated({
      name: `${GM_SYSTEM_PREFIX}:edit:feature_updated`,
      level: 'system',
      actionType: 'edit',
      action: 'feature_updated',
      mode: 'change',
      sourceFeatures: [before],
      targetFeatures: [after],
      markerData: null,
    });

    expect(fired[0]?.payload.historyEntryId).toBe('gm-history-789');
    expect(fired[1]?.payload.historyEntryId).toBeNull();
  });
});

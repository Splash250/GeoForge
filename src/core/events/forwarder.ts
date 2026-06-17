import { GM_PREFIX, GM_SYSTEM_PREFIX } from '@/core/constants.ts';
import {
  isHelperFeatureClickEvent as isHelperFeatureClickPayload,
  isHelperFeatureHoverEndEvent as isHelperFeatureHoverEndPayload,
  isHelperFeatureHoverEvent as isHelperFeatureHoverPayload,
  isHelperMapBlankClickEvent as isHelperMapBlankClickPayload,
  isHelperToolLifecycleEvent as isHelperToolLifecyclePayload,
  isSelectionEvent as isSelectionPayload,
} from '@/core/events/forwarder/guards.ts';
import type { FeatureData } from '@/core/features/feature-data.ts';
import type { GeomanFeatureMutationRecord, GeomanHistoryEntry } from '@/history/types.ts';
import type { Geoman } from '@/main.ts';
import type { GmControlLoadEvent } from '@/types/events/control.ts';
import type { GmDrawFeatureCreatedEvent, GmDrawModeEvent } from '@/types/events/draw.ts';
import type {
  GmEditFeatureEditEndEvent,
  GmEditFeatureEditStartEvent,
  GmEditFeatureRemovedEvent,
  GmEditFeatureUpdatedEvent,
  GmEditModeEvent,
} from '@/types/events/edit.ts';
import type {
  DeselectFwdEvent,
  FeatureClickFwdEvent,
  FeatureCreatedFwdEvent,
  FeatureEditEndFwdEvent,
  FeatureEditStartFwdEvent,
  FeatureHoverEndFwdEvent,
  FeatureHoverFwdEvent,
  FeatureRemovedFwdEvent,
  FeatureUpdatedFwdEvent,
  FwdEditModeName,
  GlobalDrawEnabledDisabledFwdEvent,
  GlobalDrawToggledFwdEvent,
  GlobalEditToggledFwdEvent,
  GlobalEventsListener,
  GlobalHelperToggledFwdEvent,
  GmFwdEventName,
  MapBlankClickFwdEvent,
  SelectFwdEvent,
  SystemFwdEvent,
  ToolCancelFwdEvent,
  ToolEndFwdEvent,
  ToolStartFwdEvent,
} from '@/types/events/forwarder/index.ts';
import type {
  GmHelperFeatureClickEvent,
  GmHelperFeatureHoverEndEvent,
  GmHelperFeatureHoverEvent,
  GmHelperMapBlankClickEvent,
  GmHelperModeEvent,
  GmHelperSelectionEvent,
  GmHelperToolLifecycleEvent,
} from '@/types/events/helper.ts';
import type {
  GmEvent,
  GmEventName,
  GmEventNameWithoutPrefix,
  GmSystemEvent,
} from '@/types/events/index.ts';
import type { FeatureSourceName } from '@/types/features.ts';
import type { AnyEventName } from '@/types/map/index.ts';
import type { EditModeName } from '@/types/modes/index.ts';
import type { ModeName } from '@/types/controls.ts';
import { cloneDeep } from 'lodash-es';

export class EventForwarder {
  gm: Geoman;
  globalEventsListener: GlobalEventsListener | null = null;

  constructor(gm: Geoman) {
    this.gm = gm;
  }

  get map() {
    return this.gm.mapAdapter.getMapInstance();
  }

  async processEvent(eventName: GmEventName, payload: GmSystemEvent) {
    // repeat the events to the map to allow end users to listen
    await this.fireToMap({
      type: 'system',
      eventName: eventName.split(':')[1] as GmEventNameWithoutPrefix,
      payload: {
        ...payload,
        level: 'user',
      },
    });

    if (this.isSelectionEvent(payload)) {
      await this.forwardSelection(payload);
    } else if (this.isHelperFeatureHoverEvent(payload)) {
      await this.forwardFeatureHover(payload);
    } else if (this.isHelperFeatureHoverEndEvent(payload)) {
      await this.forwardFeatureHoverEnd(payload);
    } else if (this.isHelperFeatureClickEvent(payload)) {
      await this.forwardFeatureClick(payload);
    } else if (this.isHelperMapBlankClickEvent(payload)) {
      await this.forwardMapBlankClick(payload);
    } else if (this.isHelperToolLifecycleEvent(payload)) {
      await this.forwardToolLifecycle(payload);
    } else if (payload.action === 'mode_start' || payload.action === 'mode_end') {
      await this.forwardModeToggledEvent(payload);
    } else if (payload.action === 'feature_created') {
      await this.forwardFeatureCreated(payload);
    } else if (payload.action === 'feature_removed') {
      await this.forwardFeatureRemoved(payload);
    } else if (payload.action === 'feature_updated') {
      await this.forwardFeatureUpdated(payload);
    } else if (payload.action === 'feature_edit_start') {
      await this.forwardFeatureEditStart(payload);
    } else if (payload.action === 'feature_edit_end') {
      await this.forwardFeatureEditEnd(payload);
    } else if (payload.action === 'loaded' || payload.action === 'unloaded') {
      await this.forwardGeomanLoaded(payload);
    }
  }

  isSelectionEvent(payload: GmSystemEvent): payload is GmHelperSelectionEvent {
    return isSelectionPayload(payload);
  }

  isHelperFeatureHoverEvent(payload: GmSystemEvent): payload is GmHelperFeatureHoverEvent {
    return isHelperFeatureHoverPayload(payload);
  }

  isHelperFeatureHoverEndEvent(payload: GmSystemEvent): payload is GmHelperFeatureHoverEndEvent {
    return isHelperFeatureHoverEndPayload(payload);
  }

  isHelperFeatureClickEvent(payload: GmSystemEvent): payload is GmHelperFeatureClickEvent {
    return isHelperFeatureClickPayload(payload);
  }

  isHelperMapBlankClickEvent(payload: GmSystemEvent): payload is GmHelperMapBlankClickEvent {
    return isHelperMapBlankClickPayload(payload);
  }

  isHelperToolLifecycleEvent(payload: GmSystemEvent): payload is GmHelperToolLifecycleEvent {
    return isHelperToolLifecyclePayload(payload);
  }

  async forwardModeToggledEvent(payload: GmDrawModeEvent | GmEditModeEvent | GmHelperModeEvent) {
    const enabled = payload.action === 'mode_start';

    if (payload.actionType === 'draw') {
      // global draw mode toggled
      const eventName = 'globaldrawmodetoggled';
      const eventData: GlobalDrawToggledFwdEvent = {
        name: `${GM_PREFIX}:${eventName}`,
        actionType: payload.actionType,
        action: payload.action,
        enabled,
        shape: payload.mode,
        map: this.map,
      };
      await this.fireToMap({ type: 'converted', eventName, payload: eventData });

      // drawstart, drawend
      const eventName2 = enabled ? 'drawstart' : 'drawend';
      const eventData2: GlobalDrawEnabledDisabledFwdEvent = {
        name: `${GM_PREFIX}:${eventName2}`,
        actionType: payload.actionType,
        action: payload.action,
        shape: payload.mode,
        map: this.map,
      };
      await this.fireToMap({
        type: 'converted',
        eventName: eventName2,
        payload: eventData2,
      });
    } else if (payload.actionType === 'edit') {
      const modeName = this.getConvertedEditModeName(payload.mode);
      const eventName = `global${modeName}modetoggled` as const;
      const eventData: GlobalEditToggledFwdEvent = {
        name: `${GM_PREFIX}:${eventName}`,
        actionType: payload.actionType,
        action: payload.action,
        enabled,
        map: this.map,
      };
      await this.fireToMap({
        type: 'converted',
        eventName,
        payload: eventData,
      });
    } else if (payload.actionType === 'helper') {
      const eventName = `global${payload.mode}modetoggled` as const;
      const eventData: GlobalHelperToggledFwdEvent = {
        name: `${GM_PREFIX}:${eventName}`,
        actionType: payload.actionType,
        action: payload.action,
        enabled,
        map: this.map,
      };
      await this.fireToMap({
        type: 'converted',
        eventName,
        payload: eventData,
      });
    }
  }

  async forwardFeatureCreated(payload: GmDrawFeatureCreatedEvent) {
    const eventData: FeatureCreatedFwdEvent = {
      name: `${GM_PREFIX}:create`,
      actionType: payload.actionType,
      action: payload.action,
      shape: payload.mode,
      feature: payload.featureData,
      changeRecords: [
        this.createChangeRecord({
          kind: 'create',
          feature: payload.featureData,
          before: null,
          after: payload.featureData.getGeoJson(),
          reason: 'feature.created',
        }),
      ],
      historyEntryId: this.resolveHistoryEntryId(),
      transactionId: this.resolveTransactionId(),
      map: this.map,
    };
    await this.fireToMap({ type: 'converted', eventName: 'create', payload: eventData });
  }

  async forwardFeatureRemoved(payload: GmEditFeatureRemovedEvent) {
    const eventData: FeatureRemovedFwdEvent = {
      name: `${GM_PREFIX}:remove`,
      actionType: payload.actionType,
      action: payload.action,
      shape: payload.mode,
      feature: payload.featureData,
      changeRecords: [
        this.createChangeRecord({
          kind: 'delete',
          feature: payload.featureData,
          before: payload.featureData.getGeoJson(),
          after: null,
          reason: 'feature.removed',
        }),
      ],
      historyEntryId: this.resolveHistoryEntryId(),
      transactionId: this.resolveTransactionId(),
      map: this.map,
    };
    await this.fireToMap({ type: 'converted', eventName: 'remove', payload: eventData });
  }

  async forwardFeatureUpdated(payload: GmEditFeatureUpdatedEvent) {
    const modeName = this.getConvertedEditModeName(payload.mode);
    const multiFeatureMode: Array<ModeName> = ['lasso'];
    const featuresPayload: FeatureUpdatedFwdEvent = {
      name: `${GM_PREFIX}:${modeName}`,
      actionType: payload.actionType,
      action: payload.action,
      map: this.map,
      changeRecords: this.createUpdateChangeRecords(payload),
      historyEntryId: this.resolveHistoryEntryId(),
      transactionId: this.resolveTransactionId(),
    };

    if (payload.sourceFeatures.length === 1 && !multiFeatureMode.includes(payload.mode)) {
      featuresPayload.originalFeature = payload.sourceFeatures[0];
    } else {
      featuresPayload.originalFeatures = payload.sourceFeatures;
    }

    if (payload.targetFeatures.length === 1 && !multiFeatureMode.includes(payload.mode)) {
      featuresPayload.feature = payload.targetFeatures[0];
      featuresPayload.shape = featuresPayload.feature.shape;
    } else {
      featuresPayload.features = payload.targetFeatures;
    }

    await this.fireToMap({ type: 'converted', eventName: `${modeName}`, payload: featuresPayload });
  }

  async forwardFeatureEditStart(payload: GmEditFeatureEditStartEvent) {
    const modeName = this.getConvertedEditModeName(payload.mode);
    const eventData: FeatureEditStartFwdEvent = {
      name: `${GM_PREFIX}:${modeName}start`,
      actionType: payload.actionType,
      action: payload.action,
      shape: payload.feature.shape,
      feature: payload.feature,
      map: this.map,
    };
    await this.fireToMap({ type: 'converted', eventName: `${modeName}start`, payload: eventData });
  }

  async forwardFeatureEditEnd(payload: GmEditFeatureEditEndEvent) {
    const modeName = this.getConvertedEditModeName(payload.mode);
    const eventData: FeatureEditEndFwdEvent = {
      name: `${GM_PREFIX}:${modeName}end`,
      actionType: payload.actionType,
      action: payload.action,
      shape: payload.feature.shape,
      feature: payload.feature,
      map: this.map,
    };
    await this.fireToMap({ type: 'converted', eventName: `${modeName}end`, payload: eventData });
  }

  async forwardGeomanLoaded(inputPayload: GmControlLoadEvent) {
    const payload: SystemFwdEvent = {
      name: `${GM_PREFIX}:${inputPayload.action}`,
      actionType: inputPayload.actionType,
      action: inputPayload.action,
      map: this.map,
      [GM_PREFIX]: this.gm,
    };

    await this.fireToMap({
      type: 'converted',
      eventName: `${payload.action}`,
      payload,
    });
  }

  async forwardSelection(payload: GmHelperSelectionEvent) {
    if (payload.action === 'selected') {
      const eventName = 'select';
      const eventData: SelectFwdEvent = {
        name: `${GM_PREFIX}:${eventName}`,
        actionType: payload.actionType,
        action: payload.action,
        feature: payload.feature,
        previousFeature: payload.previousFeature,
        reason: payload.reason,
        map: this.map,
      };

      await this.fireToMap({
        type: 'converted',
        eventName,
        payload: eventData,
      });
      return;
    }

    const eventName = 'deselect';
    const eventData: DeselectFwdEvent = {
      name: `${GM_PREFIX}:${eventName}`,
      actionType: payload.actionType,
      action: payload.action,
      feature: payload.feature,
      previousFeature: payload.previousFeature,
      reason: payload.reason,
      map: this.map,
    };

    await this.fireToMap({
      type: 'converted',
      eventName,
      payload: eventData,
    });
  }

  async forwardFeatureHover(payload: GmHelperFeatureHoverEvent) {
    const eventName = 'featurehover';
    const eventData: FeatureHoverFwdEvent = {
      name: `${GM_PREFIX}:${eventName}`,
      actionType: payload.actionType,
      action: payload.action,
      mode: payload.mode,
      feature: payload.feature,
      previousFeature: payload.previousFeature,
      sourceName: payload.sourceName,
      point: payload.point,
      lngLat: payload.lngLat,
      originalEvent: payload.originalEvent,
      map: this.map,
    };

    await this.fireToMap({ type: 'converted', eventName, payload: eventData });
  }

  async forwardFeatureHoverEnd(payload: GmHelperFeatureHoverEndEvent) {
    const eventName = 'featurehoverend';
    const eventData: FeatureHoverEndFwdEvent = {
      name: `${GM_PREFIX}:${eventName}`,
      actionType: payload.actionType,
      action: payload.action,
      mode: payload.mode,
      feature: payload.feature,
      reason: payload.reason,
      map: this.map,
    };

    await this.fireToMap({ type: 'converted', eventName, payload: eventData });
  }

  async forwardFeatureClick(payload: GmHelperFeatureClickEvent) {
    const eventName = 'featureclick';
    const eventData: FeatureClickFwdEvent = {
      name: `${GM_PREFIX}:${eventName}`,
      actionType: payload.actionType,
      action: payload.action,
      mode: payload.mode,
      feature: payload.feature,
      sourceName: payload.sourceName,
      point: payload.point,
      lngLat: payload.lngLat,
      originalEvent: payload.originalEvent,
      map: this.map,
    };

    await this.fireToMap({ type: 'converted', eventName, payload: eventData });
  }

  async forwardMapBlankClick(payload: GmHelperMapBlankClickEvent) {
    const eventName = 'mapblankclick';
    const eventData: MapBlankClickFwdEvent = {
      name: `${GM_PREFIX}:${eventName}`,
      actionType: payload.actionType,
      action: payload.action,
      mode: payload.mode,
      point: payload.point,
      lngLat: payload.lngLat,
      originalEvent: payload.originalEvent,
      map: this.map,
    };

    await this.fireToMap({ type: 'converted', eventName, payload: eventData });
  }

  async forwardToolLifecycle(payload: GmHelperToolLifecycleEvent) {
    if (payload.action === 'tool_start') {
      const eventName = 'toolstart';
      const eventData: ToolStartFwdEvent = {
        name: `${GM_PREFIX}:${eventName}`,
        actionType: payload.actionType,
        action: payload.action,
        toolId: payload.toolId,
        map: this.map,
      };

      await this.fireToMap({ type: 'converted', eventName, payload: eventData });
      return;
    }

    if (payload.action === 'tool_end') {
      const eventName = 'toolend';
      const eventData: ToolEndFwdEvent = {
        name: `${GM_PREFIX}:${eventName}`,
        actionType: payload.actionType,
        action: payload.action,
        toolId: payload.toolId,
        map: this.map,
      };

      await this.fireToMap({ type: 'converted', eventName, payload: eventData });
      return;
    }

    const eventName = 'toolcancel';
    const eventData: ToolCancelFwdEvent = {
      name: `${GM_PREFIX}:${eventName}`,
      actionType: payload.actionType,
      action: payload.action,
      toolId: payload.toolId,
      reason: payload.reason,
      map: this.map,
    };

    await this.fireToMap({ type: 'converted', eventName, payload: eventData });
  }

  async fireToMap({
    type,
    eventName,
    payload,
  }:
    | { type: 'system'; eventName: GmEventNameWithoutPrefix; payload: GmSystemEvent }
    | { type: 'converted'; eventName: GmFwdEventName; payload: GmEvent }): Promise<void> {
    const prefix = type === 'system' ? GM_SYSTEM_PREFIX : GM_PREFIX;
    const eventNameWithPrefix = `${prefix}:${eventName}`;

    // Wait for pending source updates when the setting is enabled and
    // the payload contains a feature with a source. This ensures feature
    // data is accessible in event handlers via exportGeoJson().
    // Users can disable this via settings.awaitDataUpdatesOnEvents for faster async updates.
    const shouldAwaitUpdates =
      this.gm.options.settings.awaitDataUpdatesOnEvents &&
      this.getPayloadSourceNames(payload).length > 0;

    if (shouldAwaitUpdates) {
      for (const sourceName of this.getPayloadSourceNames(payload)) {
        await this.gm.features.updateManager.waitForPendingUpdates(sourceName);
      }
    }

    this.globalEventsListener?.(payload);
    this.gm.mapAdapter.fire(eventNameWithPrefix as AnyEventName, payload);
  }

  getConvertedEditModeName(mode: EditModeName): FwdEditModeName {
    return mode === 'change' ? 'edit' : mode;
  }

  private createUpdateChangeRecords(
    payload: GmEditFeatureUpdatedEvent,
  ): GeomanFeatureMutationRecord[] {
    return payload.targetFeatures.map((targetFeature, index) => {
      const sourceFeature = payload.sourceFeatures[index] ?? targetFeature;
      const historyOperation = this.getLastHistoryOperation(index, 'update', targetFeature);
      const sourceGeoJson =
        payload.sourceGeoJsonFeatures?.[index] ??
        historyOperation?.before ??
        sourceFeature.getGeoJson();
      const targetGeoJson = historyOperation?.after ?? targetFeature.getGeoJson();
      return this.createChangeRecord({
        kind: 'update',
        feature: targetFeature,
        before: sourceGeoJson,
        after: targetGeoJson,
        reason: `edit.${payload.mode}`,
      });
    });
  }

  private getLastHistoryOperation(
    index: number,
    kind: GeomanFeatureMutationRecord['kind'],
    feature: FeatureData,
  ): GeomanHistoryEntry['operations'][number] | null {
    const history = (this.gm as { history?: { getLastRecordedEntry?: () => unknown } }).history;
    const entry = history?.getLastRecordedEntry?.();

    if (!entry || typeof entry !== 'object' || !('operations' in entry)) {
      return null;
    }

    const operation = (entry as GeomanHistoryEntry).operations[index];
    if (!operation || operation.kind !== kind) {
      return null;
    }

    if (
      operation.ref.sourceName !== feature.sourceName ||
      String(operation.ref.featureId) !== String(feature.id)
    ) {
      return null;
    }

    return operation;
  }

  private resolveHistoryEntryId(): string | null {
    const history = (
      this.gm as {
        history?: {
          consumeLastRecordedEntryId?: () => unknown;
          getLastRecordedEntryId?: () => unknown;
        };
      }
    ).history;
    const historyEntryId =
      history?.consumeLastRecordedEntryId?.() ?? history?.getLastRecordedEntryId?.();

    return typeof historyEntryId === 'string' ? historyEntryId : null;
  }

  private resolveTransactionId(): string | null {
    const transactions = (
      this.gm as { transactions?: { getActive?: () => { id?: unknown } | null | undefined } }
    ).transactions;
    const transactionId = transactions?.getActive?.()?.id;

    return typeof transactionId === 'string' ? transactionId : null;
  }

  private createChangeRecord({
    kind,
    feature,
    before,
    after,
    reason,
  }: {
    kind: GeomanFeatureMutationRecord['kind'];
    feature: FeatureData;
    before: GeomanFeatureMutationRecord['before'];
    after: GeomanFeatureMutationRecord['after'];
    reason: string;
  }): GeomanFeatureMutationRecord {
    return {
      id: `gm-event-change:${feature.sourceName}:${String(feature.id)}:${kind}`,
      kind,
      ref: {
        sourceName: feature.sourceName,
        featureId: feature.id,
      },
      before: before ? cloneDeep(before) : null,
      after: after ? cloneDeep(after) : null,
      reason,
      groupId: null,
      timestamp: Date.now(),
    };
  }

  private getPayloadSourceNames(payload: GmSystemEvent | GmEvent): FeatureSourceName[] {
    const sourceNames = new Set<FeatureSourceName>();
    const addFeature = (feature: unknown) => {
      if (
        feature &&
        typeof feature === 'object' &&
        'source' in feature &&
        (feature as FeatureData).source?.id
      ) {
        sourceNames.add((feature as FeatureData).source.id as FeatureSourceName);
      }
    };
    const record = payload as Record<string, unknown>;

    addFeature(record.feature);
    addFeature(record.originalFeature);

    if (Array.isArray(record.features)) {
      record.features.forEach(addFeature);
    }
    if (Array.isArray(record.originalFeatures)) {
      record.originalFeatures.forEach(addFeature);
    }

    return Array.from(sourceNames);
  }
}

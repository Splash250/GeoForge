import { GM_SYSTEM_PREFIX } from '@/core/constants.ts';
import {
  isHelperFeatureHoverEvent,
  isHelperToolLifecycleEvent,
  isSelectionEvent,
} from '@/core/events/forwarder/guards.ts';
import { SOURCES } from '@/core/features/constants.ts';
import { describe, expect, it } from 'vitest';

const feature = { id: 'feature-1' };
const pointerPayload = {
  point: { x: 1, y: 2 },
  lngLat: { lng: 3, lat: 4 },
  originalEvent: { type: 'click' },
};

describe('event forwarder guards', () => {
  it('accepts selected payloads and rejects selected payloads without previousFeature', () => {
    const selectedPayload = {
      name: `${GM_SYSTEM_PREFIX}:helper:selection`,
      level: 'system',
      actionType: 'helper',
      action: 'selected',
      mode: 'click_to_edit',
      feature,
      previousFeature: null,
      reason: 'feature-click',
    };

    expect(isSelectionEvent(selectedPayload as never)).toBe(true);
    expect(isSelectionEvent({ ...selectedPayload, previousFeature: undefined } as never)).toBe(
      false,
    );
  });

  it('accepts feature hover payloads from known sources and rejects unknown sources', () => {
    const hoverPayload = {
      name: `${GM_SYSTEM_PREFIX}:helper:feature_hover`,
      level: 'system',
      actionType: 'helper',
      action: 'feature_hover',
      mode: 'click_to_edit',
      feature,
      previousFeature: null,
      sourceName: SOURCES.main,
      ...pointerPayload,
    };

    expect(isHelperFeatureHoverEvent(hoverPayload as never)).toBe(true);
    expect(
      isHelperFeatureHoverEvent({ ...hoverPayload, sourceName: 'unknown-source' } as never),
    ).toBe(false);
  });

  it('accepts tool lifecycle payloads with api cancel reason and rejects invalid tool payloads', () => {
    const startPayload = {
      name: `${GM_SYSTEM_PREFIX}:helper:tool_start`,
      level: 'system',
      actionType: 'helper',
      action: 'tool_start',
      toolId: 'inspect-feature',
    };
    const endPayload = {
      ...startPayload,
      name: `${GM_SYSTEM_PREFIX}:helper:tool_end`,
      action: 'tool_end',
    };
    const cancelPayload = {
      ...startPayload,
      name: `${GM_SYSTEM_PREFIX}:helper:tool_cancel`,
      action: 'tool_cancel',
      reason: 'api',
    };

    expect(isHelperToolLifecycleEvent(startPayload as never)).toBe(true);
    expect(isHelperToolLifecycleEvent(endPayload as never)).toBe(true);
    expect(isHelperToolLifecycleEvent(cancelPayload as never)).toBe(true);
    expect(isHelperToolLifecycleEvent({ ...startPayload, toolId: '' } as never)).toBe(false);
    expect(isHelperToolLifecycleEvent({ ...cancelPayload, reason: 'unknown' } as never)).toBe(
      false,
    );
  });
});

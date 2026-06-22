import { describe, expect, test, vi } from 'vitest';
import type { DemoContext } from '../../examples/playground/src/demo-studio/registry/types.ts';

type OverlayPointerInspectorProps = {
  state: {
    interactable: boolean;
    pointerMode: 'selected' | 'always' | 'none';
    mapPitched: boolean;
  };
  onStateChange: (state: OverlayPointerInspectorProps['state']) => void;
  onPitchToggle: () => void;
  onReset: () => void;
};

vi.mock(
  '../../examples/playground/src/demo-studio/demos/overlays/OverlayInspector.svelte',
  () => ({
    default: {},
  }),
);
vi.mock(
  '../../examples/playground/src/demo-studio/demos/overlays/OverlayPointerInspector.svelte',
  () => ({
    default: {},
  }),
);

describe('overlay pointer modes demo', () => {
  test('registers a Demo Studio replacement for the legacy pointer mode controls', async () => {
    const { overlayDemos } = await import(
      '../../examples/playground/src/demo-studio/demos/overlays/overlayDemos.ts'
    );

    expect(overlayDemos.map((demo) => demo.id)).toContain('overlays-pointer-modes');
    expect(overlayDemos.find((demo) => demo.id === 'overlays-pointer-modes')).toMatchObject({
      title: 'Overlay pointer modes',
    });
  });

  test('syncs pointer state, pitches the map, resets defaults, and tears down overlay state', async () => {
    const { overlayDemos } = await import(
      '../../examples/playground/src/demo-studio/demos/overlays/overlayDemos.ts'
    );
    const demo = overlayDemos.find((candidate) => candidate.id === 'overlays-pointer-modes');
    expect(demo).toBeDefined();

    const addedOverlays: unknown[] = [];
    const selectedIds: Array<string | null> = [];
    const pitchCalls: unknown[] = [];
    const inspectorProps: OverlayPointerInspectorProps[] = [];
    let pitch = 0;
    const context: DemoContext = {
      geoForge: {
        overlays: {
          html: {
            add: vi.fn((definition) => addedOverlays.push(definition)),
            setSelected: vi.fn((id) => selectedIds.push(id)),
            destroy: vi.fn(),
          },
        },
      } as unknown as DemoContext['geoForge'],
      map: {
        getPitch: vi.fn(() => pitch),
        easeTo: vi.fn((options) => {
          pitchCalls.push(options);
          pitch = Number((options as { pitch?: number }).pitch ?? pitch);
        }),
      } as unknown as DemoContext['map'],
      signal: new AbortController().signal,
      isCurrent: () => true,
      setInspectorProps: (props) => inspectorProps.push(props as OverlayPointerInspectorProps),
      setCode: vi.fn(),
      logEvent: vi.fn(),
      notify: vi.fn(),
    };

    const result = await Promise.resolve(demo!.setup(context));
    const initialProps = result.inspectorProps as OverlayPointerInspectorProps;

    expect(initialProps.state).toEqual({
      interactable: true,
      pointerMode: 'selected',
      mapPitched: false,
    });
    expect(addedOverlays.at(-1)).toMatchObject({
      id: 'overlays-pointer-modes-sample',
      selected: true,
      visible: true,
      iframe: {
        interactable: true,
        pointerMode: 'selected',
      },
    });
    expect(selectedIds.at(-1)).toBe('overlays-pointer-modes-sample');

    initialProps.onStateChange({
      interactable: false,
      pointerMode: 'always',
      mapPitched: false,
    });

    expect(addedOverlays.at(-1)).toMatchObject({
      iframe: {
        interactable: false,
        pointerMode: 'always',
      },
    });

    inspectorProps.at(-1)?.onPitchToggle();

    expect(pitchCalls.at(-1)).toMatchObject({ pitch: 58, bearing: -18 });
    expect(inspectorProps.at(-1)?.state.mapPitched).toBe(true);

    inspectorProps.at(-1)?.onReset();

    expect(addedOverlays.at(-1)).toMatchObject({
      iframe: {
        interactable: true,
        pointerMode: 'selected',
      },
    });
    expect(pitchCalls.at(-1)).toMatchObject({ pitch: 0, bearing: 0 });
    expect(inspectorProps.at(-1)?.state).toEqual({
      interactable: true,
      pointerMode: 'selected',
      mapPitched: false,
    });

    result.teardown();

    expect(context.geoForge.overlays.html.destroy).toHaveBeenCalledTimes(1);
    expect(context.map.easeTo).toHaveBeenLastCalledWith({ pitch: 0, bearing: 0, duration: 0 });
  });
});

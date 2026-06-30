import { describe, expect, it, vi } from 'vitest';
import type { Feature } from 'geojson';
import { GeomanLineDecoratorSubsystem } from '../../../src/decorators/line/geomanLineDecoratorSubsystem.ts';
import type { LineDecoratorManager } from '../../../src/decorators/line/lineDecoratorManager.ts';
import type { LineDecoratorOptions } from '../../../src/decorators/line/types.ts';
import type { Geoman } from '../../../src/main.ts';

type ManagerMock = Pick<
  LineDecoratorManager,
  'bindToGeoman' | 'clear' | 'destroy' | 'updateFromFeatures'
>;

function createManagerMock(overrides: Partial<ManagerMock> = {}): LineDecoratorManager {
  return {
    bindToGeoman: vi.fn(),
    clear: vi.fn(),
    destroy: vi.fn(),
    updateFromFeatures: vi.fn(),
    ...overrides,
  } as unknown as LineDecoratorManager;
}

function createLineFeature(id = 'line-1'): Feature {
  return {
    type: 'Feature',
    id,
    geometry: {
      type: 'LineString',
      coordinates: [
        [0, 0],
        [1, 1],
      ],
    },
    properties: {},
  };
}

function createSubsystem(
  options: {
    geoman?: Partial<Geoman>;
    managerFactory?: ReturnType<typeof vi.fn>;
    map?: unknown;
  } = {},
) {
  return new GeomanLineDecoratorSubsystem({
    geoman: { destroyed: false, ...options.geoman } as unknown as Geoman,
    getMap: () => (options.map ?? {}) as never,
    managerFactory: options.managerFactory,
  });
}

describe('line decorator authoring session', () => {
  it('syncs configured features and cloned decorators through the line decorator subsystem', () => {
    const updateFromFeatures = vi.fn();
    const managerFactory = vi.fn(() => createManagerMock({ updateFromFeatures }));
    const feature = createLineFeature();
    const decorator: LineDecoratorOptions = {
      kind: 'symbol',
      imageId: 'arrow',
      rotate: { mode: 'line', angle: -90 },
    };
    const subsystem = createSubsystem({ managerFactory });
    const authoring = subsystem.createAuthoringSession({
      features: [feature],
      decorators: [decorator],
      layerPosition: 'above-lines',
    });

    if (decorator.kind === 'symbol' && decorator.rotate) {
      decorator.rotate.angle = 45;
    }
    authoring.sync();

    const resolveDecorators = updateFromFeatures.mock.calls[0][1] as (
      feature: Feature,
    ) => LineDecoratorOptions[];
    expect(managerFactory).toHaveBeenCalledWith(
      expect.objectContaining({ layerPosition: 'above-lines' }),
    );
    expect(updateFromFeatures).toHaveBeenCalledWith([feature], expect.any(Function));
    expect(resolveDecorators(feature)).toMatchObject([
      { kind: 'symbol', imageId: 'arrow', rotate: { mode: 'line', angle: -90 } },
    ]);
  });

  it('updates imported feature line style without history when history suspension is available', () => {
    const suspend = vi.fn(<T>(callback: () => T) => callback());
    const updateProperties = vi.fn();
    const featureData = {
      getGeoJson: () => createLineFeature(),
      updateProperties,
    };
    const subsystem = createSubsystem({
      geoman: { history: { suspend } } as unknown as Geoman,
    });
    const authoring = subsystem.createAuthoringSession({ features: [featureData] });

    authoring.setLineStyle({ color: '#123456', width: 8, opacity: 0.5 });

    expect(suspend).toHaveBeenCalledTimes(1);
    expect(updateProperties).toHaveBeenCalledWith({
      lineColor: '#123456',
      lineWidth: 8,
      lineOpacity: 0.5,
    });
  });

  it('can replace features, decorators, and layer position before syncing', () => {
    const firstDestroy = vi.fn();
    const secondUpdateFromFeatures = vi.fn();
    const managers = [
      createManagerMock({ destroy: firstDestroy }),
      createManagerMock({ updateFromFeatures: secondUpdateFromFeatures }),
    ];
    const managerFactory = vi.fn(() => managers.shift() ?? createManagerMock());
    const firstFeature = createLineFeature('first');
    const secondFeature = createLineFeature('second');
    const subsystem = createSubsystem({ managerFactory });
    const authoring = subsystem.createAuthoringSession({
      features: [firstFeature],
      decorators: [{ kind: 'text', text: 'OLD' }],
      layerPosition: 'below-lines',
    });

    authoring.sync();
    authoring.setFeatures([secondFeature]);
    authoring.setDecorators(() => [{ kind: 'text', text: 'NEW' }]);
    authoring.setLayerPosition('above-lines');
    authoring.sync();

    const resolveDecorators = secondUpdateFromFeatures.mock.calls[0][1] as (
      feature: Feature,
    ) => LineDecoratorOptions[];
    expect(managerFactory).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ layerPosition: 'below-lines' }),
    );
    expect(firstDestroy).toHaveBeenCalledTimes(1);
    expect(managerFactory).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ layerPosition: 'above-lines' }),
    );
    expect(secondUpdateFromFeatures).toHaveBeenCalledWith([secondFeature], expect.any(Function));
    expect(resolveDecorators(secondFeature)).toEqual([{ kind: 'text', text: 'NEW' }]);
  });

  it('clears only the active authoring render output on dispose and blocks later use', () => {
    const clear = vi.fn();
    const destroy = vi.fn();
    const managerFactory = vi.fn(() => createManagerMock({ clear, destroy }));
    const subsystem = createSubsystem({ managerFactory });
    const authoring = subsystem.createAuthoringSession({
      features: [createLineFeature()],
      decorators: [{ kind: 'text', text: 'FLOW' }],
    });

    authoring.sync();
    authoring.dispose();
    authoring.dispose();

    expect(clear).toHaveBeenCalledTimes(1);
    expect(destroy).not.toHaveBeenCalled();
    expect(() => authoring.sync()).toThrow('Line decorator authoring session is disposed.');
  });

  it('guards the shared manual renderer to one authoring session at a time', () => {
    const subsystem = createSubsystem();
    const first = subsystem.createAuthoringSession({ features: [] });

    expect(() => subsystem.createAuthoringSession({ features: [] })).toThrow(
      'A line decorator authoring session is already active.',
    );

    first.dispose();
    expect(() => subsystem.createAuthoringSession({ features: [] })).not.toThrow();
  });

  it('registers, updates, removes, and rejects SVG symbol images with session cleanup', async () => {
    const images = new Map<string, unknown>();
    const calls: unknown[] = [];
    const map = {
      hasImage: (id: string) => images.has(id),
      addImage: (id: string, image: unknown) => {
        calls.push(['addImage', id, image]);
        images.set(id, image);
      },
      updateImage: (id: string, image: unknown) => {
        calls.push(['updateImage', id, image]);
        images.set(id, image);
      },
      removeImage: (id: string) => {
        calls.push(['removeImage', id]);
        images.delete(id);
      },
    };
    const subsystem = createSubsystem({ map });
    const authoring = subsystem.createAuthoringSession({ features: [] });
    const loadImage = vi.fn(async (svg: string) => ({
      width: 1,
      height: 1,
      data: new Uint8Array(4),
      svg,
    }));

    await expect(
      authoring.registerSvgSymbolImage({
        id: 'custom-arrow',
        svg: '<span>not svg</span>',
        loadImage,
      }),
    ).resolves.toMatchObject({ ok: false, reason: 'invalid-svg' });
    await expect(
      authoring.registerSvgSymbolImage({
        id: 'custom-arrow',
        svg: '<svg xmlns="http://www.w3.org/2000/svg"><path /></svg>',
        loadImage,
      }),
    ).resolves.toMatchObject({ ok: true, action: 'added' });
    await expect(
      authoring.registerSvgSymbolImage({
        id: 'custom-arrow',
        svg: '<svg xmlns="http://www.w3.org/2000/svg"><circle /></svg>',
        loadImage,
      }),
    ).resolves.toMatchObject({ ok: true, action: 'updated' });

    authoring.unregisterSvgSymbolImage('custom-arrow');
    authoring.dispose();

    expect(calls).toEqual([
      [
        'addImage',
        'custom-arrow',
        expect.objectContaining({
          svg: '<svg xmlns="http://www.w3.org/2000/svg"><path /></svg>',
        }),
      ],
      [
        'updateImage',
        'custom-arrow',
        expect.objectContaining({
          svg: '<svg xmlns="http://www.w3.org/2000/svg"><circle /></svg>',
        }),
      ],
      ['removeImage', 'custom-arrow'],
    ]);
    expect(images.has('custom-arrow')).toBe(false);
  });
});

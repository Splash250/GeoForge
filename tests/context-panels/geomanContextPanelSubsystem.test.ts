// @vitest-environment jsdom

import { describe, expect, test, vi } from 'vitest';
import { ContextPanelManager } from '../../src/context-panels/contextPanelManager.ts';
import { GeomanContextPanelSubsystem } from '../../src/context-panels/geomanContextPanelSubsystem.ts';
import type { FeatureData } from '../../src/core/features/feature-data.ts';
import type { Geoman } from '../../src/main.ts';
import type {
  GeomanTransaction,
  GeomanTransactionCommitResult,
} from '../../src/transactions/index.ts';

function createGeomanStub() {
  const container = document.createElement('div');
  const map = { id: 'map' };

  document.body.appendChild(container);

  return {
    geoman: {
      mapAdapter: {
        getContainer: vi.fn(() => container),
        getMapInstance: vi.fn(() => map),
      },
    } as unknown as Geoman,
    container,
  };
}

function createTransactionGeomanStub() {
  const base = createGeomanStub();
  type StartTransactionOptions = {
    id: string;
    validate?: (transaction: GeomanTransaction) => unknown;
  };
  const createTransaction = (id: string) => {
    const transaction = {
      id,
      status: 'active' as GeomanTransaction['status'],
      isDirty: vi.fn(() => true),
      getChanges: vi.fn(() => []),
      commit: vi.fn<() => GeomanTransactionCommitResult>(() => {
        transaction.status = 'committed';

        return { committed: true, messages: [] };
      }),
      cancel: vi.fn(() => {
        transaction.status = 'cancelled';
      }),
    };

    return transaction;
  };
  const transaction = createTransaction('panel-transaction');
  const startedTransactions = [] as Array<ReturnType<typeof createTransaction>>;
  const transactions = {
    start: vi.fn(({ id }: StartTransactionOptions) => {
      const nextTransaction =
        startedTransactions.length === 0 ? transaction : createTransaction(id);

      nextTransaction.id = id;
      nextTransaction.status = 'active';
      startedTransactions.push(nextTransaction);

      return nextTransaction;
    }),
    getActive: vi.fn(() => startedTransactions.find((item) => item.status === 'active') ?? null),
  };

  return {
    ...base,
    transaction,
    startedTransactions,
    geoman: {
      ...base.geoman,
      transactions,
    } as unknown as Geoman,
    transactions,
  };
}

describe('GeomanContextPanelSubsystem', () => {
  test('opens one registered panel and renders content in the map container', () => {
    const { geoman, container } = createGeomanStub();
    const subsystem = new GeomanContextPanelSubsystem({ geoman });

    subsystem.register({
      id: 'details',
      title: 'Details',
      render: ({ map }) => `<p>Panel for ${(map as { id: string }).id}</p>`,
    });

    subsystem.open('details');

    const panel = container.querySelector<HTMLElement>('.gm-context-panel');

    expect(panel).not.toBeNull();
    expect(panel?.dataset.panelId).toBe('details');
    expect(panel?.getAttribute('role')).toBe('region');
    expect(panel?.querySelector('.gm-context-panel__title')?.textContent).toBe('Details');
    expect(panel?.querySelector('.gm-context-panel__body')?.innerHTML).toBe('<p>Panel for map</p>');
  });

  test('opens panel as a named region and moves focus into the first field', () => {
    const trigger = document.createElement('button');
    trigger.textContent = 'Open panel';
    document.body.appendChild(trigger);
    trigger.focus();

    const { geoman, container } = createGeomanStub();
    const subsystem = new GeomanContextPanelSubsystem({ geoman });

    subsystem.register({
      id: 'details',
      title: 'Details',
      render: () => {
        const input = document.createElement('input');
        input.type = 'text';
        input.setAttribute('aria-label', 'segmentValue');
        return input;
      },
    });

    subsystem.open('details');

    const panel = container.querySelector<HTMLElement>('.gm-context-panel');
    const title = container.querySelector<HTMLElement>('.gm-context-panel__title');
    const input = container.querySelector<HTMLInputElement>('input');

    expect(panel?.getAttribute('role')).toBe('region');
    expect(panel?.getAttribute('aria-labelledby')).toBe(title?.id);
    expect(title?.id).toMatch(/^gm-context-panel-title-/);
    expect(document.activeElement).toBe(input);
  });

  test('restores focus to the previously focused element when panel closes', () => {
    const trigger = document.createElement('button');
    trigger.textContent = 'Open panel';
    document.body.appendChild(trigger);
    trigger.focus();

    const { geoman, container } = createGeomanStub();
    const subsystem = new GeomanContextPanelSubsystem({ geoman });

    subsystem.register({
      id: 'details',
      title: 'Details',
      render: () => {
        const input = document.createElement('input');
        input.type = 'text';
        input.setAttribute('aria-label', 'segmentValue');
        return input;
      },
    });

    subsystem.open('details');
    expect(document.activeElement).not.toBe(trigger);

    subsystem.close();

    expect(container.querySelector('.gm-context-panel')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  test('Escape closes the panel and restores focus', () => {
    const trigger = document.createElement('button');
    trigger.textContent = 'Open panel';
    document.body.appendChild(trigger);
    trigger.focus();

    const { geoman, container } = createGeomanStub();
    const subsystem = new GeomanContextPanelSubsystem({ geoman });

    subsystem.register({
      id: 'details',
      title: 'Details',
      render: () => '<p>Details panel</p>',
    });

    subsystem.open('details');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(container.querySelector('.gm-context-panel')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  test('destroy removes the panel without restoring focus', () => {
    const trigger = document.createElement('button');
    trigger.textContent = 'Open panel';
    document.body.appendChild(trigger);
    trigger.focus();

    const { geoman, container } = createGeomanStub();
    const onClose = vi.fn();
    const subsystem = new GeomanContextPanelSubsystem({ geoman });

    subsystem.register({
      id: 'details',
      title: 'Details',
      render: () => {
        const input = document.createElement('input');
        input.type = 'text';
        input.setAttribute('aria-label', 'segmentValue');
        return input;
      },
      onClose,
    });

    subsystem.open('details');
    expect(document.activeElement).not.toBe(trigger);

    subsystem.destroy();

    expect(container.querySelector('.gm-context-panel')).toBeNull();
    expect(subsystem.getAll()).toEqual([]);
    expect(document.activeElement).not.toBe(trigger);
    expect(onClose).toHaveBeenCalledWith({
      reason: 'destroy',
      state: expect.objectContaining({ id: 'details' }),
    });
  });

  test('destroy clears the stored restore target when the manager is reused', () => {
    const triggerA = document.createElement('button');
    const triggerB = document.createElement('button');
    triggerA.textContent = 'Open panel A';
    triggerB.textContent = 'Open panel B';
    document.body.append(triggerA, triggerB);
    triggerA.focus();

    const { geoman } = createGeomanStub();
    const manager = new ContextPanelManager({ mapAdapter: geoman.mapAdapter });
    const managerFactory = vi.fn(() => manager);
    const firstSubsystem = new GeomanContextPanelSubsystem({ geoman, managerFactory });

    firstSubsystem.register({
      id: 'details',
      title: 'Details',
      render: () => {
        const input = document.createElement('input');
        input.type = 'text';
        input.setAttribute('aria-label', 'First field');
        return input;
      },
    });

    firstSubsystem.open('details');
    firstSubsystem.destroy();

    triggerB.focus();

    const secondSubsystem = new GeomanContextPanelSubsystem({ geoman, managerFactory });

    secondSubsystem.register({
      id: 'details',
      title: 'Details',
      render: () => {
        const input = document.createElement('input');
        input.type = 'text';
        input.setAttribute('aria-label', 'Second field');
        return input;
      },
    });

    secondSubsystem.open('details');
    secondSubsystem.close();

    expect(document.activeElement).toBe(triggerB);
  });

  test('sanitizes string render results before inserting panel HTML', () => {
    const { geoman, container } = createGeomanStub();
    const subsystem = new GeomanContextPanelSubsystem({ geoman });

    subsystem.register({
      id: 'unsafe-details',
      title: 'Unsafe Details',
      render: () =>
        '<p onclick="window.__unsafeClicked = true">Safe text</p><img src=x onerror="window.__unsafeImage = true">',
    });

    subsystem.open('unsafe-details');

    const body = container.querySelector<HTMLElement>('.gm-context-panel__body');

    expect(body?.textContent).toContain('Safe text');
    expect(body?.querySelector('p')?.getAttribute('onclick')).toBeNull();
    expect(body?.querySelector('img')?.getAttribute('onerror')).toBeNull();
  });

  test('opening a second panel replaces the first panel', () => {
    const { geoman, container } = createGeomanStub();
    const subsystem = new GeomanContextPanelSubsystem({ geoman });

    subsystem
      .register({
        id: 'first',
        title: 'First',
        render: () => '<p>first panel</p>',
      })
      .register({
        id: 'second',
        title: 'Second',
        render: () => '<p>second panel</p>',
      });

    subsystem.open('first');
    subsystem.open('second');

    expect(container.querySelectorAll('.gm-context-panel')).toHaveLength(1);
    expect(container.querySelector('.gm-context-panel')?.getAttribute('data-panel-id')).toBe(
      'second',
    );
    expect(container.textContent).not.toContain('first panel');
    expect(container.textContent).toContain('second panel');
  });

  test('opening a second panel does not restore focus to the original trigger', () => {
    const trigger = document.createElement('button');
    trigger.textContent = 'Open panel';
    document.body.appendChild(trigger);
    trigger.focus();

    const { geoman, container } = createGeomanStub();
    const onFirstClose = vi.fn(() => {
      expect(document.activeElement).not.toBe(trigger);
    });
    const subsystem = new GeomanContextPanelSubsystem({ geoman });

    subsystem
      .register({
        id: 'first',
        title: 'First',
        render: () => {
          const input = document.createElement('input');
          input.type = 'text';
          input.setAttribute('aria-label', 'First field');
          return input;
        },
        onClose: onFirstClose,
      })
      .register({
        id: 'second',
        title: 'Second',
        render: () => {
          const input = document.createElement('input');
          input.type = 'text';
          input.setAttribute('aria-label', 'Second field');
          return input;
        },
      });

    subsystem.open('first');
    subsystem.open('second');

    const secondInput = container.querySelector<HTMLInputElement>(
      'input[aria-label="Second field"]',
    );

    expect(onFirstClose).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: 'replacement',
        state: expect.objectContaining({ id: 'first' }),
      }),
    );
    expect(document.activeElement).toBe(secondInput);
  });

  test('closing a replacement panel restores focus to the original trigger', () => {
    const trigger = document.createElement('button');
    trigger.textContent = 'Open panel';
    document.body.appendChild(trigger);
    trigger.focus();

    const { geoman, container } = createGeomanStub();
    const subsystem = new GeomanContextPanelSubsystem({ geoman });

    subsystem
      .register({
        id: 'first',
        title: 'First',
        render: () => {
          const input = document.createElement('input');
          input.type = 'text';
          input.setAttribute('aria-label', 'First field');
          return input;
        },
      })
      .register({
        id: 'second',
        title: 'Second',
        render: () => {
          const input = document.createElement('input');
          input.type = 'text';
          input.setAttribute('aria-label', 'Second field');
          return input;
        },
      });

    subsystem.open('first');
    subsystem.open('second');
    subsystem.close();

    expect(container.querySelector('.gm-context-panel')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  test('close removes panel DOM and destroy clears registry', () => {
    const { geoman, container } = createGeomanStub();
    const subsystem = new GeomanContextPanelSubsystem({ geoman });

    subsystem.register({
      id: 'details',
      title: 'Details',
      render: () => {
        const content = document.createElement('div');

        content.textContent = 'details panel';

        return content;
      },
    });

    subsystem.open('details');
    subsystem.close();

    expect(container.querySelector('.gm-context-panel')).toBeNull();

    subsystem.open('details');
    subsystem.destroy();

    expect(container.querySelector('.gm-context-panel')).toBeNull();
    expect(subsystem.getAll()).toEqual([]);
  });

  test('calls panel onClose with reason and previous state when closing', () => {
    const { geoman } = createGeomanStub();
    const onClose = vi.fn();
    const contextPanels = new GeomanContextPanelSubsystem({ geoman });

    contextPanels.register({
      id: 'feature-info',
      title: 'Feature Info',
      render: () => 'Open',
      onClose,
    });
    contextPanels.open('feature-info', { label: 'Line A' });
    contextPanels.close('api');

    expect(onClose).toHaveBeenCalledWith({
      reason: 'api',
      state: expect.objectContaining({
        id: 'feature-info',
        title: 'Feature Info',
        data: { label: 'Line A' },
      }),
    });

    contextPanels.register({ id: 'other', title: 'Other', render: () => 'Other' });
    contextPanels.open('feature-info');
    contextPanels.open('other');

    expect(onClose).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: 'replacement',
        state: expect.objectContaining({ id: 'feature-info' }),
      }),
    );
  });

  test('calls panel onClose with destroy reason before clearing definitions', () => {
    const { geoman } = createGeomanStub();
    const onClose = vi.fn();
    const contextPanels = new GeomanContextPanelSubsystem({ geoman });

    contextPanels.register({
      id: 'feature-info',
      title: 'Feature Info',
      render: () => 'Open',
      onClose,
    });
    contextPanels.open('feature-info', { label: 'Line A' });
    contextPanels.destroy();

    expect(onClose).toHaveBeenCalledWith({
      reason: 'destroy',
      state: expect.objectContaining({
        id: 'feature-info',
        title: 'Feature Info',
        data: { label: 'Line A' },
      }),
    });
    expect(contextPanels.getAll()).toEqual([]);

    const emptyContextPanels = new GeomanContextPanelSubsystem({ geoman });

    emptyContextPanels.register({
      id: 'feature-info',
      title: 'Feature Info',
      render: () => 'Open',
      onClose,
    });
    onClose.mockClear();
    emptyContextPanels.destroy();

    expect(onClose).not.toHaveBeenCalled();
  });

  test('update rerenders the open panel with merged data', () => {
    const { geoman, container } = createGeomanStub();
    const contextPanels = new GeomanContextPanelSubsystem({ geoman });

    contextPanels.register({
      id: 'segment-value-editor',
      title: 'Segment Value Editor',
      render: ({ data }) => {
        const output = document.createElement('output');
        output.textContent = `${String(data.segmentValue ?? 'Not set')} ${String(data.label ?? 'Unlabeled')}`;
        return output;
      },
    });

    contextPanels.open('segment-value-editor', { segmentValue: 300, label: 'Line A' });
    contextPanels.update({ segmentValue: 450 });

    expect(container.querySelector('output')?.textContent).toBe('450 Line A');
    expect(contextPanels.getState()).toEqual(
      expect.objectContaining({
        id: 'segment-value-editor',
        data: { segmentValue: 450, label: 'Line A' },
      }),
    );
  });

  test('update is a no-op when no panel is open', () => {
    const { geoman } = createGeomanStub();
    const contextPanels = new GeomanContextPanelSubsystem({ geoman });

    expect(contextPanels.update({ segmentValue: 450 })).toBe(contextPanels);
    expect(contextPanels.getState()).toBeNull();
  });

  test('update does not notify onClose for the current panel', () => {
    const { geoman } = createGeomanStub();
    const onClose = vi.fn();
    const contextPanels = new GeomanContextPanelSubsystem({ geoman });

    contextPanels.register({
      id: 'segment-value-editor',
      title: 'Segment Value Editor',
      render: () => 'Open',
      onClose,
    });

    contextPanels.open('segment-value-editor', { segmentValue: 300 });
    contextPanels.update({ segmentValue: 450 });

    expect(onClose).not.toHaveBeenCalled();
  });

  test('update refreshes featureRef when feature data changes', () => {
    const { geoman } = createGeomanStub();
    const contextPanels = new GeomanContextPanelSubsystem({ geoman });
    const originalFeature = { id: 'line-1', sourceName: 'gm_main' };
    const nextFeature = { id: 'line-2', sourceName: 'gm_standby' };

    contextPanels.register({
      id: 'feature-info',
      title: 'Feature Info',
      render: () => 'Open',
    });

    contextPanels.open('feature-info', { feature: originalFeature as never });
    contextPanels.update({ feature: nextFeature as never });

    expect(contextPanels.getState()).toEqual(
      expect.objectContaining({
        featureRef: { id: 'line-2', sourceName: 'gm_standby' },
      }),
    );
  });

  test('clearRemovedFeature closes an open panel for the removed feature', () => {
    const { geoman } = createGeomanStub();
    const contextPanels = new GeomanContextPanelSubsystem({ geoman: geoman as never });
    const feature = { id: 'line-1', sourceName: 'gm_main' };

    contextPanels.register({ id: 'feature-info', title: 'Feature Info', render: () => 'Open' });
    contextPanels.open('feature-info', { feature: feature as never });
    contextPanels.clearRemovedFeature(feature as never);

    expect(contextPanels.getState()).toBeNull();
  });

  test('clearRemovedFeature keeps panel open when a different source has the same feature id', () => {
    const { geoman } = createGeomanStub();
    const contextPanels = new GeomanContextPanelSubsystem({ geoman });
    const panelFeature = { id: 'shared-id', sourceName: 'gm_main' };
    const removedFeature = { id: 'shared-id', sourceName: 'gm_temporary' };

    contextPanels.register({ id: 'feature-info', title: 'Feature Info', render: () => 'Open' });
    contextPanels.open('feature-info', { feature: panelFeature as never });
    contextPanels.clearRemovedFeature(removedFeature as never);

    expect(contextPanels.getState()).toEqual(
      expect.objectContaining({
        id: 'feature-info',
        featureRef: { id: 'shared-id', sourceName: 'gm_main' },
      }),
    );
  });

  test('passes null transaction context to panels without a transaction binding', () => {
    const { geoman } = createGeomanStub();
    const contextPanels = new GeomanContextPanelSubsystem({ geoman });
    const render = vi.fn(() => 'Open');

    contextPanels.register({
      id: 'details',
      title: 'Details',
      render,
    });
    contextPanels.open('details');

    expect(render).toHaveBeenCalledWith(
      expect.objectContaining({
        geoman,
        transaction: null,
      }),
    );
  });

  test('starts a panel transaction and passes transaction context to render', () => {
    const { geoman, transactions, transaction } = createTransactionGeomanStub();
    const contextPanels = new GeomanContextPanelSubsystem({ geoman });
    const render = vi.fn(() => 'Open');

    contextPanels.register({
      id: 'segment-value-editor',
      title: 'Segment Value Editor',
      transaction: { id: 'segment-value-edit' },
      render,
    });
    contextPanels.open('segment-value-editor', { segmentValue: 300 });

    expect(transactions.start).toHaveBeenCalledWith({
      id: 'segment-value-edit',
      validate: expect.any(Function),
    });
    expect(render).toHaveBeenCalledWith(
      expect.objectContaining({
        geoman,
        transaction: expect.objectContaining({
          current: transaction,
          validation: { messages: [], hasErrors: false },
          isDirty: expect.any(Function),
          commit: expect.any(Function),
          cancel: expect.any(Function),
        }),
      }),
    );
  });

  test('commits a panel transaction and closes by default when commit succeeds', () => {
    const { geoman, transaction } = createTransactionGeomanStub();
    const contextPanels = new GeomanContextPanelSubsystem({ geoman });
    let commitPanel = (): unknown => {
      throw new Error('commit callback was not assigned');
    };

    contextPanels.register({
      id: 'segment-value-editor',
      title: 'Segment Value Editor',
      transaction: { id: 'segment-value-edit', closeOnCommit: true },
      render: ({ transaction: panelTransaction }) => {
        commitPanel = () => panelTransaction!.commit();
        return 'Open';
      },
    });
    contextPanels.open('segment-value-editor');

    expect(commitPanel()).toEqual({ committed: true, messages: [] });
    expect(transaction.commit).toHaveBeenCalledTimes(1);
    expect(contextPanels.getState()).toBeNull();
  });

  test('keeps panel open and exposes validation messages when commit fails', () => {
    const { geoman, transaction, container } = createTransactionGeomanStub();
    transaction.commit.mockReturnValue({
      committed: false,
      messages: ['Segment value is required'],
    });
    const contextPanels = new GeomanContextPanelSubsystem({ geoman });
    let commitPanel = (): unknown => {
      throw new Error('commit callback was not assigned');
    };

    contextPanels.register({
      id: 'segment-value-editor',
      title: 'Segment Value Editor',
      transaction: { id: 'segment-value-edit', closeOnCommit: true },
      render: ({ transaction: panelTransaction }) => {
        commitPanel = () => panelTransaction!.commit();
        return panelTransaction?.validation.messages.join(', ') || 'Open';
      },
    });
    contextPanels.open('segment-value-editor');

    expect(commitPanel()).toEqual({ committed: false, messages: ['Segment value is required'] });
    expect(contextPanels.getState()).toEqual(
      expect.objectContaining({ id: 'segment-value-editor' }),
    );
    expect(container.textContent).toContain('Segment value is required');
  });

  test('cancels panel transaction and refreshes data when cancel requests refresh', () => {
    const { geoman, container, transaction } = createTransactionGeomanStub();
    const contextPanels = new GeomanContextPanelSubsystem({ geoman });
    let cancelPanel = (): void => {
      throw new Error('cancel callback was not assigned');
    };

    contextPanels.register({
      id: 'segment-value-editor',
      title: 'Segment Value Editor',
      transaction: {
        id: 'segment-value-edit',
        refreshData: () => ({ segmentValue: 300 }),
      },
      render: ({ data, transaction: panelTransaction }) => {
        cancelPanel = () => panelTransaction!.cancel({ refresh: true });
        return `Segment value ${String(data.segmentValue ?? 'unset')}`;
      },
    });
    contextPanels.open('segment-value-editor', { segmentValue: 450 });
    cancelPanel();

    expect(transaction.cancel).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('Segment value 300');
    expect(contextPanels.getState()).toEqual(
      expect.objectContaining({ data: { segmentValue: 300 } }),
    );
  });

  test('cancels panel transaction and rerenders active panel when cancel does not close or refresh', () => {
    const { geoman, container, transaction } = createTransactionGeomanStub();
    const contextPanels = new GeomanContextPanelSubsystem({ geoman });
    let renderCount = 0;
    let cancelPanel = (): void => {
      throw new Error('cancel callback was not assigned');
    };

    contextPanels.register({
      id: 'segment-value-editor',
      title: 'Segment Value Editor',
      transaction: { id: 'segment-value-edit' },
      render: ({ transaction: panelTransaction }) => {
        renderCount += 1;
        cancelPanel = () => panelTransaction!.cancel();
        return `Render ${renderCount}`;
      },
    });
    contextPanels.open('segment-value-editor');
    cancelPanel();

    expect(transaction.cancel).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('Render 2');
    expect(contextPanels.getState()).toEqual(
      expect.objectContaining({ id: 'segment-value-editor' }),
    );
  });

  test('closes immediately without refreshing when cancel requests close and refresh', () => {
    const { geoman, container, transaction } = createTransactionGeomanStub();
    const contextPanels = new GeomanContextPanelSubsystem({ geoman });
    const refreshData = vi.fn(() => ({ segmentValue: 300 }));
    const render = vi.fn(({ transaction: panelTransaction }) => {
      cancelPanel = () => panelTransaction!.cancel({ close: true, refresh: true });
      return 'Open';
    });
    let cancelPanel = (): void => {
      throw new Error('cancel callback was not assigned');
    };

    contextPanels.register({
      id: 'segment-value-editor',
      title: 'Segment Value Editor',
      transaction: {
        id: 'segment-value-edit',
        refreshData,
      },
      render,
    });
    contextPanels.open('segment-value-editor');
    cancelPanel();

    expect(transaction.cancel).toHaveBeenCalledTimes(1);
    expect(refreshData).not.toHaveBeenCalled();
    expect(render).toHaveBeenCalledTimes(1);
    expect(container.querySelector('.gm-context-panel')).toBeNull();
    expect(contextPanels.getState()).toBeNull();
  });

  test('applies cancel close behavior when transaction panel closes by Escape', () => {
    const { geoman, transaction } = createTransactionGeomanStub();
    const contextPanels = new GeomanContextPanelSubsystem({ geoman });

    contextPanels.register({
      id: 'segment-value-editor',
      title: 'Segment Value Editor',
      transaction: { id: 'segment-value-edit', closeBehavior: 'cancel' },
      render: () => 'Open',
    });
    contextPanels.open('segment-value-editor');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(transaction.cancel).toHaveBeenCalledTimes(1);
    expect(contextPanels.getState()).toBeNull();
  });

  test('cancels transaction when a transaction panel is replaced', () => {
    const { geoman, transaction } = createTransactionGeomanStub();
    const contextPanels = new GeomanContextPanelSubsystem({ geoman });

    contextPanels
      .register({
        id: 'first',
        title: 'First',
        transaction: { id: 'first-edit', closeBehavior: 'cancel' },
        render: () => 'First',
      })
      .register({ id: 'second', title: 'Second', render: () => 'Second' });

    contextPanels.open('first');
    contextPanels.open('second');

    expect(transaction.cancel).toHaveBeenCalledTimes(1);
    expect(contextPanels.getState()).toEqual(expect.objectContaining({ id: 'second' }));
  });

  test('cancels transaction when the bound feature is removed', () => {
    const { geoman, transaction } = createTransactionGeomanStub();
    const contextPanels = new GeomanContextPanelSubsystem({ geoman });
    const feature = { id: 'feature-1', sourceName: 'line-source' } as FeatureData;

    contextPanels.register({
      id: 'segment-value-editor',
      title: 'Segment Value Editor',
      transaction: { id: 'segment-value-edit' },
      render: () => 'Open',
    });
    contextPanels.open('segment-value-editor', { feature });
    contextPanels.clearRemovedFeature(feature);

    expect(transaction.cancel).toHaveBeenCalledTimes(1);
    expect(contextPanels.getState()).toBeNull();
  });

  test('cancels transaction when subsystem is destroyed', () => {
    const { geoman, transaction } = createTransactionGeomanStub();
    const contextPanels = new GeomanContextPanelSubsystem({ geoman });

    contextPanels.register({
      id: 'segment-value-editor',
      title: 'Segment Value Editor',
      transaction: { id: 'segment-value-edit' },
      render: () => 'Open',
    });
    contextPanels.open('segment-value-editor');
    contextPanels.destroy();

    expect(transaction.cancel).toHaveBeenCalledTimes(1);
    expect(contextPanels.getState()).toBeNull();
    expect(contextPanels.getAll()).toEqual([]);
  });

  test('keeps active transaction when closeBehavior is keep-active', () => {
    const { geoman, transaction, transactions } = createTransactionGeomanStub();
    const contextPanels = new GeomanContextPanelSubsystem({ geoman });

    contextPanels.register({
      id: 'long-edit',
      title: 'Long Edit',
      transaction: { id: 'long-edit', closeBehavior: 'keep-active' },
      render: () => 'Open',
    });

    contextPanels.open('long-edit');
    contextPanels.close('api');

    expect(transaction.cancel).not.toHaveBeenCalled();
    expect(transaction.commit).not.toHaveBeenCalled();
    expect(transactions.getActive()).toBe(transaction);
    expect(contextPanels.getState()).toBeNull();
  });

  test('uses custom close behavior with close reason', () => {
    const { geoman, transaction } = createTransactionGeomanStub();
    const closeBehavior = vi.fn();
    const contextPanels = new GeomanContextPanelSubsystem({ geoman });

    contextPanels.register({
      id: 'custom-edit',
      title: 'Custom Edit',
      transaction: { id: 'custom-edit', closeBehavior },
      render: () => 'Open',
    });

    contextPanels.open('custom-edit');
    contextPanels.close('blank-map');

    expect(closeBehavior).toHaveBeenCalledWith({
      reason: 'blank-map',
      transaction,
    });
    expect(contextPanels.getState()).toBeNull();
  });

  test('commits then cancels active transaction when close commit fails validation', () => {
    const { geoman, transaction, transactions } = createTransactionGeomanStub();
    transaction.commit.mockReturnValue({
      committed: false,
      messages: ['Segment value is required'],
    });
    const contextPanels = new GeomanContextPanelSubsystem({ geoman });

    contextPanels.register({
      id: 'segment-value-editor',
      title: 'Segment Value Editor',
      transaction: { id: 'segment-value-edit', closeBehavior: 'commit' },
      render: () => 'Open',
    });
    contextPanels.open('segment-value-editor');
    contextPanels.close('api');

    expect(transaction.commit).toHaveBeenCalledTimes(1);
    expect(transaction.cancel).toHaveBeenCalledTimes(1);
    expect(transaction.status).toBe('cancelled');
    expect(contextPanels.getState()).toBeNull();

    contextPanels.open('segment-value-editor');
    expect(transactions.start).toHaveBeenCalledTimes(2);
  });

  test('starts a fresh panel transaction when data-derived transaction id changes', () => {
    const { geoman, startedTransactions, transactions } = createTransactionGeomanStub();
    const contextPanels = new GeomanContextPanelSubsystem({ geoman });
    const renderTransactionIds: string[] = [];
    const validate = vi.fn(() => undefined);

    contextPanels.register({
      id: 'segment-value-editor',
      title: 'Segment Value Editor',
      transaction: {
        id: ({ data }) => `segment-value-edit:${String(data.segmentId)}`,
        closeBehavior: 'cancel',
        validate,
      },
      render: ({ transaction: panelTransaction }) => {
        renderTransactionIds.push(panelTransaction!.current.id);
        return 'Open';
      },
    });
    contextPanels.open('segment-value-editor', { segmentId: 'segment-a' });
    contextPanels.update({ segmentId: 'segment-b' });

    expect(startedTransactions).toHaveLength(2);
    expect(startedTransactions[0]?.cancel).toHaveBeenCalledTimes(1);
    expect(startedTransactions[0]?.status).toBe('cancelled');
    expect(startedTransactions[1]?.status).toBe('active');
    expect(renderTransactionIds).toEqual([
      'segment-value-edit:segment-a',
      'segment-value-edit:segment-b',
    ]);

    const secondValidate = transactions.start.mock.calls[1]?.[0].validate;
    secondValidate?.(startedTransactions[1] as unknown as GeomanTransaction);

    expect(validate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ segmentId: 'segment-b' }),
        transaction: startedTransactions[1],
      }),
    );
  });

  test('rerenders with a fresh active transaction after successful commit keeps panel open', () => {
    const { geoman, container, startedTransactions } = createTransactionGeomanStub();
    const contextPanels = new GeomanContextPanelSubsystem({ geoman });
    const renderTransactions: GeomanTransaction[] = [];
    let commitPanel = (): GeomanTransactionCommitResult => {
      throw new Error('commit callback was not assigned');
    };

    contextPanels.register({
      id: 'segment-value-editor',
      title: 'Segment Value Editor',
      transaction: { id: 'segment-value-edit', closeOnCommit: false },
      render: ({ transaction: panelTransaction }) => {
        renderTransactions.push(panelTransaction!.current);
        commitPanel = () => panelTransaction!.commit();
        return `Render ${renderTransactions.length}`;
      },
    });
    contextPanels.open('segment-value-editor');

    expect(commitPanel()).toEqual({ committed: true, messages: [] });

    expect(startedTransactions).toHaveLength(2);
    expect(renderTransactions).toHaveLength(2);
    expect(renderTransactions[0]?.status).toBe('committed');
    expect(renderTransactions[1]).not.toBe(renderTransactions[0]);
    expect(renderTransactions[1]?.status).toBe('active');
    expect(container.textContent).toContain('Render 2');
    expect(contextPanels.getState()).toEqual(
      expect.objectContaining({ id: 'segment-value-editor' }),
    );
  });
});

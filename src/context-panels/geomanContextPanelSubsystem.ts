import type { FeatureData } from '@/core/features/feature-data.ts';
import type { Geoman } from '@/main.ts';
import type { GeomanTransaction, GeomanTransactionCommitResult } from '@/transactions/index.ts';
import { ContextPanelManager } from './contextPanelManager.ts';
import type {
  GeomanContextPanelCloseReason,
  GeomanContextPanelDefinition,
  GeomanContextPanelOpenData,
  GeomanContextPanelRenderContext,
  GeomanContextPanelState,
  GeomanContextPanelTransactionRenderContext,
} from './types.ts';

export type GeomanContextPanelManager = Pick<ContextPanelManager, 'clear' | 'destroy' | 'render'>;

export type GeomanContextPanelSubsystemOptions = {
  geoman: Geoman;
  managerFactory?: (options: { mapAdapter: Geoman['mapAdapter'] }) => GeomanContextPanelManager;
};

export class GeomanContextPanelSubsystem {
  private readonly geoman: Geoman;
  private readonly managerFactory: (options: {
    mapAdapter: Geoman['mapAdapter'];
  }) => GeomanContextPanelManager;
  private readonly definitions = new Map<string, GeomanContextPanelDefinition>();
  private manager: GeomanContextPanelManager | null = null;
  private state: GeomanContextPanelState = null;
  private panelTransaction: {
    panelId: string;
    transactionId: string;
    transaction: GeomanTransaction;
    validationMessages: string[];
  } | null = null;

  constructor(options: GeomanContextPanelSubsystemOptions) {
    this.geoman = options.geoman;
    this.managerFactory =
      options.managerFactory ?? ((managerOptions) => new ContextPanelManager(managerOptions));
  }

  register(definition: GeomanContextPanelDefinition) {
    if (this.definitions.has(definition.id)) {
      throw new Error(`Geoman context panel "${definition.id}" is already registered`);
    }

    this.definitions.set(definition.id, definition);
    return this;
  }

  unregister(id: string) {
    if (this.state?.id === id) {
      this.close('api');
    }

    this.definitions.delete(id);
    return this;
  }

  open<TData extends GeomanContextPanelOpenData = GeomanContextPanelOpenData>(
    id: string,
    data: TData = {} as TData,
  ) {
    const definition = this.getRegisteredDefinition<TData>(id);

    if (this.state) {
      this.closePanel('replacement', { preserveRestoreFocusElement: true, restoreFocus: false });
    }

    this.getManager().render(definition, this.buildRenderContext(definition, data));

    this.state = {
      id: definition.id,
      title: definition.title,
      placement: definition.placement ?? 'right',
      featureRef: this.getFeatureRef(data.feature),
      data,
    };

    return this;
  }

  update<TData extends GeomanContextPanelOpenData = GeomanContextPanelOpenData>(
    data: Partial<TData> = {},
  ) {
    const previousState = this.state;

    if (!previousState) {
      return this;
    }

    const nextData = {
      ...previousState.data,
      ...data,
    } as TData;
    const definition = this.getRegisteredDefinition<TData>(previousState.id);

    this.getManager().render(definition, this.buildRenderContext(definition, nextData));

    this.state = {
      ...previousState,
      featureRef: this.getFeatureRef(nextData.feature),
      data: nextData,
    };

    return this;
  }

  close(reason: GeomanContextPanelCloseReason = 'api') {
    return this.closePanel(reason);
  }

  get(id: string) {
    return this.definitions.get(id) ?? null;
  }

  getAll() {
    return Array.from(this.definitions.values());
  }

  getState() {
    return this.state;
  }

  clearRemovedFeature(feature: FeatureData) {
    const featureRef = this.state?.featureRef;

    if (featureRef?.id === feature.id && featureRef.sourceName === feature.sourceName) {
      this.close('feature-removed');
    }
  }

  destroy() {
    if (this.state) {
      this.closePanel('destroy', { restoreFocus: false });
    } else {
      this.manager?.destroy();
    }

    this.manager = null;
    this.definitions.clear();
  }

  private closePanel(
    reason: GeomanContextPanelCloseReason,
    options: { preserveRestoreFocusElement?: boolean; restoreFocus?: boolean } = {},
  ) {
    const previousState = this.state;

    if (previousState) {
      this.applyPanelTransactionCloseBehavior(previousState.id, reason);
    }

    this.manager?.clear(options);
    this.state = null;

    if (previousState) {
      this.definitions.get(previousState.id)?.onClose?.({
        reason,
        state: previousState,
      });
    }

    return this;
  }

  private buildRenderContext<TData extends GeomanContextPanelOpenData>(
    definition: GeomanContextPanelDefinition<TData>,
    data: TData,
  ): GeomanContextPanelRenderContext<TData> {
    return {
      id: definition.id,
      title: definition.title,
      data,
      feature: data.feature,
      geoman: this.geoman,
      map: this.geoman.mapAdapter.getMapInstance(),
      close: () => {
        this.close('api');
      },
      transaction: this.getOrCreatePanelTransaction(definition, data),
    };
  }

  private getOrCreatePanelTransaction<TData extends GeomanContextPanelOpenData>(
    definition: GeomanContextPanelDefinition<TData>,
    data: TData,
  ): GeomanContextPanelTransactionRenderContext | null {
    const transactionOptions = definition.transaction;

    if (!transactionOptions) {
      return null;
    }

    const transactionId =
      typeof transactionOptions.id === 'function'
        ? transactionOptions.id({
            id: definition.id,
            title: definition.title,
            data,
            feature: data.feature,
            geoman: this.geoman,
          })
        : (transactionOptions.id ?? `context-panel:${definition.id}`);

    if (
      this.panelTransaction?.panelId === definition.id &&
      this.panelTransaction.transactionId === transactionId &&
      this.panelTransaction.transaction.status === 'active'
    ) {
      return this.createPanelTransactionContext(
        definition,
        data,
        this.panelTransaction.transaction,
      );
    }

    if (this.panelTransaction?.panelId === definition.id) {
      if (this.panelTransaction.transaction.status === 'active') {
        this.applyPanelTransactionCloseBehavior(definition.id, 'replacement');
      } else {
        this.panelTransaction = null;
      }
    }

    const activeTransaction = this.geoman.transactions.getActive();
    const transaction =
      activeTransaction?.id === transactionId
        ? activeTransaction
        : this.geoman.transactions.start({
            id: transactionId,
            validate: (currentTransaction) =>
              transactionOptions.validate?.({
                id: definition.id,
                title: definition.title,
                data,
                feature: data.feature,
                geoman: this.geoman,
                transaction: currentTransaction as GeomanTransaction,
              }),
          });

    this.panelTransaction = {
      panelId: definition.id,
      transactionId,
      transaction,
      validationMessages: [],
    };

    return this.createPanelTransactionContext(definition, data, transaction);
  }

  private createPanelTransactionContext<TData extends GeomanContextPanelOpenData>(
    definition: GeomanContextPanelDefinition<TData>,
    data: TData,
    transaction: GeomanTransaction,
  ): GeomanContextPanelTransactionRenderContext {
    return {
      current: transaction,
      validation: {
        messages: this.panelTransaction?.validationMessages ?? [],
        hasErrors: !!this.panelTransaction?.validationMessages.length,
      },
      isDirty: () => transaction.isDirty(),
      commit: (options = {}) => this.commitPanelTransaction(definition, data, transaction, options),
      cancel: (options = {}) => {
        this.cancelPanelTransaction(definition, data, transaction, options);
      },
    };
  }

  private commitPanelTransaction<TData extends GeomanContextPanelOpenData>(
    definition: GeomanContextPanelDefinition<TData>,
    data: TData,
    transaction: GeomanTransaction,
    options: { close?: boolean },
  ): GeomanTransactionCommitResult {
    const result = transaction.commit();

    this.setPanelValidationMessages(result.messages);

    if (!result.committed) {
      this.renderActivePanel(definition, data);
      return result;
    }

    this.panelTransaction = null;

    if (options.close ?? definition.transaction?.closeOnCommit ?? false) {
      this.close('api');
      return result;
    }

    if (this.state?.id === definition.id) {
      this.renderActivePanel(definition, data);
    }

    return result;
  }

  private cancelPanelTransaction<TData extends GeomanContextPanelOpenData>(
    definition: GeomanContextPanelDefinition<TData>,
    data: TData,
    transaction: GeomanTransaction,
    options: { close?: boolean; refresh?: boolean },
  ): void {
    transaction.cancel();
    this.panelTransaction = null;

    if (options.close) {
      this.close('api');
      return;
    }

    let nextData = data;

    if (options.refresh) {
      const refreshData = definition.transaction?.refreshData?.({
        id: definition.id,
        title: definition.title,
        data,
        feature: data.feature,
        geoman: this.geoman,
        transaction,
        reason: 'cancel',
      });

      if (refreshData) {
        nextData = { ...data, ...refreshData } as TData;
      }
    }

    if (this.state?.id === definition.id) {
      this.renderActivePanel(definition, nextData);
    }
  }

  private renderActivePanel<TData extends GeomanContextPanelOpenData>(
    definition: GeomanContextPanelDefinition<TData>,
    data: TData,
  ): void {
    if (this.state?.id !== definition.id) {
      return;
    }

    this.getManager().render(definition, this.buildRenderContext(definition, data));
    this.state = {
      ...this.state,
      featureRef: this.getFeatureRef(data.feature),
      data,
    };
  }

  private setPanelValidationMessages(messages: string[]): void {
    if (!this.panelTransaction) {
      return;
    }

    this.panelTransaction = {
      ...this.panelTransaction,
      validationMessages: messages,
    };
  }

  private applyPanelTransactionCloseBehavior(
    panelId: string,
    reason: GeomanContextPanelCloseReason,
  ): void {
    const panelTransaction = this.panelTransaction;

    if (!panelTransaction || panelTransaction.panelId !== panelId) {
      return;
    }

    const definition = this.definitions.get(panelId);
    const behavior = definition?.transaction?.closeBehavior ?? 'cancel';

    if (behavior === 'cancel') {
      panelTransaction.transaction.cancel();
      this.panelTransaction = null;
      return;
    }

    if (behavior === 'commit') {
      const result = panelTransaction.transaction.commit();

      this.setPanelValidationMessages(result.messages);

      if (!result.committed) {
        panelTransaction.transaction.cancel();
      }

      this.panelTransaction = null;
      return;
    }

    if (behavior === 'keep-active') {
      this.panelTransaction = null;
      return;
    }

    behavior({ reason, transaction: panelTransaction.transaction });
    this.panelTransaction = null;
  }

  private getManager() {
    this.manager ??= this.managerFactory({ mapAdapter: this.geoman.mapAdapter });

    return this.manager;
  }

  private getFeatureRef(feature: FeatureData | undefined) {
    if (!feature) {
      return null;
    }

    return {
      id: feature.id,
      sourceName: feature.sourceName,
    };
  }

  private getRegisteredDefinition<TData extends GeomanContextPanelOpenData>(
    id: string,
  ): GeomanContextPanelDefinition<TData> {
    const definition = this.definitions.get(id);

    if (!definition) {
      throw new Error(`Geoman context panel "${id}" is not registered`);
    }

    return definition as GeomanContextPanelDefinition<TData>;
  }
}

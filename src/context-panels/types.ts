import type { FeatureData } from '@/core/features/feature-data.ts';
import type { Geoman } from '@/main.ts';
import type {
  GeomanTransaction,
  GeomanTransactionCommitResult,
  GeomanTransactionValidationResult,
} from '@/transactions/index.ts';
import type { FeatureId, FeatureSourceName } from '@/types/features.ts';
import type { AnyMapInstance, LngLatTuple, ScreenPoint } from '@/types/map/index.ts';

export type GeomanContextPanelPlacement = 'right';
export type GeomanContextPanelCloseReason =
  | 'api'
  | 'replacement'
  | 'blank-map'
  | 'tool-end'
  | 'draw-start'
  | 'feature-removed'
  | 'destroy';

export type GeomanContextPanelCloseEvent = {
  reason: GeomanContextPanelCloseReason;
  state: NonNullable<GeomanContextPanelState>;
};

export type GeomanContextPanelOpenData = Record<string, unknown> & {
  feature?: FeatureData;
  point?: ScreenPoint;
  lngLat?: { lng: number; lat: number } | LngLatTuple;
};

export type GeomanContextPanelFeatureRef = {
  id: FeatureId;
  sourceName: FeatureSourceName;
};

export type GeomanContextPanelTransactionCloseBehavior =
  | 'cancel'
  | 'commit'
  | 'keep-active'
  | ((context: GeomanContextPanelTransactionCloseContext) => void);

export type GeomanContextPanelTransactionDefinitionContext<
  TData extends GeomanContextPanelOpenData = GeomanContextPanelOpenData,
> = {
  id: string;
  title: string;
  data: TData;
  feature: TData['feature'] extends FeatureData ? TData['feature'] : FeatureData | undefined;
  geoman: Geoman;
};

export type GeomanContextPanelTransactionValidationContext<
  TData extends GeomanContextPanelOpenData = GeomanContextPanelOpenData,
> = GeomanContextPanelTransactionDefinitionContext<TData> & {
  transaction: GeomanTransaction;
};

export type GeomanContextPanelTransactionRefreshContext<
  TData extends GeomanContextPanelOpenData = GeomanContextPanelOpenData,
> = GeomanContextPanelTransactionDefinitionContext<TData> & {
  transaction: GeomanTransaction;
  reason: GeomanContextPanelCloseReason | 'cancel';
};

export type GeomanContextPanelTransactionCloseContext = {
  reason: GeomanContextPanelCloseReason;
  transaction: GeomanTransaction;
};

export type GeomanContextPanelTransactionOptions<
  TData extends GeomanContextPanelOpenData = GeomanContextPanelOpenData,
> = {
  id?: string | ((context: GeomanContextPanelTransactionDefinitionContext<TData>) => string);
  closeBehavior?: GeomanContextPanelTransactionCloseBehavior;
  closeOnCommit?: boolean;
  validate?: (
    context: GeomanContextPanelTransactionValidationContext<TData>,
  ) => GeomanTransactionValidationResult;
  refreshData?: (
    context: GeomanContextPanelTransactionRefreshContext<TData>,
  ) => Partial<TData> | void;
};

export type GeomanContextPanelTransactionRenderContext = {
  current: GeomanTransaction;
  validation: {
    messages: string[];
    hasErrors: boolean;
  };
  isDirty: () => boolean;
  commit: (options?: { close?: boolean }) => GeomanTransactionCommitResult;
  cancel: (options?: { close?: boolean; refresh?: boolean }) => void;
};

export type GeomanContextPanelRenderContext<
  TData extends GeomanContextPanelOpenData = GeomanContextPanelOpenData,
> = {
  id: string;
  title: string;
  data: TData;
  feature: TData['feature'] extends FeatureData ? TData['feature'] : FeatureData | undefined;
  geoman: Geoman;
  map: AnyMapInstance;
  close: () => void;
  transaction: GeomanContextPanelTransactionRenderContext | null;
};

/**
 * HTMLElement results are inserted directly. String render results are sanitized
 * before insertion so basic markup is supported without preserving scriptable
 * attributes. Return an HTMLElement and assign values with textContent when
 * rendering untrusted or highly structured data.
 */
export type GeomanContextPanelRenderResult = HTMLElement | string | void;

export type GeomanContextPanelDefinition<
  TData extends GeomanContextPanelOpenData = GeomanContextPanelOpenData,
> = {
  id: string;
  title: string;
  placement?: GeomanContextPanelPlacement;
  className?: string;
  transaction?: GeomanContextPanelTransactionOptions<TData>;
  render: (context: GeomanContextPanelRenderContext<TData>) => GeomanContextPanelRenderResult;
  onClose?: (event: GeomanContextPanelCloseEvent) => void;
};

export function defineGeomanContextPanel<TData extends GeomanContextPanelOpenData>(
  definition: GeomanContextPanelDefinition<TData>,
) {
  return definition;
}

export type GeomanContextPanelState = {
  id: string;
  title: string;
  placement: GeomanContextPanelPlacement;
  featureRef: GeomanContextPanelFeatureRef | null;
  data: GeomanContextPanelOpenData;
} | null;

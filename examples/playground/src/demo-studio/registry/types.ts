import type { GeoForge } from 'maplibre-geoforge';
import type { Map } from 'maplibre-gl';
import type { Component } from 'svelte';

export type DemoCategoryId =
  | 'draw-edit'
  | 'line-decorators'
  | 'overlays'
  | 'feature-data'
  | 'geometry-tools'
  | 'workflow-systems';

export type DemoContext = {
  map: Map;
  geoForge: InstanceType<typeof GeoForge>;
  notify: (toast: { title: string; body?: string; tone?: 'success' | 'error' | 'info' }) => void;
  logEvent: (event: { name: string; category: string; payload?: unknown }) => void;
  setInspectorProps: (props: Record<string, unknown>) => void;
  setCode: (code: string) => void;
  isCurrent: () => boolean;
  signal: AbortSignal;
};

export type DemoSetupResult = {
  inspectorProps?: Record<string, unknown>;
  code?: string;
  teardown: () => void;
};

export type DemoDefinition<TInspectorProps extends object = Record<string, unknown>> = {
  id: string;
  title: string;
  description: string;
  docsPath: string;
  sourcePath?: string;
  githubUrl?: string;
  code: () => string;
  inspector: Component<TInspectorProps>;
  setup: (context: DemoContext) => DemoSetupResult | Promise<DemoSetupResult>;
};

export type RegisteredDemoDefinition = DemoDefinition<never>;

export type DemoCategory = {
  id: DemoCategoryId;
  title: string;
  description: string;
  demos: RegisteredDemoDefinition[];
};

import { systemControls } from '@/core/controls/defaults.ts';
import { getDefaultOptions } from '@/core/options/defaults/index.ts';
import type { GmOptionsData, SystemControls } from '@/main.ts';
import type { GeomanToolControlState } from '@/tools/types.ts';
import { cloneDeep } from 'lodash-es';
import { writable, type Writable } from 'svelte/store';

export type ControlsStoreState = {
  controls: SystemControls;
  options: GmOptionsData['controls'];
  settings: GmOptionsData['settings'];
  toolControls: Array<GeomanToolControlState>;
};

export type ControlsStore = Writable<ControlsStoreState>;

export const controlsStoreContextKey = Symbol('gm-controls-store');

export const createControlsStore = (): ControlsStore => {
  const defaultOptions = getDefaultOptions();

  return writable({
    controls: cloneDeep(systemControls),
    options: defaultOptions.controls,
    settings: defaultOptions.settings,
    toolControls: [],
  });
};

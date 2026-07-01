<script lang="ts">
  import caretDown from '@/assets/images/controls2/caret-down.svg';
  import caretUp from '@/assets/images/controls2/caret-up.svg';
  import ActionControl from '@/core/controls/components/action-control.svelte';
  import {
    controlsStoreContextKey,
    type ControlsStore,
  } from '@/core/controls/components/controls-store.ts';
  import ToolControl from '@/core/controls/components/tool-control.svelte';
  import type { ActionType, GenericSystemControls, ModeName } from '@/main.ts';
  import { sanitizeSvgMarkup } from '@/utils/sanitizeSvgMarkup.ts';
  import { getContext } from 'svelte';
  import { slide } from 'svelte/transition';

  // const gm: Geoman = getContext('gm');
  const controlsStore = getContext<ControlsStore>(controlsStoreContextKey);
  let expanded = $state(true);
  let controlsCollapsible = $derived($controlsStore.settings.controlsCollapsible);
  let controlsStyles = $derived($controlsStore.settings.controlsStyles);
  let visibleToolControls = $derived(
    $controlsStore.toolControls.filter((toolControl) => toolControl.uiEnabled),
  );
  let toggleControlsLabel = $derived(
    expanded ? 'Hide Geoman controls' : 'Show Geoman controls',
  );
  let toggleControlsExpanded = $derived(String(expanded));

  const getControl = (groupKey: string, mode: string) => {
    const controlSection = (
      $controlsStore.controls?.[groupKey as ActionType] as GenericSystemControls | undefined
    );
    return controlSection?.[mode as ModeName] || null;
  };

  const hasVisibleControls = (groupKey: string, groupControls: Record<string, unknown>) => {
    return Object.entries(groupControls).some(([controlKey, controlOptions]) => {
      const control = getControl(groupKey, controlKey);
      return control && controlOptions && (controlOptions as { uiEnabled?: boolean }).uiEnabled;
    });
  };

  const toggleExpanded = () => {
    expanded = !expanded;
  };

  const getToggleExpandedIcon = () => {
    return sanitizeSvgMarkup(expanded ? caretDown : caretUp);
  };
</script>

<div class="gm-reactive-controls">
  {#if controlsCollapsible}
    <div class={`${controlsStyles.controlGroupClass} group-settings`}>
      <button
        type="button"
        class="gm-control-button"
        title={toggleControlsLabel}
        aria-label={toggleControlsLabel}
        aria-expanded={toggleControlsExpanded}
        onclick={toggleExpanded}>
        {@html getToggleExpandedIcon()}
      </button>
    </div>
  {/if}

  {#if expanded}
    <div in:slide={{ duration: 180 }} out:slide={{ duration: 140 }}>
      {#each Object.entries($controlsStore.options) as [groupKey, groupControls] (groupKey)}
        {#if hasVisibleControls(groupKey, groupControls)}
          <div class={`${controlsStyles.controlGroupClass} group-${groupKey}`}>
            {#each Object.entries(groupControls) as [controlKey, controlOptions] (controlKey)}
              {@const control = getControl(groupKey, controlKey)}
              {#if control}
                <ActionControl control={control} controlOptions={controlOptions} />
              {/if}
            {/each}
          </div>
        {/if}
      {/each}

      {#if visibleToolControls.length > 0}
        <div class={`${controlsStyles.controlGroupClass} group-tools`}>
          {#each visibleToolControls as toolControl (toolControl.toolId)}
            <ToolControl {toolControl} />
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
</style>

<script lang="ts">
  import {
    controlsStoreContextKey,
    type ControlsStore,
  } from '@/core/controls/components/controls-store.ts';
  import type { Geoman } from '@/main.ts';
  import type { GeomanToolControlState } from '@/tools/types.ts';
  import { sanitizeSvgMarkup } from '@/utils/sanitizeSvgMarkup.ts';
  import { getContext } from 'svelte';

  const { toolControl }: { toolControl: GeomanToolControlState } = $props();

  const gm: Geoman = getContext('gm');
  const controlsStore = getContext<ControlsStore>(controlsStoreContextKey);
  const sanitizedSvg = $derived(toolControl.icon ? sanitizeSvgMarkup(toolControl.icon) : null);
  const ariaPressed = $derived(
    toolControl.eventType === 'toggle' ? String(toolControl.active) : undefined,
  );

  const handleClick = () => {
    if (toolControl.eventType === 'toggle' && toolControl.active) {
      gm.tools.deactivate(toolControl.toolId);
      return;
    }

    gm.tools.activate(toolControl.toolId);
  };
</script>

{#if toolControl.uiEnabled}
  <div class={$controlsStore.settings.controlsStyles.controlContainerClass}>
    <button
      type="button"
      id={`id_tool_${toolControl.toolId}`}
      class={`${$controlsStore.settings.controlsStyles.controlButtonClass} tool-${toolControl.toolId}`}
      class:active={toolControl.active}
      title={toolControl.title}
      aria-label={toolControl.title}
      aria-pressed={ariaPressed}
      onclick={handleClick}>
      {#if sanitizedSvg}
        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
        {@html sanitizedSvg}
      {:else if toolControl.title}
        {toolControl.title.slice(0, 2)}
      {:else}
        {toolControl.toolId.slice(0, 2)}
      {/if}
    </button>
  </div>
{/if}

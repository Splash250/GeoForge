<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';

  type ControlRowProps = Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'class'> & {
    label: string;
    for?: string;
    labelId?: string;
    children?: Snippet;
    class?: string;
  };

  let {
    label,
    for: forId,
    labelId,
    children,
    class: className,
    ...restProps
  }: ControlRowProps = $props();
</script>

<div {...restProps} class={className}>
  {#if forId}
    <label for={forId}>{label}</label>
  {:else}
    <span id={labelId}>{label}</span>
  {/if}
  <strong>
    {@render children?.()}
  </strong>
</div>

<style>
  div {
    min-height: 40px;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    border-top: 1px solid var(--gf-line);
    padding: 8px 0;
    color: var(--gf-body);
    font-size: 13px;
    line-height: 1.35;
  }

  div:first-child {
    border-top: 0;
  }

  span,
  label {
    flex: 0 0 96px;
    min-width: 0;
    color: var(--gf-body);
    font-weight: 500;
    padding-top: 7px;
  }

  label {
    cursor: pointer;
  }

  strong {
    min-width: 0;
    flex: 1 1 auto;
    color: var(--gf-text);
    font-weight: 700;
    text-align: right;
    overflow-wrap: anywhere;
  }

  strong :global(fieldset) {
    width: 100%;
  }
</style>

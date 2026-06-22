<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';

  type IconButtonProps = Omit<
    HTMLButtonAttributes,
    'aria-pressed' | 'children' | 'class' | 'disabled' | 'title' | 'type'
  > & {
    children?: Snippet;
    label: string;
    active?: boolean;
    type?: HTMLButtonAttributes['type'];
    disabled?: boolean;
    class?: string;
    title?: string;
    'aria-pressed'?: HTMLButtonAttributes['aria-pressed'];
  };

  let {
    children,
    label,
    active,
    type = 'button',
    disabled = false,
    class: className,
    title,
    'aria-pressed': ariaPressed,
    ...restProps
  }: IconButtonProps = $props();
</script>

<button
  {...restProps}
  class={className}
  class:active={active === true}
  {type}
  {disabled}
  aria-label={label}
  aria-pressed={ariaPressed ?? (active === undefined ? undefined : active)}
  title={title ?? label}
>
  {@render children?.()}
</button>

<style>
  button {
    width: var(--gf-icon-control);
    height: var(--gf-icon-control);
    min-width: var(--gf-icon-control);
    min-height: var(--gf-icon-control);
    display: inline-grid;
    place-items: center;
    border: 1px solid var(--gf-line);
    border-radius: var(--gf-radius-tool);
    background: color-mix(in srgb, var(--gf-panel) 90%, transparent);
    color: var(--gf-text);
    line-height: 1;
    cursor: pointer;
    transition:
      border-color 140ms ease,
      background-color 140ms ease,
      color 140ms ease,
      opacity 140ms ease;
  }

  button:hover:not(:disabled) {
    border-color: color-mix(in srgb, var(--gf-body) 78%, var(--gf-text));
    background: var(--gf-raised);
  }

  button:disabled {
    cursor: not-allowed;
    color: var(--gf-muted);
    opacity: 0.5;
  }

  .active {
    border-color: var(--gf-blue);
    background: var(--gf-blue);
    color: var(--gf-text);
  }

  .active:hover:not(:disabled) {
    border-color: color-mix(in srgb, var(--gf-blue) 80%, var(--gf-text));
    background: color-mix(in srgb, var(--gf-blue) 80%, var(--gf-text));
  }
</style>

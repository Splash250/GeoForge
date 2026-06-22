<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';

  type Variant = 'primary' | 'secondary' | 'utility' | 'danger';

  type ButtonProps = Omit<
    HTMLButtonAttributes,
    'aria-busy' | 'aria-disabled' | 'children' | 'class' | 'disabled' | 'type'
  > & {
    children?: Snippet;
    variant?: Variant;
    loading?: boolean;
    type?: HTMLButtonAttributes['type'];
    disabled?: boolean;
    class?: string;
    'aria-busy'?: HTMLButtonAttributes['aria-busy'];
    'aria-disabled'?: HTMLButtonAttributes['aria-disabled'];
  };

  let {
    children,
    variant = 'secondary',
    loading = false,
    type = 'button',
    disabled = false,
    class: className,
    onclick,
    'aria-busy': ariaBusy,
    'aria-disabled': ariaDisabled,
    ...restProps
  }: ButtonProps = $props();

  function handleClick(event: MouseEvent) {
    if (loading || disabled) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    onclick?.(event);
  }
</script>

<button
  {...restProps}
  class={className}
  class:primary={variant === 'primary'}
  class:secondary={variant === 'secondary'}
  class:utility={variant === 'utility'}
  class:danger={variant === 'danger'}
  {type}
  {disabled}
  onclick={handleClick}
  aria-busy={loading ? 'true' : ariaBusy}
  aria-disabled={ariaDisabled ?? (loading ? 'true' : undefined)}
>
  {@render children?.()}
</button>

<style>
  button {
    min-width: max-content;
    min-height: var(--gf-control-height);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    border: 1px solid var(--gf-line);
    border-radius: var(--gf-radius-pill);
    padding: 0 16px;
    background: transparent;
    color: var(--gf-body);
    font-size: 13px;
    font-weight: 600;
    line-height: 1;
    white-space: nowrap;
    cursor: pointer;
    transition:
      border-color 140ms ease,
      background-color 140ms ease,
      color 140ms ease,
      opacity 140ms ease;
  }

  button:hover:not(:disabled) {
    border-color: color-mix(in srgb, var(--gf-body) 78%, var(--gf-text));
    color: var(--gf-text);
  }

  button:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }

  button[aria-busy='true'] {
    cursor: wait;
  }

  .primary {
    border-color: var(--gf-blue);
    background: var(--gf-blue);
    color: var(--gf-text);
  }

  .primary:hover:not(:disabled) {
    border-color: color-mix(in srgb, var(--gf-blue) 80%, var(--gf-text));
    background: color-mix(in srgb, var(--gf-blue) 80%, var(--gf-text));
    color: var(--gf-text);
  }

  .secondary {
    border-color: color-mix(in srgb, var(--gf-body) 78%, var(--gf-text));
    color: var(--gf-text);
  }

  .secondary:hover:not(:disabled) {
    background: color-mix(in srgb, var(--gf-body) 12%, transparent);
  }

  .utility {
    min-height: var(--gf-control-height);
    border-radius: var(--gf-radius-tool);
    background: var(--gf-raised);
    color: var(--gf-body);
  }

  .utility:hover:not(:disabled) {
    border-color: color-mix(in srgb, var(--gf-body) 78%, var(--gf-text));
    background: var(--gf-overlay);
    color: var(--gf-text);
  }

  .danger {
    border-color: color-mix(in srgb, var(--gf-red) 60%, transparent);
    color: color-mix(in srgb, var(--gf-red) 42%, var(--gf-text));
  }

  .danger:hover:not(:disabled) {
    border-color: var(--gf-red);
    background: color-mix(in srgb, var(--gf-red) 12%, transparent);
    color: var(--gf-text);
  }
</style>

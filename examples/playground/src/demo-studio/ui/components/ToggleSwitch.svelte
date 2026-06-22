<script lang="ts">
  import type { HTMLButtonAttributes } from 'svelte/elements';

  type ToggleSwitchProps = Omit<
    HTMLButtonAttributes,
    'aria-checked' | 'aria-label' | 'children' | 'class' | 'role' | 'type'
  > & {
    checked?: boolean;
    label: string;
    onChange?: (checked: boolean) => void;
    class?: string;
  };

  let {
    checked = $bindable(false),
    label,
    onChange = () => {},
    class: className,
    onclick,
    ...restProps
  }: ToggleSwitchProps = $props();

  function handleClick(event: MouseEvent) {
    checked = !checked;
    onChange(checked);
    onclick?.(event);
  }
</script>

<button
  {...restProps}
  class={className}
  class:checked
  type="button"
  role="switch"
  aria-checked={checked}
  aria-label={label}
  onclick={handleClick}
>
  <span aria-hidden="true"></span>
</button>

<style>
  button {
    width: 46px;
    min-width: 46px;
    height: 26px;
    min-height: 26px;
    display: inline-flex;
    align-items: center;
    border: 1px solid var(--gf-line);
    border-radius: var(--gf-radius-pill);
    padding: 2px;
    background: var(--gf-raised);
    cursor: pointer;
    transition:
      border-color 140ms ease,
      background-color 140ms ease,
      opacity 140ms ease;
  }

  button:hover:not(:disabled) {
    border-color: color-mix(in srgb, var(--gf-body) 78%, var(--gf-text));
  }

  button:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }

  span {
    width: 20px;
    height: 20px;
    display: block;
    border-radius: 50%;
    background: var(--gf-body);
    transform: translateX(0);
    transition:
      background-color 140ms ease,
      transform 140ms ease;
  }

  button.checked {
    border-color: var(--gf-blue);
    background: var(--gf-blue);
  }

  button.checked span {
    background: var(--gf-text);
    transform: translateX(20px);
  }
</style>

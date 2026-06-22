<script lang="ts">
  import type { HTMLFieldsetAttributes } from 'svelte/elements';

  type SegmentOption = {
    value: string;
    label: string;
  };

  type SegmentedControlProps = Omit<HTMLFieldsetAttributes, 'class'> & {
    label: string;
    value?: string;
    options: SegmentOption[];
    onChange?: (value: string) => void;
    class?: string;
  };

  let {
    label,
    value = $bindable(''),
    options,
    onChange = () => {},
    class: className,
    onkeydown,
    ...restProps
  }: SegmentedControlProps = $props();

  let fieldset: HTMLFieldSetElement;

  function selectOption(nextValue: string) {
    if (nextValue === value) return;

    value = nextValue;
    onChange(nextValue);
  }

  function handleKeydown(event: KeyboardEvent) {
    onkeydown?.(event);

    if (event.defaultPrevented || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      return;
    }

    const buttons = Array.from(fieldset.querySelectorAll<HTMLButtonElement>('button[data-value]'));
    const currentIndex = buttons.findIndex((button) => button === document.activeElement);

    if (currentIndex === -1 || buttons.length === 0) return;

    event.preventDefault();

    const nextIndex =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? buttons.length - 1
          : event.key === 'ArrowLeft'
            ? (currentIndex - 1 + buttons.length) % buttons.length
            : (currentIndex + 1) % buttons.length;

    buttons[nextIndex]?.focus();
    buttons[nextIndex]?.click();
  }
</script>

<fieldset {...restProps} bind:this={fieldset} class={className} onkeydown={handleKeydown}>
  <legend>{label}</legend>
  <div>
    {#each options as option}
      <button
        type="button"
        data-value={option.value}
        class:active={option.value === value}
        aria-pressed={option.value === value}
        onclick={() => selectOption(option.value)}
      >
        {option.label}
      </button>
    {/each}
  </div>
</fieldset>

<style>
  fieldset {
    min-width: 0;
  }

  legend {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
    border: 0;
    padding: 0;
  }

  div {
    width: 100%;
    min-height: var(--gf-control-height);
    display: flex;
    align-items: stretch;
    flex-wrap: wrap;
    gap: 3px;
    border: 1px solid var(--gf-line);
    border-radius: var(--gf-radius-pill);
    padding: 2px;
    background: var(--gf-raised);
  }

  button {
    flex: 1 1 auto;
    min-height: 28px;
    min-width: max-content;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid transparent;
    border-radius: var(--gf-radius-pill);
    padding: 0 8px;
    background: transparent;
    color: var(--gf-body);
    font-size: 11px;
    font-weight: 650;
    line-height: 1;
    white-space: nowrap;
    cursor: pointer;
    transition:
      border-color 140ms ease,
      background-color 140ms ease,
      color 140ms ease;
  }

  button:hover {
    color: var(--gf-text);
  }

  button.active {
    border-color: var(--gf-blue);
    background: var(--gf-blue);
    color: var(--gf-text);
  }

  button.active:hover {
    border-color: color-mix(in srgb, var(--gf-blue) 80%, var(--gf-text));
    background: color-mix(in srgb, var(--gf-blue) 80%, var(--gf-text));
  }

  @media (max-width: 420px) {
    div {
      justify-content: flex-start;
    }

    button {
      flex: 0 1 auto;
      min-width: 54px;
      padding: 0 7px;
    }
  }
</style>

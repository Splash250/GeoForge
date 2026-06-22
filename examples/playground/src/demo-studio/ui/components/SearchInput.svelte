<script lang="ts">
  import type { HTMLInputAttributes } from 'svelte/elements';

  type SearchInputProps = Omit<
    HTMLInputAttributes,
    'class' | 'placeholder' | 'type' | 'value'
  > & {
    value?: string;
    placeholder?: string;
    class?: string;
  };

  let {
    value = $bindable(''),
    placeholder = 'Search',
    class: className,
    oninput,
    ...restProps
  }: SearchInputProps = $props();

  function handleInput(event: Event) {
    oninput?.(event);
  }
</script>

<label class={className}>
  <span>Search</span>
  <input {...restProps} bind:value type="search" {placeholder} oninput={handleInput} />
</label>

<style>
  label {
    width: 100%;
    display: block;
  }

  span {
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

  input {
    width: 100%;
    min-height: var(--gf-control-height);
    border: 1px solid var(--gf-line);
    border-radius: var(--gf-radius-pill);
    padding: 0 14px;
    appearance: none;
    background: var(--gf-raised);
    color: var(--gf-text);
    font-size: 13px;
    font-weight: 500;
    line-height: 1;
    outline: none;
    transition:
      border-color 140ms ease,
      background-color 140ms ease,
      color 140ms ease;
  }

  input::placeholder {
    color: var(--gf-muted);
    opacity: 1;
  }

  input:hover {
    border-color: color-mix(in srgb, var(--gf-body) 58%, var(--gf-line));
  }

  input:focus-visible {
    border-color: var(--gf-blue);
  }

  input::-webkit-search-decoration,
  input::-webkit-search-cancel-button {
    appearance: none;
  }
</style>

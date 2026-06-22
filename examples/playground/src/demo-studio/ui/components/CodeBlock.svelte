<script lang="ts">
  import Button from './Button.svelte';

  type CodeBlockProps = {
    code: string;
    copied?: boolean;
    onCopy?: (code: string) => void;
  };

  let { code, copied = false, onCopy = () => {} }: CodeBlockProps = $props();
</script>

<div>
  <pre><code>{code}</code></pre>
  <Button variant="utility" onclick={() => onCopy(code)}>{copied ? 'Copied' : 'Copy'}</Button>
</div>

<style>
  div {
    display: grid;
    gap: 12px;
    border: 1px solid color-mix(in srgb, var(--gf-line) 72%, #252a31);
    border-radius: var(--gf-radius-card);
    padding: 14px;
    background: var(--gf-code);
  }

  pre {
    max-width: 100%;
    overflow: auto;
    color: var(--gf-text);
    font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
    font-size: 12px;
    font-weight: 500;
    line-height: 1.6;
    white-space: pre-wrap;
  }

  code {
    font: inherit;
  }

  :global(.gf-studio) div :global(button) {
    justify-self: end;
  }
</style>

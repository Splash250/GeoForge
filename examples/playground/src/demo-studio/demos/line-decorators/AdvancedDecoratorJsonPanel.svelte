<script lang="ts">
  import { onDestroy } from 'svelte';
  import { Button, InspectorSection } from '../../ui';
  import { getAdvancedDecoratorLineFeature, type AdvancedDecoratorState } from './advancedDecoratorAuthoring.ts';

  type AdvancedDecoratorJsonPanelProps = {
    state: AdvancedDecoratorState;
    code?: string;
  };

  let { state, code = '' }: AdvancedDecoratorJsonPanelProps = $props();

  let copied = $state<'feature' | 'decorators' | 'code' | null>(null);
  let copyResetTimer: ReturnType<typeof setTimeout> | undefined;

  const featureJson = $derived(JSON.stringify(getAdvancedDecoratorLineFeature(state), null, 2));
  const decoratorsJson = $derived(
    JSON.stringify(getAdvancedDecoratorLineFeature(state).properties.decorators, null, 2),
  );

  async function copyValue(kind: 'feature' | 'decorators' | 'code', value: string) {
    const clipboard = navigator.clipboard;

    if (!clipboard?.writeText) {
      return;
    }

    try {
      await clipboard.writeText.call(clipboard, value);
      copied = kind;
      clearTimeout(copyResetTimer);
      copyResetTimer = setTimeout(() => {
        copied = null;
      }, 1400);
    } catch {
      copied = null;
    }
  }

  onDestroy(() => clearTimeout(copyResetTimer));
</script>

<InspectorSection title="JSON preview">
  <div class="panel-stack">
    <details open>
      <summary>
        <span>Feature</span>
      </summary>
      <div class="copy-action">
        <Button variant="utility" onclick={() => copyValue('feature', featureJson)}>
          {copied === 'feature' ? 'Copied' : 'Copy'}
        </Button>
      </div>
      <pre><code>{featureJson}</code></pre>
    </details>

    <details>
      <summary>
        <span>Decorators</span>
      </summary>
      <div class="copy-action">
        <Button variant="utility" onclick={() => copyValue('decorators', decoratorsJson)}>
          {copied === 'decorators' ? 'Copied' : 'Copy'}
        </Button>
      </div>
      <pre><code>{decoratorsJson}</code></pre>
    </details>

    <details>
      <summary>
        <span>Runtime snippet</span>
      </summary>
      <div class="copy-action">
        <Button variant="utility" onclick={() => copyValue('code', code)}>
          {copied === 'code' ? 'Copied' : 'Copy'}
        </Button>
      </div>
      <pre><code>{code}</code></pre>
    </details>
  </div>
</InspectorSection>

<style>
  .panel-stack {
    display: grid;
    gap: 10px;
  }

  details {
    position: relative;
    min-width: 0;
    border: 1px solid color-mix(in srgb, var(--gf-line) 72%, #252a31);
    border-radius: var(--gf-radius-card);
    background: var(--gf-code);
  }

  summary {
    min-width: 0;
    display: flex;
    align-items: center;
    padding: 10px 82px 10px 10px;
    color: var(--gf-text);
    font-size: 12px;
    font-weight: 750;
    cursor: pointer;
  }

  summary span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .copy-action {
    position: absolute;
    top: 7px;
    right: 10px;
    z-index: 1;
  }

  .copy-action :global(button) {
    min-height: 28px;
    padding-inline: 10px;
  }

  pre {
    max-width: 100%;
    max-height: 280px;
    overflow: auto;
    border-top: 1px solid color-mix(in srgb, var(--gf-line) 72%, #252a31);
    padding: 12px;
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
</style>

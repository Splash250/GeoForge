<script lang="ts">
  import { onDestroy } from 'svelte';
  import { Button, CodeBlock, ControlRow, InspectorSection } from '../../ui';

  export type FeatureDataDemoState = {
    featureCount: number;
    importStatsSummary: string;
    exportedJson: string;
    lastAction: string;
  };

  type FeatureDataInspectorProps = {
    state?: FeatureDataDemoState;
    onImportSample?: () => void;
    onExport?: () => void;
    code?: string;
    title?: string;
    description?: string;
  };

  const emptyFeatureDataState: FeatureDataDemoState = {
    featureCount: 0,
    importStatsSummary: '0/0 imported, 0 added, 0 overwritten, 0 failed',
    exportedJson: JSON.stringify({ type: 'FeatureCollection', features: [] }, null, 2),
    lastAction: 'Waiting for setup',
  };

  let {
    state: demoState = emptyFeatureDataState,
    onImportSample = () => {},
    onExport = () => {},
    code = '',
    title = 'GeoJSON import/export',
    description,
  }: FeatureDataInspectorProps = $props();

  let copied = $state(false);
  let copyResetTimer: ReturnType<typeof setTimeout> | undefined;

  async function copyCode(value: string) {
    const writeText = globalThis.navigator?.clipboard?.writeText;

    if (!writeText) {
      return;
    }

    try {
      await writeText.call(globalThis.navigator.clipboard, value);
      copied = true;
      clearTimeout(copyResetTimer);
      copyResetTimer = setTimeout(() => {
        copied = false;
      }, 1400);
    } catch {
      copied = false;
    }
  }

  onDestroy(() => clearTimeout(copyResetTimer));
</script>

<InspectorSection {title}>
  {#if description}
    <p class="description">{description}</p>
  {/if}

  <div class="action-strip" aria-label="GeoJSON actions">
    <Button variant="primary" onclick={onImportSample}>Import sample</Button>
    <Button variant="secondary" onclick={onExport}>Export</Button>
  </div>

  <div class="rows">
    <ControlRow label="Feature count">{demoState.featureCount}</ControlRow>
    <ControlRow class="long-value-row" label="Import stats">{demoState.importStatsSummary}</ControlRow>
    <ControlRow label="Last action">{demoState.lastAction}</ControlRow>
  </div>
</InspectorSection>

<InspectorSection title="Code">
  <CodeBlock {code} {copied} onCopy={copyCode} />
</InspectorSection>

<InspectorSection title="Exported GeoJSON">
  <pre class="exported-json"><code>{demoState.exportedJson}</code></pre>
</InspectorSection>

<style>
  .description {
    margin-bottom: 12px;
    color: var(--gf-body);
    font-size: 13px;
    line-height: 1.5;
  }

  .action-strip {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: 8px;
    margin-bottom: 12px;
  }

  .action-strip :global(button) {
    flex: 0 0 auto;
    width: auto;
    max-width: 100%;
  }

  .rows {
    display: grid;
  }

  .rows :global(.long-value-row) {
    display: grid;
    gap: 6px;
  }

  .rows :global(.long-value-row > span) {
    flex-basis: auto;
    padding-top: 0;
  }

  .rows :global(.long-value-row > strong) {
    text-align: left;
  }

  .exported-json {
    max-width: 100%;
    max-height: 260px;
    overflow: auto;
    border: 1px solid color-mix(in srgb, var(--gf-line) 72%, #252a31);
    border-radius: var(--gf-radius-card);
    padding: 12px;
    background: var(--gf-code);
    color: var(--gf-text);
    font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
    font-size: 12px;
    font-weight: 500;
    line-height: 1.55;
    white-space: pre;
  }

  code {
    font: inherit;
  }
</style>

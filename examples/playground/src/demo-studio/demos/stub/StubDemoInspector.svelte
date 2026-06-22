<script lang="ts">
  import { onDestroy } from 'svelte';
  import { CodeBlock, ControlRow, InspectorSection } from '../../ui';

  type StubDemoInspectorProps = {
    title: string;
    description: string;
    code: string;
  };

  let { title, description, code }: StubDemoInspectorProps = $props();
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
  <p>{description}</p>
  <ControlRow label="Status">Planned</ControlRow>
  <CodeBlock {code} {copied} onCopy={copyCode} />
</InspectorSection>

<style>
  p {
    margin: 0 0 12px;
    color: var(--gf-body);
    font-size: 13px;
    line-height: 1.5;
  }
</style>

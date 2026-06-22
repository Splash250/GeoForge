<script lang="ts">
  import type { Component, Snippet } from 'svelte';
  import type { RegisteredDemoDefinition } from './registry/types.ts';
  import { InspectorSection } from './ui/index.ts';

  type InspectorProps = {
    title: string;
    description: string;
    code: string;
  };

  type InspectorPanelProps = {
    demo: RegisteredDemoDefinition;
    code: string;
    inspectorProps: Record<string, unknown>;
    inspectorKey: string;
    children?: Snippet;
  };

  let { demo, code, inspectorProps, inspectorKey, children }: InspectorPanelProps = $props();
  const DemoInspector = $derived(demo.inspector as Component<InspectorProps>);
  const demoInspectorProps = $derived({
    title: demo.title,
    description: demo.description,
    code,
    ...inspectorProps
  });
</script>

<aside class="inspector-panel" aria-label="Active demo inspector">
  <section class="demo-summary" aria-labelledby="active-demo-title">
    <span class="eyebrow">Active demo</span>
    <h2 id="active-demo-title">{demo.title}</h2>
    <p>{demo.description}</p>
  </section>

  {@render children?.()}

  <InspectorSection title="Reference">
    <dl>
      <div>
        <dt>Docs path</dt>
        <dd>{demo.docsPath}</dd>
      </div>
      <div>
        <dt>Snippet source</dt>
        <dd>Current registered demo state</dd>
      </div>
    </dl>
  </InspectorSection>

  {#key inspectorKey}
    <DemoInspector {...demoInspectorProps} />
  {/key}
</aside>

<style>
  .inspector-panel {
    width: var(--gf-inspector-width);
    min-width: var(--gf-inspector-width);
    height: 100%;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 14px;
    border-left: 1px solid var(--gf-line);
    padding: 18px;
    overflow: auto;
    background: var(--gf-panel);
    overscroll-behavior: contain;
  }

  .demo-summary {
    display: grid;
    gap: 8px;
    border-bottom: 1px solid var(--gf-line);
    padding-bottom: 16px;
  }

  .eyebrow {
    color: var(--gf-blue);
    font-size: 11px;
    font-weight: 800;
    line-height: 1;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  h2 {
    color: var(--gf-text);
    font-size: 19px;
    font-weight: 800;
    line-height: 1.15;
  }

  p {
    color: var(--gf-body);
    font-size: 13px;
    line-height: 1.5;
  }

  dl {
    display: grid;
    gap: 10px;
  }

  dl div {
    min-width: 0;
    display: grid;
    gap: 4px;
  }

  dt {
    color: var(--gf-muted);
    font-size: 11px;
    font-weight: 800;
    line-height: 1;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  dd {
    min-width: 0;
    margin: 0;
    overflow-wrap: anywhere;
    color: var(--gf-text);
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 12px;
    line-height: 1.45;
  }

  @media (max-width: 1100px) {
    .inspector-panel {
      width: 320px;
      min-width: 320px;
    }
  }

  @media (max-width: 960px) {
    .inspector-panel {
      width: 100%;
      min-width: 0;
      max-height: 38dvh;
      border-left: 0;
      border-top: 1px solid var(--gf-line);
    }
  }
</style>

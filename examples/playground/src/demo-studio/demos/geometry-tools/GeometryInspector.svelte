<script lang="ts">
  import { onDestroy } from 'svelte';
  import { CodeBlock, ControlRow, InspectorSection } from '../../ui/index.ts';

  export type GeometryTopologyIssueState = {
    rule: string;
    type: string;
    severity: string;
    message: string;
  };

  export type GeometryInspectorState = {
    lineCount: number;
    danglingEndpointCount: number;
    nearbyEndpointPairCount: number;
    issues: Array<GeometryTopologyIssueState>;
  };

  type GeometryInspectorProps = {
    state?: GeometryInspectorState;
    code?: string;
    title?: string;
    description?: string;
  };

  const emptyTopologyState: GeometryInspectorState = {
    lineCount: 0,
    danglingEndpointCount: 0,
    nearbyEndpointPairCount: 0,
    issues: [],
  };

  let {
    state: demoState = emptyTopologyState,
    code = '',
    title = 'Network topology',
    description,
  }: GeometryInspectorProps = $props();

  let copied = $state(false);
  let copyResetTimer: ReturnType<typeof setTimeout> | undefined;

  async function copyCode(value: string) {
    const clipboard = typeof navigator === 'undefined' ? undefined : navigator.clipboard;

    if (!clipboard?.writeText) {
      return;
    }

    try {
      await clipboard.writeText.call(clipboard, value);
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

  <div class="rows">
    <ControlRow label="Line count">{demoState.lineCount}</ControlRow>
    <ControlRow label="Dangling endpoints">{demoState.danglingEndpointCount}</ControlRow>
    <ControlRow label="Nearby endpoint pairs">{demoState.nearbyEndpointPairCount}</ControlRow>
  </div>
</InspectorSection>

<InspectorSection title="Topology issues">
  {#if demoState.issues.length}
    <div class="issue-table" role="region" aria-label="Topology issues">
      <table>
        <thead>
          <tr>
            <th scope="col">Rule</th>
            <th scope="col">Type</th>
            <th scope="col">Severity</th>
            <th scope="col">Message</th>
          </tr>
        </thead>
        <tbody>
          {#each demoState.issues as issue}
            <tr>
              <td data-label="Rule">{issue.rule}</td>
              <td data-label="Type">{issue.type}</td>
              <td data-label="Severity">
                <span class:warning={issue.severity === 'warning'} class:error={issue.severity === 'error'}>
                  {issue.severity}
                </span>
              </td>
              <td data-label="Message">{issue.message}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {:else}
    <p class="empty-state">No topology issues found.</p>
  {/if}
</InspectorSection>

<InspectorSection title="Code">
  <CodeBlock {code} {copied} onCopy={copyCode} />
</InspectorSection>

<style>
  .description {
    margin-bottom: 12px;
    color: var(--gf-body);
    font-size: 13px;
    line-height: 1.5;
  }

  .rows {
    display: grid;
  }

  .issue-table {
    max-width: 100%;
    overflow: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    color: var(--gf-body);
    font-size: 12px;
    line-height: 1.35;
  }

  th,
  td {
    border-top: 1px solid var(--gf-line);
    padding: 9px 8px;
    text-align: left;
    vertical-align: top;
  }

  th {
    border-top: 0;
    color: var(--gf-muted);
    font-size: 10px;
    font-weight: 750;
    letter-spacing: 0;
    line-height: 1;
    text-transform: uppercase;
    white-space: nowrap;
  }

  td {
    color: var(--gf-body);
    font-weight: 500;
  }

  td:last-child {
    min-width: 128px;
    white-space: normal;
  }

  span {
    color: var(--gf-body);
    font-weight: 700;
  }

  .warning {
    color: #f5b84b;
  }

  .error {
    color: var(--gf-red);
  }

  .empty-state {
    color: var(--gf-body);
    font-size: 13px;
    line-height: 1.5;
  }

  @media (max-width: 420px) {
    .issue-table {
      overflow: hidden;
    }

    table,
    tbody,
    tr,
    td {
      display: block;
    }

    thead {
      position: absolute;
      width: 1px;
      height: 1px;
      margin: -1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      border: 0;
      padding: 0;
      white-space: nowrap;
    }

    tr {
      border-top: 1px solid var(--gf-line);
      padding: 7px 0;
    }

    tr:first-child {
      border-top: 0;
    }

    td {
      display: grid;
      grid-template-columns: minmax(78px, 36%) minmax(0, 1fr);
      gap: 8px;
      border-top: 0;
      padding: 4px 0;
      overflow-wrap: anywhere;
    }

    td::before {
      content: attr(data-label);
      color: var(--gf-muted);
      font-size: 10px;
      font-weight: 750;
      letter-spacing: 0;
      line-height: 1.25;
      text-transform: uppercase;
    }
  }
</style>

<script lang="ts">
  import { Button } from './ui/index.ts';

  type DemoTopToolbarProps = {
    categoryTitle: string;
    demoTitle: string;
    onOpenDocs: () => void;
    onOpenExamples: () => void;
    onOpenGithub: () => void;
    onReset: () => void;
    onExport: () => void;
  };

  let {
    categoryTitle,
    demoTitle,
    onOpenDocs,
    onOpenExamples,
    onOpenGithub,
    onReset,
    onExport
  }: DemoTopToolbarProps = $props();
</script>

<header class="demo-top-toolbar" aria-label="Demo Studio toolbar">
  <div class="brand-block">
    <a class="wordmark" href="/" aria-label="GeoForge home">GeoForge</a>
    <nav class="breadcrumb" aria-label="Active demo breadcrumb">
      <span>Demo Studio</span>
      <span aria-hidden="true">/</span>
      <span>{categoryTitle}</span>
      <span aria-hidden="true">/</span>
      <strong>{demoTitle}</strong>
    </nav>
  </div>

  <div class="actions" aria-label="Demo Studio utility actions">
    <Button variant="utility" aria-label="Open GeoForge docs" onclick={onOpenDocs}>Docs</Button>
    <Button variant="utility" aria-label="Open GeoForge examples" onclick={onOpenExamples}>
      Examples
    </Button>
    <Button
      variant="utility"
      aria-label="Open GeoForge GitHub repository"
      onclick={onOpenGithub}
    >
      GitHub
    </Button>
    <Button variant="secondary" onclick={onReset}>Reset</Button>
    <Button variant="primary" onclick={onExport}>Export snippet</Button>
  </div>
</header>

<style>
  .demo-top-toolbar {
    height: var(--gf-toolbar-height);
    min-height: var(--gf-toolbar-height);
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 18px;
    align-items: center;
    border-bottom: 1px solid var(--gf-line);
    padding: 0 18px 0 20px;
    background: var(--gf-panel);
  }

  .brand-block {
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 18px;
  }

  .wordmark {
    flex: 0 0 auto;
    color: var(--gf-text);
    font-size: 16px;
    font-weight: 800;
    line-height: 1;
    text-decoration: none;
    letter-spacing: 0;
  }

  .breadcrumb {
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--gf-muted);
    font-size: 13px;
    font-weight: 600;
    line-height: 1;
    white-space: nowrap;
  }

  .breadcrumb span,
  .breadcrumb strong {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .breadcrumb strong {
    color: var(--gf-text);
    font-weight: 700;
  }

  .actions {
    display: flex;
    align-items: center;
    flex-wrap: nowrap;
    justify-content: flex-end;
    gap: 8px;
  }

  @media (max-width: 960px) {
    .demo-top-toolbar {
      grid-template-columns: minmax(0, 1fr);
      height: auto;
      min-height: var(--gf-toolbar-height);
      align-items: stretch;
      padding: 12px;
    }

    .brand-block {
      align-items: flex-start;
      flex-direction: column;
      gap: 8px;
    }

    .breadcrumb {
      max-width: 100%;
      flex-wrap: wrap;
      row-gap: 6px;
      white-space: normal;
    }

    .actions {
      flex-wrap: wrap;
      justify-content: flex-start;
      overflow: visible;
      padding-bottom: 0;
    }

    .actions :global(button) {
      flex: 0 1 auto;
      min-width: 0;
    }
  }

  @media (max-width: 480px) {
    .actions :global(button) {
      flex: 1 1 calc(33.333% - 8px);
      padding-inline: 10px;
    }
  }
</style>

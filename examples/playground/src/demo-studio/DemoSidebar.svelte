<script lang="ts">
  import type { DemoCategory } from './registry/types.ts';
  import { SearchInput } from './ui/index.ts';

  type DemoSidebarProps = {
    categories: DemoCategory[];
    activeCategoryId: string;
    activeDemoId: string;
    onSelect: (categoryId: string, demoId: string) => void;
  };

  type VisibleCategory = DemoCategory & {
    matchesQuery: boolean;
    demos: DemoCategory['demos'];
  };

  let { categories, activeCategoryId, activeDemoId, onSelect }: DemoSidebarProps = $props();
  let query = $state('');

  const normalizedQuery = $derived(query.trim().toLowerCase());
  const visibleCategories = $derived(getVisibleCategories(categories, normalizedQuery));

  function getVisibleCategories(source: DemoCategory[], searchTerm: string): VisibleCategory[] {
    if (!searchTerm) {
      return source.map((category) => ({ ...category, matchesQuery: true }));
    }

    return source.flatMap((category) => {
      const categoryText = `${category.title} ${category.description}`.toLowerCase();
      const categoryMatches = categoryText.includes(searchTerm);
      const demos = categoryMatches
        ? category.demos
        : category.demos.filter((demo) =>
            `${demo.title} ${demo.description} ${demo.docsPath}`.toLowerCase().includes(searchTerm)
          );

      if (!categoryMatches && demos.length === 0) {
        return [];
      }

      return [{ ...category, demos, matchesQuery: categoryMatches }];
    });
  }
</script>

<aside class="demo-sidebar" aria-label="Demo Studio categories">
  <div class="sidebar-intro">
    <span class="eyebrow">Demo categories</span>
    <h2>Map editing workbench</h2>
    <p>Switch capabilities without leaving the live map context.</p>
  </div>

  <SearchInput bind:value={query} placeholder="Search demos, APIs, features" />

  <div class="category-list" aria-live="polite">
    {#if visibleCategories.length > 0}
      {#each visibleCategories as category (category.id)}
        {@const isActiveCategory = category.id === activeCategoryId}
        <section class="category-group" class:active-category={isActiveCategory}>
          <button
            class="category-summary"
            type="button"
            aria-current={isActiveCategory ? 'true' : undefined}
            onclick={() => {
              const firstDemo = category.demos[0];

              if (firstDemo) {
                onSelect(category.id, firstDemo.id);
              }
            }}
          >
            <span>{category.title}</span>
            <small>{category.description}</small>
          </button>

          <div class="demo-list" aria-label={`${category.title} demos`}>
            {#each category.demos as demo (demo.id)}
              {@const isActiveDemo = category.id === activeCategoryId && demo.id === activeDemoId}
              <button
                class="demo-button"
                class:active-demo={isActiveDemo}
                type="button"
                aria-current={isActiveDemo ? 'page' : undefined}
                onclick={() => onSelect(category.id, demo.id)}
              >
                <span>{demo.title}</span>
                {#if normalizedQuery && !category.matchesQuery}
                  <small>{demo.description}</small>
                {/if}
              </button>
            {/each}
          </div>
        </section>
      {/each}
    {:else}
      <p class="empty-state">No demos match this search.</p>
    {/if}
  </div>
</aside>

<style>
  .demo-sidebar {
    width: var(--gf-sidebar-width);
    min-width: var(--gf-sidebar-width);
    height: 100%;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 16px;
    border-right: 1px solid var(--gf-line);
    padding: 18px;
    overflow: auto;
    background: var(--gf-panel);
    overscroll-behavior: contain;
  }

  .sidebar-intro {
    display: grid;
    gap: 7px;
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
    font-size: 18px;
    font-weight: 800;
    line-height: 1.15;
  }

  p {
    color: var(--gf-body);
    font-size: 13px;
    line-height: 1.45;
  }

  .category-list {
    min-height: 0;
    display: grid;
    gap: 10px;
    padding-bottom: 18px;
  }

  .category-list::after {
    content: "";
    height: 18px;
  }

  .category-group {
    display: grid;
    gap: 10px;
    border: 1px solid transparent;
    border-radius: var(--gf-radius-chip);
    padding: 8px;
  }

  .active-category {
    border-color: var(--gf-line);
    background: var(--gf-raised);
  }

  .category-summary,
  .demo-button {
    width: 100%;
    min-width: 0;
    display: grid;
    gap: 5px;
    border: 0;
    text-align: left;
    cursor: pointer;
  }

  .category-summary {
    border-radius: var(--gf-radius-tool);
    padding: 8px;
    color: var(--gf-text);
  }

  .category-summary:hover {
    background: var(--gf-overlay);
  }

  .category-summary span {
    font-size: 13px;
    font-weight: 800;
    line-height: 1.2;
  }

  .category-summary small {
    color: var(--gf-body);
    font-size: 12px;
    font-weight: 500;
    line-height: 1.35;
  }

  .demo-list {
    display: grid;
    gap: 4px;
    padding-left: 8px;
  }

  .demo-button {
    border-radius: var(--gf-radius-pill);
    padding: 9px 12px;
    color: var(--gf-body);
    font-size: 13px;
    font-weight: 650;
    line-height: 1.2;
  }

  .demo-button:hover {
    background: var(--gf-overlay);
    color: var(--gf-text);
  }

  .active-demo {
    background: var(--gf-blue);
    color: var(--gf-text);
  }

  .active-demo:hover {
    background: var(--gf-blue);
    color: var(--gf-text);
  }

  .demo-button small {
    color: color-mix(in srgb, currentColor 74%, transparent);
    font-size: 12px;
    font-weight: 500;
    line-height: 1.35;
  }

  .empty-state {
    border: 1px solid var(--gf-line);
    border-radius: var(--gf-radius-tool);
    padding: 12px;
    background: var(--gf-raised);
    color: var(--gf-body);
  }

  @media (max-width: 960px) {
    .demo-sidebar {
      width: 100%;
      min-width: 0;
      max-height: 34dvh;
      border-right: 0;
      border-bottom: 1px solid var(--gf-line);
    }
  }
</style>

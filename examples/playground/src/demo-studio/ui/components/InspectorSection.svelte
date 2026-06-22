<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';

  type InspectorSectionProps = Omit<HTMLAttributes<HTMLElement>, 'children' | 'class'> & {
    title: string;
    children?: Snippet;
    class?: string;
  };

  let { title, children, class: className, ...restProps }: InspectorSectionProps = $props();
</script>

<section {...restProps} class={className}>
  <h3>{title}</h3>
  <div>
    {@render children?.()}
  </div>
</section>

<style>
  section {
    border: 1px solid var(--gf-line);
    border-radius: var(--gf-radius-card);
    padding: 14px;
    background: var(--gf-raised);
  }

  h3 {
    color: var(--gf-text);
    font-size: 14px;
    font-weight: 700;
    line-height: 1.2;
  }

  div {
    margin-top: 12px;
  }
</style>

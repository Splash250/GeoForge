<script lang="ts">
  import type { Toast } from '../types';

  type ToastStackProps = {
    toasts?: Toast[];
  };

  let { toasts = [] }: ToastStackProps = $props();
</script>

<div role="status" aria-live="polite" aria-atomic="false">
  {#each toasts as toast (toast.id)}
    <article class={toast.tone ?? 'info'}>
      <h3>{toast.title}</h3>
      {#if toast.body}
        <p>{toast.body}</p>
      {/if}
    </article>
  {/each}
</div>

<style>
  div {
    width: min(340px, calc(100vw - 32px));
    display: grid;
    gap: 10px;
    pointer-events: none;
  }

  article {
    border: 1px solid var(--gf-line);
    border-left-width: 4px;
    border-radius: var(--gf-radius-card);
    padding: 14px 16px;
    background: var(--gf-raised);
    box-shadow: 0 18px 42px color-mix(in srgb, var(--gf-void) 58%, transparent);
    color: var(--gf-body);
  }

  article.success {
    border-left-color: var(--gf-green);
  }

  article.error {
    border-left-color: var(--gf-red);
  }

  article.info {
    border-left-color: var(--gf-blue);
  }

  h3 {
    color: var(--gf-text);
    font-size: 14px;
    font-weight: 700;
    line-height: 1.25;
  }

  p {
    margin: 6px 0 0;
    color: var(--gf-body);
    font-size: 13px;
    font-weight: 500;
    line-height: 1.45;
  }
</style>

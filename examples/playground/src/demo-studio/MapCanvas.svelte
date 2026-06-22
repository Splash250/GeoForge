<script lang="ts">
  import { onMount } from 'svelte';

  type MapCanvasProps = {
    onReady: (element: HTMLDivElement) => void;
    statusLabel?: string;
    statusValue?: string;
  };

  let {
    onReady,
    statusLabel = 'GeoForge Demo Studio',
    statusValue = 'Initializing map'
  }: MapCanvasProps = $props();
  let mapElement: HTMLDivElement;

  onMount(() => {
    onReady(mapElement);
  });
</script>

<section class="map-shell" aria-label="GeoForge map canvas">
  <div bind:this={mapElement} class="map-element"></div>
  <div class="map-status" aria-live="polite">
    <span>{statusLabel}</span>
    <strong>{statusValue}</strong>
  </div>
</section>

<style>
  .map-shell {
    position: relative;
    min-width: 0;
    min-height: 0;
    height: 100%;
    overflow: hidden;
    background:
      linear-gradient(rgba(255, 255, 255, 0.035) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 255, 255, 0.035) 1px, transparent 1px),
      radial-gradient(circle at 28% 22%, rgba(0, 122, 252, 0.16), transparent 26%),
      var(--gf-void);
    background-size:
      42px 42px,
      42px 42px,
      100% 100%,
      auto;
  }

  .map-element {
    position: absolute;
    inset: 0;
    min-width: 0;
    min-height: 0;
  }

  .map-status {
    position: absolute;
    left: 16px;
    bottom: 16px;
    display: inline-grid;
    gap: 3px;
    border: 1px solid color-mix(in srgb, var(--gf-line) 74%, transparent);
    border-radius: var(--gf-radius-tool);
    padding: 8px 10px;
    background: color-mix(in srgb, var(--gf-panel) 86%, transparent);
    color: var(--gf-body);
    font-size: 11px;
    line-height: 1.2;
    pointer-events: none;
    backdrop-filter: blur(12px);
  }

  .map-status strong {
    color: var(--gf-text);
    font-size: 12px;
    font-weight: 800;
  }
</style>

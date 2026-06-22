<script lang="ts">
  import {
    buildRasterCapabilitiesRequestUrl,
    parseRasterCapabilities,
    type DiscoveredRasterLayer,
    type GeomanRasterLayer
  } from 'maplibre-geoforge';
  import { buildCustomRasterTileUrl } from './map/customRasterLayers.ts';
  import { Button, IconButton } from './ui/index.ts';

  type CustomRasterLayerPanelProps = {
    layers: GeomanRasterLayer[];
    disabled?: boolean;
    onAdd: (input: { name: string; url: string }) => void;
    onAddMany: (layers: Array<{ name: string; url: string }>) => void;
    onMove: (layerId: string, direction: -1 | 1) => void;
    onRemove: (layerId: string) => void;
  };

  let {
    layers,
    disabled = false,
    onAdd,
    onAddMany,
    onMove,
    onRemove
  }: CustomRasterLayerPanelProps = $props();

  let name = $state('');
  let url = $state('');
  let discoveredLayers = $state<DiscoveredRasterLayer[]>([]);
  let selectedLayerNames = $state<string[]>([]);
  let discoveryStatus = $state<'idle' | 'loading' | 'ready' | 'empty' | 'error'>('idle');
  let discoveryMessage = $state('');

  const canAdd = $derived(!disabled && name.trim().length > 0 && url.trim().length > 0);
  const canDiscover = $derived(!disabled && url.trim().length > 0 && discoveryStatus !== 'loading');
  const canAddSelected = $derived(!disabled && selectedLayerNames.length > 0);

  function handleSubmit(event: SubmitEvent) {
    event.preventDefault();

    if (!canAdd) {
      return;
    }

    onAdd({ name, url });
    name = '';
    url = '';
  }

  async function handleDiscover() {
    if (!canDiscover) {
      return;
    }

    discoveryStatus = 'loading';
    discoveryMessage = '';
    discoveredLayers = [];
    selectedLayerNames = [];

    try {
      const capabilitiesUrl = buildRasterCapabilitiesRequestUrl(url);
      const response = await fetch(buildCustomRasterTileUrl(capabilitiesUrl));

      if (!response.ok) {
        throw new Error(`Capabilities request failed with HTTP ${response.status}.`);
      }

      const nextLayers = parseRasterCapabilities(await response.text(), capabilitiesUrl);
      discoveredLayers = nextLayers;
      selectedLayerNames = [];
      discoveryStatus = nextLayers.length > 0 ? 'ready' : 'empty';
      discoveryMessage =
        nextLayers.length > 0
          ? `${nextLayers.length} layer${nextLayers.length === 1 ? '' : 's'} available`
          : 'No named layers found';
    } catch (error) {
      discoveryStatus = 'error';
      discoveryMessage = error instanceof Error ? error.message : String(error);
    }
  }

  function handleLayerSelection(layerName: string, checked: boolean) {
    selectedLayerNames = checked
      ? [...selectedLayerNames, layerName]
      : selectedLayerNames.filter((name) => name !== layerName);
  }

  function handleAddSelected() {
    if (!canAddSelected) {
      return;
    }

    const selectedNames = new Set(selectedLayerNames);
    const selectedLayers = discoveredLayers
      .filter((layer) => selectedNames.has(layer.name))
      .map((layer) => ({ name: layer.title || layer.name, url: layer.url }));

    onAddMany(selectedLayers);
    discoveredLayers = [];
    selectedLayerNames = [];
    discoveryStatus = 'idle';
    discoveryMessage = '';
    name = '';
    url = '';
  }
</script>

<section class="custom-raster-panel" aria-label="Custom WMS and WMTS layers">
  <div class="panel-heading">
    <div>
      <span>Layers</span>
      <strong>{layers.length}</strong>
    </div>
  </div>

  <form class="layer-form" onsubmit={handleSubmit}>
    <label>
      <span>Name</span>
      <input bind:value={name} disabled={disabled} placeholder="NUTS boundaries" />
    </label>

    <label>
      <span>WMS / WMTS URL</span>
      <textarea
        bind:value={url}
        disabled={disabled}
        placeholder="https://server.example/wms?service=WMS&request=GetMap&..."
      ></textarea>
    </label>

    <div class="form-actions">
      <Button variant="primary" type="button" disabled={!canDiscover} onclick={handleDiscover}>
        {discoveryStatus === 'loading' ? 'Checking' : 'Discover layers'}
      </Button>
      <Button variant="secondary" type="submit" disabled={!canAdd}>Add URL</Button>
    </div>
  </form>

  {#if discoveryStatus !== 'idle'}
    <div class="discovery-block" aria-live="polite">
      <div class="discovery-heading">
        <span>Available layers</span>
        <strong>{discoveryMessage}</strong>
      </div>

      {#if discoveredLayers.length > 0}
        <div class="discovered-list">
          {#each discoveredLayers as layer (layer.name)}
            <label class="discovered-item">
              <input
                type="checkbox"
                checked={selectedLayerNames.includes(layer.name)}
                onchange={(event) =>
                  handleLayerSelection(layer.name, event.currentTarget.checked)}
              />
              <span>
                <strong>{layer.title}</strong>
                <small>{layer.name}</small>
              </span>
            </label>
          {/each}
        </div>

        <Button variant="primary" type="button" disabled={!canAddSelected} onclick={handleAddSelected}>
          Add selected
        </Button>
      {/if}
    </div>
  {/if}

  <div class="layer-list" aria-label="Custom raster z index order">
    {#if layers.length > 0}
      {#each layers as layer, index (layer.id)}
        <article class="layer-item">
          <div class="layer-copy">
            <strong>{layer.name}</strong>
            <span>{layer.url}</span>
          </div>

          <div class="layer-actions">
            <IconButton
              label={`Move ${layer.name} up`}
              disabled={disabled || index === 0}
              onclick={() => onMove(layer.id, -1)}
            >
              <span aria-hidden="true">↑</span>
            </IconButton>
            <IconButton
              label={`Move ${layer.name} down`}
              disabled={disabled || index === layers.length - 1}
              onclick={() => onMove(layer.id, 1)}
            >
              <span aria-hidden="true">↓</span>
            </IconButton>
            <IconButton
              label={`Remove ${layer.name}`}
              disabled={disabled}
              onclick={() => onRemove(layer.id)}
            >
              <span aria-hidden="true">×</span>
            </IconButton>
          </div>
        </article>
      {/each}
    {:else}
      <p class="empty-state">No custom raster layers.</p>
    {/if}
  </div>
</section>

<style>
  .custom-raster-panel {
    width: 100%;
    min-width: 0;
    display: grid;
    gap: 12px;
    border: 1px solid var(--gf-line);
    border-radius: var(--gf-radius-card);
    padding: 14px;
    background: var(--gf-raised);
  }

  .panel-heading {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    align-items: center;
  }

  .panel-heading div {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--gf-text);
    font-size: 13px;
    font-weight: 800;
    line-height: 1;
  }

  .panel-heading span {
    color: var(--gf-text);
    font-size: 14px;
    font-weight: 700;
    text-transform: none;
    letter-spacing: 0;
  }

  .panel-heading strong {
    min-width: 24px;
    border-radius: var(--gf-radius-pill);
    padding: 4px 7px;
    background: var(--gf-blue);
    color: var(--gf-text);
    text-align: center;
  }

  .layer-form,
  .discovery-block {
    display: grid;
    gap: 9px;
  }

  .form-actions {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 8px;
  }

  .form-actions :global(button) {
    min-width: 0;
  }

  label {
    display: grid;
    gap: 5px;
    color: var(--gf-muted);
    font-size: 11px;
    font-weight: 800;
    line-height: 1;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  input,
  textarea {
    width: 100%;
    min-width: 0;
    border: 1px solid var(--gf-line);
    border-radius: var(--gf-radius-tool);
    background: var(--gf-raised);
    color: var(--gf-text);
    font-size: 12px;
    font-weight: 600;
    line-height: 1.4;
    text-transform: none;
    letter-spacing: 0;
  }

  input {
    min-height: 36px;
    padding: 0 10px;
  }

  textarea {
    min-height: 74px;
    padding: 9px 10px;
    resize: vertical;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  }

  input::placeholder,
  textarea::placeholder {
    color: var(--gf-muted);
    opacity: 0.78;
  }

  .layer-list {
    display: grid;
    gap: 8px;
  }

  .discovery-block {
    border: 1px solid var(--gf-line);
    border-radius: var(--gf-radius-tool);
    padding: 9px;
    background: color-mix(in srgb, var(--gf-panel) 72%, transparent);
  }

  .discovery-heading {
    display: grid;
    gap: 3px;
  }

  .discovery-heading span {
    color: var(--gf-muted);
    font-size: 11px;
    font-weight: 800;
    line-height: 1;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .discovery-heading strong {
    color: var(--gf-text);
    font-size: 12px;
    line-height: 1.3;
  }

  .discovered-list {
    display: grid;
    gap: 6px;
    max-height: 210px;
    overflow: auto;
  }

  .discovered-item {
    display: grid;
    grid-template-columns: 18px minmax(0, 1fr);
    gap: 8px;
    align-items: center;
    border: 1px solid color-mix(in srgb, var(--gf-line) 76%, transparent);
    border-radius: var(--gf-radius-tool);
    padding: 8px;
    background: color-mix(in srgb, var(--gf-panel) 82%, transparent);
    color: var(--gf-text);
    text-transform: none;
    letter-spacing: 0;
  }

  .discovered-item input {
    width: 16px;
    min-height: 16px;
    accent-color: var(--gf-blue);
  }

  .discovered-item span {
    min-width: 0;
    display: grid;
    gap: 3px;
  }

  .discovered-item strong,
  .discovered-item small {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .discovered-item strong {
    color: var(--gf-text);
    font-size: 12px;
    font-weight: 800;
    line-height: 1.2;
  }

  .discovered-item small {
    color: var(--gf-body);
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 11px;
    font-weight: 600;
    line-height: 1.25;
  }

  .layer-item {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 10px;
    align-items: center;
    border: 1px solid var(--gf-line);
    border-radius: var(--gf-radius-tool);
    padding: 9px;
    background: var(--gf-raised);
  }

  .layer-copy {
    min-width: 0;
    display: grid;
    gap: 4px;
  }

  .layer-copy strong {
    overflow: hidden;
    color: var(--gf-text);
    font-size: 13px;
    font-weight: 800;
    line-height: 1.2;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .layer-copy span {
    overflow: hidden;
    color: var(--gf-body);
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 11px;
    line-height: 1.35;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .layer-actions {
    display: flex;
    gap: 5px;
  }

  .layer-actions :global(button) {
    --gf-icon-control: 30px;
  }

  .empty-state {
    margin: 0;
    border: 1px dashed var(--gf-line);
    border-radius: var(--gf-radius-tool);
    padding: 10px;
    color: var(--gf-body);
    font-size: 12px;
    line-height: 1.35;
  }

  @media (max-width: 720px) {
    .layer-item {
      grid-template-columns: 1fr;
    }

    .layer-actions {
      justify-content: flex-end;
    }
  }
</style>

<script lang="ts">
  import Button from './Button.svelte';

  const inputId = `gf-dropzone-${Math.random().toString(36).slice(2)}`;

  type DropzoneProps = {
    label?: string;
    actionLabel?: string;
    accept?: string;
    multiple?: boolean;
    selectedFileName?: string;
    onSelect?: (files: File[]) => void;
  };

  let {
    label = 'Drop file here',
    actionLabel = 'Select file',
    accept,
    multiple = false,
    selectedFileName = '',
    onSelect = () => {}
  }: DropzoneProps = $props();

  let input: HTMLInputElement;
  let dragging = $state(false);

  function selectFiles(files: FileList | null) {
    if (!files || files.length === 0) return;

    onSelect(Array.from(files));
  }

  function openPicker() {
    input.click();
  }

  function handleDragover(event: DragEvent) {
    event.preventDefault();
    dragging = true;
  }

  function handleDragleave(event: DragEvent) {
    if (event.currentTarget === event.target) {
      dragging = false;
    }
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    dragging = false;
    selectFiles(event.dataTransfer?.files ?? null);
  }
</script>

<div
  role="group"
  aria-label={label}
  class:dragging
  ondragover={handleDragover}
  ondragleave={handleDragleave}
  ondrop={handleDrop}
>
  <input
    id={inputId}
    bind:this={input}
    type="file"
    {accept}
    {multiple}
    tabindex="-1"
    aria-label={label}
    onchange={(event) => selectFiles(event.currentTarget.files)}
  />
  <p>{label}</p>
  {#if selectedFileName}
    <span>{selectedFileName}</span>
  {/if}
  <Button variant="primary" onclick={openPicker}>{actionLabel}</Button>
</div>

<style>
  div {
    min-height: 138px;
    display: grid;
    place-items: center;
    gap: 14px;
    border: 1px dashed var(--gf-line);
    border-radius: var(--gf-radius-card);
    padding: 20px;
    background: var(--gf-raised);
    color: var(--gf-body);
    text-align: center;
    transition:
      border-color 140ms ease,
      background-color 140ms ease;
  }

  div:hover,
  div.dragging {
    border-color: var(--gf-blue);
    background: color-mix(in srgb, var(--gf-blue) 10%, var(--gf-raised));
  }

  input {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
  }

  p {
    color: var(--gf-body);
    font-size: 13px;
    font-weight: 600;
    line-height: 1.4;
  }

  span {
    color: var(--gf-muted);
    font-size: 12px;
    font-weight: 600;
    line-height: 1.35;
  }
</style>

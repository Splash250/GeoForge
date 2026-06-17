import type { Geoman } from '@/main.ts';

const singleFeatureEditIcon = `
<svg viewBox="0 0 24 24" aria-hidden="true">
  <path d="M5 5h9v9H5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" />
  <path d="m15 15 4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
  <path d="m18 12 2 2-6 6h-2v-2z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
  <circle cx="5" cy="5" r="1.5" fill="currentColor" />
  <circle cx="14" cy="5" r="1.5" fill="currentColor" />
  <circle cx="5" cy="14" r="1.5" fill="currentColor" />
</svg>`;

export function registerSingleFeatureEditTool(geoman: Geoman) {
  const disableSingleFeatureEditMode = () => {
    geoman.disableSingleFeatureEditMode();
  };

  geoman.tools.register({
    id: 'playground-single-feature-edit',
    title: 'Select feature to edit',
    control: {
      icon: singleFeatureEditIcon,
    },
    onStart: ({ geoman }) => {
      geoman.enableSingleFeatureEditMode();
    },
    onEnd: disableSingleFeatureEditMode,
    onCancel: disableSingleFeatureEditMode,
  });
}

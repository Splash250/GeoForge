import 'maplibre-gl/dist/maplibre-gl.css';
import 'maplibre-geoforge/dist/maplibre-geoforge.css';

import { mount, unmount } from 'svelte';
import DemoStudioApp from '../demo-studio/DemoStudioApp.svelte';

export function startDemoStudio(app: HTMLDivElement) {
  const component = mount(DemoStudioApp, { target: app });

  return () => {
    void unmount(component);
  };
}

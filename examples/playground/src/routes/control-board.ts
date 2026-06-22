import { mount, unmount } from 'svelte';
import ControlBoard from '../demo-studio/ui/components/ControlBoard.svelte';

export function startControlBoard(app: HTMLDivElement) {
  const component = mount(ControlBoard, { target: app });

  return () => {
    void unmount(component);
  };
}

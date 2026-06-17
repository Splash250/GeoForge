import type { Geoman } from '@/main.ts';
import type { ModeName } from '@/types/controls.ts';
import type { ModeType } from '@/types/options.ts';

export class ModeController {
  constructor(private readonly geoman: Geoman) {}

  enable(modeType: ModeType, modeName: ModeName) {
    this.geoman.options.enableMode(modeType, modeName);
  }

  disable(modeType: ModeType, modeName: ModeName) {
    this.geoman.options.disableMode(modeType, modeName);
  }

  toggle(modeType: ModeType, modeName: ModeName) {
    this.geoman.options.toggleMode(modeType, modeName);
  }

  isEnabled(modeType: ModeType, modeName: ModeName) {
    return this.geoman.options.isModeEnabled(modeType, modeName);
  }

  disableAll() {
    this.geoman.disableAllModes();
  }
}

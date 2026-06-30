import type { BaseMapAdapter } from '@/core/map/base/index.ts';
import type { AnyMapInstance } from '@/types/map/index.ts';
import { HtmlOverlayManager } from './htmlOverlayManager.ts';
import type { HtmlOverlayDefinition } from './types.ts';

type GeomanHtmlOverlayManager = Pick<
  HtmlOverlayManager,
  'add' | 'update' | 'remove' | 'get' | 'getAll' | 'setSelected' | 'destroy'
> &
  Partial<Pick<HtmlOverlayManager, 'upsert'>>;

export type GeomanHtmlOverlayManagerFactory = (options: {
  mapAdapter: BaseMapAdapter<AnyMapInstance>;
}) => GeomanHtmlOverlayManager;

export type GeomanHtmlOverlaySubsystemOptions = {
  getMapAdapter: () => BaseMapAdapter<AnyMapInstance>;
  managerFactory?: GeomanHtmlOverlayManagerFactory;
};

export class GeomanHtmlOverlaySubsystem {
  private manager: GeomanHtmlOverlayManager | null = null;

  constructor(private readonly options: GeomanHtmlOverlaySubsystemOptions) {}

  add(definition: HtmlOverlayDefinition) {
    this.getManager().add(definition);
  }

  upsert(definition: HtmlOverlayDefinition) {
    const manager = this.getManager();

    if (manager.upsert) {
      manager.upsert(definition);
      return;
    }

    manager.add(definition);
  }

  update(id: string, patch: Partial<HtmlOverlayDefinition>) {
    this.getManager().update(id, patch);
  }

  setSelected(id: string | null) {
    this.getManager().setSelected(id);
  }

  remove(id: string) {
    this.manager?.remove(id);
  }

  get(id: string) {
    return this.manager?.get(id) ?? null;
  }

  getAll() {
    return this.manager?.getAll() ?? [];
  }

  destroy() {
    this.manager?.destroy();
    this.manager = null;
  }

  private getManager() {
    if (!this.manager) {
      this.manager = this.createManager();
    }

    return this.manager;
  }

  private createManager() {
    const factory =
      this.options.managerFactory ??
      ((managerOptions: { mapAdapter: BaseMapAdapter<AnyMapInstance> }) =>
        new HtmlOverlayManager(managerOptions));

    return factory({
      mapAdapter: this.options.getMapAdapter(),
    });
  }
}

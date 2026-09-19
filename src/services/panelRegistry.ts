import type { App } from "vue";

interface PanelRegistration {
  app: App<Element>;
  element: HTMLElement;
}

export class PanelRegistry {
  readonly #panels = new Map<string, PanelRegistration>();

  has(id: string): boolean {
    return this.#panels.has(id);
  }

  isConnected(id: string): boolean {
    return this.#panels.get(id)?.element.isConnected ?? false;
  }

  mount(id: string, app: App<Element>, element: HTMLElement): void {
    this.unmount(id);
    this.#panels.set(id, { app, element });
  }

  unmount(id: string): boolean {
    const panel = this.#panels.get(id);
    if (!panel) return false;

    panel.app.unmount();
    panel.element.remove();
    this.#panels.delete(id);
    return true;
  }

  unmountAll(): void {
    for (const id of [...this.#panels.keys()]) {
      this.unmount(id);
    }
  }
}

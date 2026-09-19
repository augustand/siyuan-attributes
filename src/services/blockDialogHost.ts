import type { App } from "vue";

interface Registration {
  app: App<Element>;
  element: HTMLElement;
  root: HTMLElement;
}

export class BlockDialogHost {
  #current: Registration | undefined;

  isOpen(): boolean {
    return Boolean(this.#current?.root.isConnected);
  }

  open(create: (host: HTMLElement) => { app: App<Element>; element: HTMLElement }): void {
    this.close();
    const root = document.createElement("div");
    root.className = "mux-block-attr-dialog";
    document.body.append(root);
    const { app, element } = create(root);
    this.#current = { app, element, root };
  }

  close(): void {
    const current = this.#current;
    if (!current) return;
    current.app.unmount();
    current.root.remove();
    this.#current = undefined;
  }
}

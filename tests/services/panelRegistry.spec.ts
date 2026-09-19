import { createApp, defineComponent } from "vue";
import { describe, expect, it } from "vitest";
import { PanelRegistry } from "@/services/panelRegistry";

function createTestApp() {
  const element = document.createElement("div");
  document.body.append(element);
  return { app: createApp(defineComponent({ template: "<p>panel</p>" })), element };
}

describe("PanelRegistry", () => {
  it("replaces an existing panel for the same id", () => {
    const registry = new PanelRegistry();
    const first = createTestApp();
    const second = createTestApp();
    first.app.mount(first.element);
    second.app.mount(second.element);

    registry.mount("doc", first.app, first.element);
    registry.mount("doc", second.app, second.element);

    expect(registry.has("doc")).toBe(true);
    expect(first.element.isConnected).toBe(false);
    expect(second.element.isConnected).toBe(true);

    registry.unmountAll();
    expect(second.element.isConnected).toBe(false);
  });
});

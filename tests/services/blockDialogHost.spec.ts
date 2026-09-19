import { createApp, defineComponent } from "vue";
import { describe, expect, it } from "vitest";
import { BlockDialogHost } from "@/services/blockDialogHost";

function mountInto(host: HTMLElement) {
  const element = document.createElement("div");
  host.append(element);
  const app = createApp(defineComponent({ template: "<p>block-dialog</p>" }));
  app.mount(element);
  return { app, element };
}

describe("BlockDialogHost", () => {
  it("opens one dialog and replaces the previous", () => {
    const host = new BlockDialogHost();
    host.open(mountInto);
    expect(host.isOpen()).toBe(true);
    expect(document.querySelectorAll(".mux-block-attr-dialog").length).toBe(1);

    const firstRoot = document.querySelector(".mux-block-attr-dialog");
    host.open(mountInto);
    expect(document.querySelectorAll(".mux-block-attr-dialog").length).toBe(1);
    expect(firstRoot?.isConnected).toBe(false);

    host.close();
    expect(host.isOpen()).toBe(false);
    expect(document.querySelector(".mux-block-attr-dialog")).toBeNull();
  });
});

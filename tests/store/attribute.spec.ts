import { createPinia } from "pinia";
import { createApp, defineComponent } from "vue";
import type { App } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAttributesStore } from "@/store/attribute";
import { normalizeCustomAttributeKey } from "@/services/attributeKeys";
import type { Store } from "pinia";

const fetchBlockAttrs = vi.fn();
const writeBlockAttrs = vi.fn();
const apps: Array<App<Element>> = [];

vi.mock("@/services/blockAttrs", () => ({
  fetchBlockAttrs: (id: string) => fetchBlockAttrs(id),
  writeBlockAttrs: (id: string, attrs: Record<string, string>) => writeBlockAttrs(id, attrs),
}));

vi.mock("@/store/rules", () => ({
  useConfigStore: () => ({ rules: [] }),
}));

describe("attributes store CRUD", () => {
  afterEach(() => {
    apps.splice(0).forEach((app) => app.unmount());
  });

  function initializeStore(documentId = "doc") {
    let initializedStore: Store<
      string,
      Record<string, unknown>,
      Record<string, unknown>,
      Record<string, unknown>
    >;
    const app = createApp(defineComponent({
      setup() {
        initializedStore = useAttributesStore() as unknown as typeof initializedStore;
        return () => null;
      },
    }));
    app.use(createPinia());
    app.provide("$docId", documentId);
    app.mount(document.createElement("div"));
    apps.push(app);
    return initializedStore!;
  }

  it("replaces state instead of appending duplicate attributes", async () => {
    fetchBlockAttrs.mockResolvedValue({ id: "doc", "custom-x": "1" });
    const store = initializeStore();
    await store.loadDocumentAttributes();
    await store.loadDocumentAttributes();

    expect(store.builtInAttributes.filter((item) => item.key === "custom-x")).toHaveLength(1);
  });

  it("adds a valid custom attribute and refreshes", async () => {
    writeBlockAttrs.mockResolvedValue(undefined);
    fetchBlockAttrs.mockResolvedValue({ id: "doc", "custom-x": "1" });
    const store = initializeStore();

    await store.setAttribute("custom-x", "1");

    expect(writeBlockAttrs).toHaveBeenCalledWith("doc", { "custom-x": "1" });
    expect(store.builtInAttributes.some((item) => item.key === "custom-x")).toBe(true);
  });

  it("normalizes user input to a custom attribute key", async () => {
    writeBlockAttrs.mockResolvedValue(undefined);
    fetchBlockAttrs.mockResolvedValue({ id: "doc", "custom-project": "1" });
    const store = initializeStore();

    await store.createCustomAttribute("Project", "1");

    expect(normalizeCustomAttributeKey("Project")).toBe("custom-project");
    expect(writeBlockAttrs).toHaveBeenCalledWith("doc", { "custom-project": "1" });
    expect(store.builtInAttributes.some((item) => item.key === "custom-project")).toBe(true);
  });

  it("rejects protected keys on delete", async () => {
    const store = initializeStore();
    await expect(store.deleteCustomAttribute("id")).rejects.toThrow("protected");
    expect(writeBlockAttrs).not.toHaveBeenCalled();
  });

  it("deletes custom keys by writing an empty string", async () => {
    writeBlockAttrs.mockResolvedValue(undefined);
    fetchBlockAttrs.mockResolvedValue({ id: "doc" });
    const store = initializeStore();

    await store.deleteCustomAttribute("custom-x");

    expect(writeBlockAttrs).toHaveBeenCalledWith("doc", { "custom-x": "" });
  });
});

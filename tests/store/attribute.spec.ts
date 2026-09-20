import { createPinia } from "pinia";
import { createApp, defineComponent } from "vue";
import type { App } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAttributesStore } from "@/store/attribute";
import { normalizeCustomAttributeKey } from "@/services/attributeKeys";
import { DOCUMENT_FIELD_OVERRIDES_ATTR } from "@/models/documentFieldOverrides";
import type { Store } from "pinia";

const fetchBlockAttrs = vi.fn();
const writeBlockAttrs = vi.fn();
const apps: Array<App<Element>> = [];

vi.mock("@/services/blockAttrs", () => ({
  fetchBlockAttrs: (id: string) => fetchBlockAttrs(id),
  writeBlockAttrs: (id: string, attrs: Record<string, string>) => writeBlockAttrs(id, attrs),
}));

vi.mock("@/store/rules", () => ({
  useConfigStore: () => {
    const rules = [
      {
        id: "test-x", name: "X", rule: "custom-x", matchMethod: "exact" as const, scope: "document" as const,
        display: true, displayAs: "X", editable: true, renderMethod: "input" as const, options: [], order: 1000,
      },
      {
        id: "test-hidden", name: "Hidden", rule: "custom-hidden", matchMethod: "exact" as const, scope: "document" as const,
        display: false, displayAs: "Hidden", editable: true, renderMethod: "input" as const, options: [], order: 1000,
      },
      {
        id: "test-tags", name: "标签", rule: "custom-tags", matchMethod: "exact" as const, scope: "document" as const,
        display: true, displayAs: "标签", editable: true, renderMethod: "multi-select" as const, options: [], order: 1000,
      },
      {
        id: "test-planned", name: "计划", rule: "custom-planned", matchMethod: "exact" as const, scope: "document" as const,
        display: true, displayAs: "计划", editable: true, renderMethod: "input" as const, options: [], order: 50,
      },
    ];
    return {
      matchDocumentRule: (name: string) => rules.find((rule) => rule.rule === name),
      documentRules: () => rules,
    };
  },
}));

describe("attributes store CRUD", () => {
  afterEach(() => {
    apps.splice(0).forEach((app) => app.unmount());
  });

  function initializeStore(documentId = "doc") {
    let initializedStore: ReturnType<typeof useAttributesStore>;
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

  it("applies matched rule renderMethod and options onto attribute rows", async () => {
    fetchBlockAttrs.mockResolvedValue({ id: "doc", "custom-tags": "a,b" });
    const store = initializeStore();
    await store.loadDocumentAttributes();

    const row = store.builtInAttributes.find((item) => item.key === "custom-tags");
    expect(row?.renderMethod).toBe("multi-select");
    expect(row?.options).toEqual([]);
    expect(row?.displayAs).toBe("标签");
  });

  it("lets document overrides replace renderMethod and options", async () => {
    fetchBlockAttrs.mockResolvedValue({
      id: "doc",
      "custom-tags": "a,b",
      [DOCUMENT_FIELD_OVERRIDES_ATTR]: JSON.stringify({
        v: 1,
        fields: {
          "custom-tags": {
            display: true,
            displayAs: "tags",
            order: 5,
            editable: true,
            renderMethod: "tag-input",
            options: [],
          },
        },
      }),
    });
    const store = initializeStore();
    await store.loadDocumentAttributes();

    const row = store.builtInAttributes.find((item) => item.key === "custom-tags");
    expect(row?.renderMethod).toBe("tag-input");
    expect(row?.displayAs).toBe("tags");
    expect(row?.order).toBe(5);
  });

  it("includes exact global rules that are not yet on the document", async () => {
    fetchBlockAttrs.mockResolvedValue({ id: "doc" });
    const store = initializeStore();
    await store.loadDocumentAttributes();

    const planned = store.allDocumentAttributes.find((item) => item.key === "custom-planned");
    expect(planned).toBeTruthy();
    expect(planned?.presentOnDocument).toBe(false);
    expect(planned?.value).toBe("");
    expect(store.builtInAttributes.some((item) => item.key === "custom-planned")).toBe(true);

    const hidden = store.allDocumentAttributes.find((item) => item.key === "custom-hidden");
    expect(hidden).toBeTruthy();
    expect(store.builtInAttributes.some((item) => item.key === "custom-hidden")).toBe(false);
  });

  it("keeps hidden document attributes available to field settings", async () => {
    fetchBlockAttrs.mockResolvedValue({
      id: "doc",
      "custom-visible": "visible",
      "custom-hidden": "hidden",
    });
    const store = initializeStore();
    // Pretend the settings store has a hidden rule for custom-hidden.
    await store.loadDocumentAttributes();

    expect(store.allDocumentAttributes.map((item) => item.key)).toContain("custom-hidden");
    expect(store.builtInAttributes.map((item) => item.key)).not.toContain("custom-hidden");
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

  it("rejects writes to immutable document keys", async () => {
    const store = initializeStore();
    await expect(store.setAttribute("id", "new-id")).rejects.toThrow("read-only");
    await expect(store.setAttribute("updated", "new-time")).rejects.toThrow("read-only");
    expect(writeBlockAttrs).not.toHaveBeenCalled();
  });

  it("deletes custom keys by writing an empty string", async () => {
    writeBlockAttrs.mockResolvedValue(undefined);
    fetchBlockAttrs.mockResolvedValue({ id: "doc" });
    const store = initializeStore();

    await store.deleteCustomAttribute("custom-x");

    expect(writeBlockAttrs).toHaveBeenCalledWith(
      "doc",
      expect.objectContaining({ "custom-x": "", [DOCUMENT_FIELD_OVERRIDES_ATTR]: "" }),
    );
  });

  it("hides the reserved overrides attribute from panel lists", async () => {
    fetchBlockAttrs.mockResolvedValue({
      id: "doc",
      "custom-x": "1",
      [DOCUMENT_FIELD_OVERRIDES_ATTR]: JSON.stringify({
        v: 1,
        fields: { "custom-x": { display: true, displayAs: "X", order: 1, editable: true } },
      }),
    });
    const store = initializeStore();
    await store.loadDocumentAttributes();
    expect(store.allDocumentAttributes.map((i) => i.key)).not.toContain(DOCUMENT_FIELD_OVERRIDES_ATTR);
    expect(store.builtInAttributes.map((i) => i.key)).not.toContain(DOCUMENT_FIELD_OVERRIDES_ATTR);
  });

  it("applies document overrides on top of global rules", async () => {
    fetchBlockAttrs.mockResolvedValue({
      id: "doc",
      "custom-hidden": "secret",
      [DOCUMENT_FIELD_OVERRIDES_ATTR]: JSON.stringify({
        v: 1,
        fields: {
          "custom-hidden": { display: true, displayAs: "Shown Here", order: 5, editable: true },
        },
      }),
    });
    const store = initializeStore();
    await store.loadDocumentAttributes();
    const row = store.builtInAttributes.find((i) => i.key === "custom-hidden");
    expect(row?.displayAs).toBe("Shown Here");
    expect(row?.order).toBe(5);
  });

  it("rejects creating the reserved overrides key", async () => {
    const store = initializeStore();
    await expect(store.createCustomAttribute(DOCUMENT_FIELD_OVERRIDES_ATTR, "{}")).rejects.toThrow();
  });

  it("prunes overrides when a custom attribute is deleted", async () => {
    writeBlockAttrs.mockResolvedValue(undefined);
    fetchBlockAttrs
      .mockResolvedValueOnce({
        id: "doc",
        "custom-x": "1",
        [DOCUMENT_FIELD_OVERRIDES_ATTR]: JSON.stringify({
          v: 1,
          fields: {
            "custom-x": { display: false, displayAs: "X", order: 1, editable: true },
          },
        }),
      })
      .mockResolvedValueOnce({
        id: "doc",
        "custom-x": "1",
        [DOCUMENT_FIELD_OVERRIDES_ATTR]: JSON.stringify({
          v: 1,
          fields: {
            "custom-x": { display: false, displayAs: "X", order: 1, editable: true },
          },
        }),
      })
      .mockResolvedValue({ id: "doc" });
    const store = initializeStore();
    await store.loadDocumentAttributes();
    await store.deleteCustomAttribute("custom-x");
    expect(writeBlockAttrs).toHaveBeenCalledWith(
      "doc",
      expect.objectContaining({
        "custom-x": "",
        [DOCUMENT_FIELD_OVERRIDES_ATTR]: "",
      }),
    );
  });
});

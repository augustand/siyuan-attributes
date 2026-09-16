import { createPinia } from "pinia";
import { createApp, defineComponent } from "vue";
import type { App } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAttributesStore } from "@/store/attribute";
import { normalizeCustomAttributeKey } from "@/services/attributeKeys";
import { fetchAttributeViews, writeDatabaseCell } from "@/services/attributeViews";
import type { DatabaseField, DatabasePanel } from "@/models/attributeView";
import type { Store } from "pinia";

const fetchBlockAttrs = vi.fn();
const writeBlockAttrs = vi.fn();
const fetchAttributeViewsMock = vi.fn();
const writeDatabaseCellMock = vi.fn();
const apps: Array<App<Element>> = [];

vi.mock("@/services/blockAttrs", () => ({
  fetchBlockAttrs: (id: string) => fetchBlockAttrs(id),
  writeBlockAttrs: (id: string, attrs: Record<string, string>) => writeBlockAttrs(id, attrs),
}));

vi.mock("@/services/attributeViews", () => ({
  fetchAttributeViews: (id: string) => fetchAttributeViewsMock(id),
  writeDatabaseCell: (input: { avID: string; field: DatabaseField }) => writeDatabaseCellMock(input),
}));

vi.mock("@/store/rules", () => ({
  useConfigStore: () => ({
    matchDocumentRule: (name: string) => name === "custom-x"
      ? {
          id: "test-x", name: "X", rule: name, matchMethod: "exact", scope: "document",
          display: true, displayAs: "X", editable: true, order: 1000,
        }
      : undefined,
  }),
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

  function createDatabasePanel(): DatabasePanel {
    const value: DatabaseField["value"] = {
      id: "value-text",
      keyID: "key-text",
      itemID: "item-1",
      type: "text",
      text: "old",
      url: "",
      email: "",
      phone: "",
      template: "",
      checked: false,
      options: [],
      raw: {},
    };

    return {
      avID: "av-1",
      avName: "Database",
      fields: [{
        keyID: "key-text",
        name: "Notes",
        type: "text",
        icon: "view-list",
        editable: true,
        value,
        options: [],
      }],
    };
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

  it("stores normalized database panels atomically", async () => {
    const panel = createDatabasePanel();
    fetchBlockAttrs.mockResolvedValue({ id: "doc", "custom-avs": "av-1" });
    fetchAttributeViewsMock.mockResolvedValue([panel]);
    const store = initializeStore();

    await store.loadDocumentAttributes();
    await store.loadDatabaseAttributes();
    await store.loadDatabaseAttributes();

    expect(fetchAttributeViewsMock).toHaveBeenCalledTimes(3);
    expect(store.dataBaseAttributes["av-1"]).toEqual(panel);
    expect("keyValues" in store.dataBaseAttributes["av-1"]).toBe(false);
  });

  it("writes database cells by itemID and refreshes document state", async () => {
    const panel = createDatabasePanel();
    const [field] = panel.fields;
    writeDatabaseCellMock.mockResolvedValue(undefined);
    fetchBlockAttrs.mockResolvedValue({ id: "doc", "custom-avs": "av-1" });
    fetchAttributeViewsMock.mockResolvedValue([panel]);
    const store = initializeStore();

    field.value.text = "new";
    await store.writeDatabaseCell({
      avID: "av-1",
      field,
    });

    expect(writeDatabaseCellMock).toHaveBeenCalledWith({
      avID: "av-1",
      field,
    });
    expect(field.value.itemID).toBe("item-1");
    expect("rowID" in field.value).toBe(false);
    expect(field.value.text).toBe("new");
  });
});

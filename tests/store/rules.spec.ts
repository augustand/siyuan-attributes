import { createPinia, setActivePinia } from "pinia";
import { createApp, defineComponent } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useConfigStore } from "@/store/rules";
import type { PluginDataStore } from "@/services/settings";
import type { DatabaseField, DatabasePanel } from "@/models/attributeView";

const data = new Map<string, unknown>();
const pluginDataStore: PluginDataStore = {
  loadData: vi.fn(async (key: string) => data.get(key)),
  saveData: vi.fn(async (key: string, value: unknown) => {
    data.set(key, value);
  }),
};

const apps: Array<ReturnType<typeof createApp>> = [];

function initializeStore() {
  let initializedStore: ReturnType<typeof useConfigStore>;
  const app = createApp(defineComponent({
    setup() {
      initializedStore = useConfigStore();
      return () => null;
    },
  }));
  app.use(createPinia());
  app.provide("$plugin", pluginDataStore);
  app.mount(document.createElement("div"));
  apps.push(app);
  return initializedStore!;
}

describe("settings store", () => {
  beforeEach(() => {
    data.clear();
    setActivePinia(createPinia());
  });

  afterEach(() => {
    apps.splice(0).forEach((app) => app.unmount());
  });

  it("initializes versioned settings", async () => {
    const store = initializeStore();
    await store.initialize();

    expect(store.isReady).toBe(true);
    expect(store.settings.version).toBe(1);
    expect(data.get("settings-v1")).toMatchObject({ version: 1 });
  });

  it("updates and persists a rule", async () => {
    const store = initializeStore();
    await store.initialize();
    const id = store.settings.rules[0].id;

    await store.updateRule(id, { displayAs: "Custom ID", display: false });

    expect(store.settings.rules[0]).toMatchObject({ displayAs: "Custom ID", display: false });
    const persisted = data.get("settings-v1") as { rules: Array<{ id: string; displayAs: string }> };
    expect(persisted.rules.find((rule) => rule.id === id)?.displayAs).toBe("Custom ID");
  });

  it("locks immutable system fields when a rule is updated", async () => {
    const store = initializeStore();
    await store.initialize();
    const id = "system-id";

    await store.updateRule(id, { editable: true, rule: "name" });

    const rule = store.settings.rules.find((item) => item.id === id);
    expect(rule).toMatchObject({ editable: false, rule: "id" });
  });

  it("cannot enable unsupported database fields from settings", async () => {
    const store = initializeStore();
    await store.initialize();
    await store.updateSettings({
      ...store.settings,
      rules: [
        ...store.settings.rules,
        {
          id: "user-template", name: "Template", rule: "Template", matchMethod: "exact",
          scope: "database", display: true, displayAs: "Template", editable: true, order: 1,
        },
      ],
    });
    const unsupported: DatabaseField = {
      keyID: "key-template",
      name: "Template",
      type: "template",
      icon: "sum",
      editable: false,
      options: [],
      value: {
        id: "value-template", keyID: "key-template", itemID: "item-1", type: "template",
        text: "", url: "", email: "", phone: "", template: "calc", checked: false,
        options: [], raw: {},
      },
    };

    await store.updateRule("system-custom-avs-wildcard", { editable: true });

    expect(store.applyDatabaseRules([unsupported])[0].editable).toBe(false);
  });

  it("applies database visibility, names, editability, and ordering", async () => {
    const store = initializeStore();
    await store.initialize();
    await store.updateRule("system-custom-avs-wildcard", {
      display: true,
      displayAs: "Linked databases",
      editable: false,
      order: -10,
    });

    const field: DatabaseField = {
      keyID: "key-avs",
      name: "custom-avs-project",
      type: "text",
      icon: "old-icon",
      editable: true,
      options: [],
      value: {
        id: "value-avs", keyID: "key-avs", itemID: "item-1", type: "text", text: "",
        url: "", email: "", phone: "", template: "", checked: false, options: [], raw: {},
      },
    };
    const other: DatabaseField = {
      ...field,
      keyID: "key-notes",
      name: "Notes",
      value: { ...field.value, keyID: "key-notes", text: "private" },
    };

    const fields = store.applyDatabaseRules([field, other]);
    expect(fields).toHaveLength(1);
    expect(fields[0]).toMatchObject({
      name: "Linked databases",
      editable: false, // source field is unsupported/read-only, so the rule cannot enable it
      order: -10,
    });
  });

  it("prefers exact database field rules over abstract rules", async () => {
    const store = initializeStore();
    await store.initialize();
    const panel: DatabasePanel = {
      avID: "av-1",
      avName: "Database",
      fields: [{
        keyID: "field-1", name: "Raw name", type: "text", icon: "old-icon",
        editable: true, options: [],
        value: {
          id: "value-1", keyID: "field-1", itemID: "item-1", type: "text", text: "",
          url: "", email: "", phone: "", template: "", checked: false, options: [], raw: {},
        },
      }],
    };

    await store.setDatabaseFieldRules([{
      id: "field:av-1:field-1",
      databaseId: "av-1",
      fieldId: "field-1",
      display: true,
      displayAs: "Exact alias",
      editable: true,
      order: -5,
      icon: "new-icon",
    }]);


    const fields = store.applyDatabaseRules(panel.fields, "av-1");
    expect(fields).toEqual([{
      ...panel.fields[0],
      name: "Exact alias",
      editable: true,
      icon: "new-icon",
      order: -5,
    }]);
  });

  it("hides database fields when their exact rule is disabled", async () => {
    const store = initializeStore();
    const panel: DatabasePanel = {
      avID: "av-1",
      avName: "Database",
      fields: [{
        keyID: "field-1", name: "Raw name", type: "text", icon: "icon",
        editable: true, options: [],
        value: {
          id: "value-1", keyID: "field-1", itemID: "item-1", type: "text", text: "",
          url: "", email: "", phone: "", template: "", checked: false, options: [], raw: {},
        },
      }],
    };

    await store.setDatabaseFieldRules([{
      id: "field:av-1:field-1", databaseId: "av-1", fieldId: "field-1",
      display: false, displayAs: "Hidden", editable: false, order: 1,
    }]);

    expect(store.applyDatabaseRules(panel.fields)).toEqual([]);
  });

  it("upserts stable exact document rules", async () => {
    const store = initializeStore();
    await store.initialize();
    const rule = {
      id: "field:document:custom-project",
      name: "custom-project",
      rule: "custom-project",
      matchMethod: "exact" as const,
      scope: "document" as const,
      display: true,
      displayAs: "Project",
      editable: true,
      order: 10,
    };

    await store.upsertDocumentFieldRules([rule]);
    await store.upsertDocumentFieldRules([{ ...rule, displayAs: "Project changed" }]);

    expect(store.settings.rules.filter((item) => item.rule === "custom-project")).toHaveLength(1);
    expect(store.settings.rules.find((item) => item.rule === "custom-project")?.displayAs).toBe("Project changed");
  });

  it("resets settings", async () => {
    const store = initializeStore();
    await store.initialize();
    await store.updateSettings({ ...store.settings, showPanel: false });

    await store.resetSettings();

    expect(store.settings).toEqual(await import("@/models/settings").then((module) => module.DEFAULT_PANEL_SETTINGS));
  });
});

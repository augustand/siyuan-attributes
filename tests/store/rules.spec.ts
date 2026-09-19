import { createPinia } from "pinia";
import { createApp, defineComponent } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useConfigStore } from "@/store/rules";
import type { PluginDataStore } from "@/services/settings";

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

  it("resets settings", async () => {
    const store = initializeStore();
    await store.initialize();
    await store.updateSettings({ ...store.settings, showPanel: false });

    await store.resetSettings();

    expect(store.settings).toEqual(await import("@/models/settings").then((module) => module.DEFAULT_PANEL_SETTINGS));
  });

  it("prefers exact matches over wildcard/regex when resolving a rule", async () => {
    const store = initializeStore();
    await store.initialize();
    await store.updateSettings({
      ...store.settings,
      rules: [
        {
          id: "wild",
          name: "Wild",
          rule: "custom-*",
          matchMethod: "wildcard",
          scope: "document",
          display: true,
          displayAs: "Wild",
          editable: true,
          renderMethod: "input",
          order: 1,
        },
        {
          id: "exact",
          name: "Exact",
          rule: "custom-priority",
          matchMethod: "exact",
          scope: "document",
          display: true,
          displayAs: "Exact",
          editable: true,
          renderMethod: "input",
          order: 99,
        },
      ],
    });

    expect(store.matchDocumentRule("custom-priority")?.id).toBe("exact");
  });
});

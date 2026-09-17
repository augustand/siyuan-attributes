import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  loadPanelSettings,
  resetPanelSettings,
  savePanelSettings,
} from "@/services/settings";
import { DEFAULT_PANEL_SETTINGS } from "@/models/settings";

const data = new Map<string, unknown>();
const pluginDataStore = {
  loadData: vi.fn(async (key: string) => data.get(key)),
  saveData: vi.fn(async (key: string, value: unknown) => {
    data.set(key, value);
  }),
};

describe("settings persistence", () => {
  beforeEach(() => {
    data.clear();
    pluginDataStore.loadData.mockClear();
    pluginDataStore.saveData.mockClear();
  });

  it("migrates legacy settings into settings-v1", async () => {
    data.set("configurations", { show: false, showSettings: { page: false } });
    data.set("rules", [{
      name: "命名",
      rule: "name",
      matchMethod: "精确",
      display: true,
      displayAs: "Old name",
      editable: false,
      order: 7,
    }]);

    const settings = await loadPanelSettings(pluginDataStore);

    expect(settings.showPanel).toBe(false);
    expect(settings.showDocumentPanel).toBe(false);
    expect(settings.rules.find((rule) => rule.rule === "name")).toMatchObject({
      matchMethod: "exact",
      displayAs: "Old name",
      editable: false,
      order: 7,
    });
    expect(data.get("settings-v1")).toMatchObject({ version: 1 });
  });

  it("loads versioned settings without deleting legacy keys", async () => {
    const settings = { ...DEFAULT_PANEL_SETTINGS, showPanel: false };
    data.set("settings-v1", settings);
    data.set("rules", [{ rule: "legacy" }]);

    await expect(loadPanelSettings(pluginDataStore)).resolves.toMatchObject({
      showPanel: false,
    });
    expect(data.has("rules")).toBe(true);
  });

  it("saves normalized settings", async () => {
    await savePanelSettings(pluginDataStore, {
      ...DEFAULT_PANEL_SETTINGS,
      // @ts-expect-error exercise runtime normalization
      version: 2,
    });

    expect(data.get("settings-v1")).toMatchObject({
      version: 1,
    });
  });

  it("resets to defaults", async () => {
    await resetPanelSettings(pluginDataStore);
    expect(data.get("settings-v1")).toEqual(DEFAULT_PANEL_SETTINGS);
  });
});

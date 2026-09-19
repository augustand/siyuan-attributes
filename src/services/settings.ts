import {
  normalizeLegacySettings,
  normalizePanelSettings,
  DEFAULT_PANEL_SETTINGS,
} from "@/models/settings";
import type { PanelSettings } from "@/models/settings";

const SETTINGS_KEY = "settings-v1";
const LEGACY_RULES_KEY = "rules";
const LEGACY_CONFIGURATIONS_KEY = "configurations";

export interface PluginDataStore {
  loadData(storageName: string): Promise<any>;
  saveData(storageName: string, content: any): Promise<unknown>;
}

export async function loadPanelSettings(store: PluginDataStore): Promise<PanelSettings> {
  const settings = await store.loadData(SETTINGS_KEY);
  const [legacyRules, legacyConfigurations] = await Promise.all([
    store.loadData(LEGACY_RULES_KEY),
    store.loadData(LEGACY_CONFIGURATIONS_KEY),
  ]);
  const normalized = normalizeLegacySettings({
    settings,
    legacyRules,
    legacyConfigurations,
  });

  await savePanelSettings(store, normalized);
  return normalized;
}

export async function savePanelSettings(
  store: PluginDataStore,
  settings: PanelSettings,
): Promise<void> {
  await store.saveData(SETTINGS_KEY, normalizePanelSettings(settings));
}

export async function resetPanelSettings(store: PluginDataStore): Promise<PanelSettings> {
  const settings = normalizePanelSettings(DEFAULT_PANEL_SETTINGS);
  await savePanelSettings(store, settings);
  return settings;
}

import { defineStore } from "pinia";
import { computed, inject, ref } from "vue";
import type { Plugin } from "siyuan";
import type { DatabaseField, DatabasePanel } from "@/models/attributeView";
import type { DatabaseAvPrefs } from "@/models/databasePrefs";
import {
  filterVisibleFields,
  normalizeDatabaseAvPrefs,
  resolveAvPrefs,
} from "@/models/databasePrefs";
import { fetchAttributeViews, writeDatabaseCell } from "@/services/attributeView";
import { useConfigStore } from "@/store/rules";

const storeId = "mux-siyuan-plugin-database-panel";

export const useDatabasePanelStore = defineStore(storeId, () => {
  const plugin = inject("$plugin") as Plugin | undefined;
  const docId = inject("$docId") as string | undefined;
  const settingsStore = useConfigStore();

  const panels = ref<DatabasePanel[]>([]);
  const activeAvID = ref("");
  const isLoading = ref(false);
  const isSaving = ref(false);
  const loadError = ref<string | null>(null);

  const activePanel = computed(() => panels.value.find((p) => p.avID === activeAvID.value));

  const activePrefs = computed<DatabaseAvPrefs>(() => {
    if (!activeAvID.value) {
      return normalizeDatabaseAvPrefs({}, settingsStore.settings.databaseDefaults);
    }
    return resolveAvPrefs(
      activeAvID.value,
      settingsStore.settings.databasePrefs,
      settingsStore.settings.databaseDefaults,
    );
  });

  const visibleFields = computed(() => {
    const fields = activePanel.value?.fields ?? [];
    return filterVisibleFields(fields, activePrefs.value);
  });

  async function load(documentID = docId ?? ""): Promise<void> {
    if (!documentID) {
      panels.value = [];
      activeAvID.value = "";
      return;
    }
    isLoading.value = true;
    loadError.value = null;
    try {
      const next = await fetchAttributeViews(documentID);
      panels.value = next;
      if (!next.some((p) => p.avID === activeAvID.value)) {
        activeAvID.value = next[0]?.avID ?? "";
      }
    } catch (error) {
      panels.value = [];
      activeAvID.value = "";
      loadError.value = error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      isLoading.value = false;
    }
  }

  function setActiveAv(avID: string): void {
    if (panels.value.some((p) => p.avID === avID)) {
      activeAvID.value = avID;
    }
  }

  async function saveField(field: DatabaseField): Promise<void> {
    const avID = activeAvID.value;
    if (!avID) throw new Error("No active database");
    isSaving.value = true;
    try {
      await writeDatabaseCell({ avID, field });
    } finally {
      isSaving.value = false;
    }
  }

  async function updateAvPrefs(avID: string, patch: Partial<DatabaseAvPrefs>): Promise<void> {
    const defaults = settingsStore.settings.databaseDefaults;
    const current = resolveAvPrefs(avID, settingsStore.settings.databasePrefs, defaults);
    const nextPrefs = normalizeDatabaseAvPrefs({ ...current, ...patch }, defaults);
    await settingsStore.updateSettings({
      ...settingsStore.settings,
      databasePrefs: {
        ...settingsStore.settings.databasePrefs,
        [avID]: nextPrefs,
      },
    });
    void plugin;
  }

  return {
    panels,
    activeAvID,
    activePanel,
    activePrefs,
    visibleFields,
    isLoading,
    isSaving,
    loadError,
    load,
    setActiveAv,
    saveField,
    updateAvPrefs,
  };
});

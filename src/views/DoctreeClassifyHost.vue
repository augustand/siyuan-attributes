<template>
  <AddToDatabaseDialog
    v-model:visible="showPick"
    :doc-id="pickDocId"
    :databases="pickDatabases"
    :owned-av-ids="ownedAvIds"
    :bound-av-ids="boundAvIds"
    @bound="onBound"
  />
</template>

<script setup lang="ts">
/**
 * Body-hosted「更多表格…」picker. Menu registration lives on
 * Plugin.eventBus in index.ts; the doctree menu dispatches
 * CLASSIFY_PICK_TABLE_EVENT and this host opens the table picker.
 */
import { inject, onMounted, onUnmounted, ref } from "vue";
import { MessagePlugin } from "tdesign-vue-next";
import type { Plugin } from "siyuan";
import AddToDatabaseDialog from "@/components/AddToDatabaseDialog.vue";
import type { OwnedDatabase } from "@/models/ownedDatabase";
import { fetchAttributeViews } from "@/services/attributeView";
import {
  CLASSIFY_PICK_TABLE_EVENT,
  type ClassifyPickTableDetail,
} from "@/services/doctreeClassifyEvents";
import {
  checkOwnedDatabasesHealth,
  type OwnedDatabaseHealth,
} from "@/services/ownedDatabase";
import { refreshDocumentEditor } from "@/services/refreshEditor";
import { loadPanelSettings, type PluginDataStore } from "@/services/settings";

const plugin = inject<Plugin>("$plugin")!;

const showPick = ref(false);
const pickDocId = ref("");
const pickDatabases = ref<OwnedDatabase[]>([]);
const ownedAvIds = ref<string[]>([]);
const boundAvIds = ref<string[]>([]);

/** Same store shape the doctree services use for panel settings. */
function pluginDataStore(): PluginDataStore {
  return {
    loadData: (key: string) => plugin.loadData(key),
    saveData: (key: string, value: unknown) => plugin.saveData(key, value),
  };
}

async function openPickTable(docId: string) {
  pickDocId.value = docId;
  pickDatabases.value = [];
  ownedAvIds.value = [];
  boundAvIds.value = [];
  try {
    const settings = await loadPanelSettings(pluginDataStore());
    const databases = settings.ownedDatabases ?? [];
    ownedAvIds.value = databases.map((d) => d.avID);
    let health: Record<string, OwnedDatabaseHealth> = {};
    try {
      health = await checkOwnedDatabasesHealth(databases);
    } catch (e) {
      console.warn("checkOwnedDatabasesHealth failed", e);
    }
    pickDatabases.value = databases.filter(
      (db) => (health[db.avID] ?? "ok") === "ok",
    );
  } catch (e) {
    MessagePlugin.error(e instanceof Error ? e.message : String(e));
  }
  try {
    const panels = await fetchAttributeViews(docId);
    boundAvIds.value = panels.map((p) => p.avID);
  } catch {
    boundAvIds.value = [];
  }
  showPick.value = true;
}

function onPickTable(event: Event) {
  const detail = (event as CustomEvent<ClassifyPickTableDetail>).detail;
  if (!detail?.docId) return;
  void openPickTable(detail.docId);
}

async function onBound() {
  const docId = pickDocId.value;
  showPick.value = false;
  if (!docId) return;
  try {
    await refreshDocumentEditor(docId, plugin);
  } catch (e) {
    MessagePlugin.error(e instanceof Error ? e.message : String(e));
  }
}

onMounted(() => {
  window.addEventListener(CLASSIFY_PICK_TABLE_EVENT, onPickTable);
});

onUnmounted(() => {
  window.removeEventListener(CLASSIFY_PICK_TABLE_EVENT, onPickTable);
});
</script>

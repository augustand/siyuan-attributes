<template>
  <DatabasePanel v-if="settingsStore.settings.showPanel" />
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, inject } from "vue";
import { MessagePlugin } from "tdesign-vue-next";
import type { EventBus, IProtyle, Plugin } from "siyuan";
import { useConfigStore } from "./store/rules";
import { useDatabasePanelStore } from "./store/databasePanel";
import DatabasePanel from "./views/DatabasePanel.vue";
import { setI18n } from "./services/i18n";
import { onSettingsChanged } from "./services/settingEvents";

const plugin = inject<Plugin>("$plugin");
const eventBus = inject<EventBus>("$EventBus");
setI18n(plugin?.i18n as Record<string, unknown> | undefined);

const settingsStore = useConfigStore();
const databaseStore = useDatabasePanelStore();
let refreshTimer: ReturnType<typeof setTimeout> | undefined;
const removeSettingsChangedListener = onSettingsChanged(() => {
  void reloadFromSettings();
});

function refreshDatabase(): void {
  void databaseStore.load().catch((error) => {
    MessagePlugin.error(error instanceof Error ? error.message : "加载数据库属性失败");
  });
}

function scheduleRefresh(): void {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(refreshDatabase, 250);
}

function handleProtyle(_event: CustomEvent<{ protyle: IProtyle }>): void {
  scheduleRefresh();
}

onMounted(() => {
  void settingsStore
    .initialize()
    .then(refreshDatabase)
    .catch((error) => {
      MessagePlugin.error(error instanceof Error ? error.message : "加载设置失败");
    });
  eventBus?.on("loaded-protyle-dynamic", handleProtyle);
  eventBus?.on("switch-protyle", handleProtyle);
});

onUnmounted(() => {
  clearTimeout(refreshTimer);
  eventBus?.off("loaded-protyle-dynamic", handleProtyle);
  eventBus?.off("switch-protyle", handleProtyle);
  removeSettingsChangedListener();
});

async function reloadFromSettings(): Promise<void> {
  await settingsStore.initialize();
  refreshDatabase();
}
</script>

<style scoped></style>

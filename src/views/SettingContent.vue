<template>
  <div class="mux-db-settings">
    <h2>{{ labels.title }}</h2>
    <p class="help">{{ labels.help }}</p>

    <h3>{{ labels.ours }}</h3>
    <p class="help">{{ labels.oursHelp }}</p>
    <div v-for="db in draft.ownedDatabases" :key="db.id" class="rule-card">
      <t-input v-model="db.name" :placeholder="labels.name" />
      <p class="muted">{{ labels.hintIds }}</p>
      <t-button size="small" variant="outline" theme="danger" @click="remove(db.avID)">
        {{ labels.delete }}
      </t-button>
    </div>
    <p v-if="!draft.ownedDatabases.length" class="muted">{{ labels.empty }}</p>

    <div class="actions">
      <t-button theme="primary" :loading="saving" @click="save">{{ labels.save }}</t-button>
      <t-button variant="outline" :loading="saving" @click="reset">{{ labels.reset }}</t-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { MessagePlugin } from "tdesign-vue-next";
import { normalizePanelSettings } from "@/models/settings";
import type { PanelSettings } from "@/models/settings";
import { getI18nText } from "@/services/i18n";
import { useConfigStore } from "@/store/rules";

const settingsStore = useConfigStore();
const saving = ref(false);
const draft = reactive<PanelSettings>(normalizePanelSettings(undefined));

const labels = computed(() => ({
  title: getI18nText("settings.title", "文档数据库"),
  help: getI18nText(
    "settings.help",
    "维护「我们的库」名单。日常请用右侧 Dock：收藏 / 新建 / 添加到数据库。字段编辑用思源原生面板。",
  ),
  ours: getI18nText("settings.ours", "我们的库（可改显示名）"),
  oursHelp: getI18nText(
    "settings.oursHelp",
    "这里只改显示名；添加库请在 Dock 里「收藏已有」或「新建」。",
  ),
  name: getI18nText("settings.dbName", "显示名"),
  hintIds: getI18nText("settings.hintIds", "底层仍是思源数据库，无需记忆 ID"),
  empty: getI18nText("settings.ownedEmpty", "名单为空"),
  delete: getI18nText("settings.delete", "从名单移除"),
  save: getI18nText("settings.save", "保存设置"),
  reset: getI18nText("settings.reset", "恢复默认"),
}));

function syncDraftFromStore(): void {
  const next = normalizePanelSettings(settingsStore.settings);
  draft.ownedDatabases = next.ownedDatabases.map((d) => ({ ...d }));
  draft.showUnderTitlePanel = false;
  draft.version = 1;
}

function remove(avID: string) {
  draft.ownedDatabases = draft.ownedDatabases.filter((d) => d.avID !== avID);
}

onMounted(async () => {
  try {
    await settingsStore.initialize();
    syncDraftFromStore();
  } catch (error) {
    MessagePlugin.error(error instanceof Error ? error.message : String(error));
  }
});

async function save(): Promise<void> {
  saving.value = true;
  try {
    await settingsStore.updateSettings(
      normalizePanelSettings({
        ...settingsStore.settings,
        showUnderTitlePanel: false,
        ownedDatabases: draft.ownedDatabases,
      }),
    );
    syncDraftFromStore();
    MessagePlugin.success(getI18nText("settings.saveSuccess", "设置已保存"));
  } catch (error) {
    MessagePlugin.error(error instanceof Error ? error.message : String(error));
  } finally {
    saving.value = false;
  }
}

async function reset(): Promise<void> {
  saving.value = true;
  try {
    await settingsStore.resetSettings();
    syncDraftFromStore();
    MessagePlugin.success(getI18nText("settings.resetSuccess", "已恢复默认设置"));
  } catch (error) {
    MessagePlugin.error(error instanceof Error ? error.message : String(error));
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.mux-db-settings {
  padding: 16px 20px;
  max-width: 640px;
}
.help {
  color: var(--td-text-color-secondary);
  font-size: 13px;
  margin: 0 0 8px;
}
.muted {
  font-size: 12px;
  opacity: 0.8;
}
.rule-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px;
  margin-bottom: 10px;
  border: 1px solid var(--td-component-border);
  border-radius: 6px;
}
.actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}
</style>

<template>
  <div class="mux-db-settings">
    <h2>{{ labels.title }}</h2>
    <p class="help">{{ labels.help }}</p>
    <p class="help muted">{{ labels.coexist }}</p>

    <t-form label-align="top">
      <t-form-item :label="labels.showPanel">
        <t-switch v-model="draft.showPanel" />
      </t-form-item>
      <t-form-item :label="labels.hidePrimaryKey">
        <t-switch v-model="draft.databaseDefaults.hidePrimaryKey" />
      </t-form-item>
      <t-form-item :label="labels.hideEmpty">
        <t-switch v-model="draft.databaseDefaults.hideEmpty" />
      </t-form-item>
    </t-form>

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
  title: getI18nText("settings.title", "数据库属性面板"),
  help: getI18nText(
    "settings.help",
    "在文档标题下显示并编辑该文档绑定的数据库字段。文档 custom 属性编辑已暂停。",
  ),
  coexist: getI18nText(
    "settings.coexist",
    "若同时安装了其他数据库属性面板插件，标题下可能出现两个面板。",
  ),
  showPanel: getI18nText("settings.showPanel", "显示面板"),
  hidePrimaryKey: getI18nText("settings.hidePrimaryKey", "默认隐藏主键"),
  hideEmpty: getI18nText("settings.hideEmpty", "默认隐藏空字段"),
  save: getI18nText("settings.save", "保存设置"),
  reset: getI18nText("settings.reset", "恢复默认"),
}));

function syncDraftFromStore(): void {
  const next = normalizePanelSettings(settingsStore.settings);
  draft.showPanel = next.showPanel;
  draft.databaseDefaults = { ...next.databaseDefaults };
  draft.databasePrefs = { ...next.databasePrefs };
  draft.rules = next.rules;
  draft.version = 1;
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
        showPanel: draft.showPanel,
        databaseDefaults: { ...draft.databaseDefaults },
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
  max-width: 560px;
}

.help {
  color: var(--td-text-color-secondary);
  font-size: 13px;
  margin: 0 0 8px;
}

.muted {
  opacity: 0.85;
}

.actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}
</style>

<template>
  <div class="mux-db-settings">
    <h2>{{ labels.title }}</h2>
    <p class="help">{{ labels.help }}</p>
    <p class="help muted">{{ labels.nativeNote }}</p>

    <h3>{{ labels.rulesTitle }}</h3>
    <p class="help">{{ labels.rulesHelp }}</p>
    <div v-for="(rule, index) in draft.docDatabaseRules" :key="rule.id" class="rule-card">
      <t-input v-model="rule.name" :placeholder="labels.ruleName" />
      <t-input v-model="rule.notebookId" :placeholder="labels.notebookId" />
      <t-input v-model="rule.pathPrefix" :placeholder="labels.pathPrefix" />
      <t-input v-model="rule.avID" :placeholder="labels.avID" />
      <t-input v-model="rule.avBlockID" :placeholder="labels.avBlockID" />
      <div class="rule-row">
        <t-checkbox v-model="rule.enabled">{{ labels.enabled }}</t-checkbox>
        <t-button size="small" variant="outline" theme="danger" @click="removeRule(index)">
          {{ labels.delete }}
        </t-button>
      </div>
    </div>
    <t-button variant="dashed" block class="add-rule" @click="addRule">{{ labels.addRule }}</t-button>

    <div class="actions">
      <t-button theme="primary" :loading="saving" @click="save">{{ labels.save }}</t-button>
      <t-button variant="outline" :loading="saving" @click="reset">{{ labels.reset }}</t-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { MessagePlugin } from "tdesign-vue-next";
import { normalizeDocDatabaseRules } from "@/models/docDatabaseRules";
import type { DocDatabaseRule } from "@/models/docDatabaseRules";
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
    "管理文档与数据库的绑定规则。字段编辑请使用思源原生「数据库」区域。",
  ),
  nativeNote: getI18nText(
    "settings.nativeNote",
    "本插件不再在标题下展示属性面板，避免与系统重复。",
  ),
  rulesTitle: getI18nText("settings.rulesTitle", "绑定规则"),
  rulesHelp: getI18nText(
    "settings.rulesHelp",
    "按笔记本或路径前缀指定默认数据库。avID / 数据库块 ID 可从数据库块属性中查看。",
  ),
  ruleName: getI18nText("settings.ruleName", "规则名称"),
  notebookId: getI18nText("settings.notebookId", "笔记本 ID（可选）"),
  pathPrefix: getI18nText("settings.pathPrefix", "路径前缀（可选）"),
  avID: getI18nText("settings.avID", "数据库 avID"),
  avBlockID: getI18nText("settings.avBlockID", "数据库块 ID"),
  enabled: getI18nText("settings.enabled", "启用"),
  addRule: getI18nText("settings.addRule", "添加规则"),
  delete: getI18nText("settings.delete", "删除"),
  save: getI18nText("settings.save", "保存设置"),
  reset: getI18nText("settings.reset", "恢复默认"),
}));

function syncDraftFromStore(): void {
  const next = normalizePanelSettings(settingsStore.settings);
  draft.docDatabaseRules = next.docDatabaseRules.map((r) => ({ ...r }));
  draft.showUnderTitlePanel = false;
  draft.version = 1;
}

function addRule(): void {
  const id = `rule-${Date.now()}`;
  draft.docDatabaseRules.push({
    id,
    name: "",
    notebookId: "",
    pathPrefix: "",
    avID: "",
    avBlockID: "",
    enabled: true,
  } as DocDatabaseRule);
}

function removeRule(index: number): void {
  draft.docDatabaseRules.splice(index, 1);
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
    const rules = normalizeDocDatabaseRules(
      draft.docDatabaseRules.map((r) => ({
        ...r,
        notebookId: r.notebookId || undefined,
        pathPrefix: r.pathPrefix || undefined,
      })),
    );
    await settingsStore.updateSettings(
      normalizePanelSettings({
        ...settingsStore.settings,
        showUnderTitlePanel: false,
        docDatabaseRules: rules,
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
  opacity: 0.85;
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

.rule-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.add-rule {
  margin-top: 4px;
}

.actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}
</style>

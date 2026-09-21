<template>
  <div class="mux-doc-db-dock">
    <section>
      <h3>{{ labels.current }}</h3>
      <p v-if="!docId" class="muted">{{ labels.noDoc }}</p>
      <template v-else>
        <p class="meta">ID: {{ docId }}</p>
        <div v-if="isLoading" class="muted">{{ labels.loading }}</div>
        <div v-else-if="error" class="error">{{ error }}</div>

        <div v-if="boundPanels.length" class="list">
          <div v-for="panel in boundPanels" :key="panel.avID" class="row">
            <span>{{ panel.avName || panel.avID }}</span>
            <t-button size="small" variant="outline" theme="danger" @click="onUnbind(panel.avID)">
              {{ labels.unbind }}
            </t-button>
          </div>
        </div>
        <p v-else class="muted">{{ labels.notBound }}</p>

        <div v-if="unboundMatchedRules.length" class="suggest">
          <p>{{ labels.suggest }}</p>
          <div v-for="rule in unboundMatchedRules" :key="rule.id" class="row">
            <span>{{ rule.name }}</span>
            <t-button size="small" theme="primary" @click="onBind(rule)">
              {{ labels.bind }}
            </t-button>
          </div>
        </div>
      </template>
    </section>

    <section>
      <h3>{{ labels.query }}</h3>
      <t-select
        v-model="selectedAv"
        :options="avOptions"
        :placeholder="labels.pickAv"
        clearable
        @change="onPickAv"
      />
      <div v-if="boundDocs.length" class="list">
        <div
          v-for="doc in boundDocs"
          :key="doc.id"
          class="row clickable"
          @click="onOpen(doc.id)"
        >
          <span>{{ doc.content }}</span>
        </div>
      </div>
      <p v-else-if="selectedAv" class="muted">{{ labels.noRows }}</p>
    </section>

    <section>
      <h3>{{ labels.rules }}</h3>
      <p class="muted">{{ labels.rulesHint }}</p>
      <ul v-if="rules.length">
        <li v-for="rule in rules" :key="rule.id">
          {{ rule.name || rule.avID }}
          <span v-if="!rule.enabled">({{ labels.disabled }})</span>
        </li>
      </ul>
      <p v-else class="muted">{{ labels.noRules }}</p>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { storeToRefs } from "pinia";
import { MessagePlugin } from "tdesign-vue-next";
import type { DocDatabaseRule } from "@/models/docDatabaseRules";
import { getI18nText } from "@/services/i18n";
import { useDocDatabaseStore } from "@/store/docDatabase";
import { useConfigStore } from "@/store/rules";

const store = useDocDatabaseStore();
const settingsStore = useConfigStore();
const {
  docId,
  boundPanels,
  boundDocs,
  isLoading,
  error,
  rules,
  unboundMatchedRules,
} = storeToRefs(store);

const selectedAv = ref("");

const labels = computed(() => ({
  current: getI18nText("docDb.current", "当前文档"),
  noDoc: getI18nText("docDb.noDoc", "打开一篇文档后可在此管理绑定"),
  loading: getI18nText("docDb.loading", "加载中…"),
  notBound: getI18nText("docDb.notBound", "尚未绑定任何数据库"),
  suggest: getI18nText("docDb.suggest", "匹配到规则，可一键绑定："),
  bind: getI18nText("docDb.bind", "绑定"),
  unbind: getI18nText("docDb.unbind", "解绑"),
  query: getI18nText("docDb.query", "库内文档"),
  pickAv: getI18nText("docDb.pickAv", "选择数据库（规则中的库）"),
  noRows: getI18nText("docDb.noRows", "没有条目"),
  rules: getI18nText("docDb.rules", "已配置规则"),
  rulesHint: getI18nText("docDb.rulesHint", "在插件设置中编辑绑定规则"),
  noRules: getI18nText("docDb.noRules", "暂无规则"),
  disabled: getI18nText("docDb.disabled", "已禁用"),
}));

const avOptions = computed(() =>
  rules.value.map((r) => ({ label: r.name || r.avID, value: r.avID })),
);

async function onBind(rule: DocDatabaseRule) {
  try {
    await store.bindRule(rule);
    MessagePlugin.success(getI18nText("docDb.bindOk", "已绑定"));
  } catch (e) {
    MessagePlugin.error(e instanceof Error ? e.message : String(e));
  }
}

async function onUnbind(avID: string) {
  try {
    await store.unbind(avID);
    MessagePlugin.success(getI18nText("docDb.unbindOk", "已解绑"));
  } catch (e) {
    MessagePlugin.error(e instanceof Error ? e.message : String(e));
  }
}

async function onPickAv(avID: string) {
  selectedAv.value = avID;
  if (!avID) {
    await store.loadBoundDocs("");
    return;
  }
  try {
    await store.loadBoundDocs(avID);
  } catch (e) {
    MessagePlugin.error(e instanceof Error ? e.message : String(e));
  }
}

async function onOpen(id: string) {
  try {
    await store.openDoc(id);
  } catch (e) {
    MessagePlugin.error(e instanceof Error ? e.message : String(e));
  }
}

function readActiveDocFromDom(): { docId: string; path: string } {
  const title = document.querySelector(".protyle:not(.fn__none) .protyle-title[data-node-id]");
  const docId = title?.getAttribute("data-node-id") ?? "";
  return { docId, path: "" };
}

async function refreshContext() {
  await settingsStore.initialize().catch(() => undefined);
  const { docId: id, path } = readActiveDocFromDom();
  if (!id) return;
  await store.setContext({ docId: id, path, notebookId: "" }).catch((e) => {
    MessagePlugin.error(e instanceof Error ? e.message : String(e));
  });
}

let timer: ReturnType<typeof setInterval> | undefined;

onMounted(() => {
  void refreshContext();
  timer = setInterval(() => {
    const { docId: id } = readActiveDocFromDom();
    if (id && id !== store.docId) void refreshContext();
  }, 1500);
});

onUnmounted(() => {
  if (timer) clearInterval(timer);
});
</script>

<style scoped>
.mux-doc-db-dock {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
  overflow: auto;
  box-sizing: border-box;
}

h3 {
  margin: 0 0 8px;
  font-size: 14px;
}

.muted {
  color: var(--b3-theme-on-surface-light, #888);
  font-size: 12px;
}

.error {
  color: var(--b3-theme-error, #e33);
  font-size: 12px;
}

.meta {
  font-size: 12px;
  word-break: break-all;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 4px;
  background: var(--b3-theme-surface-lighter, rgba(255, 255, 255, 0.04));
}

.row.clickable {
  cursor: pointer;
}

.suggest {
  margin-top: 10px;
}

ul {
  margin: 0;
  padding-left: 18px;
  font-size: 13px;
}
</style>

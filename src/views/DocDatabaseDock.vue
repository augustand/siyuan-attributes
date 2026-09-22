<template>
  <div class="mux-doc-db-dock">
    <section>
      <div class="section-head">
        <h3>{{ labels.ours }}</h3>
        <div class="head-actions">
          <t-button size="small" variant="outline" @click="showRegister = true">
            {{ labels.register }}
          </t-button>
          <t-button size="small" theme="primary" @click="showCreate = true">
            {{ labels.create }}
          </t-button>
        </div>
      </div>

      <div v-if="!ownedDatabases.length" class="muted">{{ labels.oursEmpty }}</div>
      <div v-else class="list">
        <div v-for="db in ownedDatabases" :key="db.id" class="row">
          <span class="name">{{ db.name }}</span>
          <t-button size="small" variant="text" theme="danger" @click="removeOwned(db.avID)">
            {{ labels.remove }}
          </t-button>
        </div>
      </div>
    </section>

    <section>
      <h3>{{ labels.current }}</h3>
      <p v-if="!docId" class="muted">{{ labels.noDoc }}</p>
      <template v-else>
        <t-button
          block
          theme="primary"
          :disabled="!ownedDatabases.length"
          @click="showAdd = true"
        >
          {{ labels.addTo }}
        </t-button>

        <div v-if="boundOwned.length" class="list" style="margin-top: 10px">
          <div v-for="db in boundOwned" :key="db.avID" class="row">
            <span>{{ db.name }}</span>
            <t-button size="small" variant="outline" theme="danger" @click="onUnbind(db.avID)">
              {{ labels.unbind }}
            </t-button>
          </div>
        </div>
        <p v-else class="muted" style="margin-top: 8px">{{ labels.notBound }}</p>

        <t-button
          size="small"
          variant="text"
          style="margin-top: 8px"
          @click="collectFromPage"
        >
          {{ labels.collectPage }}
        </t-button>
      </template>
    </section>

    <AddToDatabaseDialog
      v-model:visible="showAdd"
      :doc-id="docId"
      :databases="ownedDatabases"
      :bound-av-ids="boundAvIds"
      @bound="onBound"
    />

    <t-dialog
      v-model:visible="showRegister"
      :header="labels.registerTitle"
      width="480px"
      :confirm-btn="labels.close"
      :cancel-btn="null"
    >
      <t-input
        v-model="searchKeyword"
        :placeholder="labels.searchPh"
        clearable
        @enter="runSearch"
      />
      <t-button size="small" style="margin: 8px 0" @click="runSearch">{{ labels.search }}</t-button>
      <div class="list">
        <div v-for="hit in searchHits" :key="hit.avID" class="row">
          <div>
            <div class="name">{{ hit.avName }}</div>
            <div class="muted path">{{ hit.hPath }}</div>
          </div>
          <t-button size="small" theme="primary" @click="registerHit(hit)">
            {{ labels.collect }}
          </t-button>
        </div>
      </div>
    </t-dialog>

    <t-dialog
      v-model:visible="showCreate"
      :header="labels.createTitle"
      width="420px"
      :confirm-btn="labels.createGo"
      @confirm="runCreate"
    >
      <t-form label-align="top">
        <t-form-item :label="labels.dbName">
          <t-input v-model="createName" :placeholder="labels.dbNamePh" />
        </t-form-item>
        <t-form-item :label="labels.notebook">
          <t-select v-model="createNotebookId" :options="notebookOptions" />
        </t-form-item>
      </t-form>
      <p class="muted">{{ labels.createHint }}</p>
    </t-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, onMounted, onUnmounted, ref } from "vue";
import { storeToRefs } from "pinia";
import { MessagePlugin } from "tdesign-vue-next";
import type { Plugin } from "siyuan";
import AddToDatabaseDialog from "@/components/AddToDatabaseDialog.vue";
import { normalizePanelSettings } from "@/models/settings";
import type { OwnedDatabase } from "@/models/ownedDatabase";
import type { AttributeViewSearchHit } from "@/models/ownedDatabase";
import { getI18nText } from "@/services/i18n";
import {
  createDatabaseHomeDoc,
  findAttributeViewsInActiveEditor,
  getActiveDocumentId,
  listNotebooks,
  openDocument,
  ownedFromSearchHit,
  searchWorkspaceDatabases,
} from "@/services/ownedDatabase";
import { useDocDatabaseStore } from "@/store/docDatabase";
import { useConfigStore } from "@/store/rules";

const plugin = inject<Plugin>("$plugin");
const store = useDocDatabaseStore();
const settingsStore = useConfigStore();
const { docId, boundPanels } = storeToRefs(store);

const showAdd = ref(false);
const showRegister = ref(false);
const showCreate = ref(false);
const searchKeyword = ref("");
const searchHits = ref<AttributeViewSearchHit[]>([]);
const createName = ref("");
const createNotebookId = ref("");
const notebookOptions = ref<Array<{ label: string; value: string }>>([]);

const labels = computed(() => ({
  ours: getI18nText("ownedDb.ours", "我们的库"),
  oursEmpty: getI18nText("ownedDb.oursEmpty", "还没有库。先「收藏已有」或「新建」。"),
  register: getI18nText("ownedDb.register", "收藏已有"),
  create: getI18nText("ownedDb.create", "新建"),
  remove: getI18nText("ownedDb.remove", "移除"),
  current: getI18nText("ownedDb.current", "当前文档"),
  noDoc: getI18nText("ownedDb.noDoc", "打开一篇文档后可加入我们的库"),
  addTo: getI18nText("ownedDb.addTo", "添加到数据库…"),
  notBound: getI18nText("ownedDb.notBound", "尚未加入我们的库"),
  unbind: getI18nText("ownedDb.unbind", "移出"),
  collectPage: getI18nText("ownedDb.collectPage", "收藏本文档中的数据库"),
  registerTitle: getI18nText("ownedDb.registerTitle", "收藏已有数据库"),
  searchPh: getI18nText("ownedDb.searchPh", "按库名搜索"),
  search: getI18nText("ownedDb.search", "搜索"),
  collect: getI18nText("ownedDb.collect", "收藏"),
  close: getI18nText("close", "关闭"),
  createTitle: getI18nText("ownedDb.createTitle", "新建数据库"),
  createGo: getI18nText("ownedDb.createGo", "创建并打开"),
  dbName: getI18nText("ownedDb.dbName", "库名称"),
  dbNamePh: getI18nText("ownedDb.dbNamePh", "例如：项目 / 读书"),
  notebook: getI18nText("ownedDb.notebook", "笔记本"),
  createHint: getI18nText(
    "ownedDb.createHint",
    "会新建一篇文档。请在文档里用 / 插入「数据库」，再点「收藏本文档中的数据库」。",
  ),
}));

const ownedDatabases = computed(
  () => settingsStore.settings.ownedDatabases ?? [],
);

const boundAvIds = computed(() => boundPanels.value.map((p) => p.avID));

const boundOwned = computed(() =>
  ownedDatabases.value.filter((db) => boundAvIds.value.includes(db.avID)),
);

async function persistOwned(next: OwnedDatabase[]) {
  await settingsStore.updateSettings(
    normalizePanelSettings({
      ...settingsStore.settings,
      ownedDatabases: next,
      showUnderTitlePanel: false,
    }),
  );
}

async function registerHit(hit: AttributeViewSearchHit) {
  const db = ownedFromSearchHit(hit);
  if (ownedDatabases.value.some((x) => x.avID === db.avID)) {
    MessagePlugin.info(getI18nText("ownedDb.exists", "该库已在名单中"));
    return;
  }
  await persistOwned([...ownedDatabases.value, db]);
  MessagePlugin.success(getI18nText("ownedDb.collected", `已收藏「${db.name}」`));
}

async function removeOwned(avID: string) {
  await persistOwned(ownedDatabases.value.filter((d) => d.avID !== avID));
}

async function runSearch() {
  try {
    searchHits.value = await searchWorkspaceDatabases(searchKeyword.value.trim());
    if (!searchHits.value.length) {
      MessagePlugin.info(getI18nText("ownedDb.noHits", "没有匹配的数据库"));
    }
  } catch (e) {
    MessagePlugin.error(e instanceof Error ? e.message : String(e));
  }
}

async function collectFromPage() {
  const found = findAttributeViewsInActiveEditor();
  if (!found.length) {
    MessagePlugin.warning(
      getI18nText("ownedDb.noneOnPage", "当前文档里没找到数据库块，请先用 / 插入数据库"),
    );
    return;
  }
  const existing = new Set(ownedDatabases.value.map((d) => d.avID));
  const added: OwnedDatabase[] = [];
  for (const item of found) {
    if (existing.has(item.avID)) continue;
    added.push({
      id: item.avID,
      name: item.name,
      avID: item.avID,
      avBlockID: item.avBlockID,
      homeDocId: docId.value || undefined,
      createdAt: Date.now(),
    });
  }
  if (!added.length) {
    MessagePlugin.info(getI18nText("ownedDb.allCollected", "页面上的库都已收藏"));
    return;
  }
  await persistOwned([...ownedDatabases.value, ...added]);
  MessagePlugin.success(
    getI18nText("ownedDb.collectedN", `已收藏 ${added.length} 个库`),
  );
}

async function runCreate() {
  if (!createName.value.trim() || !createNotebookId.value) {
    MessagePlugin.warning(getI18nText("ownedDb.createNeed", "请填写名称并选择笔记本"));
    return false;
  }
  try {
    const id = await createDatabaseHomeDoc({
      notebookId: createNotebookId.value,
      name: createName.value.trim(),
    });
    const p = plugin as Plugin & { openTab?: (opts: Record<string, unknown>) => void };
    if (typeof p?.openTab === "function") {
      p.openTab({ doc: { id } });
    } else {
      await openDocument(id);
    }
    showCreate.value = false;
    MessagePlugin.success(getI18nText("ownedDb.createOk", "已打开新文档，请插入数据库后点收藏"));
  } catch (e) {
    MessagePlugin.error(e instanceof Error ? e.message : String(e));
  }
  return false;
}

async function onUnbind(avID: string) {
  try {
    await store.unbind(avID);
    MessagePlugin.success(getI18nText("ownedDb.unbindOk", "已移出"));
  } catch (e) {
    MessagePlugin.error(e instanceof Error ? e.message : String(e));
  }
}

async function onBound() {
  await store.refreshBound().catch(() => undefined);
}

async function refreshContext() {
  await settingsStore.initialize().catch(() => undefined);
  const id = getActiveDocumentId();
  if (!id) return;
  await store.setContext({ docId: id, path: "", notebookId: "" }).catch(() => undefined);
}

let timer: ReturnType<typeof setInterval> | undefined;

onMounted(async () => {
  void refreshContext();
  timer = setInterval(() => {
    const id = getActiveDocumentId();
    if (id && id !== store.docId) void refreshContext();
  }, 1500);
  try {
    const notebooks = await listNotebooks();
    notebookOptions.value = notebooks.map((n) => ({ label: n.name, value: n.id }));
    createNotebookId.value = notebooks[0]?.id ?? "";
  } catch {
    /* ignore */
  }
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
  gap: 18px;
  height: 100%;
  overflow: auto;
  box-sizing: border-box;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.head-actions {
  display: flex;
  gap: 6px;
}

h3 {
  margin: 0;
  font-size: 14px;
}

.muted {
  color: var(--b3-theme-on-surface-light, #888);
  font-size: 12px;
}

.path {
  margin-top: 2px;
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

.name {
  font-size: 13px;
  font-weight: 500;
}
</style>

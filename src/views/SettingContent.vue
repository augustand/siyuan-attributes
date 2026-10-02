<template>
  <div class="mux-db-settings">
    <h2>{{ labels.title }}</h2>
    <p class="help">{{ labels.help }}</p>

    <div class="section-head">
      <h3>{{ labels.ours }}</h3>
      <div class="head-actions">
        <t-button
          size="small"
          variant="outline"
          :loading="generating"
          @click="onBackfillDefault"
        >
          {{ labels.backfillMissing }}
        </t-button>
        <t-button size="small" theme="primary" @click="openCreateDialog">
          {{ labels.create }}
        </t-button>
      </div>
    </div>
    <p class="help">{{ labels.oursHelp }}</p>

    <div v-if="brokenCount" class="health-banner">
      <span>{{ labels.brokenBanner.replace("{n}", String(brokenCount)) }}</span>
      <t-button size="small" theme="danger" variant="outline" @click="cleanBroken">
        {{ labels.cleanBroken }}
      </t-button>
    </div>

    <div v-for="db in draft.ownedDatabases" :key="db.id" class="rule-card">
      <div class="name-row">
        <t-input v-model="db.name" :placeholder="labels.name" />
        <span v-if="db.templateKey" class="badge default-badge">
          {{ labels.defaultBadge }}
        </span>
        <span v-if="healthMap[db.avID] && healthMap[db.avID] !== 'ok'" class="badge">
          {{ labels.unusable }}
        </span>
      </div>
      <p class="muted">{{ labels.hintIds }}</p>
      <div class="card-actions">
        <t-button
          v-if="db.homeDocId"
          size="small"
          variant="outline"
          @click="openHome(db.homeDocId)"
        >
          {{ labels.open }}
        </t-button>
        <t-button v-if="db.templateKey" size="small" variant="outline" @click="onBackfillColumns(db)">
          {{ labels.backfill }}
        </t-button>
        <t-button size="small" variant="outline" theme="danger" @click="remove(db.avID)">
          {{ labels.delete }}
        </t-button>
      </div>
    </div>
    <p v-if="!draft.ownedDatabases.length" class="muted">{{ labels.empty }}</p>

    <div class="actions">
      <t-button theme="primary" :loading="saving" @click="save">{{ labels.save }}</t-button>
      <t-button variant="outline" :loading="saving" @click="reset">{{ labels.reset }}</t-button>
    </div>

    <div class="section-head ws-head">
      <h3>{{ labels.workspaceAll }}</h3>
      <div class="head-actions">
        <t-button
          v-for="chip in wsFilterChips"
          :key="chip.value"
          size="small"
          :theme="wsFilter === chip.value ? 'primary' : 'default'"
          variant="outline"
          @click="wsFilter = chip.value"
        >
          {{ chip.label }}
        </t-button>
        <t-button
          v-if="wsSelectedEntries.length"
          size="small"
          theme="danger"
          variant="outline"
          :loading="wsDeleting"
          @click="onDeleteSelected"
        >
          {{ labels.orphanDelete }}({{ wsSelectedEntries.length }})
        </t-button>
      </div>
    </div>
    <div v-if="wsLoading && !wsEntries.length" class="muted">{{ labels.loading }}</div>
    <p v-else-if="!filteredWsRows.length" class="muted">{{ labels.noHits }}</p>
    <div v-else class="ws-list">
      <div v-for="row in filteredWsRows" :key="row.entry.avID" class="rule-card ws-card">
        <div class="name-row">
          <t-checkbox
            v-if="isDeletableOrigin(row.entry.origin)"
            class="ws-orphan-check"
            :checked="wsOrphanSelected.has(row.entry.avID)"
            @change="(checked: boolean) => toggleOrphanSelected(row.entry.avID, checked)"
          />
          <div class="ws-name-wrap">
            <div class="ws-name" :title="wsEntryName(row.entry)">
              {{ wsEntryName(row.entry) }}
            </div>
            <div class="muted">{{ wsEntrySubline(row.entry) }}</div>
            <div v-if="row.entry.origin === 'unreferenced'" class="muted">
              {{ labels.orphanHint }}
            </div>
          </div>
          <span class="badge ws-origin">{{ wsOriginLabel(row.entry.origin) }}</span>
          <span v-if="row.entry.health !== 'ok'" class="badge">{{ labels.unusable }}</span>
        </div>
        <div v-if="!row.db && row.entry.origin === 'active'" class="card-actions">
          <t-button
            v-if="row.entry.hostDocID"
            size="small"
            variant="outline"
            @click="openHostDoc(row.entry.hostDocID)"
          >
            {{ labels.openHost }}
          </t-button>
          <t-button
            v-if="row.entry.blockID"
            size="small"
            variant="outline"
            @click="adoptEntry(row.entry)"
          >
            {{ labels.adopt }}
          </t-button>
          <span v-else class="muted">{{ labels.adoptUnavailable }}</span>
        </div>
      </div>
    </div>

    <t-dialog
      v-model:visible="showCreate"
      :header="labels.createTitle"
      width="420px"
      :confirm-btn="labels.createGo"
      @confirm="runCreate"
    >
      <t-form label-align="top">
        <t-form-item :label="labels.startLabel">
          <t-select v-model="createStartKey" :options="startOptions" />
        </t-form-item>
        <t-form-item :label="labels.dbName">
          <t-input v-model="createName" :placeholder="labels.dbNamePh" />
        </t-form-item>
        <button type="button" class="adv-toggle" @click="showCreateAdvanced = !showCreateAdvanced">
          <span>{{ labels.changeNotebook }}</span>
          <span>{{ showCreateAdvanced ? "▾" : "▸" }}</span>
        </button>
        <t-form-item v-if="showCreateAdvanced" :label="labels.notebook">
          <t-select v-model="createNotebookId" :options="notebookOptions" />
        </t-form-item>
        <p v-else class="muted">{{ notebookHint }}</p>
      </t-form>
      <p class="muted">{{ labels.createHint }}</p>
    </t-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, onMounted, reactive, ref } from "vue";
import { DialogPlugin, MessagePlugin } from "tdesign-vue-next";
import type { Plugin } from "siyuan";
import { normalizePanelSettings } from "@/models/settings";
import type { PanelSettings } from "@/models/settings";
import { getI18nText } from "@/services/i18n";
import {
  checkOwnedDatabasesHealth,
  createOwnedDatabase,
  ensureOwnedDatabaseTemplateColumns,
  generateDefaultTables,
  getActiveNotebookId,
  listNotebooks,
  openDocument,
  ownedFromSearchHit,
  pickCreateNotebookId,
  type OwnedDatabaseHealth,
} from "@/services/ownedDatabase";
import {
  listWorkspaceDatabases,
  removeDatabaseCompletely,
  type WorkspaceDatabaseEntry,
  type WorkspaceDbOrigin,
} from "@/services/workspaceDatabase";
import { deleteOwnedDatabaseHome } from "@/services/ownedDatabaseMigrate";
import {
  DEFAULT_TABLE_TEMPLATES,
  getDatabaseType,
  getTableTemplate,
  type TableTemplate,
} from "@/models/databaseTypes";
import { displayOwnedDatabaseName } from "@/models/ownedDatabaseHang";
import { useConfigStore } from "@/store/rules";
import type { OwnedDatabase } from "@/models/ownedDatabase";

const plugin = inject<Plugin>("$plugin");
const settingsStore = useConfigStore();
const saving = ref(false);
const generating = ref(false);
const draft = reactive<PanelSettings>(normalizePanelSettings(undefined));
const showCreate = ref(false);
const showCreateAdvanced = ref(false);
type TableStartKey = "blank" | "tasks" | "projects" | "inbox";
const createName = ref("");
const createStartKey = ref<TableStartKey>("blank");
const createNotebookId = ref("");
const notebookOptions = ref<Array<{ label: string; value: string }>>([]);
const notebooks = ref<Array<{ id: string; name: string }>>([]);
const healthMap = ref<Record<string, OwnedDatabaseHealth>>({});
const wsEntries = ref<WorkspaceDatabaseEntry[]>([]);
const wsLoading = ref(false);
let wsLoadingSeq = 0;
type WsFilterValue = "all" | "active" | "unreferenced";
const wsFilter = ref<WsFilterValue>("all");
const wsOrphanSelected = ref<Set<string>>(new Set());
const wsDeleting = ref(false);

/** Rows that offer checkbox + batch delete: every non-catalog entry. */
function isDeletableOrigin(origin: WorkspaceDbOrigin): boolean {
  return origin === "active" || origin === "unreferenced";
}

const startOptions = computed(() => [
  { value: "blank" as TableStartKey, label: getI18nText("ownedDb.startBlank", "空白表格") },
  ...DEFAULT_TABLE_TEMPLATES.map((t) => ({
    value: t.key as TableStartKey,
    label: templateName(t),
  })),
]);

function templateName(t: TableTemplate): string {
  return getI18nText(t.nameKey, t.nameFallback);
}

function typeLabel(typeId: string | undefined): string {
  const def = getDatabaseType(typeId);
  const fallback =
    def.id === "task"
      ? "任务"
      : def.id === "project"
        ? "项目"
        : def.id === "product"
          ? "产品"
          : "通用";
  return getI18nText(def.nameKey, fallback);
}

function dbDisplayName(db: OwnedDatabase): string {
  const template = db.templateKey ? getTableTemplate(db.templateKey) : undefined;
  return displayOwnedDatabaseName(
    db.name,
    typeLabel(db.typeId),
    template ? templateName(template) : undefined,
  );
}

const labels = computed(() => ({
  title: getI18nText("settings.title", "文档表格"),
  help: getI18nText(
    "settings.help",
    "维护「我们的库」名单与显示名。日常请打开右侧 Dock「文档数据库」：添加到数据库。字段编辑用标题下原生区域。",
  ),
  ours: getI18nText("ownedDb.ours", "表格"),
  oursHelp: getI18nText(
    "settings.oursHelp",
    "可在此新建或改名。把文档加入库请用 Dock。",
  ),
  create: getI18nText("ownedDb.create", "新建"),
  open: getI18nText("ownedDb.open", "打开"),
  name: getI18nText("settings.dbName", "显示名"),
  hintIds: getI18nText("settings.hintIds", "底层仍是思源数据库，无需记忆 ID"),
  empty: getI18nText(
    "settings.ownedEmpty",
    "还没有库。点右上角「新建」创建第一个。",
  ),
  delete: getI18nText("settings.delete", "从名单移除"),
  save: getI18nText("settings.save", "保存设置"),
  reset: getI18nText("settings.reset", "恢复默认"),
  createTitle: getI18nText("ownedDb.createTitle", "新建表格"),
  createGo: getI18nText("ownedDb.createGo", "创建"),
  startLabel: getI18nText("ownedDb.startLabel", "起点"),
  dbName: getI18nText("ownedDb.dbName", "表格名称"),
  generateDefault: getI18nText("ownedDb.generateDefault", "一键生成默认表格"),
  generateOk: getI18nText("ownedDb.generateOk", "已生成 {n} 张表"),
  tablesReady: getI18nText("ownedDb.tablesReady", "三张默认表已就绪"),
  backfillMissing: getI18nText("ownedDb.backfillMissing", "补齐缺失的默认表"),
  defaultBadge: getI18nText("ownedDb.defaultBadge", "默认"),
  dbNamePh: getI18nText("ownedDb.dbNamePh", "例如：本周任务"),
  notebook: getI18nText("ownedDb.notebook", "存放笔记本"),
  changeNotebook: getI18nText("ownedDb.changeNotebook", "更换存放位置"),
  createHint: getI18nText(
    "ownedDb.createHint",
    "创建后可继续在当前文档点「添加到数据库…」。库文档可在列表里「打开」。",
  ),
  unusable: getI18nText("ownedDb.unusable", "不可用"),
  brokenBanner: getI18nText(
    "ownedDb.brokenBanner",
    "发现 {n} 个异常库（标题下无法显示属性）",
  ),
  cleanBroken: getI18nText("ownedDb.cleanBroken", "清理异常库"),
  backfill: getI18nText("ownedDb.backfill", "补齐列"),
  backfillNone: getI18nText("ownedDb.backfillNone", "列已齐全"),
  columnsAdded: getI18nText("ownedDb.columnsAdded", "已补齐字段：{cols}"),
  loading: getI18nText("loading", "加载中…"),
  noHits: getI18nText("ownedDb.noHits", "没有匹配的数据库"),
  workspaceAll: getI18nText("ownedDb.workspaceAll", "工作区全部数据库"),
  originManaged: getI18nText("ownedDb.originManaged", "托管"),
  originCollected: getI18nText("ownedDb.originCollected", "已收录"),
  originActive: getI18nText("ownedDb.originActive", "未收录"),
  originOrphan: getI18nText("ownedDb.originOrphan", "无引用"),
  adopt: getI18nText("ownedDb.adopt", "采纳"),
  adoptOk: getI18nText("ownedDb.adoptOk", "已采纳「{name}」"),
  adoptUnavailable: getI18nText("ownedDb.adoptUnavailable", "缺少数据库块标识，无法采纳"),
  orphanHint: getI18nText("ownedDb.orphanHint", "无引用的数据库，未被任何文档使用"),
  openHost: getI18nText("ownedDb.openHost", "打开宿主"),
  orphanDelete: getI18nText("ownedDb.orphanDelete", "删除选中"),
  orphanDeleteConfirmTitle: getI18nText("ownedDb.orphanDeleteConfirmTitle", "删除孤儿库"),
  orphanDeleteConfirmBody: getI18nText(
    "ownedDb.orphanDeleteConfirmBody",
    "将永久删除选中数据库的数据；被文档引用的会一并移除其嵌入块。不可恢复。",
  ),
  orphanDeleteOk: getI18nText("ownedDb.orphanDeleteOk", "已删除 {n} 个"),
  orphanDeletePartial: getI18nText("ownedDb.orphanDeletePartial", "{n} 个删除失败"),
  wsFilterAll: getI18nText("ownedDb.wsFilterAll", "全部"),
  wsFilterActive: getI18nText("ownedDb.wsFilterActive", "未收录"),
  wsFilterOrphan: getI18nText("ownedDb.wsFilterOrphan", "无引用"),
  close: getI18nText("close", "关闭"),
}));

const brokenCount = computed(
  () =>
    draft.ownedDatabases.filter((db) => {
      const h = healthMap.value[db.avID];
      return h === "broken" || h === "missing";
    }).length,
);

const notebookHint = computed(() => {
  const nb = notebooks.value.find((n) => n.id === createNotebookId.value);
  const name = nb?.name || createNotebookId.value || "—";
  return getI18nText("ownedDb.notebookHint", `将存放在：${name}`);
});

interface WsRow {
  entry: WorkspaceDatabaseEntry;
  /** Catalog entry when the row is managed/collected — membership is shown via the origin badge. */
  db?: OwnedDatabase;
}

const wsRows = computed<WsRow[]>(() =>
  wsEntries.value.map((entry) => ({
    entry,
    db: draft.ownedDatabases.find((d) => d.avID === entry.avID),
  })),
);

const filteredWsRows = computed(() => {
  if (wsFilter.value === "active") {
    return wsRows.value.filter((row) => row.entry.origin === "active");
  }
  if (wsFilter.value === "unreferenced") {
    return wsRows.value.filter((row) => row.entry.origin === "unreferenced");
  }
  return wsRows.value;
});

const wsFilterChips = computed(() => [
  { value: "all" as WsFilterValue, label: labels.value.wsFilterAll },
  { value: "active" as WsFilterValue, label: labels.value.wsFilterActive },
  { value: "unreferenced" as WsFilterValue, label: labels.value.wsFilterOrphan },
]);

/** Selected deletable entries, intersected with live entries so stale ids
 * never delete; entries carry blockID so the block delete can travel. */
const wsSelectedEntries = computed(() =>
  wsEntries.value.filter(
    (e) => isDeletableOrigin(e.origin) && wsOrphanSelected.value.has(e.avID),
  ),
);

function toggleOrphanSelected(avID: string, checked: boolean) {
  const next = new Set(wsOrphanSelected.value);
  if (checked) next.add(avID);
  else next.delete(avID);
  wsOrphanSelected.value = next;
}

function openHostDoc(hostDocID: string) {
  void openDocument(hostDocID, plugin).catch((e) => {
    console.warn("openHostDoc failed", e);
  });
}

/** Batch-delete the selected databases completely (block + AV file), sequential loop. */
function onDeleteSelected() {
  const entries = wsSelectedEntries.value;
  if (!entries.length) return;
  const dialog = DialogPlugin.confirm({
    header: labels.value.orphanDeleteConfirmTitle,
    body: labels.value.orphanDeleteConfirmBody,
    confirmBtn: labels.value.orphanDelete,
    cancelBtn: labels.value.close,
    theme: "danger",
    onConfirm: async () => {
      wsDeleting.value = true;
      let ok = 0;
      let failed = 0;
      try {
        for (const entry of entries) {
          try {
            await removeDatabaseCompletely({ avID: entry.avID, blockID: entry.blockID });
            ok += 1;
          } catch (e) {
            failed += 1;
            console.warn("removeDatabaseCompletely failed", entry.avID, e);
          }
        }
        wsOrphanSelected.value = new Set();
        if (ok) {
          MessagePlugin.success(labels.value.orphanDeleteOk.replace("{n}", String(ok)));
        }
        if (failed) {
          MessagePlugin.error(labels.value.orphanDeletePartial.replace("{n}", String(failed)));
        }
        await refreshWorkspace();
      } finally {
        wsDeleting.value = false;
        dialog.hide();
      }
    },
  });
}

function wsOriginLabel(origin: WorkspaceDbOrigin): string {
  if (origin === "managed") return labels.value.originManaged;
  if (origin === "collected") return labels.value.originCollected;
  if (origin === "active") return labels.value.originActive;
  return labels.value.originOrphan;
}

function wsEntryName(entry: WorkspaceDatabaseEntry): string {
  if (entry.name) return entry.name;
  if (entry.hostPath) {
    const base = entry.hostPath.split("/").pop()?.trim();
    if (base) return base;
  }
  return entry.avID;
}

function wsEntrySubline(entry: WorkspaceDatabaseEntry): string {
  if (entry.origin === "unreferenced") return entry.avID;
  return entry.hostPath || entry.avID;
}

function syncDraftFromStore(): void {
  const next = normalizePanelSettings(settingsStore.settings);
  draft.ownedDatabases = next.ownedDatabases.map((d) => ({ ...d }));
  draft.ownedDbPrimaryByType = { ...next.ownedDbPrimaryByType };
  draft.showUnderTitlePanel = false;
  draft.version = 1;
}

async function onBackfillColumns(db: OwnedDatabase): Promise<void> {
  try {
    // db comes from the draft — an unsaved rename still travels with it
    const { added } = await ensureOwnedDatabaseTemplateColumns(db);
    if (added.length) {
      MessagePlugin.info(labels.value.columnsAdded.replace("{cols}", added.join("、")));
    } else {
      MessagePlugin.success(labels.value.backfillNone);
    }
  } catch (e) {
    MessagePlugin.error(e instanceof Error ? e.message : String(e));
  }
}

async function onBackfillDefault(): Promise<void> {
  if (generating.value) return;
  generating.value = true;
  try {
    const { created } = await generateDefaultTables({
      plugin,
      nameOf: templateName,
    });
    // generateDefaultTables persists through the plugin store — reload the draft.
    await settingsStore.initialize().catch(() => undefined);
    syncDraftFromStore();
    await refreshHealth();
    if (created.length === 0) {
      MessagePlugin.success(labels.value.tablesReady);
    } else {
      MessagePlugin.success(
        labels.value.generateOk.replace("{n}", String(created.length)),
      );
    }
  } catch (e) {
    MessagePlugin.error(e instanceof Error ? e.message : String(e));
  } finally {
    generating.value = false;
  }
}

async function refreshHealth() {
  if (!draft.ownedDatabases.length) {
    healthMap.value = {};
    return;
  }
  try {
    healthMap.value = await checkOwnedDatabasesHealth(draft.ownedDatabases);
  } catch {
    /* ignore */
  }
}

async function refreshWorkspace() {
  const seq = ++wsLoadingSeq;
  wsLoading.value = true;
  try {
    const entries = await listWorkspaceDatabases({ owned: draft.ownedDatabases });
    if (seq !== wsLoadingSeq) return;
    wsEntries.value = entries;
  } catch (e) {
    if (seq !== wsLoadingSeq) return;
    console.warn("listWorkspaceDatabases failed", e);
    wsEntries.value = [];
  } finally {
    if (seq === wsLoadingSeq) wsLoading.value = false;
  }
}

/** Adopt an active (not-yet-collected) workspace database into the catalog. */
async function adoptEntry(entry: WorkspaceDatabaseEntry) {
  if (!entry.blockID) return;
  const db = ownedFromSearchHit({
    avID: entry.avID,
    avName: entry.name,
    blockID: entry.blockID,
    hPath: entry.hostPath ?? "",
  });
  if (entry.hostDocID) db.homeDocId = entry.hostDocID;
  if (draft.ownedDatabases.some((x) => x.avID === db.avID)) {
    MessagePlugin.info(getI18nText("ownedDb.exists", "该库已在名单中"));
    return;
  }
  try {
    await settingsStore.updateSettings(
      normalizePanelSettings({
        ...settingsStore.settings,
        showUnderTitlePanel: false,
        ownedDatabases: [...draft.ownedDatabases, db],
      }),
    );
    syncDraftFromStore();
    await refreshHealth();
    void refreshWorkspace();
    MessagePlugin.success(labels.value.adoptOk.replace("{name}", db.name));
  } catch (e) {
    MessagePlugin.error(e instanceof Error ? e.message : String(e));
  }
}

async function cleanBroken() {
  const next = draft.ownedDatabases.filter((db) => {
    const h = healthMap.value[db.avID];
    return h !== "broken" && h !== "missing";
  });
  const removed = draft.ownedDatabases.length - next.length;
  draft.ownedDatabases = next;
  await settingsStore.updateSettings(
    normalizePanelSettings({
      ...settingsStore.settings,
      showUnderTitlePanel: false,
      ownedDatabases: next,
    }),
  );
  syncDraftFromStore();
  await refreshHealth();
  MessagePlugin.success(
    getI18nText("ownedDb.cleanedN", `已从名单移除 ${removed} 个异常库（未删除思源中的文件）`),
  );
}

function remove(avID: string) {
  const db = draft.ownedDatabases.find((d) => d.avID === avID);
  if (!db) return;
  const dialog = DialogPlugin.confirm({
    header: getI18nText("ownedDb.removeConfirmTitle", "移除我们的库"),
    body: getI18nText(
      "ownedDb.removeConfirmBody",
      "将删除「{name}」对应的库文档（思源数据库一并删除）。点取消则仅从名单移出、不删文件。",
    ).replace("{name}", dbDisplayName(db)),
    confirmBtn: getI18nText("ownedDb.removeConfirmOk", "删除库"),
    cancelBtn: getI18nText("ownedDb.removeCatalogOnly", "仅移出名单"),
    theme: "danger",
    onConfirm: async () => {
      try {
        if (db.homeDocId) {
          await deleteOwnedDatabaseHome(db);
        }
        draft.ownedDatabases = draft.ownedDatabases.filter((d) => d.avID !== avID);
        MessagePlugin.success(
          getI18nText("ownedDb.removeOkDeleted", "已删除库文档并从名单移除"),
        );
      } catch (e) {
        MessagePlugin.error(e instanceof Error ? e.message : String(e));
      }
      dialog.hide();
    },
    onCancel: () => {
      draft.ownedDatabases = draft.ownedDatabases.filter((d) => d.avID !== avID);
      MessagePlugin.success(
        getI18nText("ownedDb.removeOkCatalog", "已从名单移除（未删思源文件）"),
      );
    },
  });
}

async function openHome(homeDocId: string) {
  try {
    await openDocument(homeDocId, plugin);
  } catch (e) {
    console.warn("openHome failed", e);
  }
}

async function prepareCreateNotebook() {
  const list = await listNotebooks();
  notebooks.value = list;
  notebookOptions.value = list.map((n) => ({ label: n.name, value: n.id }));
  const active = await getActiveNotebookId();
  createNotebookId.value = pickCreateNotebookId({
    activeNotebookId: active,
    savedNotebookId: settingsStore.settings.ownedDbNotebookId,
    notebooks: list,
  });
}

async function openCreateDialog() {
  showCreateAdvanced.value = false;
  createStartKey.value = "blank";
  try {
    await prepareCreateNotebook();
  } catch (e) {
    MessagePlugin.error(e instanceof Error ? e.message : String(e));
  }
  showCreate.value = true;
}

async function runCreate() {
  if (!createName.value.trim() || !createNotebookId.value) {
    MessagePlugin.warning(getI18nText("ownedDb.createNeed", "请填写名称并选择笔记本"));
    return false;
  }
  const startKey = createStartKey.value;
  try {
    const db = await createOwnedDatabase({
      notebookId: createNotebookId.value,
      name: createName.value.trim(),
      ...(startKey === "blank"
        ? { columns: [{ name: "备注", type: "text" }] }
        : { templateKey: startKey }),
    });
    draft.ownedDatabases = [...draft.ownedDatabases, db];
    await settingsStore.updateSettings(
      normalizePanelSettings({
        ...settingsStore.settings,
        showUnderTitlePanel: false,
        ownedDatabases: draft.ownedDatabases,
        ownedDbNotebookId: createNotebookId.value,
        ownedDbLastAvID: db.avID,
      }),
    );
    syncDraftFromStore();
    showCreate.value = false;
    createName.value = "";
    showCreateAdvanced.value = false;
    await refreshHealth();
    MessagePlugin.success(
      getI18nText("ownedDb.createOkName", "已创建「{name}」").replace("{name}", dbDisplayName(db)),
    );
  } catch (e) {
    MessagePlugin.error(e instanceof Error ? e.message : String(e));
  }
  return false;
}

onMounted(async () => {
  try {
    await settingsStore.initialize();
    syncDraftFromStore();
    await prepareCreateNotebook();
    await refreshHealth();
    void refreshWorkspace();
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
        ownedDbPrimaryByType: draft.ownedDbPrimaryByType,
      }),
    );
    syncDraftFromStore();
    await refreshHealth();
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
.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 8px;
}
.section-head h3 {
  margin: 0;
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
.card-actions {
  display: flex;
  gap: 6px;
}
.name-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.name-row .t-input {
  flex: 1;
}
.badge {
  flex-shrink: 0;
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 3px;
  color: var(--td-error-color, #e35);
  background: color-mix(in srgb, var(--td-error-color, #e35) 16%, transparent);
}
.default-badge {
  color: var(--td-text-color-secondary, #888);
  background: var(--td-bg-color-secondarycontainer, rgba(0, 0, 0, 0.04));
}
.head-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.health-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 12px;
  padding: 8px 10px;
  border-radius: 6px;
  font-size: 12px;
  background: color-mix(in srgb, var(--td-error-color, #e35) 12%, transparent);
}
.actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}
.adv-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  margin: 4px 0 8px;
  padding: 4px 0;
  border: none;
  background: transparent;
  color: var(--td-text-color-secondary);
  font-size: 12px;
  cursor: pointer;
}
.ws-head {
  margin-top: 20px;
}
.head-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}
.ws-list {
  display: flex;
  flex-direction: column;
}
.ws-card {
  margin-bottom: 8px;
}
.ws-name-wrap {
  flex: 1;
  min-width: 0;
}
.ws-name {
  font-size: 13px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ws-name-wrap .muted {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ws-origin {
  color: var(--td-text-color-secondary, #888);
  background: var(--td-bg-color-secondarycontainer, rgba(0, 0, 0, 0.04));
}
.ws-orphan-check {
  flex-shrink: 0;
}
</style>

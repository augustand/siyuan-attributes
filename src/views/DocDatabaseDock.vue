<template>
  <div class="mux-doc-db-dock">
    <section>
      <h3>{{ labels.current }}</h3>
      <p v-if="!docId" class="muted">{{ labels.noDoc }}</p>

      <!-- empty catalog -->
      <template v-else-if="!ownedDatabases.length">
        <p class="guide">{{ labels.oursEmpty }}</p>
        <t-button
          block
          theme="primary"
          size="large"
          :loading="generating"
          @click="onGenerateDefault"
        >
          {{ labels.generateDefault }}
        </t-button>
        <t-button block variant="outline" style="margin-top: 6px" @click="onCreateClick">
          {{ labels.create }}
        </t-button>
      </template>

      <!-- messy: multiple under-title bindings -->
      <template v-else-if="isMessyBindings">
        <div class="status-card warn">
          <div class="status-title">{{ labels.messyTitle }}</div>
          <p class="guide">{{ labels.messyHint.replace("{n}", String(boundPanelCount)) }}</p>
          <t-button block theme="warning" @click="onCleanExtraBindings">
            {{ labels.cleanExtra }}
          </t-button>
        </div>
      </template>

      <!-- bound: single clear membership -->
      <template v-else-if="primaryBound">
        <div class="status-card">
          <div class="status-title">{{ dbDisplayName(primaryBound) }}</div>
          <p class="guide">{{ labels.boundHint }}</p>
          <div class="status-actions">
            <t-button size="small" variant="outline" theme="danger" @click="onUnbind(primaryBound.avID)">
              {{ labels.unbind }}
            </t-button>
          </div>
        </div>
      </template>

      <!-- unbound: join a default table -->
      <template v-else>
        <p class="guide">{{ labels.notBound }}</p>
        <div class="quick-tables">
          <button
            v-for="tpl in DEFAULT_TABLE_TEMPLATES"
            :key="tpl.key"
            type="button"
            class="quick-table-btn"
            @click="onJoinTemplate(tpl.key)"
          >
            {{ templateName(tpl) }}
          </button>
        </div>
        <t-button
          block
          size="small"
          variant="text"
          style="margin-top: 6px"
          @click="openAddPicker()"
        >
          {{ labels.joinOther }}
        </t-button>
      </template>
    </section>

    <section>
      <div class="section-head">
        <h3>{{ showWorkspace ? labels.workspaceAll : labels.ours }}</h3>
        <div class="head-actions">
          <t-button
            size="small"
            theme="primary"
            variant="outline"
            :loading="wsLoading"
            @click="toggleWorkspace"
          >
            {{ showWorkspace ? labels.showCatalog : labels.showWorkspace }}
          </t-button>
          <t-button size="small" theme="primary" variant="outline" @click="onCreateClick">
            {{ labels.create }}
          </t-button>
        </div>
      </div>

      <template v-if="!showWorkspace">
      <div v-if="brokenCount" class="health-banner">
        <span>{{ labels.brokenBanner.replace("{n}", String(brokenCount)) }}</span>
        <t-button size="small" theme="danger" variant="outline" @click="cleanBroken">
          {{ labels.cleanBroken }}
        </t-button>
      </div>

      <div v-if="ownedDatabases.length" class="filter-row">
        <t-input
          v-model="listKeyword"
          :placeholder="labels.filterPh"
          size="small"
          clearable
        />
        <t-checkbox v-if="brokenCount > 0" v-model="brokenOnly" class="broken-only">
          {{ labels.brokenOnly }}
        </t-checkbox>
      </div>

      <div v-if="!ownedDatabases.length" class="muted">{{ labels.oursEmpty }}</div>
      <div v-else-if="!filteredDatabases.length" class="muted">{{ labels.noHits }}</div>
      <div v-else class="list">
        <div v-for="db in filteredDatabases" :key="db.id" class="row">
          <div class="name-cell">
            <t-input
              v-if="renaming && renaming.avID === db.avID"
              v-model="renaming.name"
              class="rename-input"
              size="small"
              autofocus
              @enter="commitRename"
              @blur="commitRename"
              @keydown="onRenameKeydown"
            />
            <button
              v-else
              type="button"
              class="name name-btn"
              :title="dbDisplayName(db)"
              @click="startRename(db)"
            >
              {{ dbDisplayName(db) }}
            </button>
            <span v-if="docCounts[db.avID] !== undefined" class="muted doc-count">
              {{ labels.docCount.replace("{n}", String(docCounts[db.avID])) }}
            </span>
            <span v-if="healthMap[db.avID] && healthMap[db.avID] !== 'ok'" class="badge">
              {{ labels.unusable }}
            </span>
          </div>
          <div class="row-actions">
            <t-button
              size="small"
              variant="text"
              :disabled="(healthMap[db.avID] ?? 'ok') !== 'ok'"
              @click="openDocs(db)"
            >
              {{ labels.docs }}
            </t-button>
            <t-button
              v-if="db.homeDocId"
              size="small"
              variant="text"
              @click="openHome(db.homeDocId)"
            >
              {{ labels.open }}
            </t-button>
            <t-button size="small" variant="text" @click="onBackfillColumns(db)">
              {{ labels.backfill }}
            </t-button>
            <t-button size="small" variant="text" theme="danger" @click="removeOwned(db.avID)">
              {{ labels.remove }}
            </t-button>
          </div>
        </div>
      </div>
      </template>

      <template v-else>
        <div v-if="wsLoading && !wsEntries.length" class="muted">{{ labels.loading }}</div>
        <p v-else-if="!wsEntries.length" class="muted">{{ labels.noHits }}</p>
        <div v-else class="list">
          <div v-for="group in wsGroups" :key="group.origin" class="ws-group">
            <div class="ws-group-head">
              <span>{{ wsOriginLabel(group.origin) }}</span>
              <span class="ws-group-count">{{ group.rows.length }}</span>
              <t-button
                v-if="isDeletableOrigin(group.origin) && wsSelectedEntries.length"
                class="ws-orphan-delete"
                size="small"
                variant="text"
                theme="danger"
                :loading="wsDeleting"
                @click="onDeleteSelected"
              >
                {{ labels.orphanDelete }}({{ wsSelectedEntries.length }})
              </t-button>
            </div>
            <div v-for="row in group.rows" :key="row.entry.avID" class="row ws-row">
              <t-checkbox
                v-if="isDeletableOrigin(group.origin)"
                class="ws-orphan-check"
                :checked="wsOrphanSelected.has(row.entry.avID)"
                @change="(checked: boolean) => toggleOrphanSelected(row.entry.avID, checked)"
              />
              <div class="name-cell">
                <t-input
                  v-if="renaming && renaming.avID === row.entry.avID"
                  v-model="renaming.name"
                  class="rename-input"
                  size="small"
                  autofocus
                  @enter="commitRename"
                  @blur="commitRename"
                  @keydown="onRenameKeydown"
                />
                <button
                  v-else-if="row.db"
                  type="button"
                  class="name name-btn"
                  :title="dbDisplayName(row.db)"
                  @click="startRename(row.db)"
                >
                  {{ dbDisplayName(row.db) }}
                </button>
                <div v-else class="ws-name-wrap">
                  <div class="name" :title="wsEntryName(row.entry)">
                    {{ wsEntryName(row.entry) }}
                  </div>
                  <div class="muted path">{{ wsEntrySubline(row.entry) }}</div>
                  <div v-if="row.entry.origin === 'unreferenced'" class="muted path">
                    {{ labels.orphanHint }}
                  </div>
                </div>
                <span class="badge ws-origin">{{ wsOriginLabel(row.entry.origin) }}</span>
                <span v-if="row.entry.health !== 'ok'" class="badge">
                  {{ labels.unusable }}
                </span>
              </div>
              <div class="row-actions">
                <template v-if="row.db">
                  <t-button
                    size="small"
                    variant="text"
                    :disabled="(healthMap[row.entry.avID] ?? 'ok') !== 'ok'"
                    @click="openDocs(row.db)"
                  >
                    {{ labels.docs }}
                  </t-button>
                  <t-button
                    v-if="row.db.homeDocId"
                    size="small"
                    variant="text"
                    @click="openHome(row.db.homeDocId)"
                  >
                    {{ labels.open }}
                  </t-button>
                  <t-button size="small" variant="text" @click="onBackfillColumns(row.db)">
                    {{ labels.backfill }}
                  </t-button>
                  <t-button
                    size="small"
                    variant="text"
                    theme="danger"
                    @click="removeOwned(row.entry.avID)"
                  >
                    {{ labels.remove }}
                  </t-button>
                </template>
                <template v-else>
                  <t-button
                    v-if="row.entry.hostDocID"
                    size="small"
                    variant="text"
                    @click="openHostDoc(row.entry.hostDocID)"
                  >
                    {{ labels.openHost }}
                  </t-button>
                  <t-button
                    v-if="canAdopt(row.entry)"
                    size="small"
                    variant="text"
                    theme="primary"
                    @click="adoptEntry(row.entry)"
                  >
                    {{ labels.adopt }}
                  </t-button>
                  <span v-else-if="row.entry.origin === 'active'" class="muted ws-adopt-hint">
                    {{ labels.adoptUnavailable }}
                  </span>
                </template>
              </div>
            </div>
          </div>
        </div>
      </template>
    </section>

    <section class="more">
      <button type="button" class="more-toggle" @click="showMore = !showMore">
        <span>{{ labels.more }}</span>
        <span class="chevron">{{ showMore ? "▾" : "▸" }}</span>
      </button>
      <div v-if="showMore" class="more-body">
        <t-button size="small" variant="outline" block @click="showRegister = true">
          {{ labels.register }}
        </t-button>
        <t-button
          size="small"
          variant="outline"
          block
          :disabled="!docId"
          @click="collectFromPage"
        >
          {{ labels.collectPage }}
        </t-button>
        <p class="muted">{{ labels.moreHint }}</p>
      </div>
    </section>

    <AddToDatabaseDialog
      v-model:visible="showAdd"
      :doc-id="addDocId"
      :databases="databasesForAdd"
      :owned-av-ids="ownedDatabases.map((d) => d.avID)"
      :bound-av-ids="boundAvIdsForAdd"
      @bound="onBound"
    />

    <t-dialog
      v-model:visible="showDocs"
      :header="docsTitle"
      width="420px"
      :confirm-btn="labels.close"
      :cancel-btn="null"
    >
      <p v-if="docsLoading" class="muted">{{ labels.loading }}</p>
      <template v-else-if="docsRows.length">
        <div v-if="docsColumns.length" class="docs-filter">
          <t-select
            v-model="docsFilterKey"
            class="docs-filter-col"
            size="small"
            clearable
            :options="docsColumnOptions"
          />
          <t-select
            v-model="docsFilterOp"
            class="docs-filter-op"
            size="small"
            :options="docsOpOptions"
          />
          <t-input
            v-if="docsFilterOp !== 'isEmpty'"
            v-model="docsFilterValue"
            class="docs-filter-value"
            size="small"
            clearable
            :placeholder="labels.queryValuePh"
          />
        </div>
        <div class="docs-filter-meta">
          <span class="muted">{{ docsHitsLabel }}</span>
          <t-button v-if="docsFilterActive" size="small" variant="text" @click="clearDocsFilter">
            {{ labels.queryClear }}
          </t-button>
        </div>
        <div v-if="filteredDocsRows.length" class="list">
          <button
            v-for="row in filteredDocsRows"
            :key="row.docID"
            type="button"
            class="doc-item"
            @click="openBoundDoc(row.docID)"
          >
            {{ row.primaryText || row.docID }}
          </button>
        </div>
        <p v-else class="muted">{{ labels.noHits }}</p>
      </template>
      <p v-else-if="!docsList.length" class="muted">{{ labels.docsEmpty }}</p>
      <div v-else class="list">
        <button
          v-for="doc in docsList"
          :key="doc.id"
          type="button"
          class="doc-item"
          @click="openBoundDoc(doc.id)"
        >
          {{ doc.content || doc.id }}
        </button>
      </div>
    </t-dialog>

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
        <t-form-item :label="labels.startLabel">
          <t-select v-model="createStartKey" :options="startOptions" />
        </t-form-item>
        <t-form-item :label="labels.dbName">
          <t-input v-model="createName" :placeholder="labels.dbNamePh" autofocus />
        </t-form-item>
        <button type="button" class="more-toggle" @click="showCreateAdvanced = !showCreateAdvanced">
          <span>{{ labels.changeNotebook }}</span>
          <span class="chevron">{{ showCreateAdvanced ? "▾" : "▸" }}</span>
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
import { computed, inject, onMounted, onUnmounted, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { DialogPlugin, MessagePlugin } from "tdesign-vue-next";
import type { Plugin } from "siyuan";
import AddToDatabaseDialog from "@/components/AddToDatabaseDialog.vue";
import { normalizePanelSettings } from "@/models/settings";
import type { OwnedDatabase } from "@/models/ownedDatabase";
import type { AttributeViewSearchHit } from "@/models/ownedDatabase";
import { getI18nText } from "@/services/i18n";
import {
  fetchAttributeViews,
  listDatabaseBoundDocs,
  type DatabaseBoundDoc,
} from "@/services/attributeView";
import {
  fetchDatabaseQueryData,
  matchDoc,
  type DatabaseQueryColumn,
  type DatabaseQueryRow,
  type QueryOp,
} from "@/services/databaseQuery";
import {
  clearDocumentDatabaseBindings,
  deleteOwnedDatabaseHome,
  findForeignDatabaseBlocksInDoc,
} from "@/services/ownedDatabaseMigrate";
import { joinTableByKey } from "@/services/doctreeClassify";
import { refreshDocumentEditor } from "@/services/refreshEditor";
import {
  checkOwnedDatabasesHealth,
  createOwnedDatabase,
  ensureOwnedDatabaseTemplateColumns,
  findAttributeViewsInActiveEditor,
  generateDefaultTables,
  getActiveDocumentId,
  getActiveNotebookId,
  listNotebooks,
  openDocument,
  ownedFromSearchHit,
  pickCreateNotebookId,
  searchWorkspaceDatabases,
  syncOwnedDatabaseNames,
  type OwnedDatabaseHealth,
} from "@/services/ownedDatabase";
import {
  DEFAULT_TABLE_TEMPLATES,
  getDatabaseType,
  getTableTemplate,
  normalizeDatabaseTypeId,
  type TableTemplate,
} from "@/models/databaseTypes";
import {
  displayOwnedDatabaseName,
  filterOwnedDatabases,
} from "@/models/ownedDatabaseHang";
import {
  listWorkspaceDatabases,
  removeDatabaseCompletely,
  type WorkspaceDatabaseEntry,
  type WorkspaceDbOrigin,
} from "@/services/workspaceDatabase";
import { useDocDatabaseStore } from "@/store/docDatabase";
import { useConfigStore } from "@/store/rules";
import { onSettingsChanged } from "@/services/settingEvents";

const plugin = inject<Plugin>("$plugin");
const store = useDocDatabaseStore();
const settingsStore = useConfigStore();
const { docId, boundPanels } = storeToRefs(store);

const showAdd = ref(false);
const addPickerDatabases = ref<OwnedDatabase[]>([]);
const showRegister = ref(false);
const showCreate = ref(false);
const showMore = ref(false);
const showCreateAdvanced = ref(false);
const showDocs = ref(false);
const docsLoading = ref(false);
const docsList = ref<DatabaseBoundDoc[]>([]);
const docsAvName = ref("");
const docsColumns = ref<DatabaseQueryColumn[]>([]);
const docsRows = ref<DatabaseQueryRow[]>([]);
const docsFilterKey = ref("");
const docsFilterOp = ref<QueryOp>("contains");
const docsFilterValue = ref("");
const menuDocId = ref("");
const searchKeyword = ref("");
const searchHits = ref<AttributeViewSearchHit[]>([]);
type TableStartKey = "blank" | "tasks" | "projects" | "inbox";
const createName = ref("");
const createStartKey = ref<TableStartKey>("blank");
const createNotebookId = ref("");
const notebookOptions = ref<Array<{ label: string; value: string }>>([]);
const notebooks = ref<Array<{ id: string; name: string }>>([]);
const healthMap = ref<Record<string, OwnedDatabaseHealth>>({});
const docCounts = ref<Record<string, number>>({});
let docCountsSeq = 0;
const generating = ref(false);
const listKeyword = ref("");
const brokenOnly = ref(false);
const renaming = ref<{ avID: string; name: string } | null>(null);
const showWorkspace = ref(true); // 默认工作区视图：上来就看到所有数据库
const wsEntries = ref<WorkspaceDatabaseEntry[]>([]);
const wsLoading = ref(false);
let wsLoadingSeq = 0;
const wsOrphanSelected = ref<Set<string>>(new Set());
const wsDeleting = ref(false);

const startOptions = computed(() => [
  { value: "blank" as TableStartKey, label: labels.value.startBlank },
  ...DEFAULT_TABLE_TEMPLATES.map((t) => ({
    value: t.key as TableStartKey,
    label: templateName(t),
  })),
]);

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

function templateName(t: TableTemplate): string {
  return getI18nText(t.nameKey, t.nameFallback);
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
  ours: getI18nText("ownedDb.ours", "表格"),
  oursEmpty: getI18nText("ownedDb.oursEmpty", "还没有表格。一键生成默认表格，或点「新建」。"),
  register: getI18nText("ownedDb.register", "导入工作区已有库"),
  create: getI18nText("ownedDb.create", "新建"),
  open: getI18nText("ownedDb.open", "打开"),
  docs: getI18nText("ownedDb.docs", "文档"),
  docsEmpty: getI18nText("ownedDb.docsEmpty", "这个库里还没有文档"),
  docsTitle: getI18nText("ownedDb.docsTitle", "库中的文档"),
  loading: getI18nText("loading", "加载中…"),
  remove: getI18nText("ownedDb.remove", "移除"),
  current: getI18nText("ownedDb.current", "当前文档"),
  noDoc: getI18nText("ownedDb.noDoc", "打开一篇文档后，可一键加入我们的库"),
  addTo: getI18nText("ownedDb.addTo", "添加到数据库…"),
  cleanExtra: getI18nText(
    "ownedDb.cleanExtra",
    "清理多余数据库（只留一个）",
  ),
  removeConfirmTitle: getI18nText("ownedDb.removeConfirmTitle", "移除我们的库"),
  removeConfirmBody: getI18nText(
    "ownedDb.removeConfirmBody",
    "将从名单移除「{name}」，并删除对应的库文档（思源里的数据库一并删掉）。此操作不可恢复。",
  ),
  removeConfirmOk: getI18nText("ownedDb.removeConfirmOk", "删除库"),
  removeCatalogOnly: getI18nText("ownedDb.removeCatalogOnly", "仅移出名单"),
  removeOkDeleted: getI18nText("ownedDb.removeOkDeleted", "已删除库文档并从名单移除"),
  removeOkCatalog: getI18nText("ownedDb.removeOkCatalog", "已从名单移除（未删思源文件）"),
  foreignBlocksTitle: getI18nText("ownedDb.foreignBlocksTitle", "库文档中还嵌着其它表格"),
  foreignBlocksBody: getI18nText(
    "ownedDb.foreignBlocksBody",
    "「{doc}」中还嵌着这些表格的数据库块：{names}。删除该文档会把它们一并销毁。仍要删除吗？",
  ),
  foreignBlocksOk: getI18nText("ownedDb.foreignBlocksOk", "仍要删除"),
  cleanExtraOkN: getI18nText(
    "ownedDb.cleanExtraOkN",
    "已清理 {n} 个多余绑定。若标题下仍显示，请切换一下文档。",
  ),
  cleanExtraNone: getI18nText("ownedDb.cleanExtraNone", "当前没有多余的数据库绑定"),
  cleanExtraCleared: getI18nText(
    "ownedDb.cleanExtraCleared",
    "已清空全部绑定（{n}）。请再点类型挂进一个库。",
  ),
  boundHint: getI18nText(
    "ownedDb.boundHint",
    "字段请在标题下的原生数据库区域编辑。一篇文档只属于一个库。",
  ),
  messyTitle: getI18nText("ownedDb.messyTitle", "标题下有多个数据库"),
  messyHint: getI18nText(
    "ownedDb.messyHint",
    "检测到 {n} 个绑定。先清理，再按类型挂接。",
  ),
  notBound: getI18nText("ownedDb.notBound", "尚未加入。加入后请在标题下编辑字段。"),
  unbind: getI18nText("ownedDb.unbind", "移出"),
  more: getI18nText("ownedDb.more", "更多"),
  moreHint: getI18nText(
    "ownedDb.moreHint",
    "导入仅用于接管已有库。日常请用「点类型挂接」。",
  ),
  columnsAdded: getI18nText("ownedDb.columnsAdded", "已补齐字段：{cols}"),
  collectPage: getI18nText("ownedDb.collectPage", "导入本文档中的数据库"),
  registerTitle: getI18nText("ownedDb.registerTitle", "导入工作区已有数据库"),
  searchPh: getI18nText("ownedDb.searchPh", "按库名搜索"),
  search: getI18nText("ownedDb.search", "搜索"),
  collect: getI18nText("ownedDb.collect", "导入"),
  close: getI18nText("close", "关闭"),
  createTitle: getI18nText("ownedDb.createTitle", "新建表格"),
  createGo: getI18nText("ownedDb.createGo", "创建"),
  startLabel: getI18nText("ownedDb.startLabel", "起点"),
  startBlank: getI18nText("ownedDb.startBlank", "空白表格"),
  dbName: getI18nText("ownedDb.dbName", "表格名称"),
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
  filterPh: getI18nText("ownedDb.filterPh", "搜索库名或类型"),
  brokenOnly: getI18nText("ownedDb.brokenOnly", "只看异常"),
  backfill: getI18nText("ownedDb.backfill", "补齐列"),
  backfillNone: getI18nText("ownedDb.backfillNone", "列已齐全"),
  generateDefault: getI18nText("ownedDb.generateDefault", "一键生成默认表格"),
  generateOk: getI18nText("ownedDb.generateOk", "已生成 {n} 张表"),
  tablesReady: getI18nText("ownedDb.tablesReady", "三张默认表已就绪"),
  backfillMissing: getI18nText("ownedDb.backfillMissing", "补齐缺失的默认表"),
  joinOther: getI18nText("ownedDb.joinOther", "选择其它表格…"),
  docCount: getI18nText("ownedDb.docCount", "{n} 篇"),
  defaultBadge: getI18nText("ownedDb.defaultBadge", "默认"),
  joinOk: getI18nText("ownedDb.joinOk", "已加入「{name}」"),
  createdJoin: getI18nText("ownedDb.createdJoin", "已生成并加入「{name}」"),
  noHits: getI18nText("ownedDb.noHits", "没有匹配的数据库"),
  queryEquals: getI18nText("ownedDb.queryEquals", "等于"),
  queryContains: getI18nText("ownedDb.queryContains", "包含"),
  queryIsEmpty: getI18nText("ownedDb.queryIsEmpty", "为空"),
  queryValuePh: getI18nText("ownedDb.queryValuePh", "筛选值"),
  queryHits: getI18nText("ownedDb.queryHits", "{n} 篇命中"),
  queryClear: getI18nText("ownedDb.queryClear", "清除筛选"),
  workspaceAll: getI18nText("ownedDb.workspaceAll", "工作区全部数据库"),
  showWorkspace: getI18nText("ownedDb.showWorkspace", "工作区"),
  showCatalog: getI18nText("ownedDb.showCatalog", "表格目录"),
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
}));

const notebookHint = computed(() => {
  const nb = notebooks.value.find((n) => n.id === createNotebookId.value);
  const name = nb?.name || createNotebookId.value || "—";
  return getI18nText("ownedDb.notebookHint", "将存放在：{name}").replace("{name}", name);
});

const ownedDatabases = computed(
  () => settingsStore.settings.ownedDatabases ?? [],
);

const healthyDatabases = computed(() =>
  ownedDatabases.value.filter((db) => (healthMap.value[db.avID] ?? "ok") === "ok"),
);

const filteredDatabases = computed(() =>
  filterOwnedDatabases(
    ownedDatabases.value,
    { keyword: listKeyword.value, brokenOnly: brokenOnly.value },
    healthMap.value,
    (db) => typeLabel(db.typeId),
  ),
);

const databasesForAdd = computed(() =>
  addPickerDatabases.value.length > 0
    ? addPickerDatabases.value
    : healthyDatabases.value,
);

interface WsRow {
  entry: WorkspaceDatabaseEntry;
  /** Catalog entry when the row is managed/collected — enables the existing actions. */
  db?: OwnedDatabase;
}

interface WsGroup {
  origin: WorkspaceDbOrigin;
  rows: WsRow[];
}

const wsGroups = computed<WsGroup[]>(() => {
  const byOrigin = new Map<WorkspaceDbOrigin, WsRow[]>();
  for (const entry of wsEntries.value) {
    const rows = byOrigin.get(entry.origin) ?? [];
    rows.push({
      entry,
      db: ownedDatabases.value.find((d) => d.avID === entry.avID),
    });
    byOrigin.set(entry.origin, rows);
  }
  const groups: WsGroup[] = [];
  for (const origin of ["managed", "collected", "active", "unreferenced"] as const) {
    const rows = byOrigin.get(origin);
    if (rows?.length) groups.push({ origin, rows });
  }
  return groups;
});

function wsOriginLabel(origin: WorkspaceDbOrigin): string {
  if (origin === "managed") return labels.value.originManaged;
  if (origin === "collected") return labels.value.originCollected;
  if (origin === "active") return labels.value.originActive;
  return labels.value.originOrphan;
}

/** Rows that offer checkbox + batch delete: every non-catalog entry. */
function isDeletableOrigin(origin: WorkspaceDbOrigin): boolean {
  return origin === "active" || origin === "unreferenced";
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

function canAdopt(entry: WorkspaceDatabaseEntry): boolean {
  return entry.origin === "active" && !!entry.blockID;
}

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

const addDocId = computed(() => menuDocId.value || docId.value);

const boundAvIds = computed(() => boundPanels.value.map((p) => p.avID));

const boundAvIdsForAdd = computed(() => {
  if (menuDocId.value && menuDocId.value !== docId.value) return [];
  return boundAvIds.value;
});

const docsTitle = computed(
  () => `${labels.value.docsTitle}${docsAvName.value ? ` · ${docsAvName.value}` : ""}`,
);

const docsColumnOptions = computed(() =>
  docsColumns.value.map((col) => ({
    value: col.keyID,
    label: col.name ? `${col.name} (${col.type})` : col.type,
  })),
);

const docsOpOptions = computed(() => [
  { value: "equals" as QueryOp, label: labels.value.queryEquals },
  { value: "contains" as QueryOp, label: labels.value.queryContains },
  { value: "isEmpty" as QueryOp, label: labels.value.queryIsEmpty },
]);

const docsFilterActive = computed(() => docsFilterKey.value !== "");

const filteredDocsRows = computed(() => {
  if (!docsFilterActive.value) return docsRows.value;
  const filter = {
    keyID: docsFilterKey.value,
    op: docsFilterOp.value,
    value: docsFilterValue.value,
  };
  return docsRows.value.filter((row) => matchDoc(row, filter));
});

const docsHitsLabel = computed(() =>
  labels.value.queryHits.replace("{n}", String(filteredDocsRows.value.length)),
);

function clearDocsFilter() {
  docsFilterKey.value = "";
  docsFilterOp.value = "contains";
  docsFilterValue.value = "";
}

function resetDocsState() {
  clearDocsFilter();
  docsColumns.value = [];
  docsRows.value = [];
  docsList.value = [];
}

const brokenCount = computed(
  () =>
    ownedDatabases.value.filter((db) => {
      const h = healthMap.value[db.avID];
      return h === "broken" || h === "missing";
    }).length,
);

const boundOwned = computed(() =>
  ownedDatabases.value.filter((db) => boundAvIds.value.includes(db.avID)),
);

const boundPanelCount = computed(() => boundPanels.value.length);

/** More than one under-title AV → abnormal; force cleanup UX. */
const isMessyBindings = computed(() => boundPanelCount.value > 1);

const primaryBound = computed(() => {
  if (isMessyBindings.value) return undefined;
  return boundOwned.value[0];
});

// Filter state lives only inside the docs dialog; drop it on close.
watch(showDocs, (visible) => {
  if (!visible) resetDocsState();
});

async function afterBindingMutation(targetDocId: string) {
  await store.refreshBound().catch(() => undefined);
  if (targetDocId === docId.value) {
    await refreshDocumentEditor(targetDocId, plugin);
  }
  void refreshDocCounts();
}

async function prepareCreateNotebook() {
  try {
    const list = await listNotebooks();
    notebooks.value = list;
    notebookOptions.value = list.map((n) => ({ label: n.name, value: n.id }));
    const active = await getActiveNotebookId();
    createNotebookId.value = pickCreateNotebookId({
      activeNotebookId: active,
      savedNotebookId: settingsStore.settings.ownedDbNotebookId,
      notebooks: list,
    });
  } catch {
    /* ignore */
  }
}

async function onJoinTemplate(templateKey: string) {
  if (!docId.value) {
    MessagePlugin.warning(getI18nText("ownedDb.needDoc", "请先打开一篇文档"));
    return;
  }
  if (!plugin) return;
  try {
    const result = await joinTableByKey({
      plugin,
      docId: docId.value,
      templateKey,
      nameOf: templateName,
    });
    if (result.addedColumns.length) {
      MessagePlugin.info(
        labels.value.columnsAdded.replace("{cols}", result.addedColumns.join("、")),
      );
    }
    if (result.kind === "already") {
      MessagePlugin.info(getI18nText("ownedDb.alreadyBound", "文档已在该库中"));
    } else {
      const toast = result.kind === "created"
        ? labels.value.createdJoin
        : labels.value.joinOk;
      MessagePlugin.success(toast.replace("{name}", dbDisplayName(result.db)));
      // joinTableByKey persisted the (possibly new) table — reload the catalog.
      await settingsStore.initialize().catch(() => undefined);
      await afterBindingMutation(docId.value);
    }
    await refreshDocCounts();
  } catch (e) {
    MessagePlugin.error(e instanceof Error ? e.message : String(e));
  }
}

/** Row count per table = fetchDatabaseQueryData rows; failures hide the badge. */
async function refreshDocCounts() {
  const dbs = [...ownedDatabases.value];
  if (!dbs.length) {
    docCounts.value = {};
    return;
  }
  const seq = ++docCountsSeq;
  const entries = await Promise.all(
    dbs.map(async (db) => {
      try {
        const data = await fetchDatabaseQueryData(db.avID);
        return [db.avID, data.rows.length] as const;
      } catch {
        return null;
      }
    }),
  );
  if (seq !== docCountsSeq) return; // superseded by a newer refresh
  const next: Record<string, number> = {};
  for (const entry of entries) {
    if (entry) next[entry[0]] = entry[1];
  }
  docCounts.value = next;
  // Self-heal database display names (legacy " (Duplicated …)" suffixes,
  // kernel-cache name clobbers). Fire-and-forget; failures are logged inside.
  void syncOwnedDatabaseNames(dbs).catch((e) =>
    console.warn("syncOwnedDatabaseNames failed", e),
  );
}

async function onGenerateDefault() {
  if (generating.value) return;
  generating.value = true;
  try {
    const { created } = await generateDefaultTables({
      plugin,
      nameOf: templateName,
    });
    // generateDefaultTables persists through the service path — reload the
    // store so later dock writes don't run on a stale catalog snapshot.
    await settingsStore.initialize().catch(() => undefined);
    await refreshHealth();
    await refreshDocCounts();
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

async function onUnbind(avID: string) {
  try {
    await store.unbind(avID);
    if (docId.value) await afterBindingMutation(docId.value);
    MessagePlugin.success(getI18nText("ownedDb.unbindOk", "已移出"));
  } catch (e) {
    MessagePlugin.error(e instanceof Error ? e.message : String(e));
  }
}

async function persistPrimaryAndLast(db: OwnedDatabase) {
  const typeId = normalizeDatabaseTypeId(db.typeId);
  await settingsStore.updateSettings(
    normalizePanelSettings({
      ...settingsStore.settings,
      ownedDbLastAvID: db.avID,
      ownedDbLastTypeId: typeId,
      ownedDbPrimaryByType: {
        ...settingsStore.settings.ownedDbPrimaryByType,
        [typeId]: db.avID,
      },
      showUnderTitlePanel: false,
    }),
  );
}

function startRename(db: OwnedDatabase) {
  renaming.value = { avID: db.avID, name: db.name };
}

function cancelRename() {
  renaming.value = null;
}

function onRenameKeydown(_value: string, ctx: { e: KeyboardEvent }) {
  if (ctx.e.key === "Escape") cancelRename();
}

async function commitRename() {
  const current = renaming.value;
  if (!current) return;
  renaming.value = null;
  const trimmed = current.name.trim();
  if (!trimmed) return; // blank input cancels without saving
  const db = ownedDatabases.value.find((d) => d.avID === current.avID);
  if (!db || db.name === trimmed) return;
  try {
    await persistOwned(
      ownedDatabases.value.map((d) =>
        d.avID === current.avID ? { ...d, name: trimmed } : d,
      ),
    );
  } catch (e) {
    MessagePlugin.error(e instanceof Error ? e.message : String(e));
  }
}

async function onBackfillColumns(db: OwnedDatabase) {
  try {
    const { added } = await ensureOwnedDatabaseTemplateColumns(db);
    if (added.length) {
      MessagePlugin.info(
        labels.value.columnsAdded.replace("{cols}", added.join("、")),
      );
    } else {
      MessagePlugin.success(labels.value.backfillNone);
    }
  } catch (e) {
    MessagePlugin.error(e instanceof Error ? e.message : String(e));
  }
}

async function onBound(db: OwnedDatabase, boundDocId?: string) {
  try {
    const { added } = await ensureOwnedDatabaseTemplateColumns(db);
    if (added.length) {
      MessagePlugin.info(
        labels.value.columnsAdded.replace("{cols}", added.join("、")),
      );
    }
  } catch (e) {
    console.warn("ensureOwnedDatabaseTemplateColumns failed", e);
  }
  const refreshId = boundDocId || addDocId.value || docId.value;
  await persistPrimaryAndLast(db);
  menuDocId.value = "";
  if (refreshId) await afterBindingMutation(refreshId);
  MessagePlugin.success(
    getI18nText(
      "ownedDb.bindOkNative",
      `已挂到「${dbDisplayName(db)}」。请在标题下原生区域编辑属性。`,
    ),
  );
}

async function onCleanExtraBindings() {
  if (!docId.value) {
    MessagePlugin.warning(getI18nText("ownedDb.needDoc", "请先打开一篇文档"));
    return;
  }
  try {
    const panels = await fetchAttributeViews(docId.value);
    if (panels.length <= 1) {
      MessagePlugin.info(labels.value.cleanExtraNone);
      await store.refreshBound().catch(() => undefined);
      return;
    }

    const panelIds = new Set(panels.map((p) => p.avID));
    const keep =
      boundOwned.value.find((db) => panelIds.has(db.avID))
      ?? ownedDatabases.value.find((db) => panelIds.has(db.avID));

    if (keep) {
      const result = await clearDocumentDatabaseBindings({
        docId: docId.value,
        keepAvID: keep.avID,
      });
      await afterBindingMutation(docId.value);
      MessagePlugin.success(
        labels.value.cleanExtraOkN
          .replace("{n}", String(result.removed))
          .replace("{name}", dbDisplayName(keep)),
      );
      return;
    }

    const result = await clearDocumentDatabaseBindings({ docId: docId.value });
    await afterBindingMutation(docId.value);
    MessagePlugin.success(
      labels.value.cleanExtraCleared.replace("{n}", String(result.removed)),
    );
  } catch (e) {
    MessagePlugin.error(e instanceof Error ? e.message : String(e));
  }
}

function openAddPicker(filter?: OwnedDatabase[]) {
  menuDocId.value = "";
  addPickerDatabases.value = filter ?? [];
  showAdd.value = true;
}

async function openDocs(db: OwnedDatabase) {
  docsAvName.value = db.name;
  resetDocsState();
  showDocs.value = true;
  docsLoading.value = true;
  try {
    const data = await fetchDatabaseQueryData(db.avID);
    docsColumns.value = data.columns;
    docsRows.value = data.rows;
  } catch (e) {
    // Kernel failure → fall back to the legacy bound-docs list (no filter UI).
    console.warn("fetchDatabaseQueryData failed, falling back", e);
  }
  if (!docsRows.value.length) {
    try {
      docsList.value = await listDatabaseBoundDocs(db.avID);
    } catch (e) {
      MessagePlugin.error(e instanceof Error ? e.message : String(e));
    }
  }
  docsLoading.value = false;
}

async function openBoundDoc(id: string) {
  showDocs.value = false;
  try {
    await openDocument(id, plugin);
  } catch (e) {
    console.warn("openBoundDoc failed", e);
  }
}

async function refreshHealth() {
  if (!ownedDatabases.value.length) {
    healthMap.value = {};
    return;
  }
  try {
    healthMap.value = await checkOwnedDatabasesHealth(ownedDatabases.value);
  } catch {
    /* ignore */
  }
}

async function refreshWorkspace() {
  const seq = ++wsLoadingSeq;
  wsLoading.value = true;
  try {
    const entries = await listWorkspaceDatabases({ owned: ownedDatabases.value });
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

function toggleWorkspace() {
  showWorkspace.value = !showWorkspace.value;
  if (showWorkspace.value) {
    void refreshWorkspace();
  } else {
    wsOrphanSelected.value = new Set();
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
  if (ownedDatabases.value.some((x) => x.avID === db.avID)) {
    MessagePlugin.info(getI18nText("ownedDb.exists", "该库已在名单中"));
    return;
  }
  try {
    // persistOwned refreshes catalog health internally.
    await persistOwned([...ownedDatabases.value, db]);
    MessagePlugin.success(labels.value.adoptOk.replace("{name}", db.name));
    // Back to the catalog so the adopted table shows its full actions.
    showWorkspace.value = false;
    void refreshWorkspace();
    void refreshDocCounts();
  } catch (e) {
    MessagePlugin.error(e instanceof Error ? e.message : String(e));
  }
}

async function cleanBroken() {
  const next = ownedDatabases.value.filter((db) => {
    const h = healthMap.value[db.avID];
    return h !== "broken" && h !== "missing";
  });
  const removed = ownedDatabases.value.length - next.length;
  await persistOwned(next);
  await refreshHealth();
  MessagePlugin.success(
    getI18nText("ownedDb.cleanedN", `已从名单移除 ${removed} 个异常库（未删除思源中的文件）`),
  );
}

async function openCreateDialog() {
  showCreateAdvanced.value = false;
  createStartKey.value = "blank";
  await prepareCreateNotebook();
  showCreate.value = true;
}

function onCreateClick() {
  void openCreateDialog();
}

async function persistOwned(next: OwnedDatabase[]) {
  await settingsStore.updateSettings(
    normalizePanelSettings({
      ...settingsStore.settings,
      ownedDatabases: next,
      showUnderTitlePanel: false,
    }),
  );
  await refreshHealth();
}

async function registerHit(hit: AttributeViewSearchHit) {
  const db = ownedFromSearchHit(hit);
  if (ownedDatabases.value.some((x) => x.avID === db.avID)) {
    MessagePlugin.info(getI18nText("ownedDb.exists", "该库已在名单中"));
    return;
  }
  await persistOwned([...ownedDatabases.value, db]);
  MessagePlugin.success(getI18nText("ownedDb.collected", "已导入「{name}」").replace("{name}", db.name));
}

/**
 * Second confirm when the home doc about to be deleted still hosts FOREIGN
 * database blocks (legacy bug nested tables inside each other's home docs):
 * deleting the doc destroys those blocks too. Resolves true to proceed.
 */
function confirmDeleteForeignBlocks(hostName: string, foreign: AttributeViewSearchHit[]): Promise<boolean> {
  const names = foreign.map((h) => h.avName).join("、");
  return new Promise((resolve) => {
    const inner = DialogPlugin.confirm({
      header: labels.value.foreignBlocksTitle,
      body: labels.value.foreignBlocksBody
        .replace("{doc}", hostName)
        .replace("{names}", names),
      confirmBtn: labels.value.foreignBlocksOk,
      cancelBtn: labels.value.close,
      theme: "warning",
      onConfirm: () => {
        resolve(true);
        inner.hide();
      },
      onCancel: () => resolve(false),
      onClose: () => resolve(false),
    });
  });
}

/** Foreign-block probe that never breaks the remove flow (fail-open). */
async function findForeignDatabaseBlocksSafe(db: OwnedDatabase): Promise<AttributeViewSearchHit[]> {
  if (!db.homeDocId) return [];
  try {
    return await findForeignDatabaseBlocksInDoc({
      docId: db.homeDocId,
      excludeAvIDs: [db.avID],
    });
  } catch (e) {
    console.warn("findForeignDatabaseBlocksInDoc failed", e);
    return [];
  }
}

async function removeOwned(avID: string) {
  const db = ownedDatabases.value.find((d) => d.avID === avID);
  if (!db) return;

  const body = labels.value.removeConfirmBody.replace("{name}", db.name);

  const dialog = DialogPlugin.confirm({
    header: labels.value.removeConfirmTitle,
    body,
    confirmBtn: labels.value.removeConfirmOk,
    cancelBtn: labels.value.removeCatalogOnly,
    theme: "danger",
    onConfirm: async () => {
      try {
        if (db.homeDocId && db.source !== "collected") {
          const foreign = await findForeignDatabaseBlocksSafe(db);
          if (foreign.length && !(await confirmDeleteForeignBlocks(db.name, foreign))) {
            dialog.hide();
            return;
          }
          await deleteOwnedDatabaseHome(db);
          await persistOwned(ownedDatabases.value.filter((d) => d.avID !== avID));
          MessagePlugin.success(labels.value.removeOkDeleted);
        } else if (db.homeDocId) {
          // collected but has home — still try delete if user confirmed delete
          const foreign = await findForeignDatabaseBlocksSafe(db);
          if (foreign.length && !(await confirmDeleteForeignBlocks(db.name, foreign))) {
            dialog.hide();
            return;
          }
          await deleteOwnedDatabaseHome(db);
          await persistOwned(ownedDatabases.value.filter((d) => d.avID !== avID));
          MessagePlugin.success(labels.value.removeOkDeleted);
        } else {
          await persistOwned(ownedDatabases.value.filter((d) => d.avID !== avID));
          MessagePlugin.success(labels.value.removeOkCatalog);
        }
      } catch (e) {
        MessagePlugin.error(e instanceof Error ? e.message : String(e));
      }
      dialog.hide();
    },
    onClose: () => {
      // cancelBtn = catalog only
    },
    onCancel: async () => {
      await persistOwned(ownedDatabases.value.filter((d) => d.avID !== avID));
      MessagePlugin.success(labels.value.removeOkCatalog);
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
      getI18nText("ownedDb.noneOnPage", "当前文档里没找到数据库块"),
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
      source: "collected",
      createdAt: Date.now(),
    });
  }
  if (!added.length) {
    MessagePlugin.info(getI18nText("ownedDb.allCollected", "页面上的库都已在名单中"));
    return;
  }
  await persistOwned([...ownedDatabases.value, ...added]);
  MessagePlugin.success(
    getI18nText("ownedDb.collectedN", "已导入 {n} 个库").replace("{n}", String(added.length)),
  );
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
    await settingsStore.updateSettings(
      normalizePanelSettings({
        ...settingsStore.settings,
        ownedDatabases: [...ownedDatabases.value, db],
        ownedDbNotebookId: createNotebookId.value,
        ownedDbLastAvID: db.avID,
        showUnderTitlePanel: false,
      }),
    );
    await refreshHealth();
    void refreshDocCounts();
    showCreate.value = false;
    createName.value = "";
    showCreateAdvanced.value = false;
    MessagePlugin.success(
      getI18nText("ownedDb.createOkName", "已创建「{name}」").replace("{name}", dbDisplayName(db)),
    );
  } catch (e) {
    MessagePlugin.error(e instanceof Error ? e.message : String(e));
  }
  return false;
}

async function refreshContext() {
  await settingsStore.initialize().catch(() => undefined);
  const id = getActiveDocumentId();
  if (!id) return;
  await store.setContext({ docId: id, path: "", notebookId: "" }).catch(() => undefined);
}

let timer: ReturnType<typeof setInterval> | undefined;
let offSettingsChanged: (() => void) | undefined;

onMounted(async () => {
  void refreshContext();
  timer = setInterval(() => {
    const id = getActiveDocumentId();
    if (id && id !== store.docId) void refreshContext();
  }, 1500);
  await prepareCreateNotebook();
  await refreshHealth();
  void refreshDocCounts();
  // Default view is the workspace list — load it on mount (上来就能看到所有数据库).
  void refreshWorkspace();
  offSettingsChanged = onSettingsChanged(() => {
    void settingsStore
      .initialize()
      .then(() => refreshHealth())
      .then(() => refreshDocCounts())
      .catch(() => undefined);
    void store.refreshBound().catch(() => undefined);
    if (showWorkspace.value) void refreshWorkspace();
  });
});

onUnmounted(() => {
  if (timer) clearInterval(timer);
  offSettingsChanged?.();
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

h3 {
  margin: 0 0 8px;
  font-size: 14px;
}

.section-head h3 {
  margin: 0;
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

.row-actions {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
}

.name {
  font-size: 13px;
  font-weight: 500;
}

.name-btn {
  padding: 0;
  border: none;
  background: transparent;
  color: inherit;
  text-align: left;
  font: inherit;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.name-btn:hover {
  color: var(--b3-theme-primary, #357);
}

.rename-input {
  flex: 1;
  min-width: 0;
}

.filter-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.filter-row :deep(.t-input) {
  flex: 1;
  min-width: 0;
}

.filter-row .broken-only {
  flex-shrink: 0;
  font-size: 12px;
}

.name-cell {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.badge {
  flex-shrink: 0;
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 3px;
  color: var(--b3-theme-error, #e35);
  background: color-mix(in srgb, var(--b3-theme-error, #e35) 16%, transparent);
}

.head-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ws-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 10px;
}

.ws-group-head {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--b3-theme-on-surface-light, #888);
}

.ws-group-count {
  padding: 0 5px;
  border-radius: 8px;
  background: var(--b3-theme-surface-lighter, rgba(255, 255, 255, 0.06));
  font-size: 10px;
}

.ws-name-wrap {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.ws-name-wrap .path {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ws-origin {
  color: var(--b3-theme-on-surface-light, #888);
  background: var(--b3-theme-surface-lighter, rgba(255, 255, 255, 0.06));
}

.ws-adopt-hint {
  font-size: 11px;
  text-align: right;
}

.ws-orphan-check {
  flex-shrink: 0;
}

.ws-group-head .ws-orphan-delete {
  margin-left: auto;
}

.doc-count {
  flex-shrink: 0;
  font-size: 11px;
}

.health-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
  padding: 8px;
  border-radius: 4px;
  font-size: 12px;
  background: color-mix(in srgb, var(--b3-theme-error, #e35) 12%, transparent);
}

.guide {
  margin: 0 0 8px;
  font-size: 12px;
  line-height: 1.45;
  color: var(--b3-theme-on-surface-light, #888);
}

.quick-tables {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}

.quick-table-btn {
  padding: 8px 6px;
  border-radius: 4px;
  border: 1px solid var(--b3-border-color, rgba(255, 255, 255, 0.12));
  background: var(--b3-theme-surface-lighter, rgba(255, 255, 255, 0.04));
  color: inherit;
  font-size: 13px;
  cursor: pointer;
}

.quick-table-btn:hover {
  border-color: var(--b3-theme-primary, #357);
}

.status-card {
  padding: 10px;
  border-radius: 6px;
  border: 1px solid var(--b3-border-color, rgba(255, 255, 255, 0.1));
  background: var(--b3-theme-surface-lighter, rgba(255, 255, 255, 0.03));
}

.status-card.warn {
  border-color: color-mix(in srgb, var(--b3-theme-warning, #c80) 50%, transparent);
  background: color-mix(in srgb, var(--b3-theme-warning, #c80) 10%, transparent);
}

.status-title {
  font-size: 15px;
  font-weight: 600;
  line-height: 1.35;
}

.status-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.doc-item {
  display: block;
  width: 100%;
  text-align: left;
  padding: 8px 10px;
  border-radius: 4px;
  border: 1px solid var(--b3-border-color, rgba(255, 255, 255, 0.08));
  background: transparent;
  color: inherit;
  cursor: pointer;
  font-size: 13px;
}

.doc-item:hover {
  border-color: var(--b3-theme-primary, #357);
}

.docs-filter {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}

.docs-filter-col {
  flex: 1.2;
  min-width: 0;
}

.docs-filter-op {
  flex: 0.9;
  min-width: 0;
}

.docs-filter-value {
  flex: 1;
  min-width: 0;
}

.docs-filter-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  margin-bottom: 6px;
  min-height: 22px;
}

.more {
  margin-top: auto;
  padding-top: 4px;
  border-top: 1px solid var(--b3-border-color, rgba(255, 255, 255, 0.08));
}

.more-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 6px 0;
  border: none;
  background: transparent;
  color: var(--b3-theme-on-surface-light, #888);
  font-size: 12px;
  cursor: pointer;
}

.more-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-bottom: 4px;
}

.chevron {
  opacity: 0.8;
}
</style>

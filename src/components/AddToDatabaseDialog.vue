<template>
  <t-dialog
    :visible="visible"
    :header="labels.title"
    width="420px"
    :confirm-btn="null"
    :cancel-btn="labels.close"
    @close="emit('update:visible', false)"
    @update:visible="emit('update:visible', $event)"
  >
    <p class="hint">{{ labels.hint }}</p>
    <div v-if="!databases.length" class="empty">{{ labels.empty }}</div>
    <template v-else>
      <t-input
        v-model="keyword"
        class="search"
        clearable
        :placeholder="labels.searchPh"
      />
      <div v-if="!filtered.length" class="empty">{{ labels.noHits }}</div>
      <div v-else class="list">
        <button
          v-for="db in filtered"
          :key="db.id"
          type="button"
          class="db-item"
          :disabled="busyId === db.avID"
          @click="pick(db)"
        >
          <span class="name">{{ displayName(db) }}</span>
          <span v-if="boundIds.has(db.avID)" class="tag">{{ labels.already }}</span>
        </button>
      </div>
    </template>
  </t-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { MessagePlugin } from "tdesign-vue-next";
import type { OwnedDatabase } from "@/models/ownedDatabase";
import type { DatabaseTypeId } from "@/models/databaseTypes";
import { DATABASE_TYPES } from "@/models/databaseTypes";
import { displayOwnedDatabaseName } from "@/models/ownedDatabaseHang";
import { getI18nText } from "@/services/i18n";
import { migrateDocumentToOwnedDatabase } from "@/services/ownedDatabaseMigrate";

const props = defineProps<{
  visible: boolean;
  docId: string;
  databases: OwnedDatabase[];
  /** All plugin-owned catalog avIDs (for exclusive migrate). */
  ownedAvIds?: string[];
  boundAvIds?: string[];
}>();

const emit = defineEmits<{
  "update:visible": [boolean];
  bound: [OwnedDatabase];
}>();

const busyId = ref("");
const boundIds = computed(() => new Set(props.boundAvIds ?? []));
const keyword = ref("");

function typeLabel(typeId?: DatabaseTypeId): string {
  const def = DATABASE_TYPES.find((t) => t.id === typeId);
  return def ? getI18nText(def.nameKey, typeId ?? "") : "";
}

function displayName(db: OwnedDatabase): string {
  return displayOwnedDatabaseName(db.name, typeLabel(db.typeId));
}

const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase();
  if (!kw) return props.databases;
  return props.databases.filter(
    (db) =>
      displayName(db).toLowerCase().includes(kw)
      || typeLabel(db.typeId).toLowerCase().includes(kw),
  );
});

watch(
  () => props.visible,
  (visible) => {
    if (visible) keyword.value = "";
  },
);

const labels = computed(() => ({
  title: getI18nText("ownedDb.addTitle", "添加到数据库"),
  hint: getI18nText(
    "ownedDb.addHint",
    "一篇文档在「我们的库」里只属于一个库；换库会自动从其它库移出。",
  ),
  empty: getI18nText("ownedDb.addEmpty", "还没有可用的库。请先新建，或清理异常库后再试。"),
  close: getI18nText("close", "关闭"),
  already: getI18nText("ownedDb.already", "已加入"),
  searchPh: getI18nText("ownedDb.searchPh", "按库名搜索"),
  noHits: getI18nText("ownedDb.noHits", "没有匹配的数据库"),
}));

async function pick(db: OwnedDatabase) {
  if (!props.docId) {
    MessagePlugin.warning(getI18nText("ownedDb.needDoc", "请先打开一篇文档"));
    return;
  }
  if (boundIds.value.has(db.avID)) {
    MessagePlugin.info(getI18nText("ownedDb.alreadyBound", "文档已在该库中"));
    return;
  }
  busyId.value = db.avID;
  try {
    const ownedAvIDs = props.ownedAvIds?.length
      ? props.ownedAvIds
      : props.databases.map((d) => d.avID);
    await migrateDocumentToOwnedDatabase({
      docId: props.docId,
      target: db,
      ownedAvIDs,
      // Prefer live keys so orphan「未命名」tabs are cleared too.
      currentlyBoundAvIDs: undefined,
    });
    emit("bound", db);
    emit("update:visible", false);
  } catch (e) {
    MessagePlugin.error(e instanceof Error ? e.message : String(e));
  } finally {
    busyId.value = "";
  }
}
</script>

<style scoped>
.hint {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--td-text-color-secondary);
}
.search {
  margin-bottom: 8px;
}
.empty {
  padding: 16px 0;
  color: var(--td-text-color-placeholder);
  font-size: 13px;
}
.list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 360px;
  overflow: auto;
}
.db-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  text-align: left;
  padding: 10px 12px;
  border-radius: 6px;
  border: 1px solid var(--td-component-border);
  background: transparent;
  color: inherit;
  cursor: pointer;
}
.db-item:hover:not(:disabled) {
  border-color: var(--td-brand-color);
}
.db-item:disabled {
  opacity: 0.6;
  cursor: default;
}
.name {
  font-size: 14px;
  font-weight: 500;
}
.tag {
  font-size: 12px;
  opacity: 0.7;
}
</style>

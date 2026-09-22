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
    <div v-else class="list">
      <button
        v-for="db in databases"
        :key="db.id"
        type="button"
        class="db-item"
        :disabled="busyId === db.avID"
        @click="pick(db)"
      >
        <span class="name">{{ db.name }}</span>
        <span v-if="boundIds.has(db.avID)" class="tag">{{ labels.already }}</span>
      </button>
    </div>
  </t-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { MessagePlugin } from "tdesign-vue-next";
import type { OwnedDatabase } from "@/models/ownedDatabase";
import { getI18nText } from "@/services/i18n";
import { bindDocumentToDatabase } from "@/services/attributeView";

const props = defineProps<{
  visible: boolean;
  docId: string;
  databases: OwnedDatabase[];
  boundAvIds?: string[];
}>();

const emit = defineEmits<{
  "update:visible": [boolean];
  bound: [OwnedDatabase];
}>();

const busyId = ref("");
const boundIds = computed(() => new Set(props.boundAvIds ?? []));

const labels = computed(() => ({
  title: getI18nText("ownedDb.addTitle", "添加到数据库"),
  hint: getI18nText("ownedDb.addHint", "选择一个我们的库（只显示名称）"),
  empty: getI18nText("ownedDb.addEmpty", "还没有「我们的库」。请先在 Dock 里新建或收藏。"),
  close: getI18nText("close", "关闭"),
  already: getI18nText("ownedDb.already", "已加入"),
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
    await bindDocumentToDatabase({
      avID: db.avID,
      avBlockID: db.avBlockID,
      docId: props.docId,
      viewID: db.viewID,
    });
    MessagePlugin.success(getI18nText("ownedDb.bindOk", `已加入「${db.name}」`));
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

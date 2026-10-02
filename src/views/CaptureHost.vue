<template>
  <t-dialog
    v-model:visible="show"
    :header="labels.title"
    width="460px"
    :confirm-btn="labels.capture"
    :cancel-btn="labels.close"
    @confirm="onCapture"
    @close="reset"
  >
    <t-input
      v-model="title"
      class="cap-input"
      clearable
      autofocus
      :placeholder="labels.titlePh"
      @enter="onCapture"
    />
    <t-textarea
      v-model="content"
      class="cap-content"
      :autosize="{ minRows: 4, maxRows: 10 }"
      :placeholder="labels.contentPh"
    />
    <p class="muted">{{ labels.hint }}</p>
  </t-dialog>
</template>

<script setup lang="ts">
/**
 * Body-hosted「快记」capture: one box, one keystroke — the entry lands as a
 * new document inside the 素材收集箱 table (auto-created when missing).
 * index.ts's top-bar button dispatches CAPTURE_EVENT; the dialog opens
 * regardless of which doc/dock state the user is in.
 */
import { inject, onMounted, onUnmounted, ref } from "vue";
import { MessagePlugin } from "tdesign-vue-next";
import type { Plugin } from "siyuan";
import { getI18nText } from "@/services/i18n";
import { CAPTURE_EVENT } from "@/services/doctreeClassifyEvents";
import { createDocIntoTable } from "@/services/doctreeClassify";
import { ensureTableForTemplateKey } from "@/services/ownedDatabase";
import { displayOwnedDatabaseName } from "@/models/ownedDatabaseHang";

const plugin = inject<Plugin>("$plugin")!;

const show = ref(false);
const title = ref("");
const content = ref("");
const busy = ref(false);

const labels = ref({
  title: getI18nText("ownedDb.capture", "记一条到收集箱"),
  capture: getI18nText("ownedDb.capture", "记一条"),
  close: getI18nText("close", "关闭"),
  titlePh: getI18nText("ownedDb.captureTitlePh", "想记点什么…"),
  contentPh: getI18nText(
    "ownedDb.captureContentPh",
    "补充内容（可选，支持 Markdown）",
  ),
  hint: getI18nText(
    "ownedDb.captureHint",
    "将创建一篇文档并放入素材收集箱，稍后可在表格里整理。",
  ),
  captureOk: getI18nText("ownedDb.captureOk", "已入收集箱"),
  needTitle: getI18nText("ownedDb.captureNeedTitle", "先写个标题"),
});

function reset(): void {
  title.value = "";
  content.value = "";
  busy.value = false;
}

async function onCapture(): Promise<void> {
  const t = title.value.trim();
  if (!t) {
    MessagePlugin.warning(labels.value.needTitle);
    return;
  }
  if (busy.value) return;
  busy.value = true;
  try {
    // Zero-config: the inbox table is generated on first capture if missing.
    const { db } = await ensureTableForTemplateKey({
      plugin,
      templateKey: "inbox",
      nameOf: (tpl) => getI18nText(tpl.nameKey, tpl.nameFallback),
    });
    await createDocIntoTable({
      plugin,
      db,
      title: t,
      markdown: content.value.trim(),
    });
    const name = displayOwnedDatabaseName(
      db.name,
      getI18nText("ownedDb.tables.inbox", "素材收集箱"),
    );
    MessagePlugin.success(
      name ? `${labels.value.captureOk}（${name}）` : labels.value.captureOk,
    );
    reset();
    show.value = false;
  } catch (e) {
    MessagePlugin.error(e instanceof Error ? e.message : String(e));
  } finally {
    busy.value = false;
  }
}

function onCaptureEvent(): void {
  show.value = true;
}

onMounted(() => window.addEventListener(CAPTURE_EVENT, onCaptureEvent));
onUnmounted(() => window.removeEventListener(CAPTURE_EVENT, onCaptureEvent));
</script>

<style scoped>
.cap-input {
  margin-bottom: 10px;
}
.cap-content {
  margin-bottom: 10px;
}
.muted {
  margin: 0;
  font-size: 12px;
  color: var(--td-text-color-placeholder);
}
</style>

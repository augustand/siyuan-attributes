<template>
    <div class="block-attr-overlay" role="dialog" aria-modal="true" @click.self="close">
        <div class="block-attr-dialog">
            <header class="dialog-header">
                <div class="header-main">
                    <h2>{{ labels.title }}</h2>
                    <code class="block-id">{{ blockId }}</code>
                </div>
                <div class="header-actions">
                    <t-button size="small" variant="text" @click="copyId">{{ labels.copyId }}</t-button>
                    <t-button size="small" variant="text" @click="close">{{ labels.close }}</t-button>
                </div>
            </header>
            <div class="dialog-body">
                <AttributePanel />
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { inject, onMounted, onUnmounted } from "vue";
import { MessagePlugin } from "tdesign-vue-next";
import type { Plugin } from "siyuan";
import AttributePanel from "@/views/AttributePanel.vue";
import { useAttributesStore } from "@/store/attribute";
import { useConfigStore } from "@/store/rules";
import { setI18n, getI18nText } from "@/services/i18n";
import { onSettingsChanged } from "@/services/settingEvents";

const plugin = inject<Plugin>("$plugin");
const blockId = inject<string>("$docId", "");
const closeDialog = inject<() => void>("$closeBlockDialog", () => undefined);
setI18n(plugin?.i18n as Record<string, unknown> | undefined);

const attributeStore = useAttributesStore();
const settingsStore = useConfigStore();
const removeSettingsChangedListener = onSettingsChanged(() => {
    void reloadFromSettings();
});

const labels = {
    title: getI18nText("blockDialog.title", "块属性"),
    close: getI18nText("blockDialog.close", "关闭"),
    copyId: getI18nText("blockDialog.copyId", "复制 ID"),
};

function close(): void {
    closeDialog();
}

async function copyId(): Promise<void> {
    try {
        await navigator.clipboard.writeText(blockId);
        MessagePlugin.success(getI18nText("attributes.copySuccess", "已复制"));
    } catch {
        MessagePlugin.error(getI18nText("attributes.copyFailed", "复制失败"));
    }
}

function refreshAttributes(): void {
    void attributeStore.loadDocumentAttributes().catch((error) => {
        MessagePlugin.error(
            error instanceof Error
                ? error.message
                : getI18nText("blockDialog.loadFailed", "加载块属性失败"),
        );
    });
}

async function reloadFromSettings(): Promise<void> {
    await settingsStore.initialize();
    refreshAttributes();
}

onMounted(() => {
    void settingsStore
        .initialize()
        .then(refreshAttributes)
        .catch((error) => {
            MessagePlugin.error(error instanceof Error ? error.message : "加载设置失败");
        });
});

onUnmounted(() => {
    removeSettingsChangedListener();
});
</script>

<style scoped>
.block-attr-overlay {
    position: fixed;
    inset: 0;
    z-index: 400;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: rgba(0, 0, 0, 0.45);
}

.block-attr-dialog {
    display: flex;
    flex-direction: column;
    width: min(720px, 100%);
    max-height: min(80vh, 900px);
    overflow: hidden;
    border-radius: var(--td-radius-large);
    background: var(--td-bg-color-container);
    box-shadow: var(--td-shadow-3);
}

.dialog-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    padding: 16px 20px;
    border-bottom: 1px solid var(--td-component-stroke);
}

.header-main h2 {
    margin: 0 0 6px;
    font-size: 16px;
}

.block-id {
    display: block;
    color: var(--td-text-color-secondary);
    font-size: 12px;
    word-break: break-all;
}

.header-actions {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
}

.dialog-body {
    overflow: auto;
    padding: 8px 20px 20px;
}
</style>

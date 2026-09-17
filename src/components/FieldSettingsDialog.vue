<template>
    <Teleport to="body">
        <div class="field-settings-overlay" role="dialog" aria-modal="true">
            <div class="field-settings-dialog">
                <header class="dialog-header">
                    <div>
                        <h2>{{ labels.title }}</h2>
                        <p>{{ labels.subtitle }}</p>
                    </div>
                    <t-button variant="text" @click="close">{{ labels.close }}</t-button>
                </header>

                <div class="dialog-body">
                    <t-loading :loading="loading || store.isSaving" :text="labels.loading">
                        <section class="field-group">
                            <div class="group-header">
                                <h3>{{ labels.documentFields }}</h3>
                                <span class="group-count">{{ documentItems.length }}</span>
                            </div>

                            <div v-if="documentItems.length === 0" class="empty">
                                {{ labels.noDocumentFields }}
                            </div>

                            <div v-for="item in documentItems" :key="item.key" class="field-card">
                                <div class="field-identity">
                                    <div class="field-title">
                                        <span class="field-name">{{ item.attr.displayAs || item.key }}</span>
                                        <span class="source-badge">文档</span>
                                        <span v-if="!item.rule.display" class="hidden-badge">{{ labels.hidden }}</span>
                                    </div>
                                    <code class="field-key">{{ item.key }}</code>
                                    <p v-if="item.attr.value" class="field-preview">{{ item.attr.value }}</p>
                                </div>

                                <div class="field-controls">
                                    <label>
                                        <span>{{ labels.display }}</span>
                                        <t-switch v-model="item.rule.display" />
                                    </label>
                                    <label>
                                        <span>{{ labels.displayName }}</span>
                                        <t-input v-model="item.rule.displayAs" />
                                    </label>
                                    <label>
                                        <span>{{ labels.order }}</span>
                                        <t-input-number v-model="item.rule.order" theme="column" :min="0" :max="99999" />
                                    </label>
                                    <label>
                                        <span>{{ labels.editable }}</span>
                                        <t-switch
                                            v-model="item.rule.editable"
                                            :disabled="isDocumentKeyReadonly(item.key)"
                                        />
                                    </label>
                                </div>
                                <p v-if="isDocumentKeyReadonly(item.key)" class="readonly-help">
                                    {{ labels.readonlyCapability }}
                                </p>
                            </div>
                        </section>
                    </t-loading>
                </div>

                <footer class="dialog-footer">
                    <span class="footer-status">{{ status }}</span>
                    <div class="footer-actions">
                        <t-button theme="default" :disabled="saving" @click="close">{{ labels.cancel }}</t-button>
                        <t-button theme="primary" :disabled="saving || loading" @click="save">{{ labels.save }}</t-button>
                    </div>
                </footer>
            </div>
        </div>
    </Teleport>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import { useAttributesStore } from '@/store/attribute';
import { useConfigStore } from '@/store/rules';
import {
  findExactDisplayRule,
  normalizeDisplayRule,
} from '@/models/settings';
import { isReadOnlyDocumentAttributeName } from '@/models/settings';
import type { DisplayRule } from '@/models/settings';
import { getI18nText } from '@/services/i18n';

const emit = defineEmits<{
    (event: 'close'): void;
    (event: 'saved'): void;
}>();

const attributeStore = useAttributesStore();
const settingsStore = useConfigStore();
const store = attributeStore;
const loading = ref(false);
const saving = ref(false);
const status = ref('');

const documentDrafts = ref<Array<{
    key: string;
    attr: {
        key: string;
        value: string;
        displayAs: string;
        editable: boolean;
    };
    rule: DisplayRule;
}>>([]);

const labels = {
    title: getI18nText('fieldSettings.title', '当前字段设置'),
    subtitle: getI18nText('fieldSettings.subtitle', '配置当前文档中的属性'),
    close: getI18nText('close', '关闭'),
    loading: getI18nText('loading', '加载中...'),
    save: getI18nText('save', '保存'),
    cancel: getI18nText('cancel', '取消'),
    documentFields: getI18nText('fieldSettings.documentFields', '文档属性'),
    noDocumentFields: getI18nText('fieldSettings.noDocumentFields', '暂无文档属性'),
    display: getI18nText('settings.display', '显示'),
    displayName: getI18nText('settings.displayName', '显示名'),
    order: getI18nText('settings.order', '排序值'),
    editable: getI18nText('settings.editable', '可编辑'),
    hidden: getI18nText('settings.hidden', '已隐藏'),
    readonlyCapability: getI18nText('settings.readOnlyCapability', '该字段由思源管理，值不可通过面板修改；显示名仅是插件内别名。'),
    saveSuccess: getI18nText('fieldSettings.saveSuccess', '字段设置已保存'),
    saveFailed: getI18nText('fieldSettings.saveFailed', '保存字段设置失败'),
};

const canSave = computed(() => !loading.value && !saving.value);
const documentItems = computed(() => documentDrafts.value);

function buildDocumentDraft(item: {
    key: string;
    value: string;
    name: string;
    displayAs: string;
    editable: boolean;
    order: number;
    icon?: string;
}) {
    const exact = findExactDisplayRule(settingsStore.settings.rules, item.key);
    const matched = settingsStore.matchDocumentRule(item.key);
    const base = exact || matched;

    return normalizeDisplayRule({
        id: exact?.id || `field:document:${item.key}`,
        name: item.key,
        rule: item.key,
        matchMethod: 'exact',
        scope: 'document',
        display: base ? base.display : true,
        displayAs: base?.displayAs || item.displayAs || item.key,
        editable: !isReadOnlyDocumentAttributeName(item.key) && (base?.editable ?? true),
        order: base?.order ?? item.order,
        icon: base?.icon || item.icon,
        system: Boolean(base?.system && exact),
    });
}

function isDocumentKeyReadonly(key: string): boolean {
    return isReadOnlyDocumentAttributeName(key);
}

function loadDrafts(): void {
    documentDrafts.value = attributeStore.allDocumentAttributes.map((attribute) => ({
        key: attribute.key,
        attr: {
            key: attribute.key,
            value: attribute.value,
            displayAs: attribute.displayAs,
            editable: attribute.editable,
        },
        rule: buildDocumentDraft(attribute),
    }));
}

function close(): void {
    emit('close');
}

async function save(): Promise<void> {
    if (!canSave.value) return;
    saving.value = true;
    status.value = '';

    try {
        await settingsStore.upsertDocumentFieldRules(
            documentDrafts.value.map((item) => item.rule),
        );

        status.value = labels.saveSuccess;
        emit('saved');
        emit('close');
    } catch (error) {
        status.value = error instanceof Error ? error.message : labels.saveFailed;
        MessagePlugin.error(status.value);
    } finally {
        saving.value = false;
    }
}

onMounted(async () => {
    loading.value = true;
    try {
        await settingsStore.initialize();
        loadDrafts();
    } catch (error) {
        status.value = error instanceof Error ? error.message : getI18nText('settings.loadFailed', '加载设置失败');
    } finally {
        loading.value = false;
    }
});
</script>

<style scoped lang="scss">
.field-settings-overlay {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: rgba(0, 0, 0, 42%);
}

.field-settings-dialog {
    display: flex;
    flex-direction: column;
    width: min(840px, 94vw);
    height: min(700px, 88vh);
    overflow: hidden;
    border-radius: var(--td-radius-medium);
    background: var(--td-bg-color-container);
    box-shadow: var(--td-shadow-3);
}

.dialog-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    padding: 18px 20px;
    border-bottom: 1px solid var(--td-component-stroke);

    h2 {
        margin: 0 0 4px;
        font-size: 18px;
        line-height: 1.3;
    }

    p {
        margin: 0;
        color: var(--td-text-color-secondary);
        font-size: 13px;
    }
}

.dialog-body {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 18px 20px;
}

.field-group {
    margin-bottom: 12px;
}

.group-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;

    h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 700;
    }
}

.group-count {
    padding: 1px 8px;
    border-radius: 999px;
    background: var(--td-bg-color-secondarycontainer);
    color: var(--td-text-color-secondary);
    font-size: 12px;
}

.field-card {
    padding: 14px;
    margin-bottom: 10px;
    border: 1px solid var(--td-component-stroke);
    border-radius: var(--td-radius-medium);
    background: var(--td-bg-color-secondarycontainer);
}

.field-identity {
    margin-bottom: 12px;
}

.field-title {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
}

.field-name {
    font-size: 14px;
    font-weight: 600;
}

.source-badge {
    padding: 1px 6px;
    border-radius: var(--td-radius-small);
    background: var(--td-brand-color-light);
    color: var(--td-brand-color);
    font-size: 12px;
}

.hidden-badge {
    padding: 1px 6px;
    border-radius: var(--td-radius-small);
    background: var(--td-warning-color);
    color: var(--td-text-color-anti);
    font-size: 12px;
}

.field-key,
.field-preview {
    margin: 2px 0 0;
    color: var(--td-text-color-secondary);
    font-size: 12px;
    word-break: break-all;
}

.field-controls {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) 132px auto;
    align-items: end;
    gap: 12px;

    label {
        display: flex;
        flex-direction: column;
        gap: 6px;
        min-width: 0;
        color: var(--td-text-color-secondary);
        font-size: 12px;
    }
}

.readonly-help {
    margin: 8px 0 0;
    color: var(--td-text-color-secondary);
    font-size: 12px;
}

.dialog-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 20px;
    border-top: 1px solid var(--td-component-stroke);
}

.footer-status {
    color: var(--td-text-color-secondary);
    font-size: 12px;
}

.footer-actions {
    display: flex;
    gap: 8px;
}

@media (max-width: 760px) {
    .field-settings-overlay {
        padding: 0;
    }

    .field-settings-dialog {
        width: 100%;
        height: 100%;
        border-radius: 0;
    }

    .field-controls {
        grid-template-columns: 1fr;
        align-items: stretch;
    }
}
</style>

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
                    <t-loading :loading="loading || attributeStore.isSaving" :text="labels.loading">
                        <section class="field-group">
                            <div class="group-header">
                                <h3>{{ labels.documentFields }}</h3>
                                <span class="group-count">{{ documentItems.length }}</span>
                            </div>

                            <div v-if="documentItems.length === 0" class="empty">
                                {{ labels.emptyHint }}
                            </div>

                            <div v-for="item in documentItems" :key="item.key" class="field-card">
                                <div class="field-identity">
                                    <div class="field-title">
                                        <span class="field-name">{{ item.draft.displayAs || item.key }}</span>
                                        <span class="source-badge">{{ item.presentOnDocument === false ? labels.fromRule : labels.onDocument }}</span>
                                        <span v-if="!item.draft.display" class="hidden-badge">{{ labels.hidden }}</span>
                                    </div>
                                    <code class="field-key">{{ item.key }}</code>
                                    <p v-if="item.attr.value" class="field-preview">{{ item.attr.value }}</p>
                                </div>

                                <div class="field-controls">
                                    <label>
                                        <span>{{ labels.display }}</span>
                                        <t-switch v-model="item.draft.display" />
                                    </label>
                                    <label>
                                        <span>{{ labels.displayName }}</span>
                                        <t-input v-model="item.draft.displayAs" />
                                    </label>
                                    <label>
                                        <span>{{ labels.order }}</span>
                                        <t-input-number v-model="item.draft.order" theme="column" :min="0" :max="99999" />
                                    </label>
                                    <label>
                                        <span>{{ labels.editable }}</span>
                                        <t-switch
                                            v-model="item.draft.editable"
                                            :disabled="isDocumentKeyReadonly(item.key)"
                                        />
                                    </label>
                                    <label>
                                        <span>{{ labels.editMethod }}</span>
                                        <t-select v-model="item.draft.renderMethod">
                                            <t-option value="input" :label="labels.renderInput" />
                                            <t-option value="tag-input" :label="labels.renderTag" />
                                            <t-option value="datetime" :label="labels.renderDatetime" />
                                            <t-option value="link" :label="labels.renderLink" />
                                            <t-option value="select" :label="labels.renderSelect" />
                                            <t-option value="multi-select" :label="labels.renderMultiSelect" />
                                            <t-option value="date" :label="labels.renderDate" />
                                            <t-option value="checkbox" :label="labels.renderCheckbox" />
                                            <t-option value="number" :label="labels.renderNumber" />
                                        </t-select>
                                    </label>
                                    <label
                                        v-if="item.draft.renderMethod === 'select' || item.draft.renderMethod === 'multi-select'"
                                        class="options-field"
                                    >
                                        <span>{{ labels.options }}</span>
                                        <t-tag-input
                                            v-model="item.draft.options"
                                            :placeholder="labels.optionsHint"
                                            clearable
                                        />
                                    </label>
                                </div>
                                <p class="render-method-help">{{ labels.typeOverrideHelp }}</p>
                                <div class="field-footer">
                                    <p v-if="isDocumentKeyReadonly(item.key)" class="readonly-help">
                                        {{ labels.readonlyCapability }}
                                    </p>
                                    <t-button
                                        size="small"
                                        variant="text"
                                        :disabled="isSameAsBaseline(item)"
                                        @click="restore(item)"
                                    >
                                        {{ labels.restoreDefault }}
                                    </t-button>
                                </div>
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
import { isReadOnlyDocumentAttributeName } from '@/models/settings';
import {
    applyDocumentFieldOverride,
    type DocumentFieldOverride,
} from '@/models/documentFieldOverrides';
import { getI18nText } from '@/services/i18n';

interface FieldDraft {
    key: string;
    presentOnDocument: boolean;
    attr: {
        key: string;
        value: string;
        displayAs: string;
        editable: boolean;
    };
    baseline: DocumentFieldOverride;
    draft: DocumentFieldOverride;
}

const emit = defineEmits<{
    (event: 'close'): void;
    (event: 'saved'): void;
}>();

const attributeStore = useAttributesStore();
const settingsStore = useConfigStore();
const loading = ref(false);
const saving = ref(false);
const status = ref('');
const documentDrafts = ref<FieldDraft[]>([]);

const labels = {
    title: getI18nText('fieldSettings.title', '当前字段设置'),
    subtitle: getI18nText('fieldSettings.subtitle', '仅影响当前文档；未覆盖的字段仍使用全局默认规则'),
    close: getI18nText('close', '关闭'),
    loading: getI18nText('loading', '加载中...'),
    save: getI18nText('save', '保存'),
    cancel: getI18nText('cancel', '取消'),
    documentFields: getI18nText('fieldSettings.documentFields', '文档属性'),
    emptyHint: getI18nText('fieldSettings.emptyHint', '暂无字段。请先在全局「属性面板设置」中添加精确匹配规则，或在面板中添加属性。'),
    onDocument: getI18nText('fieldSettings.onDocument', '文档'),
    fromRule: getI18nText('fieldSettings.fromRule', '全局规则'),
    restoreDefault: getI18nText('fieldSettings.restoreDefault', '恢复默认'),
    display: getI18nText('settings.display', '显示'),
    displayName: getI18nText('settings.displayName', '显示名'),
    order: getI18nText('settings.order', '排序值'),
    editable: getI18nText('settings.editable', '可编辑'),
    editMethod: getI18nText('fieldSettings.editMethod', '编辑方式'),
    options: getI18nText('settings.options', '选项'),
    optionsHint: getI18nText('settings.optionsHint', '仅单选/多选有效；回车添加选项'),
    typeOverrideHelp: getI18nText(
        'fieldSettings.typeOverrideHelp',
        '编辑方式与选项仅作用于当前文档；恢复默认后回到全局规则',
    ),
    hidden: getI18nText('settings.hidden', '已隐藏'),
    readonlyCapability: getI18nText('settings.readOnlyCapability', '该字段由思源管理，值不可通过面板修改；显示名仅是插件内别名。'),
    saveSuccess: getI18nText('fieldSettings.saveSuccess', '字段设置已保存'),
    saveFailed: getI18nText('fieldSettings.saveFailed', '保存字段设置失败'),
    renderInput: getI18nText('settings.renderInput', '文本'),
    renderTag: getI18nText('settings.renderTag', '标签'),
    renderDatetime: getI18nText('settings.renderDatetime', '日期时间'),
    renderLink: getI18nText('settings.renderLink', '链接/ID'),
    renderSelect: getI18nText('settings.renderSelect', '单选'),
    renderMultiSelect: getI18nText('settings.renderMultiSelect', '多选'),
    renderDate: getI18nText('settings.renderDate', '日期'),
    renderCheckbox: getI18nText('settings.renderCheckbox', '开关'),
    renderNumber: getI18nText('settings.renderNumber', '数字'),
};

const canSave = computed(() => !loading.value && !saving.value);
const documentItems = computed(() => documentDrafts.value);

function baselineFor(key: string, fallbackDisplayAs: string, fallbackOrder: number): DocumentFieldOverride {
    const matched = settingsStore.matchDocumentRule(key);
    if (matched) {
        return {
            display: matched.display,
            displayAs: matched.displayAs || fallbackDisplayAs,
            order: matched.order,
            editable: !isReadOnlyDocumentAttributeName(key) && matched.editable,
            renderMethod: matched.renderMethod ?? 'input',
            options: [...(matched.options ?? [])],
        };
    }
    return {
        display: true,
        displayAs: fallbackDisplayAs,
        order: fallbackOrder,
        editable: !isReadOnlyDocumentAttributeName(key),
        renderMethod: 'input',
        options: [],
    };
}

function isDocumentKeyReadonly(key: string): boolean {
    return isReadOnlyDocumentAttributeName(key);
}

function sameOptions(left: string[] | undefined, right: string[] | undefined): boolean {
    const a = left ?? [];
    const b = right ?? [];
    if (a.length !== b.length) return false;
    return a.every((value, index) => value === b[index]);
}

function isSameAsBaseline(item: FieldDraft): boolean {
    return (
        item.draft.display === item.baseline.display
        && item.draft.displayAs === item.baseline.displayAs
        && item.draft.order === item.baseline.order
        && item.draft.editable === item.baseline.editable
        && (item.draft.renderMethod ?? 'input') === (item.baseline.renderMethod ?? 'input')
        && sameOptions(item.draft.options, item.baseline.options)
    );
}

function restore(item: FieldDraft): void {
    item.draft = {
        ...item.baseline,
        options: [...(item.baseline.options ?? [])],
    };
}

function loadDrafts(): void {
    const overrides = attributeStore.documentFieldOverrides.fields;
    documentDrafts.value = attributeStore.allDocumentAttributes.map((attribute) => {
        const baseline = baselineFor(
            attribute.key,
            attribute.key.replace(/^custom-/, ''),
            1000,
        );
        const existing = overrides[attribute.key];
        const merged = applyDocumentFieldOverride(baseline, existing);
        const draft: DocumentFieldOverride = {
            ...merged,
            renderMethod: merged.renderMethod ?? 'input',
            options: [...(merged.options ?? [])],
        };
        return {
            key: attribute.key,
            presentOnDocument: attribute.presentOnDocument !== false,
            attr: {
                key: attribute.key,
                value: attribute.value,
                displayAs: attribute.displayAs,
                editable: attribute.editable,
            },
            baseline: {
                ...baseline,
                options: [...(baseline.options ?? [])],
            },
            draft,
        };
    });
}

function close(): void {
    emit('close');
}

async function save(): Promise<void> {
    if (!canSave.value) return;
    saving.value = true;
    status.value = '';

    try {
        const fields: Record<string, DocumentFieldOverride> = {};
        for (const item of documentDrafts.value) {
            if (isSameAsBaseline(item)) continue;
            fields[item.key] = {
                display: item.draft.display,
                displayAs: item.draft.displayAs,
                order: item.draft.order,
                editable: isDocumentKeyReadonly(item.key) ? false : item.draft.editable,
                renderMethod: item.draft.renderMethod ?? 'input',
                options: [...(item.draft.options ?? [])],
            };
        }
        await attributeStore.saveDocumentFieldOverrides(fields);
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
        await attributeStore.loadDocumentAttributes();
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

.empty {
    padding: 18px;
    border: 1px dashed var(--td-component-border);
    border-radius: var(--td-radius-medium);
    color: var(--td-text-color-secondary);
    text-align: center;
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
    grid-template-columns: auto minmax(0, 1fr) 132px auto auto;
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

.render-method-help {
    margin: 8px 0 0;
    color: var(--td-text-color-secondary);
    font-size: 12px;
}

.options-field {
    grid-column: 1 / -1;
}

.field-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-top: 8px;
}

.readonly-help {
    margin: 0;
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

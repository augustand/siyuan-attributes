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

                        <section
                            v-for="database in databaseGroups"
                            :key="database.avID"
                            class="field-group"
                        >
                            <div class="group-header">
                                <h3>{{ database.avName || labels.unnamedDatabase }}</h3>
                                <span class="group-count">{{ database.items.length }}</span>
                            </div>

                            <div v-if="database.items.length === 0" class="empty">
                                {{ labels.noDatabaseFields }}
                            </div>

                            <div
                                v-for="item in database.items"
                                :key="`${database.avID}:${item.field.keyID}`"
                                class="field-card"
                            >
                                <div class="field-identity">
                                    <div class="field-title">
                                        <span class="field-name">{{ item.field.name }}</span>
                                        <span class="source-badge">{{ typeLabel(item.field.type) }}</span>
                                    </div>
                                    <code class="field-key">{{ item.field.keyID }}</code>
                                    <p class="field-preview">{{ describeDatabaseValue(item.field) }}</p>
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
                                            :disabled="!item.field.editable"
                                        />
                                    </label>
                                </div>
                                <p v-if="!item.field.editable" class="readonly-help">
                                    {{ labels.fieldTypeReadonly }}
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
import {
    computed,
    onMounted,
    ref,
} from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import { useAttributesStore } from '@/store/attribute';
import { useConfigStore } from '@/store/rules';
import {
    findExactDisplayRule,
    normalizeDatabaseFieldRules,
    normalizeDisplayRule,
} from '@/models/settings';
import type {
    DatabaseFieldRule,
    DisplayRule,
} from '@/models/settings';
import type { DatabaseField } from '@/models/attributeView';
import { isReadOnlyDocumentAttributeName } from '@/models/settings';
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

const databaseGroups = ref<Array<{
    avID: string;
    avName: string;
    items: Array<{
        field: DatabaseField;
        rule: DatabaseFieldRule;
    }>;
}>>([]);

const documentItems = computed(() => documentDrafts.value);

const labels = {
    title: getI18nText('fieldSettings.title', '当前字段设置'),
    subtitle: getI18nText('fieldSettings.subtitle', '直接配置当前文档和关联数据库中的字段'),
    close: getI18nText('close', '关闭'),
    loading: getI18nText('loading', '加载中...'),
    save: getI18nText('save', '保存'),
    cancel: getI18nText('cancel', '取消'),
    documentFields: getI18nText('fieldSettings.documentFields', '文档属性'),
    noDocumentFields: getI18nText('fieldSettings.noDocumentFields', '暂无文档属性'),
    unnamedDatabase: getI18nText('fieldSettings.unnamedDatabase', '未命名数据库'),
    noDatabaseFields: getI18nText('fieldSettings.noDatabaseFields', '暂无数据库字段'),
    display: getI18nText('settings.display', '显示'),
    displayName: getI18nText('settings.displayName', '显示名'),
    order: getI18nText('settings.order', '排序值'),
    editable: getI18nText('settings.editable', '可编辑'),
    readonlyCapability: getI18nText('settings.readOnlyCapability', '该字段由思源管理，值不可通过面板修改；显示名仅是插件内别名。'),
    fieldTypeReadonly: getI18nText('fieldSettings.fieldTypeReadonly', '该数据库字段类型当前不支持编辑。'),
    saveSuccess: getI18nText('fieldSettings.saveSuccess', '字段设置已保存'),
    saveFailed: getI18nText('fieldSettings.saveFailed', '保存字段设置失败'),
};

const canSave = computed(() => !loading.value && !saving.value);

function typeLabel(type: string): string {
    const values: Record<string, string> = {
        text: '文本',
        number: '数字',
        date: '日期',
        select: '单选',
        mSelect: '多选',
        url: '网址',
        email: '邮箱',
        phone: '电话',
        checkbox: '复选框',
        template: '模板',
        relation: '关联',
        rollup: '汇总',
        mAsset: '资源',
    };
    return values[type] || type;
}

function describeDatabaseValue(field: DatabaseField): string {
    const value = field.value;
    if (field.type === 'checkbox') return value.checked ? '已勾选' : '未勾选';
    if (field.type === 'select' || field.type === 'mSelect') {
        return value.options.map((option) => option.name).join(' / ') || '空';
    }
    if (field.type === 'date') {
        const parts = [value.date?.content, value.date?.content2]
            .filter((timestamp): timestamp is number => Boolean(timestamp))
            .map((timestamp) => new Date(timestamp).toLocaleString());
        return parts.join(' → ') || '空';
    }
    if (field.type === 'number') return value.number === undefined ? '空' : String(value.number);
    if (field.type === 'text') return value.text || '空';
    if (field.type === 'url') return value.url || '空';
    if (field.type === 'email') return value.email || '空';
    if (field.type === 'phone') return value.phone || '空';
    if (field.type === 'template') return value.template || '空';

    const rendered = value.raw.renderedContent;
    return typeof rendered === 'string' ? rendered : '—';
}

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
        editable: item.editable && (base?.editable ?? true),
        order: base?.order ?? item.order,
        icon: base?.icon || item.icon,
        system: Boolean(base?.system && exact),
    });
}

function buildDatabaseDraft(
    databaseId: string,
    field: DatabaseField,
): DatabaseFieldRule {
    const exact = settingsStore.settings.fieldRules.find((rule) => (
        rule.databaseId === databaseId && rule.fieldId === field.keyID
    ));
    const effective = settingsStore.applyDatabaseRules([field], databaseId)[0];

    return {
        id: exact?.id || `field:${databaseId}:${field.keyID}`,
        databaseId,
        fieldId: field.keyID,
        display: Boolean(effective),
        displayAs: effective?.name || field.name,
        editable: field.editable && (effective?.editable ?? true),
        order: effective?.order ?? 1000,
        icon: effective?.icon || field.icon,
    };
}

function isDocumentKeyReadonly(key: string): boolean {
    return isReadOnlyDocumentAttributeName(key);
}

function loadDrafts(): void {
    documentDrafts.value = attributeStore.builtInAttributes.map((attribute) => ({
        key: attribute.key,
        attr: {
            key: attribute.key,
            value: attribute.value,
            displayAs: attribute.displayAs,
            editable: attribute.editable,
        },
        rule: buildDocumentDraft(attribute),
    }));

    databaseGroups.value = Object.values(attributeStore.dataBaseAttributes).map((panel) => ({
        avID: panel.avID,
        avName: panel.avName,
        items: panel.fields.map((field) => ({
            field,
            rule: buildDatabaseDraft(panel.avID, field),
        })),
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
        const databaseRules = normalizeDatabaseFieldRules(
            databaseGroups.value.flatMap((group) => group.items.map((item) => item.rule)),
        );
        await settingsStore.upsertDocumentFieldRules(
            documentDrafts.value.map((item) => item.rule),
        );
        await settingsStore.setDatabaseFieldRules(databaseRules);

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
    width: min(920px, 94vw);
    height: min(720px, 88vh);
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
    margin-bottom: 24px;
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

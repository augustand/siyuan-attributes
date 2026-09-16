<template>
    <div class="settings-shell">
        <aside class="settings-nav" aria-label="设置导航">
            <div class="nav-brand">
                <span class="nav-brand-title">{{ labels.title }}</span>
                <span class="nav-brand-subtitle">{{ labels.brandSubtitle }}</span>
            </div>

            <nav class="nav-items">
                <button
                    type="button"
                    class="nav-item"
                    :class="{ active: activeSection === 'general' }"
                    @click="activeSection = 'general'"
                >
                    <span>{{ labels.general }}</span>
                </button>
                <button
                    type="button"
                    class="nav-item"
                    :class="{ active: activeSection === 'all' }"
                    @click="activeSection = 'all'"
                >
                    <span>{{ labels.allRules }}</span>
                    <span class="nav-count">{{ countByScope('all') }}</span>
                </button>
                <button
                    type="button"
                    class="nav-item"
                    :class="{ active: activeSection === 'document' }"
                    @click="activeSection = 'document'"
                >
                    <span>{{ labels.documentRules }}</span>
                    <span class="nav-count">{{ countByScope('document') }}</span>
                </button>
                <button
                    type="button"
                    class="nav-item"
                    :class="{ active: activeSection === 'database' }"
                    @click="activeSection = 'database'"
                >
                    <span>{{ labels.databaseRules }}</span>
                    <span class="nav-count">{{ countByScope('database') }}</span>
                </button>
            </nav>

            <div class="nav-hint">{{ labels.navHint }}</div>
        </aside>

        <main class="settings-main">
            <header class="settings-header">
                <div>
                    <h1>{{ activeTitle }}</h1>
                    <p>{{ activeDescription }}</p>
                </div>
                <div class="header-actions">
                    <t-button theme="default" :disabled="busy" @click="reset">{{ labels.reset }}</t-button>
                    <t-button theme="primary" :disabled="busy || !dirty" @click="save">{{ labels.save }}</t-button>
                </div>
            </header>

            <div class="settings-scroll">
                <t-loading :loading="loading || store.isSaving" :text="labels.loading" class="loading-area">
                    <section v-if="activeSection === 'general'" class="content-section">
                        <div class="toggle-grid">
                            <label class="toggle-card">
                                <div>
                                    <strong>{{ labels.showPanel }}</strong>
                                    <p>{{ labels.showPanelHelp }}</p>
                                </div>
                                <t-switch v-model="local.showPanel" />
                            </label>
                            <label class="toggle-card">
                                <div>
                                    <strong>{{ labels.showDocumentPanel }}</strong>
                                    <p>{{ labels.showDocumentPanelHelp }}</p>
                                </div>
                                <t-switch v-model="local.showDocumentPanel" />
                            </label>
                            <label class="toggle-card">
                                <div>
                                    <strong>{{ labels.showDatabasePanel }}</strong>
                                    <p>{{ labels.showDatabasePanelHelp }}</p>
                                </div>
                                <t-switch v-model="local.showDatabasePanel" />
                            </label>
                        </div>
                    </section>

                    <section v-else class="content-section">
                        <div class="rules-toolbar">
                            <t-input
                                v-model="search"
                                class="search-input"
                                clearable
                                :placeholder="labels.searchRules"
                            >
                                <template #prefixIcon>
                                    <t-icon name="search" />
                                </template>
                            </t-input>
                            <t-button theme="primary" @click="addRule">{{ labels.addRule }}</t-button>
                        </div>

                        <div class="rules-layout">
                            <div class="rule-list" role="list">
                                <div v-if="filteredRules.length === 0" class="empty">
                                    {{ labels.noMatchingRules }}
                                </div>

                                <div
                                    v-for="rule in filteredRules"
                                    :key="rule.id"
                                    class="rule-row"
                                    :class="{ selected: selectedRuleId === rule.id, disabled: !rule.display }"
                                    role="button"
                                    tabindex="0"
                                    @click="selectedRuleId = rule.id"
                                    @keydown.enter="selectedRuleId = rule.id"
                                >
                                    <t-switch
                                        v-model="rule.display"
                                        class="rule-switch"
                                        @click.stop
                                    />
                                    <div class="rule-summary">
                                        <div class="rule-title">
                                            <span class="rule-name">{{ rule.displayAs || rule.name }}</span>
                                            <span class="scope-badge" :data-scope="rule.scope">{{ scopeLabel(rule.scope) }}</span>
                                        </div>
                                        <code class="rule-expression">{{ rule.rule }}</code>
                                    </div>
                                    <t-icon class="rule-chevron" name="chevron-right" />
                                </div>
                            </div>

                            <aside v-if="selectedRule" class="rule-editor" aria-label="规则编辑">
                                <div class="editor-header">
                                    <h2>{{ labels.editRule }}</h2>
                                    <div class="editor-actions">
                                        <t-button size="small" variant="text" @click="move(selectedRule.id, -1)">{{ labels.moveUp }}</t-button>
                                        <t-button size="small" variant="text" @click="move(selectedRule.id, 1)">{{ labels.moveDown }}</t-button>
                                        <t-button size="small" theme="danger" variant="text" @click="removeRule(selectedRule.id)">{{ labels.delete }}</t-button>
                                        <t-button size="small" variant="text" @click="selectedRuleId = null">{{ labels.close }}</t-button>
                                    </div>
                                </div>

                                <div class="editor-grid">
                                    <label>
                                        <span>{{ labels.displayName }}</span>
                                        <t-input v-model="selectedRule.displayAs" />
                                    </label>
                                    <label>
                                        <span>{{ labels.ruleName }}</span>
                                        <t-input v-model="selectedRule.name" :disabled="selectedRule.system" />
                                    </label>
                                    <label>
                                        <span>{{ labels.matchExpression }}</span>
                                        <t-input v-model="selectedRule.rule" :disabled="selectedRule.system" />
                                    </label>
                                    <label>
                                        <span>{{ labels.matchMethod }}</span>
                                        <t-select v-model="selectedRule.matchMethod" :disabled="selectedRule.system">
                                            <t-option value="exact" :label="labels.exact" />
                                            <t-option value="wildcard" :label="labels.wildcard" />
                                            <t-option value="regex" :label="labels.regex" />
                                        </t-select>
                                    </label>
                                    <label>
                                        <span>{{ labels.scope }}</span>
                                        <t-select v-model="selectedRule.scope" :disabled="selectedRule.system">
                                            <t-option value="document" :label="labels.document" />
                                            <t-option value="database" :label="labels.database" />
                                            <t-option value="all" :label="labels.all" />
                                        </t-select>
                                    </label>
                                    <label>
                                        <span>{{ labels.order }}</span>
                                        <t-input-number v-model="selectedRule.order" theme="column" :min="0" :max="99999" />
                                    </label>
                                    <label class="switch-field">
                                        <span>{{ labels.display }}</span>
                                        <t-switch v-model="selectedRule.display" />
                                    </label>
                                    <label class="switch-field">
                                        <span>{{ labels.editable }}</span>
                                        <t-switch
                                            v-model="selectedRule.editable"
                                            :disabled="isEditableLocked(selectedRule)"
                                        />
                                    </label>
                                </div>
                                <p v-if="isEditableLocked(selectedRule)" class="locked-help">
                                    {{ labels.readOnlyCapability }}
                                </p>

                                <p class="editor-help">{{ labels.editorHelp }}</p>
                            </aside>

                            <aside v-else class="rule-editor empty-editor">
                                <t-icon name="edit" />
                                <p>{{ labels.selectRule }}</p>
                            </aside>
                        </div>
                    </section>
                </t-loading>
            </div>

            <footer class="settings-footer">
                <span class="footer-status" :class="{ saved: justSaved }">
                    {{ justSaved ? labels.saved : labels.autoSaveHint }}
                </span>
                <div class="footer-actions">
                    <t-button theme="default" :disabled="busy" @click="reset">{{ labels.reset }}</t-button>
                    <t-button theme="primary" :disabled="busy || !dirty" @click="save">{{ labels.save }}</t-button>
                </div>
            </footer>
        </main>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import { useConfigStore } from '@/store/rules';
import { normalizePanelSettings } from '@/models/settings';
import { isReadOnlyDocumentAttributeName } from '@/models/settings';
import type { DisplayRule, DisplayRuleScope, PanelSettings } from '@/models/settings';
import { getI18nText } from '@/services/i18n';

type SettingsSection = 'general' | 'all' | 'document' | 'database';

const store = useConfigStore();
const loading = ref(false);
const saving = ref(false);
const justSaved = ref(false);
const activeSection = ref<SettingsSection>('general');
const selectedRuleId = ref<string | null>(null);
const search = ref('');
const local = ref<PanelSettings>(normalizePanelSettings({}));

const labels = {
    title: getI18nText('settings.title', '属性面板设置'),
    brandSubtitle: getI18nText('settings.brandSubtitle', '文档与数据库属性'),
    loading: getI18nText('loading', '加载中...'),
    general: getI18nText('settings.general', '通用'),
    allRules: getI18nText('settings.allRules', '全部规则'),
    documentRules: getI18nText('settings.documentRules', '文档规则'),
    databaseRules: getI18nText('settings.databaseRules', '数据库规则'),
    navHint: getI18nText('settings.navHint', '数据库字段默认隐藏，添加规则后才会显示。'),
    showPanel: getI18nText('settings.showPanel', '显示属性面板'),
    showPanelHelp: getI18nText('settings.showPanelHelp', '关闭后，所有文档下方的属性面板都会隐藏。'),
    showDocumentPanel: getI18nText('settings.showDocumentPanel', '显示文档属性'),
    showDocumentPanelHelp: getI18nText('settings.showDocumentPanelHelp', '控制文档级自定义属性区域。'),
    showDatabasePanel: getI18nText('settings.showDatabasePanel', '显示数据库属性'),
    showDatabasePanelHelp: getI18nText('settings.showDatabasePanelHelp', '控制关联数据库字段区域。'),
    reset: getI18nText('settings.reset', '恢复默认'),
    save: getI18nText('settings.save', '保存设置'),
    saved: getI18nText('settings.saveSuccess', '设置已保存'),
    autoSaveHint: getI18nText('settings.changesPending', '修改后点击保存'),
    searchRules: getI18nText('settings.searchRules', '搜索规则或属性名'),
    addRule: getI18nText('settings.addRule', '添加规则'),
    noMatchingRules: getI18nText('settings.noMatchingRules', '没有匹配的规则'),
    edit: getI18nText('settings.edit', '编辑'),
    delete: getI18nText('settings.delete', '删除'),
    editRule: getI18nText('settings.editRule', '编辑规则'),
    moveUp: getI18nText('settings.moveUp', '上移'),
    moveDown: getI18nText('settings.moveDown', '下移'),
    close: getI18nText('close', '关闭'),
    ruleName: getI18nText('settings.ruleName', '规则名称'),
    displayName: getI18nText('settings.displayName', '显示名'),
    matchExpression: getI18nText('settings.matchExpression', '匹配表达式'),
    matchMethod: getI18nText('settings.matchMethod', '匹配方式'),
    exact: getI18nText('settings.exact', '精确'),
    wildcard: getI18nText('settings.wildcard', '通配符'),
    regex: getI18nText('settings.regex', '正则'),
    scope: getI18nText('settings.scope', '作用范围'),
    document: getI18nText('settings.document', '文档属性'),
    database: getI18nText('settings.database', '数据库属性'),
    all: getI18nText('settings.all', '两者'),
    order: getI18nText('settings.order', '排序值'),
    display: getI18nText('settings.display', '显示'),
    editable: getI18nText('settings.editable', '可编辑'),
    editorHelp: getI18nText('settings.editorHelp', '数据库字段必须匹配一条已启用的规则才会显示。'),
    selectRule: getI18nText('settings.selectRule', '选择左侧规则后可编辑'),
    resetConfirm: getI18nText('settings.resetConfirm', '确认恢复默认设置？当前未保存修改将丢失。'),
    loadFailed: getI18nText('settings.loadFailed', '加载设置失败'),
    saveSuccess: getI18nText('settings.saveSuccess', '设置已保存'),
    saveFailed: getI18nText('settings.saveFailed', '保存设置失败'),
    resetSuccess: getI18nText('settings.resetSuccess', '已恢复默认设置'),
    resetFailed: getI18nText('settings.resetFailed', '恢复默认设置失败'),
    readOnlyCapability: getI18nText('settings.readOnlyCapability', '该字段由思源管理，值不可通过面板修改；显示名仅是插件内别名。'),
};

const busy = computed(() => loading.value || saving.value);

const activeTitle = computed(() => {
    if (activeSection.value === 'general') return labels.general;
    if (activeSection.value === 'document') return labels.documentRules;
    if (activeSection.value === 'database') return labels.databaseRules;
    return labels.allRules;
});

const activeDescription = computed(() => {
    if (activeSection.value === 'general') return labels.showPanelHelp;
    if (activeSection.value === 'document') return '匹配文档级属性名。';
    if (activeSection.value === 'database') return labels.navHint;
    return '查看和编辑全部显示规则。';
});

const sortedRules = computed(() => [...local.value.rules].sort(compareRules));

const filteredRules = computed(() => {
    const keyword = search.value.trim().toLowerCase();
    return sortedRules.value.filter((rule) => {
        if (activeSection.value === 'document' && rule.scope !== 'document' && rule.scope !== 'all') return false;
        if (activeSection.value === 'database' && rule.scope !== 'database' && rule.scope !== 'all') return false;
        if (!keyword) return true;
        return [rule.name, rule.displayAs, rule.rule]
            .join(' ')
            .toLowerCase()
            .includes(keyword);
    });
});

const selectedRule = computed(() => {
    return local.value.rules.find((rule) => rule.id === selectedRuleId.value) || null;
});

const dirty = computed(() => {
    return JSON.stringify(normalizePanelSettings(local.value)) !== JSON.stringify(store.settings);
});

function compareRules(left: DisplayRule, right: DisplayRule): number {
    return left.order - right.order || left.id.localeCompare(right.id);
}

function countByScope(scope: Exclude<SettingsSection, 'general'>): number {
    if (scope === 'all') return local.value.rules.length;
    return local.value.rules.filter((rule) => rule.scope === scope || rule.scope === 'all').length;
}

function scopeLabel(scope: DisplayRuleScope): string {
    if (scope === 'document') return labels.document;
    if (scope === 'database') return labels.database;
    return labels.all;
}

function isEditableLocked(rule: DisplayRule): boolean {
    if (rule.system && rule.id !== 'system-name' && rule.id !== 'system-alias') return true;
    return rule.matchMethod === 'exact' && isReadOnlyDocumentAttributeName(rule.rule);
}

async function load(): Promise<void> {
    loading.value = true;
    try {
        await store.initialize();
        local.value = normalizePanelSettings(store.settings);
    } catch (error) {
        MessagePlugin.error(error instanceof Error ? error.message : labels.loadFailed);
    } finally {
        loading.value = false;
    }
}

async function save(): Promise<void> {
    saving.value = true;
    try {
        await store.updateSettings(local.value);
        local.value = normalizePanelSettings(store.settings);
        justSaved.value = true;
        setTimeout(() => {
            justSaved.value = false;
        }, 1800);
    } catch (error) {
        MessagePlugin.error(error instanceof Error ? error.message : labels.saveFailed);
    } finally {
        saving.value = false;
    }
}

async function reset(): Promise<void> {
    if (!window.confirm(labels.resetConfirm)) return;

    saving.value = true;
    try {
        await store.resetSettings();
        local.value = normalizePanelSettings(store.settings);
        selectedRuleId.value = null;
        MessagePlugin.success(getI18nText('settings.resetSuccess', '已恢复默认设置'));
    } catch (error) {
        MessagePlugin.error(error instanceof Error ? error.message : getI18nText('settings.resetFailed', '恢复默认设置失败'));
    } finally {
        saving.value = false;
    }
}

function addRule(): void {
    const maxOrder = local.value.rules.reduce((order, rule) => Math.max(order, rule.order), 0);
    const rule: DisplayRule = {
        id: `user-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        name: '',
        rule: 'custom-',
        matchMethod: 'exact',
        scope: activeSection.value === 'database' ? 'database' : 'document',
        display: true,
        displayAs: '',
        editable: true,
        order: maxOrder + 1,
    };

    local.value.rules.push(rule);
    activeSection.value = 'all';
    selectedRuleId.value = rule.id;
}

function removeRule(id: string): void {
    local.value.rules = local.value.rules.filter((rule) => rule.id !== id);
    if (selectedRuleId.value === id) selectedRuleId.value = null;
}

function move(id: string, direction: -1 | 1): void {
    const rules = [...local.value.rules].sort(compareRules);
    const index = rules.findIndex((rule) => rule.id === id);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= rules.length) return;

    const currentOrder = rules[index].order;
    const targetOrder = rules[targetIndex].order;
    rules[index].order = targetOrder === currentOrder ? currentOrder + direction : targetOrder;
    rules[targetIndex].order = currentOrder;
    local.value.rules = rules;
}

onMounted(load);
</script>

<style scoped lang="scss">
.settings-shell {
    display: flex;
    width: 100%;
    min-width: min(920px, 86vw);
    height: 100%;
    min-height: min(64vh, 620px);
    overflow: hidden;
    color: var(--td-text-color-primary);
    background: var(--td-bg-color-container);
    border-radius: var(--td-radius-medium);
}

.settings-nav {
    width: 228px;
    flex: 0 0 228px;
    display: flex;
    flex-direction: column;
    padding: 18px 14px;
    border-right: 1px solid var(--td-component-stroke);
    background: var(--td-bg-color-secondarycontainer);
}

.nav-brand {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 0 10px 16px;
    border-bottom: 1px solid var(--td-component-stroke);
}

.nav-brand-title {
    font-size: 16px;
    font-weight: 700;
    line-height: 1.3;
}

.nav-brand-subtitle,
.nav-hint {
    color: var(--td-text-color-secondary);
    font-size: 12px;
    line-height: 1.5;
}

.nav-items {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-top: 16px;
}

.nav-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    min-height: 36px;
    padding: 8px 10px;
    border: 0;
    border-radius: var(--td-radius-medium);
    background: transparent;
    color: var(--td-text-color-primary);
    font-size: 14px;
    text-align: left;
    cursor: pointer;

    &:hover {
        background: var(--td-bg-color-container-hover);
    }

    &.active {
        color: var(--td-brand-color);
        background: var(--td-brand-color-light);
        font-weight: 600;
    }
}

.nav-count {
    min-width: 22px;
    padding: 1px 6px;
    border-radius: 999px;
    background: var(--td-bg-color-component);
    color: var(--td-text-color-primary);
    font-size: 12px;
    text-align: center;
}

.nav-hint {
    margin-top: auto;
    padding: 12px 10px 0;
    border-top: 1px solid var(--td-component-stroke);
}

.settings-main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
}

.settings-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    padding: 20px 24px 16px;
    border-bottom: 1px solid var(--td-component-stroke);

    h1 {
        margin: 0 0 4px;
        font-size: 18px;
        font-weight: 700;
        line-height: 1.3;
    }

    p {
        margin: 0;
        color: var(--td-text-color-secondary);
        font-size: 13px;
        line-height: 1.5;
    }
}

.header-actions,
.footer-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 0 0 auto;
}

.settings-scroll {
    flex: 1;
    min-height: 0;
    overflow: auto;

    :deep(.t-loading__parent) {
        min-height: 100%;
        width: 100%;
    }
}

.content-section {
    padding: 20px 24px 28px;
}

.toggle-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 14px;
}

.toggle-card {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    min-height: 104px;
    padding: 16px;
    border: 1px solid var(--td-component-stroke);
    border-radius: var(--td-radius-medium);
    background: var(--td-bg-color-secondarycontainer);
    cursor: pointer;

    strong {
        display: block;
        margin-bottom: 6px;
        font-size: 14px;
    }

    p {
        margin: 0;
        color: var(--td-text-color-secondary);
        font-size: 12px;
        line-height: 1.5;
    }
}

.rules-toolbar {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 14px;
}

.search-input {
    max-width: 360px;
}

.rules-layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(320px, 400px);
    gap: 16px;
    align-items: start;
}

.rule-list {
    min-width: 0;
    border: 1px solid var(--td-component-stroke);
    border-radius: var(--td-radius-medium);
    overflow: hidden;
}

.rule-row {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 12px;
    width: 100%;
    min-height: 64px;
    padding: 10px 12px;
    border-bottom: 1px solid var(--td-component-stroke);
    background: var(--td-bg-color-container);
    cursor: pointer;

    &:last-child {
        border-bottom: 0;
    }

    &:hover {
        background: var(--td-bg-color-container-hover);
    }

    &.selected {
        box-shadow: inset 3px 0 0 var(--td-brand-color);
        background: var(--td-bg-color-container-select);
    }

    &.disabled .rule-name {
        color: var(--td-text-color-disabled);
        text-decoration: line-through;
    }
}

.rule-summary {
    min-width: 0;
}

.rule-title {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    margin-bottom: 3px;
}

.rule-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 14px;
    font-weight: 600;
}

.scope-badge {
    flex: 0 0 auto;
    padding: 1px 6px;
    border-radius: var(--td-radius-small);
    background: var(--td-bg-color-secondarycontainer);
    color: var(--td-text-color-secondary);
    font-size: 12px;
}

.rule-expression {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--td-text-color-secondary);
    font-size: 12px;
}

.rule-chevron {
    color: var(--td-text-color-placeholder);
}

.editor-actions {
    display: flex;
    align-items: center;
    gap: 2px;
}

.rule-editor {
    position: sticky;
    top: 0;
    padding: 16px;
    border: 1px solid var(--td-component-stroke);
    border-radius: var(--td-radius-medium);
    background: var(--td-bg-color-secondarycontainer);
}

.editor-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 14px;

    h2 {
        margin: 0;
        font-size: 16px;
        font-weight: 700;
    }
}

.editor-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;

    label {
        display: flex;
        flex-direction: column;
        gap: 6px;
        color: var(--td-text-color-secondary);
        font-size: 12px;
    }

    .switch-field {
        justify-content: flex-end;
        min-height: 54px;
    }
}

.editor-help,
.empty-editor {
    color: var(--td-text-color-secondary);
    font-size: 12px;
    line-height: 1.5;
}

.empty-editor {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 220px;
    gap: 10px;
    text-align: center;
}

.settings-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 24px;
    border-top: 1px solid var(--td-component-stroke);
    background: var(--td-bg-color-container);
}

.footer-status {
    color: var(--td-text-color-secondary);
    font-size: 12px;

    &.saved {
        color: var(--td-success-color);
        font-weight: 600;
    }
}

@media (max-width: 1080px) {
    .rules-layout {
        grid-template-columns: 1fr;
    }

    .rule-editor {
        position: static;
    }
}

@media (max-width: 860px) {
    .settings-shell {
        min-width: 0;
        flex-direction: column;
    }

    .settings-nav {
        width: 100%;
        flex: 0 0 auto;
        flex-direction: column;
        border-right: 0;
        border-bottom: 1px solid var(--td-component-stroke);
    }

    .nav-items {
        flex-direction: row;
        overflow-x: auto;
    }

    .nav-item {
        white-space: nowrap;
    }

    .nav-hint {
        display: none;
    }

    .settings-header,
    .content-section,
    .settings-footer {
        padding-left: 16px;
        padding-right: 16px;
    }

    .editor-grid {
        grid-template-columns: 1fr;
    }
}
</style>

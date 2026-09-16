<template>
    <div class="setting command-palette detail-base">
        <t-card :title="labels.title" :bordered="false">
            <t-loading :loading="loading || store.isSaving" :text="labels.loading">
                <div class="settings-body">
                    <section class="settings-section">
                        <h3>{{ labels.general }}</h3>
                        <label class="setting-line">
                            <t-checkbox v-model="local.showPanel" />
                            <span>{{ labels.showPanel }}</span>
                        </label>
                        <label class="setting-line">
                            <t-checkbox v-model="local.showDocumentPanel" />
                            <span>{{ labels.showDocumentPanel }}</span>
                        </label>
                        <label class="setting-line">
                            <t-checkbox v-model="local.showDatabasePanel" />
                            <span>{{ labels.showDatabasePanel }}</span>
                        </label>
                    </section>

                    <section class="settings-section">
                        <div class="section-header">
                            <h3>{{ labels.rules }}</h3>
                            <t-button theme="default" variant="text" @click="addRule">{{ labels.addRule }}</t-button>
                        </div>

                        <p class="setting-help">{{ labels.help }}</p>
                        <div v-if="local.rules.length === 0" class="empty">{{ labels.noRules }}</div>

                        <div v-for="(rule, index) in sortedRules" :key="rule.id" class="rule-card">
                            <div class="rule-header">
                                <strong>{{ rule.name || rule.rule }}</strong>
                                <div class="rule-actions">
                                    <t-button size="small" variant="text" :disabled="index === 0" @click="move(rule.id, -1)">{{ labels.moveUp }}</t-button>
                                    <t-button size="small" variant="text" :disabled="index === sortedRules.length - 1" @click="move(rule.id, 1)">{{ labels.moveDown }}</t-button>
                                    <t-button size="small" theme="danger" variant="text" @click="removeRule(rule.id)">{{ labels.delete }}</t-button>
                                </div>
                            </div>

                            <div class="rule-grid">
                                <label>
                                    <span>{{ labels.displayName }}</span>
                                    <t-input v-model="rule.displayAs" />
                                </label>
                                <label>
                                    <span>{{ labels.matchExpression }}</span>
                                    <t-input v-model="rule.rule" />
                                </label>
                                <label>
                                    <span>{{ labels.matchMethod }}</span>
                                    <t-select v-model="rule.matchMethod">
                                        <t-option value="exact" :label="labels.exact" />
                                        <t-option value="wildcard" :label="labels.wildcard" />
                                        <t-option value="regex" :label="labels.regex" />
                                    </t-select>
                                </label>
                                <label>
                                    <span>{{ labels.scope }}</span>
                                    <t-select v-model="rule.scope">
                                        <t-option value="document" :label="labels.document" />
                                        <t-option value="database" :label="labels.database" />
                                        <t-option value="all" :label="labels.all" />
                                    </t-select>
                                </label>
                                <label>
                                    <span>{{ labels.order }}</span>
                                    <t-input-number v-model="rule.order" theme="column" :min="0" :max="99999" />
                                </label>
                                <label>
                                    <span>{{ labels.display }}</span>
                                    <t-checkbox v-model="rule.display" />
                                </label>
                                <label>
                                    <span>{{ labels.editable }}</span>
                                    <t-checkbox v-model="rule.editable" />
                                </label>
                            </div>
                        </div>
                    </section>
                </div>

                <template #footer>
                    <div class="settings-footer">
                        <t-button theme="default" :disabled="busy" @click="reset">{{ labels.reset }}</t-button>
                        <t-button theme="primary" :disabled="busy || !dirty" @click="save">{{ labels.save }}</t-button>
                    </div>
                </template>
            </t-loading>
        </t-card>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import { useConfigStore } from '@/store/rules';
import { normalizePanelSettings } from '@/models/settings';
import type { PanelSettings } from '@/models/settings';
import { getI18nText } from '@/services/i18n';

const store = useConfigStore();
const loading = ref(false);
const saving = ref(false);
const local = ref<PanelSettings>(normalizePanelSettings({}));

const labels = {
    title: getI18nText('settings.title', '属性面板设置'),
    loading: getI18nText('loading', '加载中...'),
    general: getI18nText('settings.general', '通用'),
    showPanel: getI18nText('settings.showPanel', '显示属性面板'),
    showDocumentPanel: getI18nText('settings.showDocumentPanel', '显示文档属性'),
    showDatabasePanel: getI18nText('settings.showDatabasePanel', '显示数据库属性'),
    rules: getI18nText('settings.rules', '显示规则'),
    addRule: getI18nText('settings.addRule', '添加规则'),
    help: getI18nText('settings.help', '文档规则按属性名匹配；数据库规则可按字段名或字段 ID 匹配。数据库字段必须有匹配且启用的规则才会显示。'),
    noRules: getI18nText('settings.noRules', '暂无规则'),
    moveUp: getI18nText('settings.moveUp', '上移'),
    moveDown: getI18nText('settings.moveDown', '下移'),
    delete: getI18nText('settings.delete', '删除'),
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
    reset: getI18nText('settings.reset', '恢复默认'),
    save: getI18nText('settings.save', '保存设置'),
    resetConfirm: getI18nText('settings.resetConfirm', '确认恢复默认设置？当前未保存修改将丢失。'),
    loadFailed: getI18nText('settings.loadFailed', '加载设置失败'),
    saveSuccess: getI18nText('settings.saveSuccess', '设置已保存'),
    saveFailed: getI18nText('settings.saveFailed', '保存设置失败'),
    resetSuccess: getI18nText('settings.resetSuccess', '已恢复默认设置'),
    resetFailed: getI18nText('settings.resetFailed', '恢复默认设置失败'),
};

const busy = computed(() => loading.value || saving.value);
const sortedRules = computed(() => [...local.value.rules].sort((left, right) => left.order - right.order));
const dirty = computed(() => {
    return JSON.stringify(normalizePanelSettings(local.value)) !== JSON.stringify(store.settings);
});

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
        MessagePlugin.success(labels.saveSuccess);
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
        MessagePlugin.success(labels.resetSuccess);
    } catch (error) {
        MessagePlugin.error(error instanceof Error ? error.message : labels.resetFailed);
    } finally {
        saving.value = false;
    }
}

function addRule(): void {
    const maxOrder = local.value.rules.reduce((order, rule) => Math.max(order, rule.order), 0);
    local.value.rules.push({
        id: `user-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        name: '',
        rule: 'custom-',
        matchMethod: 'exact',
        scope: 'document',
        display: true,
        displayAs: '',
        editable: true,
        order: maxOrder + 1,
    });
}

function removeRule(id: string): void {
    local.value.rules = local.value.rules.filter((rule) => rule.id !== id);
}

function move(id: string, direction: -1 | 1): void {
    const rules = [...local.value.rules].sort((left, right) => left.order - right.order);
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
.settings-body {
    display: flex;
    flex-direction: column;
    gap: 24px;
}

.settings-section {
    h3 {
        margin: 0 0 12px;
        font-size: var(--td-font-title-medium);
        font-weight: 600;
    }
}

.section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;

    h3 {
        margin-bottom: 0;
    }
}

.setting-line {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
}

.setting-help {
    margin: 0 0 12px;
    color: var(--td-text-color-secondary);
    font-size: var(--td-font-body-small);
}

.empty {
    padding: 18px;
    border: 1px dashed var(--td-component-border);
    border-radius: var(--td-radius-medium);
    color: var(--td-text-color-secondary);
    text-align: center;
}

.rule-card {
    padding: 12px;
    margin-bottom: 12px;
    border: 1px solid var(--td-component-border);
    border-radius: var(--td-radius-medium);
}

.rule-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
}

.rule-actions {
    display: flex;
    gap: 4px;
}

.rule-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;

    label {
        display: flex;
        flex-direction: column;
        gap: 5px;
        font-size: var(--td-font-body-small);
        color: var(--td-text-color-secondary);
    }
}

.settings-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
}
</style>

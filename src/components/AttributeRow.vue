<template>
    <BaseRow :name="attribute?.displayAs || attributeKey" :siyuan-key="attributeKey">
        <template v-if="method === 'input'">
            <t-input
                v-model="draft"
                :borderless="true"
                :placeholder="labels.inputPlaceholder"
                :disabled="!canEdit || saving"
                @blur="submitText"
            />
        </template>

        <template v-else-if="method === 'tag-input'">
            <t-tag-input
                v-model="tags"
                :borderless="true"
                :placeholder="labels.tagPlaceholder"
                :disabled="!canEdit || saving"
                clearable
                @change="submitTags"
            />
        </template>

        <template v-else-if="method === 'datetime'">
            <t-date-picker
                v-if="canEdit"
                v-model="pickerValue"
                enable-time-picker
                allow-input
                :borderless="true"
                :placeholder="labels.datePlaceholder"
                :disabled="saving"
                @change="submitDate"
            />
            <span v-else class="readonly-value">{{ displayDatetime }}</span>
        </template>

        <template v-else-if="method === 'link'">
            <div class="link-row">
                <span class="readonly-value">{{ draft }}</span>
                <t-button size="small" variant="text" :disabled="!draft" @click="copyValue">
                    {{ labels.copy }}
                </t-button>
            </div>
        </template>

        <template v-else>
            <t-input
                v-model="draft"
                :borderless="true"
                :placeholder="labels.inputPlaceholder"
                :disabled="!canEdit || saving"
                @blur="submitText"
            />
        </template>

        <template #actions>
            <AttributeRowActions v-if="attributeKey.startsWith('custom-')" :attribute-key="attributeKey" />
        </template>
    </BaseRow>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import { storeToRefs } from 'pinia';
import { useAttributesStore } from '@/store/attribute';
import AttributeRowActions from './AttributeRowActions.vue';
import { getI18nText } from '@/services/i18n';
import {
    formatSiYuanTimestampDisplay,
    parseAliasTags,
    parseSiYuanTimestamp,
    serializeAliasTags,
    toSiYuanTimestamp,
} from '@/services/siyuanFormats';
import type { DisplayRenderMethod } from '@/models/settings';

const props = defineProps<{
    attributeKey: string;
}>();

const attributeStore = useAttributesStore();
const { builtInAttributes, isSaving } = storeToRefs(attributeStore);

const labels = {
    inputPlaceholder: getI18nText('attributes.valuePlaceholder', '属性值'),
    tagPlaceholder: getI18nText('attributes.tagPlaceholder', '输入后回车添加'),
    datePlaceholder: getI18nText('attributes.datePlaceholder', '请选择日期时间'),
    copy: getI18nText('attributes.copy', '复制'),
    copySuccess: getI18nText('attributes.copySuccess', '已复制'),
    copyFailed: getI18nText('attributes.copyFailed', '复制失败'),
    saveSuccess: getI18nText('attributes.saveSuccess', '设置成功'),
    saveFailed: getI18nText('attributes.saveFailed', '设置失败'),
};

const attribute = computed(() => (
    builtInAttributes.value.find((item) => item.key === props.attributeKey)
));

const method = computed<DisplayRenderMethod>(() => {
    const raw = attribute.value?.renderMethod;
    if (raw === 'tag-input' || raw === 'datetime' || raw === 'link' || raw === 'input') return raw;
    return 'input';
});

const canEdit = computed(() => Boolean(attribute.value?.editable));
const saving = computed(() => isSaving.value);

const draft = ref('');
const tags = ref<string[]>([]);
const pickerValue = ref<string>('');
const lastSaved = ref('');

watch(
    attribute,
    (row) => {
        if (!row) return;
        draft.value = row.value ?? '';
        lastSaved.value = row.value ?? '';
        tags.value = parseAliasTags(row.value);
        const parsed = parseSiYuanTimestamp(row.value);
        pickerValue.value = parsed ? formatForPicker(parsed) : '';
    },
    { immediate: true },
);

function formatForPicker(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

const displayDatetime = computed(() => formatSiYuanTimestampDisplay(draft.value));

async function persist(next: string): Promise<void> {
    if (!attribute.value || !canEdit.value) return;
    if (next === lastSaved.value) return;
    try {
        await attributeStore.setAttribute(props.attributeKey, next);
        lastSaved.value = next;
        draft.value = next;
        MessagePlugin.success(labels.saveSuccess);
    } catch (error) {
        MessagePlugin.error(error instanceof Error ? error.message : labels.saveFailed);
    }
}

async function submitText(): Promise<void> {
    await persist(draft.value);
}

async function submitTags(): Promise<void> {
    const next = serializeAliasTags(tags.value);
    tags.value = parseAliasTags(next);
    await persist(next);
}

async function submitDate(value: string | Date): Promise<void> {
    let date: Date | undefined;
    if (value instanceof Date) {
        date = value;
    } else if (typeof value === 'string' && value.trim()) {
        const asSiYuan = value.replace(/\D/g, '');
        date = parseSiYuanTimestamp(asSiYuan.padEnd(14, '0').slice(0, 14))
            ?? new Date(value);
        if (Number.isNaN(date.getTime())) date = undefined;
    }
    await persist(toSiYuanTimestamp(date));
}

async function copyValue(): Promise<void> {
    if (!draft.value) return;
    try {
        await navigator.clipboard.writeText(draft.value);
        MessagePlugin.success(labels.copySuccess);
    } catch {
        MessagePlugin.error(labels.copyFailed);
    }
}
</script>

<style scoped>
.readonly-value {
    color: var(--td-text-color-primary);
    font-size: 14px;
    word-break: break-all;
}

.link-row {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
}

:deep(.t-input:not(:hover)) {
    border: white;
}

:deep(.t-input--focused) {
    border-color: var(--td-brand-color);
}
</style>

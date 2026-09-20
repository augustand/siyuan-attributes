<template>
    <BaseRow :name="attribute?.displayAs || attributeKey" :icon="attribute?.icon || 'view-list'">
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

        <template v-else-if="method === 'select'">
            <t-select
                v-model="draft"
                :borderless="true"
                :disabled="!canEdit || saving"
                clearable
                @change="submitText"
            >
                <t-option
                    v-for="opt in selectOptions"
                    :key="opt"
                    :value="opt"
                    :label="opt"
                />
            </t-select>
        </template>

        <template v-else-if="method === 'multi-select'">
            <t-select
                v-model="multiValues"
                multiple
                filterable
                :borderless="true"
                :disabled="!canEdit || saving"
                clearable
                @change="submitMulti"
            >
                <t-option
                    v-for="opt in multiOptions"
                    :key="opt"
                    :value="opt"
                    :label="opt"
                />
            </t-select>
        </template>

        <template v-else-if="method === 'date'">
            <t-date-picker
                v-if="canEdit"
                v-model="datePickerValue"
                allow-input
                :borderless="true"
                :placeholder="labels.dateOnlyPlaceholder"
                :disabled="saving"
                @change="submitDateOnly"
            />
            <span v-else class="readonly-value">{{ displayDate }}</span>
        </template>

        <template v-else-if="method === 'checkbox'">
            <t-switch
                :model-value="checkboxOn"
                :disabled="!canEdit || saving"
                @change="submitCheckbox"
            />
        </template>

        <template v-else-if="method === 'number'">
            <t-input
                v-model="draft"
                type="number"
                :borderless="true"
                :placeholder="labels.numberPlaceholder"
                :disabled="!canEdit || saving"
                @blur="submitNumber"
            />
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
    formatSiYuanDateDisplay,
    formatSiYuanTimestampDisplay,
    parseAliasTags,
    parseCheckboxValue,
    parseNumberValue,
    parseSiYuanDate,
    parseSiYuanTimestamp,
    serializeAliasTags,
    serializeCheckboxValue,
    toSiYuanDate,
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
    dateOnlyPlaceholder: getI18nText('attributes.dateOnlyPlaceholder', '请选择日期'),
    numberPlaceholder: getI18nText('attributes.numberPlaceholder', '请输入数字'),
    copy: getI18nText('attributes.copy', '复制'),
    copySuccess: getI18nText('attributes.copySuccess', '已复制'),
    copyFailed: getI18nText('attributes.copyFailed', '复制失败'),
    saveSuccess: getI18nText('attributes.saveSuccess', '设置成功'),
    saveFailed: getI18nText('attributes.saveFailed', '设置失败'),
};

const SELECT_METHODS = new Set([
    'input', 'tag-input', 'datetime', 'link',
    'select', 'multi-select', 'date', 'checkbox', 'number',
]);

const attribute = computed(() => (
    builtInAttributes.value.find((item) => item.key === props.attributeKey)
));

const method = computed<DisplayRenderMethod>(() => {
    const raw = attribute.value?.renderMethod;
    if (raw && SELECT_METHODS.has(raw)) return raw as DisplayRenderMethod;
    return 'input';
});

const ruleOptions = computed(() => attribute.value?.options ?? []);

const canEdit = computed(() => Boolean(attribute.value?.editable));
const saving = computed(() => isSaving.value);

const draft = ref('');
const tags = ref<string[]>([]);
const multiValues = ref<string[]>([]);
const pickerValue = ref<string>('');
const datePickerValue = ref('');
const lastSaved = ref('');

const selectOptions = computed(() => {
    const opts = [...ruleOptions.value];
    const current = draft.value;
    if (current && !opts.includes(current)) opts.unshift(current);
    return opts;
});

const multiOptions = computed(() => {
    const opts = [...ruleOptions.value];
    for (const v of multiValues.value) {
        if (v && !opts.includes(v)) opts.push(v);
    }
    return opts;
});

watch(
    attribute,
    (row) => {
        if (!row) return;
        draft.value = row.value ?? '';
        lastSaved.value = row.value ?? '';
        tags.value = parseAliasTags(row.value);
        multiValues.value = parseAliasTags(row.value);
        const parsed = parseSiYuanTimestamp(row.value);
        pickerValue.value = parsed ? formatForPicker(parsed) : '';
        const parsedDate = parseSiYuanDate(row.value);
        datePickerValue.value = parsedDate ? formatDateForPicker(parsedDate) : '';
    },
    { immediate: true },
);

function formatForPicker(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function formatDateForPicker(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const displayDatetime = computed(() => formatSiYuanTimestampDisplay(draft.value));
const displayDate = computed(() => formatSiYuanDateDisplay(draft.value));
const checkboxOn = computed(() => parseCheckboxValue(draft.value));

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

async function submitMulti(): Promise<void> {
    const next = serializeAliasTags(multiValues.value);
    multiValues.value = parseAliasTags(next);
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

async function submitDateOnly(value: string | Date): Promise<void> {
    let date: Date | undefined;
    if (value instanceof Date) {
        const serialized = toSiYuanDate(value);
        date = serialized ? parseSiYuanDate(serialized) : undefined;
    } else if (typeof value === 'string' && value.trim()) {
        const digits = value.replace(/\D/g, '');
        date = parseSiYuanDate(digits.slice(0, 8));
    }
    if (!date) {
        const parsed = parseSiYuanDate(lastSaved.value);
        datePickerValue.value = parsed ? formatDateForPicker(parsed) : '';
        return;
    }
    await persist(toSiYuanDate(date));
}

async function submitCheckbox(on: boolean): Promise<void> {
    await persist(serializeCheckboxValue(on));
}

async function submitNumber(): Promise<void> {
    const parsed = parseNumberValue(draft.value);
    if (parsed === undefined) {
        draft.value = lastSaved.value;
        return;
    }
    await persist(parsed);
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

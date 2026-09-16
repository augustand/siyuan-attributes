<template>
    <BaseRow :name="field?.name || ''" :key="field?.keyID" :icon="databaseIcons[field?.type]">

        <!-- 单选（M2 暂只读） -->
        <template v-if="field?.type === 'select'">
            <t-select v-model="selectValue" :borderless="true" placeholder="-请选择-" readonly>
                <t-option
                    v-for="item in field.options"
                    :key="item.name"
                    :value="item.name"
                    :label="item.name"
                />
            </t-select>
        </template>

        <!-- 文本 -->
        <template v-else-if="field?.type === 'text'">
            <t-input
                v-model="field.value.text"
                :borderless="true"
                :disabled="!field.editable || store.isSavingDatabaseAttributes"
                placeholder="请输入"
                @blur="handleSubmit"
            />
        </template>

        <!-- 链接 -->
        <template v-else-if="field?.type === 'url'">
            <t-input
                v-model="field.value.url"
                :borderless="true"
                :disabled="!field.editable || store.isSavingDatabaseAttributes"
                placeholder="请输入"
                @blur="handleSubmit"
            />
        </template>

        <!-- 数字 -->
        <template v-else-if="field?.type === 'number'">
            <t-input-number
                v-model="field.value.number"
                :borderless="true"
                :disabled="!field.editable || store.isSavingDatabaseAttributes"
                placeholder="请输入"
                @blur="handleSubmit"
                @enter="handleSubmit"
            />
        </template>

        <!-- 多选（M2 暂只读） -->
        <template v-else-if="field?.type === 'mSelect'">
            <t-select
                readonly
                v-model="selectValue"
                :borderless="true"
                placeholder="-请选择-"
                multiple
            >
                <t-option
                    v-for="item in field.options"
                    :key="item.name"
                    :value="item.name"
                    :label="item.name"
                />
            </t-select>
        </template>

        <!-- 日期（M2 暂只读） -->
        <template v-else-if="field?.type === 'date'">
            <template v-if="field.value.date?.hasEndDate">
                <t-date-range-picker
                    readonly
                    v-model="dateRange"
                    :borderless="true"
                    placeholder="请选择"
                    :enable-time-picker="!field.value.date.isNotTime"
                />
            </template>
            <template v-else>
                <t-date-picker
                    readonly
                    v-model="dateValue"
                    :borderless="true"
                    placeholder="请选择"
                    :enable-time-picker="!field.value.date?.isNotTime"
                />
            </template>
        </template>

        <!-- 复选框 -->
        <template v-else-if="field?.type === 'checkbox'">
            <t-checkbox
                v-model="field.value.checked"
                :disabled="!field.editable || store.isSavingDatabaseAttributes"
                @change="handleSubmit"
            />
        </template>

        <!-- 模板 -->
        <template v-else-if="field?.type === 'template'">
            <t-input v-model="field.value.template" :borderless="true" placeholder="请输入" readonly />
        </template>

        <template v-else>
            <t-input :value="readonlyValue" :borderless="true" placeholder="暂不支持编辑" readonly />
        </template>
    </BaseRow>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { MessagePlugin } from 'tdesign-vue-next';
import { useAttributesStore } from '@/store/attribute';
import BaseRow from './BaseRow.vue';
import { getI18nText } from '@/services/i18n';

const databaseIcons: Record<string, string> = {
    text: 'view-list',
    select: 'chevron-down-s',
    url: 'link',
    number: 'add-and-subtract',
    mSelect: 'chevron-down-double-s',
    date: 'calendar-event',
    checkbox: 'check',
    template: 'sum',
    relation: 'link',
    rollup: 'sum',
    mAsset: 'image',
    email: 'mail',
    phone: 'call',
    created: 'calendar',
    updated: 'calendar',
};

const props = defineProps<{
    avID: string;
    fieldKeyID: string;
}>();

const attributeStore = useAttributesStore();
const store = attributeStore;
const { dataBaseAttributes } = storeToRefs(attributeStore);

const field = computed(() => {
    return dataBaseAttributes.value[props.avID]?.fields.find(
        (item) => item.keyID === props.fieldKeyID,
    );
});

const selectValue = computed({
    get: () => field.value?.value.options.map((option) => option.name) ?? [],
    set: () => undefined,
});

const dateValue = computed(() => field.value?.value.date?.content);
const dateRange = computed(() => {
    const date = field.value?.value.date;
    return date?.hasEndDate ? [date.content, date.content2] : undefined;
});

const readonlyValue = computed(() => {
    const rendered = field.value?.value.raw.renderedContent;
    return typeof rendered === 'string' ? rendered : '';
});

async function handleSubmit(): Promise<void> {
    if (!field.value || !field.value.editable) return;

    try {
        await attributeStore.writeDatabaseCell({
            avID: props.avID,
            field: field.value,
        });
        MessagePlugin.success(getI18nText('attributes.saveSuccess', '设置成功'));
    } catch (error) {
        MessagePlugin.error(
            error instanceof Error
                ? error.message
                : getI18nText('attributes.saveFailed', '设置失败'),
        );
    }
}
</script>

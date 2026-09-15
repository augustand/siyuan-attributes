<template>
    <t-popconfirm :content="deleteConfirmText" @confirm="deleteAttribute">
        <t-button
            :disabled="store.isSaving"
            size="small"
            theme="danger"
            variant="text"
        >
            {{ deleteText }}
        </t-button>
    </t-popconfirm>
</template>

<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next';
import { useAttributesStore } from '@/store/attribute';
import { getI18nText } from '@/services/i18n';

const props = defineProps<{ attributeKey: string }>();
const store = useAttributesStore();

const deleteText = getI18nText('attributes.delete', '删除');
const deleteConfirmText = getI18nText('attributes.deleteConfirm', '确认删除该属性？');

async function deleteAttribute(): Promise<void> {
    try {
        await store.deleteCustomAttribute(props.attributeKey);
        MessagePlugin.success(getI18nText('attributes.deleteSuccess', '删除成功'));
    } catch (error) {
        MessagePlugin.error(error instanceof Error ? error.message : getI18nText('attributes.deleteFailed', '删除失败'));
    }
}
</script>

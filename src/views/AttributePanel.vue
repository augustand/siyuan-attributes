<template>
    <div class="attribute-panel">
        <div class="panel-toolbar">
            <span class="panel-title">{{ labels.panel }}</span>
            <t-button
                size="small"
                theme="default"
                variant="text"
                @click="showFieldSettings = true"
            >
                <template #icon>
                    <t-icon name="setting" />
                </template>
                {{ labels.fieldSettings }}
            </t-button>
        </div>

        <BuiltInAttrs />

        <FieldSettingsDialog
            v-if="showFieldSettings"
            @saved="refreshPanel"
            @close="showFieldSettings = false"
        />
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useAttributesStore } from '@/store/attribute';
import FieldSettingsDialog from '@/components/FieldSettingsDialog.vue';
import { getI18nText } from '@/services/i18n';

const attributeStore = useAttributesStore();
const showFieldSettings = ref(false);

async function refreshPanel(): Promise<void> {
    await attributeStore.loadDocumentAttributes();
}

const labels = {
    panel: getI18nText('fieldSettings.panelTitle', '属性面板'),
    fieldSettings: getI18nText('fieldSettings.open', '字段设置'),
};
</script>

<style scoped>
.panel-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-top: 8px;
}

.panel-title {
    color: var(--td-text-color-secondary);
    font-size: 12px;
    font-weight: 600;
}
</style>

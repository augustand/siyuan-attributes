<template>
    <div class="add-attribute-row">
        <t-button
            v-if="!creating"
            style="width: 150px"
            theme="default"
            variant="text"
            @click="creating = true"
        >
            <template #icon>
                <add-icon />
            </template>
            {{ addText }}
        </t-button>

        <template v-else>
            <t-input
                v-model="key"
                class="attr-selector"
                :borderless="true"
                :placeholder="keyPlaceholder"
            />
            <t-input
                v-model="value"
                class="attribute-value-input"
                :borderless="true"
                :placeholder="valuePlaceholder"
                @enter="save"
            />
            <t-button
                :disabled="!canSave"
                :loading="store.isSaving"
                theme="primary"
                variant="text"
                @click="save"
            >
                {{ saveText }}
            </t-button>
            <t-button
                :disabled="store.isSaving"
                theme="default"
                variant="text"
                @click="cancel"
            >
                {{ cancelText }}
            </t-button>
        </template>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { AddIcon } from 'tdesign-icons-vue-next';
import { MessagePlugin } from 'tdesign-vue-next';
import { useAttributesStore } from '@/store/attribute';
import { getI18nText } from '@/services/i18n';

const store = useAttributesStore();
const creating = ref(false);
const key = ref('');
const value = ref('');

const addText = getI18nText('attributes.add', '添加属性');
const keyPlaceholder = getI18nText('attributes.keyPlaceholder', 'custom-key');
const valuePlaceholder = getI18nText('attributes.valuePlaceholder', '属性值');
const saveText = getI18nText('attributes.save', '保存');
const cancelText = getI18nText('cancel', '取消');

const canSave = computed(() => {
    return /^custom-[a-z][a-z0-9-]*$/.test(key.value.trim())
        && value.value.trim().length > 0
        && !store.isSaving;
});

function cancel(): void {
    key.value = '';
    value.value = '';
    creating.value = false;
}

async function save(): Promise<void> {
    if (!canSave.value) return;

    try {
        await store.setAttribute(key.value.trim(), value.value.trim(), { requireCustom: true });
        MessagePlugin.success(getI18nText('attributes.saveSuccess', '设置成功'));
        cancel();
    } catch (error) {
        MessagePlugin.error(error instanceof Error ? error.message : getI18nText('attributes.saveFailed', '设置失败'));
    }
}
</script>

<style scoped>
.add-attribute-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
}

.attribute-value-input {
    flex: 1;
}

:deep(.t-input:not(:hover)) {
    border: white;
}

:deep(.t-input--focused) {
    border-color: var(--td-brand-color);
}

.attr-selector {
    width: 150px;
}
</style>

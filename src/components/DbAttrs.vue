<template>
    <t-card :bordered="false">
        <template v-if="targetTable">
        <template v-for="field in settingsStore.applyDatabaseRules(targetTable.fields, avID)" :key="field.keyID">
                <DbRow :avID="avID" :fieldKeyID="field.keyID" />
            </template>

            <!-- <AttributeRowAdd /> -->
        </template>

        <template v-else>
            暂无属性
        </template>
    </t-card>
</template>


<script setup lang="ts">
import { useAttributesStore } from '@/store/attribute';
import DbRow from './DbRow.vue';
import { computed } from 'vue';
import { useConfigStore } from '@/store/rules';

const props = defineProps({
    avID: {
        type: String,
        required: true,
    },
});

// 通过数据库id，渲染对应的属性面板
const attributeStore = useAttributesStore();
const settingsStore = useConfigStore();

const targetTable = computed(() => attributeStore.dataBaseAttributes[props.avID]);
</script>


<style scoped>
.form-step-container {
    background-color: var(--td-bg-color-container);
    padding: 12px 12px;
    border-radius: var(--td-radius-medium);
    height: 100%;
}

:deep(.t-card__body) {
    padding: 0px 0px;
}

.content {
    /* Gray */
    color: #4F4F4F;
    font-size: 14px;
    line-height: 20px;
    margin-bottom: 4px;
}
</style>
import { computed } from 'vue';

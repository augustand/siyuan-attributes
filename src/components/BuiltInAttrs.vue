<template>
    <t-card :bordered="false">
        <template v-for="attribute in attributeStore.builtInAttributes" :key="attribute.key">
            <AttributeRow :attribute-key="attribute.key" />
        </template>
        <AttributeRowAdd />
    </t-card>
</template>

<script setup lang="ts">
import AttributeRow from '@/components/AttributeRow.vue';
import AttributeRowAdd from '@/components/AttributeRowAdd.vue';
import { useAttributesStore } from '@/store/attribute';

const attributeStore = useAttributesStore();
</script>

<style scoped>
:deep(.t-card__body) {
    padding: 0;
}
</style>

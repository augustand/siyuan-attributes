<template>
    <AttributePanel />
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import { inject } from 'vue';
import type { Plugin } from 'siyuan';
import { useAttributesStore } from './store/attribute';
import AttributePanel from './views/AttributePanel.vue';
import { setI18n } from './services/i18n';

const plugin = inject<Plugin>('$plugin');
setI18n(plugin?.i18n as Record<string, unknown> | undefined);

const attributeStore = useAttributesStore();

onMounted(() => {
  void attributeStore.loadDocumentAttributes().catch((error) => {
    MessagePlugin.error(error instanceof Error ? error.message : "加载属性失败");
  });
});
</script>

<style scoped></style>

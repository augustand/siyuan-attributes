<template>
    <AttributePanel />
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { onUnmounted } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import { inject } from 'vue';
import type { EventBus, IProtyle, IWebSocketData, Plugin } from 'siyuan';
import { useAttributesStore } from './store/attribute';
import AttributePanel from './views/AttributePanel.vue';
import { setI18n } from './services/i18n';

const plugin = inject<Plugin>('$plugin');
const eventBus = inject<EventBus>('$EventBus');
setI18n(plugin?.i18n as Record<string, unknown> | undefined);

const attributeStore = useAttributesStore();
let refreshTimer: ReturnType<typeof setTimeout> | undefined;
let refreshInterval: ReturnType<typeof setInterval> | undefined;

function refreshAttributes(): void {
    void attributeStore.loadDocumentAttributes().catch((error) => {
        MessagePlugin.error(error instanceof Error ? error.message : "加载属性失败");
    });
}

function scheduleRefresh(): void {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(refreshAttributes, 250);
}

function handleWebSocket(event: CustomEvent<IWebSocketData>): void {
    if (event.detail?.cmd === "refreshAttributeView") scheduleRefresh();
}

function handleProtyle(_event: CustomEvent<{ protyle: IProtyle }>): void {
    scheduleRefresh();
}

onMounted(() => {
    refreshAttributes();
    eventBus?.on("ws-main", handleWebSocket);
    eventBus?.on("loaded-protyle-dynamic", handleProtyle);
    eventBus?.on("switch-protyle", handleProtyle);
    // SiYuan sends refreshAttributeView to protyle sockets, not plugin ws-main sockets.
    refreshInterval = setInterval(refreshAttributes, 5000);
});

onUnmounted(() => {
    clearTimeout(refreshTimer);
    clearInterval(refreshInterval);
    eventBus?.off("ws-main", handleWebSocket);
    eventBus?.off("loaded-protyle-dynamic", handleProtyle);
    eventBus?.off("switch-protyle", handleProtyle);
});
</script>

<style scoped></style>

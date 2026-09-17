<template>
    <AttributePanel v-if="settingsStore.settings.showPanel" />
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { onUnmounted } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import { inject } from 'vue';
import type { EventBus, IProtyle, Plugin } from 'siyuan';
import { useAttributesStore } from './store/attribute';
import { useConfigStore } from './store/rules';
import AttributePanel from './views/AttributePanel.vue';
import { setI18n } from './services/i18n';
import { onSettingsChanged } from './services/settingEvents';

const plugin = inject<Plugin>('$plugin');
const eventBus = inject<EventBus>('$EventBus');
setI18n(plugin?.i18n as Record<string, unknown> | undefined);

const attributeStore = useAttributesStore();
const settingsStore = useConfigStore();
let refreshTimer: ReturnType<typeof setTimeout> | undefined;
let refreshInterval: ReturnType<typeof setInterval> | undefined;
const removeSettingsChangedListener = onSettingsChanged(() => {
    void reloadFromSettings();
});

function refreshAttributes(): void {
    void attributeStore.loadDocumentAttributes().catch((error) => {
        MessagePlugin.error(error instanceof Error ? error.message : "加载属性失败");
    });
}

function scheduleRefresh(): void {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(refreshAttributes, 250);
}

function handleProtyle(_event: CustomEvent<{ protyle: IProtyle }>): void {
    scheduleRefresh();
}

onMounted(() => {
    void settingsStore.initialize()
        .then(refreshAttributes)
        .catch((error) => {
            MessagePlugin.error(error instanceof Error ? error.message : "加载设置失败");
        });
    eventBus?.on("loaded-protyle-dynamic", handleProtyle);
    eventBus?.on("switch-protyle", handleProtyle);
    refreshInterval = setInterval(refreshAttributes, 5000);
});

onUnmounted(() => {
    clearTimeout(refreshTimer);
    clearInterval(refreshInterval);
    eventBus?.off("loaded-protyle-dynamic", handleProtyle);
    eventBus?.off("switch-protyle", handleProtyle);
    removeSettingsChangedListener();
});

async function reloadFromSettings(): Promise<void> {
    await settingsStore.initialize();
    refreshAttributes();
}
</script>

<style scoped></style>

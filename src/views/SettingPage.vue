<template>
    <SettingContent class="mux-plugin-settings" />
</template>

<script setup lang="ts">
import { inject } from 'vue';
import type { Plugin } from 'siyuan';
import SettingContent from './SettingContent.vue';
import { setI18n } from '@/services/i18n';

const plugin = inject<Plugin>('$plugin');
setI18n(plugin?.i18n as Record<string, unknown> | undefined);
</script>

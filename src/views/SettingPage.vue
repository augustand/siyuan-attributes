<template>
    <t-layout style="height: 100%;">
        <t-aside>
            <t-menu theme="light" value="settings" style="margin-right: 8px">
                <t-menu-item value="settings">
                    <template #icon>
                        <t-icon name="setting" />
                    </template>
                    {{ labels.panel }}
                </t-menu-item>
            </t-menu>
        </t-aside>
        <t-layout>
            <t-content>
                <div class="layout">
                    <SettingContent />
                </div>
            </t-content>
            <t-footer>Copyright @ 2022-{{ new Date().getFullYear() }} TransMux. All Rights Reserved</t-footer>
        </t-layout>
    </t-layout>
</template>

<script setup lang="ts">
import { inject } from 'vue';
import type { Plugin } from 'siyuan';
import SettingContent from './SettingContent.vue';
import { setI18n } from '@/services/i18n';
import { getI18nText } from '@/services/i18n';

const plugin = inject<Plugin>('$plugin');
setI18n(plugin?.i18n as Record<string, unknown> | undefined);

const labels = {
    panel: getI18nText('settings.title', '属性面板设置'),
};
</script>

<style scoped>
.layout {
    padding: 16px;
}
</style>

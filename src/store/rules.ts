import { defineStore } from "pinia";
import type { Plugin } from "siyuan";
import { inject, ref } from "vue";
import {
    compareDisplayRules,
    DEFAULT_PANEL_SETTINGS,
    matchDisplayRule,
    normalizeDisplayRule,
    normalizePanelSettings,
} from "@/models/settings";
import type { DisplayRule, PanelSettings } from "@/models/settings";
import {
    loadPanelSettings,
    resetPanelSettings,
    savePanelSettings,
} from "@/services/settings";
import { emitSettingsChanged } from "@/services/settingEvents";

const pluginKey = "mux-siyuan-plugin-attributes-panel";

function cloneDefaultSettings(): PanelSettings {
    return normalizePanelSettings(DEFAULT_PANEL_SETTINGS);
}

export const useConfigStore = defineStore(pluginKey + "settings", () => {
    const plugin = inject("$plugin") as Plugin;
    const pluginDataStore = {
        loadData: (key: string) => plugin.loadData(key),
        saveData: (key: string, value: unknown) => plugin.saveData(key, value),
    };

    const settings = ref<PanelSettings>(cloneDefaultSettings());
    const isReady = ref(false);
    const isSaving = ref(false);
    let initializationToken = 0;

    async function persist(): Promise<void> {
        isSaving.value = true;
        try {
            await savePanelSettings(pluginDataStore, settings.value);
            emitSettingsChanged();
        } finally {
            isSaving.value = false;
        }
    }

    async function initialize(): Promise<void> {
        const token = ++initializationToken;
        try {
            const loaded = await loadPanelSettings(pluginDataStore);
            if (token !== initializationToken) return;

            settings.value = loaded;
            isReady.value = true;
        } catch (error) {
            if (token === initializationToken) isReady.value = true;
            throw error;
        }
    }

    async function updateSettings(next: PanelSettings): Promise<void> {
        settings.value = normalizePanelSettings(next);
        await persist();
    }

    async function updateRule(id: string, patch: Partial<Omit<DisplayRule, "id" | "version">>): Promise<void> {
        const current = settings.value.rules.find((rule) => rule.id === id);
        if (!current) throw new Error(`Setting rule not found: ${id}`);

        const candidate = normalizeDisplayRule({ ...current, ...patch, id });
        if (!candidate) throw new Error(`Setting rule not found: ${id}`);

        settings.value = {
            ...settings.value,
            rules: settings.value.rules.map((rule) => rule.id === id ? candidate : rule),
        };
        await persist();
    }

    async function addRule(rule: Omit<DisplayRule, "id">): Promise<DisplayRule> {
        const id = `user-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
        const candidate = normalizeDisplayRule({ ...rule, id });
        if (!candidate) throw new Error("Invalid setting rule");

        settings.value = { ...settings.value, rules: [...settings.value.rules, candidate] };
        await persist();
        return candidate;
    }

    async function removeRule(id: string): Promise<void> {
        settings.value = {
            ...settings.value,
            rules: settings.value.rules.filter((rule) => rule.id !== id),
        };
        await persist();
    }

    async function moveRule(id: string, direction: -1 | 1): Promise<void> {
        const sorted = [...settings.value.rules].sort(compareDisplayRules);
        const index = sorted.findIndex((rule) => rule.id === id);
        const targetIndex = index + direction;
        if (index < 0 || targetIndex < 0 || targetIndex >= sorted.length) return;

        const current = sorted[index];
        const target = sorted[targetIndex];
        const currentOrder = current.order;
        current.order = target.order === currentOrder ? currentOrder + direction : target.order;
        target.order = currentOrder;

        settings.value = {
            ...settings.value,
            rules: settings.value.rules.map((rule) => {
                if (rule.id === current.id) return current;
                if (rule.id === target.id) return target;
                return rule;
            }),
        };
        await persist();
    }

    async function resetSettings(): Promise<void> {
        settings.value = await resetPanelSettings(pluginDataStore);
        emitSettingsChanged();
    }

    function findDocumentRule(name: string): DisplayRule | undefined {
        return settings.value.rules.find((rule) => matchDisplayRule(rule, name));
    }

    function matchDocumentRule(name: string): DisplayRule | undefined {
        return findDocumentRule(name);
    }

    function documentRules(): DisplayRule[] {
        return [...settings.value.rules].sort(compareDisplayRules);
    }

    async function upsertDocumentFieldRules(rules: DisplayRule[]): Promise<void> {
        let nextRules = [...settings.value.rules];

        for (const input of rules) {
            const candidate = normalizeDisplayRule({
                ...input,
                matchMethod: "exact",
                scope: "document",
            });
            if (!candidate) continue;

            const existingIndex = nextRules.findIndex((rule) => (
                rule.id === candidate.id
                || (rule.matchMethod === "exact"
                    && rule.rule === candidate.rule)
            ));
            nextRules = existingIndex >= 0
                ? nextRules.map((rule, index) => index === existingIndex ? candidate : rule)
                : [...nextRules, candidate];
        }

        settings.value = { ...settings.value, rules: nextRules };
        await persist();
    }


    return {
        settings,
        isReady,
        isSaving,
        initialize,
        updateSettings,
        updateRule,
        addRule,
        removeRule,
        moveRule,
        resetSettings,
        matchDocumentRule,
        documentRules,
        upsertDocumentFieldRules,
    };
});

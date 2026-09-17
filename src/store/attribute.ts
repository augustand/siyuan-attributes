import { defineStore } from "pinia";
import { inject, ref } from "vue";
import { useConfigStore } from "./rules";
import { normalizeCustomAttributeKey } from "@/services/attributeKeys";
import { isReadOnlyDocumentAttributeName } from "@/models/settings";
import { fetchBlockAttrs, writeBlockAttrs } from "@/services/blockAttrs";

const pluginKey = "mux-siyuan-plugin-attributes-panel";

export interface innerAttribute {
    key: string;
    value: string;
    name: string;
    displayAs: string;
    editable: boolean;
    renderMethod?: string;
    order: number;
    icon?: string;
}

export const useAttributesStore = defineStore(pluginKey + "attrs", () => {
    const documentId = ref(inject<string>("$docId", ""));
    const builtInAttributes = ref([] as Array<innerAttribute>);
    const allDocumentAttributes = ref([] as Array<innerAttribute>);
    const isSaving = ref(false);

    async function loadDocumentAttributes(): Promise<void> {
        const attrs = await fetchBlockAttrs(documentId.value);
        const next: Array<innerAttribute> = [];

    for (const [attributeName, attributeValue] of Object.entries(attrs)) {
      const rule = matchRules(attributeName);
      const hidden = Boolean(rule && !rule.display);

      // custom-avs is SiYuan's internal database binding. Database support is
      // temporarily removed, so it should never enter the document field list.
      if (attributeName === "custom-avs" || attributeName.startsWith("custom-avs:")) continue;

      if (rule) {
                next.push({
                    key: attributeName,
                    value: attributeValue,
                    name: rule.name,
                    displayAs: rule.displayAs || attributeName,
                    editable: rule.editable && !hidden && !isReadOnlyDocumentAttributeName(attributeName),
                    renderMethod: rule.renderMethod,
                    order: rule.order,
                    icon: rule.icon,
                });
            } else if (attributeName.startsWith("custom-")) {
                next.push({
                    key: attributeName,
                    value: attributeValue,
                    name: attributeName,
                    displayAs: attributeName.replace(/^custom-/, ""),
                    editable: true,
                    renderMethod: "input",
                    order: 1000,
                });
            }
        }

        allDocumentAttributes.value = next.sort((left, right) => left.order - right.order);
        builtInAttributes.value = allDocumentAttributes.value.filter((attribute) => {
            const rule = matchRules(attribute.key);
            return !rule || rule.display;
        });
    }

    async function setAttribute(
        key: string,
        value: string,
        options: { requireCustom?: boolean } = {},
    ): Promise<void> {
        if (isReadOnlyDocumentAttributeName(key)) {
            throw new Error(`Attribute key is read-only: ${key}`);
        }

        if (options.requireCustom) {
            normalizeCustomAttributeKey(key);
        }

        isSaving.value = true;
        try {
            await writeBlockAttrs(documentId.value, { [key]: value });
            await loadDocumentAttributes();
        } finally {
            isSaving.value = false;
        }
    }

    async function createCustomAttribute(input: string, value: string): Promise<void> {
        const key = normalizeCustomAttributeKey(input);
        isSaving.value = true;
        try {
            await writeBlockAttrs(documentId.value, { [key]: value });
            await loadDocumentAttributes();
        } finally {
            isSaving.value = false;
        }
    }

    const protectedDeleteKeys = new Set([
        "id",
        "updated",
        "type",
        "subtype",
        "fold",
        "scroll",
        "title",
        "icon",
        "custom-avs",
    ]);

    async function deleteCustomAttribute(key: string): Promise<void> {
        if (protectedDeleteKeys.has(key) || !key.startsWith("custom-")) {
            throw new Error(`Attribute key is protected and cannot be deleted: ${key}`);
        }

        isSaving.value = true;
        try {
            await writeBlockAttrs(documentId.value, { [key]: "" });
            await loadDocumentAttributes();
        } finally {
            isSaving.value = false;
        }
    }

    return {
        documentId,
        builtInAttributes,
        allDocumentAttributes,
        isSaving,
        loadDocumentAttributes,
        createCustomAttribute,
        setAttribute,
        deleteCustomAttribute,
    };
});

function matchRules(attributeName: string) {
    const configStore = useConfigStore();
    return configStore.matchDocumentRule(attributeName);
}

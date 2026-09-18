import { defineStore } from "pinia";
import { inject, ref } from "vue";
import { useConfigStore } from "./rules";
import { normalizeCustomAttributeKey } from "@/services/attributeKeys";
import { isReadOnlyDocumentAttributeName } from "@/models/settings";
import { fetchBlockAttrs, writeBlockAttrs } from "@/services/blockAttrs";
import {
    DOCUMENT_FIELD_OVERRIDES_ATTR,
    applyDocumentFieldOverride,
    isReservedDocumentAttributeKey,
    parseDocumentFieldOverrides,
    serializeDocumentFieldOverrides,
    type DocumentFieldOverride,
    type DocumentFieldOverrides,
} from "@/models/documentFieldOverrides";

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

type AttributeRow = innerAttribute & { show: boolean };

export const useAttributesStore = defineStore(pluginKey + "attrs", () => {
    const documentId = ref(inject<string>("$docId", ""));
    const builtInAttributes = ref([] as Array<innerAttribute>);
    const allDocumentAttributes = ref([] as Array<innerAttribute>);
    const documentFieldOverrides = ref<DocumentFieldOverrides>({ v: 1, fields: {} });
    const isSaving = ref(false);

    async function loadDocumentAttributes(): Promise<void> {
        const attrs = await fetchBlockAttrs(documentId.value);
        const overrides = parseDocumentFieldOverrides(attrs[DOCUMENT_FIELD_OVERRIDES_ATTR]);
        documentFieldOverrides.value = overrides;
        const next: Array<AttributeRow> = [];

        for (const [attributeName, attributeValue] of Object.entries(attrs)) {
            if (isReservedDocumentAttributeKey(attributeName)) continue;
            if (attributeName === "custom-avs" || attributeName.startsWith("custom-avs:")) continue;

            const matched = matchRules(attributeName);
            const override = overrides.fields[attributeName];

            if (matched) {
                const effective = applyDocumentFieldOverride(
                    {
                        display: matched.display,
                        displayAs: matched.displayAs || attributeName,
                        order: matched.order,
                        editable: matched.editable,
                    },
                    override,
                );
                const hidden = !effective.display;
                next.push({
                    key: attributeName,
                    value: attributeValue,
                    name: matched.name,
                    displayAs: effective.displayAs,
                    editable: effective.editable && !hidden && !isReadOnlyDocumentAttributeName(attributeName),
                    renderMethod: matched.renderMethod,
                    order: effective.order,
                    icon: matched.icon,
                    show: effective.display,
                });
            } else if (attributeName.startsWith("custom-")) {
                const base = {
                    display: true,
                    displayAs: attributeName.replace(/^custom-/, ""),
                    order: 1000,
                    editable: true,
                };
                const effective = applyDocumentFieldOverride(base, override);
                const hidden = !effective.display;
                next.push({
                    key: attributeName,
                    value: attributeValue,
                    name: attributeName,
                    displayAs: effective.displayAs,
                    editable: effective.editable && !hidden,
                    renderMethod: "input",
                    order: effective.order,
                    show: effective.display,
                });
            }
        }

        const sorted = next.sort((left, right) => left.order - right.order);
        allDocumentAttributes.value = sorted.map(({ show: _show, ...row }) => row);
        builtInAttributes.value = sorted.filter((row) => row.show).map(({ show: _show, ...row }) => row);
    }

    async function setAttribute(
        key: string,
        value: string,
        options: { requireCustom?: boolean } = {},
    ): Promise<void> {
        if (isReservedDocumentAttributeKey(key)) {
            throw new Error(`Attribute key is reserved: ${DOCUMENT_FIELD_OVERRIDES_ATTR}`);
        }
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
        if (
            isReservedDocumentAttributeKey(input)
            || isReservedDocumentAttributeKey(`custom-${input}`)
        ) {
            throw new Error(`Attribute key is reserved: ${DOCUMENT_FIELD_OVERRIDES_ATTR}`);
        }
        const key = normalizeCustomAttributeKey(input);
        if (isReservedDocumentAttributeKey(key)) {
            throw new Error(`Attribute key is reserved: ${DOCUMENT_FIELD_OVERRIDES_ATTR}`);
        }
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
        DOCUMENT_FIELD_OVERRIDES_ATTR,
    ]);

    async function deleteCustomAttribute(key: string): Promise<void> {
        if (
            isReservedDocumentAttributeKey(key)
            || protectedDeleteKeys.has(key)
            || !key.startsWith("custom-")
        ) {
            throw new Error(`Attribute key is protected and cannot be deleted: ${key}`);
        }

        isSaving.value = true;
        try {
            const attrs = await fetchBlockAttrs(documentId.value);
            const overrides = parseDocumentFieldOverrides(attrs[DOCUMENT_FIELD_OVERRIDES_ATTR]);
            const nextFields = { ...overrides.fields };
            delete nextFields[key];
            const payload: Record<string, string> = { [key]: "" };
            payload[DOCUMENT_FIELD_OVERRIDES_ATTR] = Object.keys(nextFields).length === 0
                ? ""
                : serializeDocumentFieldOverrides({ v: 1, fields: nextFields });
            await writeBlockAttrs(documentId.value, payload);
            await loadDocumentAttributes();
        } finally {
            isSaving.value = false;
        }
    }

    async function saveDocumentFieldOverrides(fields: Record<string, DocumentFieldOverride>): Promise<void> {
        isSaving.value = true;
        try {
            const value = Object.keys(fields).length === 0
                ? ""
                : serializeDocumentFieldOverrides({ v: 1, fields });
            await writeBlockAttrs(documentId.value, { [DOCUMENT_FIELD_OVERRIDES_ATTR]: value });
            await loadDocumentAttributes();
        } finally {
            isSaving.value = false;
        }
    }

    return {
        documentId,
        builtInAttributes,
        allDocumentAttributes,
        documentFieldOverrides,
        isSaving,
        loadDocumentAttributes,
        createCustomAttribute,
        setAttribute,
        deleteCustomAttribute,
        saveDocumentFieldOverrides,
    };
});

function matchRules(attributeName: string) {
    const configStore = useConfigStore();
    return configStore.matchDocumentRule(attributeName);
}

import { defineStore } from "pinia";
import { inject, reactive, ref } from "vue";
import { useConfigStore } from "./rules";
import { normalizeCustomAttributeKey } from "@/services/attributeKeys";
import { isReadOnlyDocumentAttributeName } from "@/models/settings";
import { fetchBlockAttrs, writeBlockAttrs } from "@/services/blockAttrs";
import {
  fetchAttributeViews,
  writeDatabaseCell as writeDatabaseCellApi,
} from "@/services/attributeViews";
import type { DatabaseField, DatabasePanel } from "@/models/attributeView";

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
  // Data Flow Model

  // SiYuan --> Inner Store --> UI
  // UI --> API --> SiYuan --> Flush(Based on message --> function) --> UI
  // UI --> Inner Store (UnReliable, based on components)

  // --- Attributes Data Storages ---
  const documentId = ref(inject<string>("$docId", ""));
  const builtInAttributes = ref([] as Array<innerAttribute>); // 内置数据库属性
  const allDocumentAttributes = ref([] as Array<innerAttribute>);
  const dataBaseAttributes = reactive<Record<string, DatabasePanel>>({});
  const pageBlockAttributes = reactive({}); // 当前块属性
  const isSaving = ref(false);
  const isLoadingDatabaseAttributes = ref(false);
  const isSavingDatabaseAttributes = ref(false);
  let databaseLoadToken = 0;

  async function loadDocumentAttributes(): Promise<void> {
    const attrs = await fetchBlockAttrs(documentId.value);
    const next: Array<innerAttribute> = [];

    for (const [attributeName, attributeValue] of Object.entries(attrs)) {
      const rule = matchRules(attributeName);
      const hidden = Boolean(rule && !rule.display);

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

    allDocumentAttributes.value = next.sort((left, right) => {
      return left.order - right.order;
    });

    builtInAttributes.value = allDocumentAttributes.value.filter((attribute) => {
      const rule = matchRules(attribute.key);
      return !rule || rule.display;
    });

    if ("custom-avs" in attrs) {
      await loadDatabaseAttributes();
    } else {
      replaceDatabasePanels([]);
    }
  }

  async function loadDatabaseAttributes(): Promise<void> {
    if (!documentId.value) return;

    const token = ++databaseLoadToken;
    isLoadingDatabaseAttributes.value = true;
    try {
      const panels = await fetchAttributeViews(documentId.value);
      if (token !== databaseLoadToken) return;

      replaceDatabasePanels(panels);
    } finally {
      if (token === databaseLoadToken) {
        isLoadingDatabaseAttributes.value = false;
      }
    }
  }

  function replaceDatabasePanels(panels: DatabasePanel[]): void {
    const nextIDs = new Set(panels.map((panel) => panel.avID));
    for (const avID of Object.keys(dataBaseAttributes)) {
      if (!nextIDs.has(avID)) delete dataBaseAttributes[avID];
    }
    for (const panel of panels) {
      dataBaseAttributes[panel.avID] = panel;
    }
  }

  async function writeDatabaseCell(input: {
    avID: string;
    field: DatabaseField;
  }): Promise<void> {
    isSavingDatabaseAttributes.value = true;
    try {
      await writeDatabaseCellApi({
        avID: input.avID,
        field: input.field,
      });
      await loadDocumentAttributes();
    } finally {
      isSavingDatabaseAttributes.value = false;
    }
  }

  function assertCustomKey(key: string): void {
    normalizeCustomAttributeKey(key);
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
      assertCustomKey(key);
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
    dataBaseAttributes,
    pageBlockAttributes, // Inner States
    isSaving,
    isLoadingDatabaseAttributes,
    isSavingDatabaseAttributes,
    loadDocumentAttributes,
    loadDatabaseAttributes,
    writeDatabaseCell,
    createCustomAttribute,
    setAttribute,
    deleteCustomAttribute,
  };
});

function matchRules(attributeName: string) {
  const configStore = useConfigStore();
  return configStore.matchDocumentRule(attributeName);
}

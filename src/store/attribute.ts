import { defineStore } from "pinia";
import { inject, reactive, ref } from "vue";
import { displayRule, useConfigStore } from "./rules";
import { normalizeCustomAttributeKey } from "@/services/attributeKeys";
import { fetchBlockAttrs, writeBlockAttrs } from "@/services/blockAttrs";
import {
  fetchAttributeViews,
  writeDatabaseCell as writeDatabaseCellApi,
} from "@/services/attributeViews";
import type { DatabaseField, DatabasePanel } from "@/models/attributeView";

const pluginKey = "mux-siyuan-plugin-attributes-panel";

export interface innerAttribute extends displayRule {
  key: string;
  value: string;
}

export const useAttributesStore = defineStore(pluginKey + "attrs", () => {
  // Data Flow Model

  // SiYuan --> Inner Store --> UI
  // UI --> API --> SiYuan --> Flush(Based on message --> function) --> UI
  // UI --> Inner Store (UnReliable, based on components)

  // --- Attributes Data Storages ---
  const documentId = ref(inject<string>("$docId", ""));
  const builtInAttributes = ref([] as Array<innerAttribute>); // 内置数据库属性
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
      if (rule && !rule.display) continue;

      if (rule) {
        next.push({
          ...rule,
          key: attributeName,
          value: attributeValue,
        });
      } else {
        next.push({
          key: attributeName,
          value: attributeValue,
          name: attributeName,
          displayAs: attributeName.replace(/^custom-/, ""),
          rule: attributeName,
          renderMethod: "input",
          matchMethod: "精确",
          editable: true,
          display: true,
        });
      }
    }

    builtInAttributes.value = next.sort((left, right) => {
      return (left.order ?? Number.MAX_SAFE_INTEGER) - (right.order ?? Number.MAX_SAFE_INTEGER);
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
  const rules = configStore.rules;

  return rules.find((rule) => {
    if (rule.matchMethod === "精确" && rule.rule === attributeName) {
      return true;
    }

    if (rule.matchMethod === "通配符" && matchWild(attributeName, rule.rule)) {
      return true;
    }

    if (rule.matchMethod === "正则" && matchRegex(attributeName, rule.rule)) {
      return true;
    }
  });
}

function matchRegex(_attributeName: string, _rule: string) {
  return false;
}

function matchWild(_attributeName: string, _rule: string) {
  // Wanna imporve this? goto Leetcode #44
  return false;
}

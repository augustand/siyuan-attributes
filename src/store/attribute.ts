import { defineStore } from "pinia";
import { fetchPost } from "siyuan";
import type { IWebSocketData } from "siyuan";
import { inject, reactive, ref } from "vue";
import { displayRule, useConfigStore } from "./rules";
import { normalizeCustomAttributeKey } from "@/services/attributeKeys";
import { fetchBlockAttrs, writeBlockAttrs } from "@/services/blockAttrs";

const pluginKey = "mux-siyuan-plugin-attributes-panel";

export interface innerAttribute extends displayRule {
  key: string;
  value: string;
}

// TODO: Database Data Type

export const useAttributesStore = defineStore(pluginKey + "attrs", () => {
  // Data Flow Model

  // SiYuan --> Inner Store --> UI
  // UI --> API --> SiYuan --> Flush(Based on message --> function) --> UI
  // UI --> Inner Store (UnReliable, based on components)

  // --- Attributes Data Storages ---
  const documentId = ref(inject<string>("$docId", ""));
  const builtInAttributes = ref([] as Array<innerAttribute>); // 内置数据库属性
  const dataBaseAttributes = reactive<Record<string, any>>({}); // 当前文档所有数据库属性
  const pageBlockAttributes = reactive({}); // 当前块属性
  const isSaving = ref(false);

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
    }
  }

  async function loadDatabaseAttributes(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      fetchPost(
      "/api/av/getAttributeViewKeys",
      {
        id: documentId.value,
      },
      (response: IWebSocketData) => {
        if (response.code !== 0) {
          reject(new Error(response.msg || "Failed to load database attributes"));
          return;
        }

        const data = response.data;
        if (!data || data.length === 0) {
          resolve();
          return;
        }

        for (const av of data) {
          // 遍历所有的数据库，转换为关注的数据格式

          const database = { ...av, fields: [] };
          delete database.keyValues;

          database.fields = av.keyValues.flatMap(({ key, values }) => {
            // TODO: Convert Attributes by rules and orders via dragging
            // 跳过主键
            if (key.type === "block") {
              return [];
            }
            const value = values[0];

            let cellValue = value[value.type];
            if (value.type === "select") {
              cellValue = value.mSelect;
            }

            if (value.type === "select" || value.type === "mSelect") {
              // change every cellValue {content: "aaa", color: "1"} -> index
              // 暂时屏蔽name和content的区别，暂时屏蔽对象，注意如果以后content不唯一，这里绝对会出问题
              if (cellValue instanceof Array) {
                cellValue = {
                  content: cellValue.map((v) => {
                    return key.options.findIndex(
                      (option) => option.name === v.content
                    );
                  }),
                };
              } else {
                cellValue = [];
              }
            }

            return [
              {
                name: key.name,
                cellID: value.id,
                keyID: value.keyID,
                rowID: value.blockID,
                type: value.type,
                value: cellValue,
                options: key.options,
              },
            ];
          });

          dataBaseAttributes[av.avID] = database;
        }
        resolve();
      },
      undefined,
      () => {
        reject(new Error("Failed to load database attributes"));
      }
      );
    });
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
    loadDocumentAttributes,
    loadDatabaseAttributes,
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

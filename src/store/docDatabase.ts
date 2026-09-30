import { defineStore } from "pinia";
import { computed, inject, ref } from "vue";
import type { Plugin } from "siyuan";
import type { DatabasePanel } from "@/models/attributeView";
import type { DocDatabaseRule } from "@/models/docDatabaseRules";
import { matchDocDatabaseRules } from "@/models/docDatabaseRules";
import {
  bindDocumentToDatabase,
  fetchAttributeViews,
  listDatabaseBoundDocs,
  unbindDocumentFromDatabase,
  type DatabaseBoundDoc,
} from "@/services/attributeView";
import { openDocument } from "@/services/ownedDatabase";
import { useConfigStore } from "@/store/rules";

export const useDocDatabaseStore = defineStore("mux-doc-database-manager", () => {
  const plugin = inject("$plugin") as Plugin | undefined;
  const settingsStore = useConfigStore();

  const docId = ref("");
  const notebookId = ref("");
  const path = ref("");
  const boundPanels = ref<DatabasePanel[]>([]);
  const boundDocs = ref<DatabaseBoundDoc[]>([]);
  const queryAvID = ref("");
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  const rules = computed(() => settingsStore.settings.docDatabaseRules);

  const matchedRules = computed(() =>
    matchDocDatabaseRules(
      { notebookId: notebookId.value, path: path.value },
      rules.value,
    ),
  );

  const unboundMatchedRules = computed(() => {
    const bound = new Set(boundPanels.value.map((p) => p.avID));
    return matchedRules.value.filter((r) => !bound.has(r.avID));
  });

  async function setContext(input: {
    docId: string;
    notebookId?: string;
    path?: string;
  }): Promise<void> {
    docId.value = input.docId;
    notebookId.value = input.notebookId ?? "";
    path.value = input.path ?? "";
    await refreshBound();
  }

  async function refreshBound(): Promise<void> {
    if (!docId.value) {
      boundPanels.value = [];
      return;
    }
    isLoading.value = true;
    error.value = null;
    try {
      boundPanels.value = await fetchAttributeViews(docId.value);
    } catch (e) {
      boundPanels.value = [];
      error.value = e instanceof Error ? e.message : String(e);
      throw e;
    } finally {
      isLoading.value = false;
    }
  }

  async function bindRule(rule: DocDatabaseRule): Promise<void> {
    if (!docId.value) throw new Error("No document");
    await bindDocumentToDatabase({
      avID: rule.avID,
      avBlockID: rule.avBlockID,
      docId: docId.value,
      viewID: rule.viewID,
    });
    await refreshBound();
  }

  async function unbind(avID: string): Promise<void> {
    if (!docId.value) throw new Error("No document");
    await unbindDocumentFromDatabase({ avID, docId: docId.value });
    await refreshBound();
  }

  async function loadBoundDocs(avID: string): Promise<void> {
    queryAvID.value = avID;
    if (!avID) {
      boundDocs.value = [];
      return;
    }
    boundDocs.value = await listDatabaseBoundDocs(avID);
  }

  async function openDoc(id: string): Promise<void> {
    try {
      await openDocument(id, plugin);
    } catch (e) {
      console.warn("openDoc failed", e);
    }
  }

  return {
    docId,
    notebookId,
    path,
    boundPanels,
    boundDocs,
    queryAvID,
    isLoading,
    error,
    rules,
    matchedRules,
    unboundMatchedRules,
    setContext,
    refreshBound,
    bindRule,
    unbind,
    loadBoundDocs,
    openDoc,
  };
});

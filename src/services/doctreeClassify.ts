import { fetchSyncPost, type Plugin } from "siyuan";
import { assertSiyuanData } from "./siyuanResponse";
import type { OwnedDatabase } from "@/models/ownedDatabase";
import type { DatabaseTypeId, TableTemplate } from "@/models/databaseTypes";
import { normalizeDatabaseTypeId } from "@/models/databaseTypes";
import { pickPrimaryDatabaseForType } from "@/models/ownedDatabaseHang";
import {
  normalizePanelSettings,
  type PanelSettings,
} from "@/models/settings";
import { fetchAttributeViews } from "@/services/attributeView";
import {
  checkOwnedDatabasesHealth,
  ensureOwnedDatabaseTemplateColumns,
  ensureTableForTemplateKey,
} from "@/services/ownedDatabase";
import { migrateDocumentToOwnedDatabase } from "@/services/ownedDatabaseMigrate";
import { refreshDocumentEditor } from "@/services/refreshEditor";
import {
  loadPanelSettings,
  savePanelSettings,
  type PluginDataStore,
} from "@/services/settings";
import { emitSettingsChanged } from "@/services/settingEvents";

function pluginDataStore(plugin: Plugin): PluginDataStore {
  return {
    loadData: (key: string) => plugin.loadData(key),
    saveData: (key: string, value: unknown) => plugin.saveData(key, value),
  };
}

export type ClassifyResult =
  | {
      kind: "hung";
      db: OwnedDatabase;
      addedColumns: string[];
    }
  | { kind: "needCreate"; typeId: DatabaseTypeId }
  | { kind: "already"; db: OwnedDatabase };

/**
 * Hang a document onto the primary owned DB of a business type.
 * Independent of whether the Dock is mounted.
 */
export async function classifyDocumentToType(input: {
  plugin: Plugin;
  docId: string;
  typeId: DatabaseTypeId | string;
}): Promise<ClassifyResult> {
  const typeId = normalizeDatabaseTypeId(input.typeId);
  const store = pluginDataStore(input.plugin);
  const settings = await loadPanelSettings(store);
  const databases = settings.ownedDatabases ?? [];
  const health = await checkOwnedDatabasesHealth(databases);
  const healthyAvIDs = Object.entries(health)
    .filter(([, h]) => h === "ok")
    .map(([id]) => id);

  const primary = pickPrimaryDatabaseForType({
    typeId,
    databases,
    healthyAvIDs,
    primaryAvID: settings.ownedDbPrimaryByType?.[typeId],
    lastAvID: settings.ownedDbLastAvID,
  });

  if (!primary) {
    return { kind: "needCreate", typeId };
  }

  const panelsBefore = await fetchAttributeViews(input.docId);
  if (
    panelsBefore.length === 1
    && panelsBefore[0]?.avID === primary.avID
  ) {
    return { kind: "already", db: primary };
  }

  await migrateDocumentToOwnedDatabase({
    docId: input.docId,
    target: primary,
  });

  let addedColumns: string[] = [];
  try {
    const ensured = await ensureOwnedDatabaseTemplateColumns(primary);
    addedColumns = ensured.added;
  } catch (e) {
    console.warn("ensureOwnedDatabaseTemplateColumns failed", e);
  }

  const next: PanelSettings = normalizePanelSettings({
    ...settings,
    ownedDbLastAvID: primary.avID,
    ownedDbLastTypeId: typeId,
    ownedDbPrimaryByType: {
      ...settings.ownedDbPrimaryByType,
      [typeId]: primary.avID,
    },
    showUnderTitlePanel: false,
  });
  await savePanelSettings(store, next);
  emitSettingsChanged();
  await refreshDocumentEditor(input.docId, input.plugin);

  return { kind: "hung", db: primary, addedColumns };
}

/** Persist a newly created DB as primary for its type (and last-used). */
export async function persistCreatedAsPrimary(input: {
  plugin: Plugin;
  db: OwnedDatabase;
  notebookId?: string;
}): Promise<PanelSettings> {
  const store = pluginDataStore(input.plugin);
  const settings = await loadPanelSettings(store);
  const typeId = normalizeDatabaseTypeId(input.db.typeId);
  const next = normalizePanelSettings({
    ...settings,
    ownedDatabases: [
      ...settings.ownedDatabases.filter((d) => d.avID !== input.db.avID),
      input.db,
    ],
    ownedDbNotebookId: input.notebookId || settings.ownedDbNotebookId,
    ownedDbLastAvID: input.db.avID,
    ownedDbLastTypeId: typeId,
    ownedDbPrimaryByType: {
      ...settings.ownedDbPrimaryByType,
      [typeId]: input.db.avID,
    },
    showUnderTitlePanel: false,
  });
  await savePanelSettings(store, next);
  emitSettingsChanged();
  return next;
}

export type JoinTableResult = {
  kind: "bound" | "created" | "already";
  db: OwnedDatabase;
  addedColumns: string[];
};

/**
 * Doc-tree「加入表格」: make sure the default table for `templateKey` exists
 * (auto-generate on demand), then bind the doc onto it exclusively, backfill
 * template columns and record last-used. Dormant alternative to
 * classifyDocumentToType (type flow retired by the tables redesign).
 */
export async function joinTableByKey(input: {
  plugin: Plugin;
  docId: string;
  templateKey: string;
  nameOf?: (t: TableTemplate) => string;
}): Promise<JoinTableResult> {
  const ensured = await ensureTableForTemplateKey({
    plugin: input.plugin,
    templateKey: input.templateKey,
    nameOf: input.nameOf,
  });
  const db = ensured.db;

  const panelsBefore = await fetchAttributeViews(input.docId);
  if (
    panelsBefore.length === 1
    && panelsBefore[0]?.avID === db.avID
  ) {
    return { kind: "already", db, addedColumns: [] };
  }

  // Mutex scoping: only unbind tables that belong to OUR catalog —
  // the user's native bindings on the document must survive the join.
  const catalog = await loadPanelSettings(pluginDataStore(input.plugin));
  await migrateDocumentToOwnedDatabase({
    docId: input.docId,
    target: db,
    ownedAvIDs: catalog.ownedDatabases.map((d) => d.avID),
  });

  let addedColumns: string[] = [];
  try {
    const cols = await ensureOwnedDatabaseTemplateColumns(db);
    addedColumns = cols.added;
  } catch (e) {
    console.warn("ensureOwnedDatabaseTemplateColumns failed", e);
  }

  const store = pluginDataStore(input.plugin);
  const settings = await loadPanelSettings(store);
  const next = normalizePanelSettings({
    ...settings,
    ownedDatabases: [
      ...settings.ownedDatabases.filter((d) => d.avID !== db.avID),
      db,
    ],
    ownedDbLastAvID: db.avID,
    showUnderTitlePanel: false,
  });
  await savePanelSettings(store, next);
  emitSettingsChanged();
  await refreshDocumentEditor(input.docId, input.plugin);

  return { kind: ensured.created ? "created" : "bound", db, addedColumns };
}


/**
 * Create a fresh document titled `title` and file it into `db` (row = doc).
 * Notebook is resolved from the table's home doc (blocks.box). Exclusive
 * migrate + column backfill + editor refresh, mirroring joinTableByKey.
 */
export async function createDocIntoTable(input: {
  plugin?: Plugin;
  db: Pick<OwnedDatabase, "avID" | "avBlockID" | "homeDocId">;
  title: string;
  /** Optional markdown body written into the new document. */
  markdown?: string;
  ownedAvIDs?: readonly string[];
}): Promise<{ docId: string }> {
  const title = input.title.trim();
  if (!title) {
    throw new Error("请输入新文档标题");
  }
  if (!input.db.homeDocId) {
    throw new Error("无法确定该表格的存放笔记本（表格缺少宿主文档）");
  }
  const query = assertSiyuanData<Array<{ box?: string }>>(
    await fetchSyncPost("/api/query/sql", {
      stmt: `SELECT box, root_id FROM blocks WHERE id = '${input.db.homeDocId}'`,
    }),
    "Failed to resolve table notebook",
  );
  const notebook = query?.[0]?.box;
  if (!notebook) {
    throw new Error("无法确定该表格的存放笔记本，请先在表格列表里「打开」一次该表格");
  }
  const created = assertSiyuanData<string>(
    await fetchSyncPost("/api/filetree/createDocWithMd", {
      notebook,
      path: `/${title}`,
      markdown: input.markdown ?? "",
    }),
    "Failed to create document",
  );
  if (!created) {
    throw new Error("创建文档失败，请重试");
  }
  await migrateDocumentToOwnedDatabase({
    docId: created,
    target: input.db as OwnedDatabase,
    ownedAvIDs: input.ownedAvIDs,
  });
  try {
    await ensureOwnedDatabaseTemplateColumns(input.db as OwnedDatabase);
  } catch (e) {
    console.warn("createDocIntoTable: ensure columns failed", e);
  }
  try {
    await refreshDocumentEditor(created, input.plugin);
  } catch (e) {
    console.warn("createDocIntoTable: refresh failed", e);
  }
  return { docId: created };
}
import { fetchSyncPost, openTab } from "siyuan";
import type { Plugin } from "siyuan";
import type { OwnedDatabase } from "@/models/ownedDatabase";
import {
  normalizeAttributeViewSearchResults,
  type AttributeViewSearchHit,
} from "@/models/ownedDatabase";
import {
  attributeViewBlockDom,
  buildEmptyAttributeViewJson,
  newSiYuanID,
} from "@/models/ownedDatabaseCreate";
import {
  DEFAULT_TABLE_TEMPLATES,
  getDatabaseType,
  getTableTemplate,
  normalizeDatabaseTypeId,
  type DatabaseTypeId,
  type DatabaseTypeColumn,
  type TableTemplate,
} from "@/models/databaseTypes";
import {
  normalizePanelSettings,
  type PanelSettings,
} from "@/models/settings";
import { missingTemplateColumns } from "@/models/ownedDatabaseHang";
import {
  loadPanelSettings,
  savePanelSettings,
  type PluginDataStore,
} from "@/services/settings";
import { emitSettingsChanged } from "@/services/settingEvents";
import { assertSiyuanData, SiyuanApiError } from "./siyuanResponse";

export async function searchWorkspaceDatabases(keyword = ""): Promise<AttributeViewSearchHit[]> {
  const data = assertSiyuanData<unknown>(
    await fetchSyncPost("/api/av/searchAttributeView", {
      keyword,
      includeViewMatches: false,
    }),
    "Failed to search databases",
  );
  return normalizeAttributeViewSearchResults(data);
}

export function ownedFromSearchHit(
  hit: AttributeViewSearchHit,
  nameOverride?: string,
): OwnedDatabase {
  return {
    id: hit.avID,
    name: (nameOverride?.trim() || hit.avName || hit.avID).trim(),
    avID: hit.avID,
    avBlockID: hit.blockID,
    source: "collected",
    createdAt: Date.now(),
  };
}

export interface NotebookInfo {
  id: string;
  name: string;
}

export async function listNotebooks(): Promise<NotebookInfo[]> {
  const data = assertSiyuanData<{ notebooks?: unknown }>(
    await fetchSyncPost("/api/notebook/lsNotebooks", {}),
    "Failed to list notebooks",
  );
  const notebooks = Array.isArray(data.notebooks) ? data.notebooks : [];
  return notebooks.flatMap((item) => {
    if (typeof item !== "object" || item === null) return [];
    const row = item as Record<string, unknown>;
    const id = typeof row.id === "string" ? row.id : "";
    const name = typeof row.name === "string" ? row.name : id;
    return id ? [{ id, name }] : [];
  });
}

/**
 * Create a home document for a new database.
 */
export async function createDatabaseHomeDoc(input: {
  notebookId: string;
  name: string;
}): Promise<string> {
  const name = input.name.trim() || "未命名库";
  const path = `/${name}`;
  const markdown = `# ${name}\n\n`;
  const docId = assertSiyuanData<string>(
    await fetchSyncPost("/api/filetree/createDocWithMd", {
      notebook: input.notebookId,
      path,
      markdown,
    }),
    "Failed to create database home document",
  );
  return docId;
}

export async function openDocument(docId: string, plugin?: Plugin): Promise<void> {
  // Prefer host openTab — /api/filetree/openDoc often returns an empty body and
  // fetchSyncPost then throws "Unexpected end of JSON input".
  if (plugin?.app) {
    await openTab({
      app: plugin.app,
      doc: { id: docId },
    });
    return;
  }
  const response = await fetch("/api/filetree/openDoc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: docId }),
  });
  const text = await response.text();
  if (!text.trim()) return;
  const parsed = JSON.parse(text) as { code?: number; msg?: string };
  if (parsed.code !== 0) {
    throw new SiyuanApiError(parsed.msg || "Failed to open document", parsed.code ?? -1);
  }
}

/**
 * Write AV JSON via putFile without Response.json() — empty bodies are tolerated,
 * then we verify with getAttributeView.
 */
export async function putAttributeViewFile(
  avID: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
  const file = new File([blob], `${avID}.json`, { type: "application/json" });
  const form = new FormData();
  form.append("path", `/data/storage/av/${avID}.json`);
  form.append("isDir", "false");
  form.append("modTime", String(Math.floor(Date.now() / 1000)));
  form.append("file", file);

  const response = await fetch("/api/file/putFile", {
    method: "POST",
    body: form,
  });
  const text = await response.text();
  if (text.trim()) {
    let parsed: { code?: number; msg?: string };
    try {
      parsed = JSON.parse(text) as { code?: number; msg?: string };
    } catch {
      throw new SiyuanApiError(`写入数据库文件失败：${text.slice(0, 120)}`);
    }
    if (parsed.code !== 0) {
      throw new SiyuanApiError(parsed.msg || "写入数据库文件失败", parsed.code ?? -1);
    }
  } else if (!response.ok) {
    throw new SiyuanApiError(`写入数据库文件失败：HTTP ${response.status}`);
  }

  const check = await fetchSyncPost("/api/av/getAttributeView", { id: avID });
  if (check?.code !== 0 || check.data == null) {
    throw new SiyuanApiError(check?.msg || "数据库文件写入后无法读取，请重试", check?.code ?? -1);
  }
}

/** Home-doc ids are SiYuan node ids: `YYYYMMDDHHmmss-xxxxxxx` (local time). */
function docIdCreatedAt(docId: string): number | undefined {
  const match = /^(\d{14})-[0-9a-z]{7}$/i.exec(docId);
  if (!match) return undefined;
  const stamp = match[1]!;
  const iso = `${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}`
    + `T${stamp.slice(8, 10)}:${stamp.slice(10, 12)}:${stamp.slice(12, 14)}`;
  const time = Date.parse(iso);
  return Number.isFinite(time) ? time : undefined;
}

/**
 * The AV block must land in the table's OWN home doc. Old kernels return an
 * EXISTING same-named document from createDocWithMd instead of creating one;
 * appending the block there would nest it inside a foreign table's home doc.
 * The fresh doc's id embeds its creation timestamp — verify it, fail loudly
 * on collision.
 */
function assertFreshHomeDoc(docId: string, name: string): void {
  const createdAt = docIdCreatedAt(docId);
  if (createdAt === undefined) return; // unknown id shape — best effort
  if (Math.abs(Date.now() - createdAt) <= 10 * 60 * 1000) return;
  throw new SiyuanApiError(
    `已存在同名文档「${name}」，无法为它单独建库（否则数据库块会嵌进别人的文档）。请换一个表格名称。`,
  );
}

/**
 * Create the per-call duplicate source. The seed carries an EMPTY AV name:
 * kernel `DuplicateDatabaseBlock` appends " (Duplicated ts)" ONLY when the
 * name is non-empty, so an empty name duplicates to an empty name — no
 * suffix, and no stale kernel-cache name leaking into the copy. The final
 * table name rides on the primary block key and is stamped onto the copy
 * immediately after duplication, BEFORE column writes (see createOwnedDatabase:
 * the rename merges the on-disk JSON, so it must never run after the kernel
 * has added columns — a stale read would drop them from the file).
 */
async function createSeedAttributeView(keyName: string): Promise<string> {
  const avID = newSiYuanID();
  await putAttributeViewFile(avID, buildEmptyAttributeViewJson({ avID, name: "", keyName }));
  return avID;
}

async function duplicateAttributeViewBlock(avID: string): Promise<{ avID: string; blockID: string }> {
  const data = assertSiyuanData<{ avID?: string; blockID?: string }>(
    await fetchSyncPost("/api/av/duplicateAttributeViewBlock", { avID }),
    "Failed to duplicate database",
  );
  if (!data.avID || !data.blockID) {
    throw new SiyuanApiError("duplicateAttributeViewBlock returned incomplete data");
  }
  return { avID: data.avID, blockID: data.blockID };
}

async function appendAttributeViewBlock(input: {
  parentID: string;
  avID: string;
  blockID: string;
}): Promise<void> {
  assertSiyuanData(
    await fetchSyncPost("/api/block/appendBlock", {
      dataType: "dom",
      data: attributeViewBlockDom(input.avID, input.blockID),
      parentID: input.parentID,
    }),
    "Failed to insert database block",
  );
}

/**
 * Stamp the final table name onto an AV: read the FULL live JSON, merge the
 * name, putFile, then verify by reading back — retry once on mismatch and
 * warn (never throw) if the kernel cache keeps serving the old name. The
 * periodic self-heal (syncOwnedDatabaseNames) reconciles the rest.
 */
/** Read the AV JSON from DISK (/data/storage/av/<avID>.json). The kernel's
 * getAttributeView serves an in-memory parse that can lag behind disk writes
 * made behind its back (duplicate/putFile), so rename merges must read disk. */
export async function readAttributeViewFile(
  avID: string,
): Promise<Record<string, unknown> | undefined> {
  const response = await fetchSyncPost("/api/file/getFile", {
    path: `/data/storage/av/${avID}.json`,
  });
  if (!response || typeof response !== "object") return undefined;
  // The kernel serves getFile as the RAW file body (no {code,msg,data}
  // envelope), so fetchSyncPost hands back the parsed file object itself;
  // older wrappers deliver an envelope whose data is the file text. Both.
  const asEnvelope = response as { code?: unknown; data?: unknown };
  if (typeof asEnvelope.data === "string" && asEnvelope.data.trim()) {
    try {
      const parsed = JSON.parse(asEnvelope.data) as unknown;
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : undefined;
    } catch {
      return undefined;
    }
  }
  const looksLikeFile =
    asEnvelope.data === undefined
    && asEnvelope.code === undefined
    && ("keyValues" in response || "views" in response || "keyIDs" in response);
  return looksLikeFile ? (response as Record<string, unknown>) : undefined;
}

export async function renameAttributeView(avID: string, name: string): Promise<void> {
  const trimmed = name.trim() || "未命名库";
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const av = await readAttributeViewFile(avID);
    if (!av) {
      throw new SiyuanApiError("Failed to read database for rename");
    }
    await putAttributeViewFile(avID, { ...av, name: trimmed });
    const checkAv = await readAttributeViewFile(avID);
    if (checkAv && (checkAv as { name?: unknown }).name === trimmed) return;
  }
  // Non-fatal: catalog still stores the intended name
  console.warn("renameAttributeView: name may not have persisted for", avID);
}

async function setAttributeViewKeyOptions(
  avID: string,
  keyID: string,
  options: Array<{ name: string; color?: string }>,
): Promise<void> {
  const response = await fetchSyncPost("/api/av/getAttributeView", { id: avID });
  const root = response?.data;
  if (response?.code !== 0 || !root || typeof root !== "object") {
    throw new SiyuanApiError(response?.msg || "Failed to read database for options");
  }
  const av = (root as { av?: Record<string, unknown> }).av;
  if (!av || typeof av !== "object") {
    throw new SiyuanApiError("Failed to read database for options");
  }
  const keyValues = Array.isArray(av.keyValues) ? av.keyValues : [];
  let found = false;
  for (const entry of keyValues) {
    if (!entry || typeof entry !== "object") continue;
    const key = (entry as { key?: Record<string, unknown> }).key;
    if (!key || key.id !== keyID) continue;
    key.options = options.map((o, i) => ({
      name: o.name,
      color: o.color || String((i % 7) + 1),
    }));
    found = true;
    break;
  }
  if (!found) {
    throw new SiyuanApiError(`Column ${keyID} not found when setting options`);
  }
  await putAttributeViewFile(avID, { ...av });
}

async function addTemplateColumns(
  avID: string,
  blockID: string,
  columns: readonly DatabaseTypeColumn[],
): Promise<void> {
  for (const col of columns) {
    const keyID = newSiYuanID();
    const response = await fetchSyncPost("/api/av/addAttributeViewKey", {
      avID,
      blockID,
      keyID,
      keyName: col.name,
      keyType: col.type,
      keyIcon: "",
      previousKeyID: "",
    });
    if (response?.code !== 0) {
      throw new SiyuanApiError(response?.msg || `Failed to add column ${col.name}`, response?.code ?? -1);
    }
    if (col.options?.length) {
      await setAttributeViewKeyOptions(avID, keyID, col.options);
    }
  }
}

function readExistingKeyNames(av: Record<string, unknown>): string[] {
  const keyValues = Array.isArray(av.keyValues) ? av.keyValues : [];
  const names: string[] = [];
  for (const entry of keyValues) {
    if (!entry || typeof entry !== "object") continue;
    const key = (entry as { key?: { name?: unknown } }).key;
    if (typeof key?.name === "string" && key.name.trim()) names.push(key.name);
  }
  return names;
}

/**
 * Add any missing template columns to an existing owned database.
 * Prefers the table template (db.templateKey) and falls back to the legacy
 * business-type template. Safe to call repeatedly (idempotent by column name).
 */
export async function ensureOwnedDatabaseTemplateColumns(
  db: OwnedDatabase,
): Promise<{ added: string[] }> {
  const template = db.templateKey ? getTableTemplate(db.templateKey) : undefined;
  const columns = template?.columns ?? getDatabaseType(db.typeId).columns;
  const response = await fetchSyncPost("/api/av/getAttributeView", { id: db.avID });
  const av = (response?.data as { av?: Record<string, unknown> } | undefined)?.av;
  if (response?.code !== 0 || !av) {
    throw new SiyuanApiError(response?.msg || "Failed to read database for columns");
  }
  const missing = missingTemplateColumns(readExistingKeyNames(av), columns);
  if (!missing.length) return { added: [] };
  await addTemplateColumns(db.avID, db.avBlockID, missing);
  return { added: missing.map((c) => c.name) };
}

async function assertMirrorRegistered(avID: string): Promise<void> {
  const response = await fetchSyncPost("/api/av/getMirrorDatabaseBlocks", { avID });
  const data = response?.data as { refDefs?: unknown[] } | null | undefined;
  const refs = Array.isArray(data?.refDefs) ? data.refDefs : [];
  if (response?.code !== 0 || refs.length < 1) {
    throw new SiyuanApiError(
      "数据库块未正确登记到思源（镜像关系缺失），文档标题下将无法显示属性。请重试创建。",
    );
  }
}

/**
 * Create a plugin-managed table via SiYuan’s official duplicate path
 * (registers mirror block rel so under-title attributes work).
 *
 * Pipeline (per call — no shared state between creations):
 * 1. home doc named exactly like the table;
 * 2. fresh per-call seed AV with an EMPTY name (kernel duplicates empty
 *    names verbatim — no " (Duplicated …)" suffix, no stale-cache leak);
 * 3. duplicate, append the copy's block INTO the new home doc, mirror-check,
 *    add template columns;
 * 4. as the ABSOLUTE LAST step, stamp the final table name onto the copy
 *    (read-merge-putFile, verify + one retry, warn only).
 *
 * - `templateKey`: build from a default table template (tasks/projects/inbox).
 * - `columns`: explicit column list (e.g. the blank “备注” starter).
 * - `typeId`: legacy compat only — ignored once templateKey/columns are given.
 */
export async function createOwnedDatabase(input: {
  notebookId: string;
  name: string;
  templateKey?: string;
  columns?: DatabaseTypeColumn[];
  typeId?: DatabaseTypeId | string;
}): Promise<OwnedDatabase> {
  const name = input.name.trim() || "未命名库";
  if (!input.notebookId) {
    throw new Error("notebookId is required");
  }
  const template = input.templateKey ? getTableTemplate(input.templateKey) : undefined;
  if (input.templateKey && !template) {
    throw new Error(`Unknown table template: ${input.templateKey}`);
  }
  const typeId = normalizeDatabaseTypeId(input.typeId);
  const columns: readonly DatabaseTypeColumn[] = input.columns?.length
    ? input.columns
    : (template?.columns ?? getDatabaseType(typeId).columns);

  // Host docs live in the storage notebook, named after the table itself.
  const homeDocId = await createDatabaseHomeDoc({
    notebookId: input.notebookId,
    name,
  });
  assertFreshHomeDoc(homeDocId, name);

  const seedID = await createSeedAttributeView(name);
  const { avID, blockID: avBlockID } = await duplicateAttributeViewBlock(seedID);

  // Stamp the final name IMMEDIATELY after duplication, before any column
  // writes: the rename merges the on-disk JSON, and at this point the file
  // only holds the primary key + view, so there is nothing to clobber. The
  // kernel's own column writes afterwards flush to disk safely (non-fatal).
  try {
    await renameAttributeView(avID, name);
  } catch (e) {
    console.warn("createOwnedDatabase: name stamp failed (catalog keeps the intended name)", e);
  }

  await appendAttributeViewBlock({ parentID: homeDocId, avID, blockID: avBlockID });
  await assertMirrorRegistered(avID);
  await addTemplateColumns(avID, avBlockID, columns);

  return {
    id: avID,
    name,
    avID,
    avBlockID,
    homeDocId,
    source: "managed",
    ...(template ? { templateKey: template.key } : { typeId }),
    createdAt: Date.now(),
  };
}

export type OwnedDatabaseHealth = "ok" | "broken" | "missing";

/**
 * Health = can the AV JSON still be read off disk. The kernel's
 * getMirrorDatabaseBlocks returns `refDefs: []` for EVERYTHING on 3.8.4 —
 * including long-established in-use databases — so it is NOT a valid health
 * primitive and is never consulted here. "broken" stays in the type for UI
 * compatibility but is no longer produced.
 */
export async function checkOwnedDatabaseHealth(avID: string): Promise<OwnedDatabaseHealth> {
  try {
    const av = await readAttributeViewFile(avID);
    return av ? "ok" : "missing";
  } catch {
    return "missing";
  }
}

export async function checkOwnedDatabasesHealth(
  databases: OwnedDatabase[],
): Promise<Record<string, OwnedDatabaseHealth>> {
  const entries = await Promise.all(
    databases.map(async (db) => [db.avID, await checkOwnedDatabaseHealth(db.avID)] as const),
  );
  return Object.fromEntries(entries);
}

/**
 * Self-heal database display names against the catalog. Tables created by
 * older plugin versions carry " (Duplicated …)" suffixes, and the kernel's
 * in-memory AV cache can resurrect empty names over a putFile'd rename. For
 * each db: read the live AV JSON; when its name is empty or still a
 * Duplicated leftover while the catalog knows a real name, putFile the
 * merged JSON with the catalog name. User renames (any other non-empty
 * name) are respected. Never throws — failures are logged.
 */
export async function syncOwnedDatabaseNames(dbs: OwnedDatabase[]): Promise<void> {
  for (const db of Array.isArray(dbs) ? dbs : []) {
    const wanted = (db?.name || "").trim();
    if (!wanted || !db.avID) continue;
    try {
      const av = await readAttributeViewFile(db.avID);
      if (!av) continue;
      const current = typeof av.name === "string" ? av.name.trim() : "";
      const stale = current === "" || current.includes(" (Duplicated ");
      if (!stale || current === wanted) continue;
      await putAttributeViewFile(db.avID, { ...av, name: wanted });
    } catch (e) {
      console.warn("syncOwnedDatabaseNames: failed for", db.avID, e);
    }
  }
}

/** Collect attribute-view blocks from the active editor DOM (no ID typing). */
export function findAttributeViewsInActiveEditor(): Array<{
  avID: string;
  avBlockID: string;
  name: string;
}> {
  const root = document.querySelector(".protyle:not(.fn__none)") ?? document;
  const nodes = root.querySelectorAll<HTMLElement>(
    '[data-type="NodeAttributeView"], [data-av-id], .av[data-id]',
  );
  const out: Array<{ avID: string; avBlockID: string; name: string }> = [];
  const seen = new Set<string>();

  nodes.forEach((el) => {
    const avID =
      el.getAttribute("data-av-id")
      || el.getAttribute("data-avid")
      || el.dataset.avId
      || "";
    const avBlockID = el.getAttribute("data-node-id") || el.getAttribute("data-id") || "";
    if (!avID || !avBlockID || seen.has(avID)) return;
    seen.add(avID);
    const title =
      el.querySelector(".av__title, .av__header .fn__flex-1")?.textContent?.trim()
      || "";
    out.push({ avID, avBlockID, name: title || avID });
  });

  return out;
}

export function getActiveDocumentId(): string {
  const title = document.querySelector(
    ".protyle:not(.fn__none) .protyle-title[data-node-id]",
  );
  return title?.getAttribute("data-node-id") ?? "";
}

/** Notebook (box) id for the active document, if available. */
export async function getActiveNotebookId(): Promise<string> {
  const docId = getActiveDocumentId();
  if (!docId) return "";
  try {
    const data = assertSiyuanData<{ box?: string }>(
      await fetchSyncPost("/api/block/getBlockInfo", { id: docId }),
      "Failed to resolve notebook",
    );
    return typeof data.box === "string" ? data.box : "";
  } catch {
    return "";
  }
}

export function pickCreateNotebookId(input: {
  activeNotebookId?: string;
  savedNotebookId?: string;
  notebooks: NotebookInfo[];
}): string {
  const ids = new Set(input.notebooks.map((n) => n.id));
  if (input.activeNotebookId && ids.has(input.activeNotebookId)) {
    return input.activeNotebookId;
  }
  if (input.savedNotebookId && ids.has(input.savedNotebookId)) {
    return input.savedNotebookId;
  }
  return input.notebooks[0]?.id ?? "";
}

function pluginDataStore(plugin: Plugin): PluginDataStore {
  return {
    loadData: (key: string) => plugin.loadData(key),
    saveData: (key: string, value: unknown) => plugin.saveData(key, value),
  };
}

type CreateOwnedDatabaseFn = typeof createOwnedDatabase;

function templateDisplayName(
  template: TableTemplate,
  nameOf?: (t: TableTemplate) => string,
): string {
  return (nameOf?.(template) ?? "").trim() || template.nameFallback;
}

async function resolveCreateNotebookId(input: {
  notebookId?: string;
  settings?: PanelSettings;
}): Promise<string> {
  if (input.notebookId) return input.notebookId;
  const notebooks = await listNotebooks();
  const activeNotebookId = await getActiveNotebookId();
  const savedNotebookId = input.settings?.ownedDbNotebookId ?? "";
  return pickCreateNotebookId({ activeNotebookId, savedNotebookId, notebooks });
}

/**
 * Persist a freshly created table into the settings catalog
 * (same shape as persistCreatedAsPrimary, minus the primary-by-type write).
 * Re-reads the catalog FRESH right before merging: kernel ops take seconds,
 * and another write path (Dock, a parallel ensure) may have added entries in
 * the meantime — the stale snapshot must never be written back over them.
 */
async function persistCreatedTable(input: {
  plugin: Plugin;
  db: OwnedDatabase;
  notebookId: string;
}): Promise<void> {
  const store = pluginDataStore(input.plugin);
  const fresh = await loadPanelSettings(store);
  const next = normalizePanelSettings({
    ...fresh,
    ownedDatabases: [
      ...fresh.ownedDatabases.filter((d) => d.avID !== input.db.avID),
      input.db,
    ],
    ownedDbNotebookId: input.notebookId || fresh.ownedDbNotebookId,
    ownedDbLastAvID: input.db.avID,
    showUnderTitlePanel: false,
  });
  await savePanelSettings(store, next);
  emitSettingsChanged();
}

/** In-flight creations per templateKey — concurrent ensures share one run. */
const ensureInFlight = new Map<string, Promise<{ db: OwnedDatabase; created: boolean }>>();

/**
 * Find a healthy owned db created from the given table template; create it
 * when missing (or when every candidate is unhealthy) and register it in the
 * settings catalog. Idempotent per templateKey.
 *
 * In-flight mutex: two overlapping calls for the SAME templateKey (double
 * click, dock + settings page racing) share one creation instead of each
 * creating its own table. Sequential calls are independent — by then the
 * first table is in the catalog (persistCreatedTable re-reads it) and is
 * reused.
 */
export async function ensureTableForTemplateKey(input: {
  plugin?: Plugin;
  templateKey: string;
  notebookId?: string;
  nameOf?: (t: TableTemplate) => string;
  /** Injectable create seam (tests). Defaults to createOwnedDatabase. */
  create?: CreateOwnedDatabaseFn;
}): Promise<{ db: OwnedDatabase; created: boolean }> {
  const template = getTableTemplate(input.templateKey);
  if (!template) {
    throw new Error(`Unknown table template: ${input.templateKey}`);
  }
  const inFlight = ensureInFlight.get(template.key);
  if (inFlight) return inFlight;

  const run = (async (): Promise<{ db: OwnedDatabase; created: boolean }> => {
    const create = input.create ?? createOwnedDatabase;

    let settings: PanelSettings | undefined;
    if (input.plugin) {
      settings = await loadPanelSettings(pluginDataStore(input.plugin));
      const candidates = settings.ownedDatabases.filter(
        (d) => d.templateKey === template.key,
      );
      if (candidates.length) {
        const health = await checkOwnedDatabasesHealth(candidates);
        const healthy = candidates.find((d) => health[d.avID] === "ok");
        if (healthy) return { db: healthy, created: false };
      }
    }

    const name = templateDisplayName(template, input.nameOf);
    const notebookId = await resolveCreateNotebookId({
      notebookId: input.notebookId,
      settings,
    });
    const db = await create({ notebookId, name, templateKey: template.key });

    if (input.plugin) {
      await persistCreatedTable({ plugin: input.plugin, db, notebookId });
    }
    return { db, created: true };
  })();

  ensureInFlight.set(template.key, run);
  try {
    return await run;
  } finally {
    ensureInFlight.delete(template.key);
  }
}

/**
 * One-click “生成默认表格”: create every default template that does not have a
 * healthy db yet. Idempotent — missing keys only.
 */
export async function generateDefaultTables(input: {
  plugin?: Plugin;
  notebookId?: string;
  nameOf?: (t: TableTemplate) => string;
  /** Injectable create seam (tests). Defaults to createOwnedDatabase. */
  create?: CreateOwnedDatabaseFn;
}): Promise<{ created: OwnedDatabase[]; skipped: number }> {
  const created: OwnedDatabase[] = [];
  let skipped = 0;
  for (const template of DEFAULT_TABLE_TEMPLATES) {
    const result = await ensureTableForTemplateKey({
      ...input,
      templateKey: template.key,
    });
    if (result.created) created.push(result.db);
    else skipped += 1;
  }
  return { created, skipped };
}

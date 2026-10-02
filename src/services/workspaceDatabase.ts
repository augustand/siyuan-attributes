import { fetchSyncPost } from "siyuan";
import type { AttributeViewSearchHit, OwnedDatabase } from "@/models/ownedDatabase";
import {
  checkOwnedDatabaseHealth,
  searchWorkspaceDatabases,
} from "@/services/ownedDatabase";

/** Directory that physically stores one JSON file per attribute view. */
const AV_DIR = "/data/storage/av";

/** /api/query/sql asks for root_id in id batches of this size. */
const SQL_CHUNK = 50;

export type WorkspaceDbOrigin = "managed" | "collected" | "active" | "unreferenced";
export type WorkspaceDbHealth = "ok" | "broken" | "missing";

export interface WorkspaceDatabaseEntry {
  avID: string;
  /** Catalog name for managed/collected (authoritative); search name otherwise, "" when unknown. */
  name: string;
  /** Host document path — present when the database was found via searchAttributeView. */
  hostPath?: string;
  origin: WorkspaceDbOrigin;
  health: WorkspaceDbHealth;
  /** AV block id when known (catalog avBlockID or search hit) — adoption needs it. */
  blockID?: string;
  /** Host document id, resolved from a search-hit blockID via /api/query/sql (root_id). */
  hostDocID?: string;
}

async function listAvDirIDs(): Promise<string[]> {
  try {
    const response = await fetchSyncPost("/api/file/readDir", { path: AV_DIR });
    const data = response?.data;
    if (!Array.isArray(data)) return [];
    const ids: string[] = [];
    for (const entry of data) {
      if (typeof entry !== "object" || entry === null) continue;
      const row = entry as { name?: unknown; isDir?: unknown };
      if (row.isDir === true) continue;
      const name = typeof row.name === "string" ? row.name : "";
      if (!name.toLowerCase().endsWith(".json")) continue;
      const id = name.slice(0, -".json".length).trim();
      if (id) ids.push(id);
    }
    return ids;
  } catch {
    return [];
  }
}

const ORIGIN_RANK: Record<WorkspaceDbOrigin, number> = {
  managed: 0,
  collected: 1,
  active: 2,
  unreferenced: 3,
};

/** Escape a value for a SQL single-quoted literal (SiYuan IDs never contain quotes; defensive). */
function sqlLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/**
 * blockID → root_id (host document id) via /api/query/sql, batches of 50.
 * Blocks missing from the index simply have no row → no host. Any failure
 * (endpoint error, throw) degrades to an empty map so the listing never
 * breaks; entries then just have no hostDocID.
 */
async function fetchHostDocIDs(blockIDs: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (let i = 0; i < blockIDs.length; i += SQL_CHUNK) {
    const chunk = blockIDs.slice(i, i + SQL_CHUNK);
    try {
      const response = await fetchSyncPost("/api/query/sql", {
        stmt: `SELECT id, root_id FROM blocks WHERE id IN (${chunk.map(sqlLiteral).join(",")})`,
      });
      const rows = response?.data;
      if (!Array.isArray(rows)) continue;
      for (const row of rows) {
        if (typeof row !== "object" || row === null) continue;
        const rec = row as Record<string, unknown>;
        const id = typeof rec.id === "string" ? rec.id : "";
        const rootID = typeof rec.root_id === "string" ? rec.root_id : "";
        if (id && rootID) map.set(id, rootID);
      }
    } catch {
      // Degrade silently — hostDocID is an enhancement, not a requirement.
    }
  }
  return map;
}

/**
 * Delete ONE database completely — documents are irrelevant ("我们只管理数
 * 据库"): (a) when the embedded block is known, delete it from its document
 * (/api/block/deleteBlock); ANY failure there (tree not found, network, …) is
 * ignored and the flow continues; (b) delete the AV data file itself
 * (/api/file/removeFile /data/storage/av/<avID>.json) — this bypasses the
 * kernel's broken unused-check (on 3.8.6 /api/av/removeUnusedAttributeView
 * refuses EVERYTHING and getUnusedAttributeViews returns []). code 0 is
 * success AND code 404 ("path does not exist") is success (already gone);
 * anything else throws with the kernel message.
 *
 * Both calls use raw fetch (not fetchSyncPost): the app-provided fetchSyncPost
 * toasts kernel errors on its own, which would flood the UI during batch
 * deletes.
 */
export async function removeDatabaseCompletely(entry: {
  avID: string;
  blockID?: string;
}): Promise<"deleted"> {
  if (entry.blockID) {
    try {
      await fetch("/api/block/deleteBlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: entry.blockID }),
      });
    } catch (e) {
      console.warn("removeDatabaseCompletely: deleteBlock failed (ignored)", entry.avID, e);
    }
  }

  const response = await fetch("/api/file/removeFile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: `${AV_DIR}/${entry.avID}.json` }),
  });
  const text = await response.text();
  let parsed: { code?: number; msg?: string };
  try {
    parsed = JSON.parse(text) as { code?: number; msg?: string };
  } catch {
    throw new Error(`removeDatabaseCompletely: non-JSON ${response.status}: ${text.slice(0, 120)}`);
  }
  if (parsed.code === 0 || parsed.code === 404) return "deleted";
  throw new Error(parsed.msg || `Failed to remove database ${entry.avID}`);
}

/**
 * Enumerate EVERY attribute view in the workspace (read-only):
 *   ids = readDir(/data/storage/av) ∪ searchAttributeView("") ∪ catalog
 *
 * Classification precedence (kernel 3.8.6 — getUnusedAttributeViews returns
 * [] ALWAYS there and is DEAD as a primitive; getMirrorDatabaseBlocks returns
 * refDefs: [] for every database and is never consulted):
 *   1. catalog hit → managed/collected (catalog name authoritative; health
 *      = AV file readability via getFile)
 *   2. search hit → active (name/hostPath/blockID from the hit, health ok;
 *      searchAttributeView("") is COMPLETE for referenced databases — its
 *      count equals the blocks-table type='av' count)
 *   3. remaining disk ids → unreferenced: the AV file exists on disk but is
 *      in no search hit and not in the catalog (health missing per the
 *      existing `!== "ok"` consumer convention; no blockID/hostPath)
 *
 * Sort: managed, collected, active, unreferenced; within a group alphabetical
 * by name with empty names last (by avID).
 */
export async function listWorkspaceDatabases(input: {
  owned: OwnedDatabase[];
}): Promise<WorkspaceDatabaseEntry[]> {
  const owned = Array.isArray(input?.owned) ? input.owned : [];
  const catalog = new Map<string, OwnedDatabase>();
  for (const db of owned) {
    if (!db?.avID || catalog.has(db.avID)) continue;
    catalog.set(db.avID, db);
  }

  const [dirIDs, hits] = await Promise.all([
    listAvDirIDs(),
    searchWorkspaceDatabases("").catch((): AttributeViewSearchHit[] => []),
  ]);

  const ids = new Set<string>([...dirIDs, ...hits.map((h) => h.avID), ...catalog.keys()]);
  const hitByID = new Map(hits.map((h) => [h.avID, h]));

  // One disk read per catalog entry; an individual read failure (or throw)
  // degrades that entry's health only — never the whole listing.
  const catalogHealth = new Map<string, WorkspaceDbHealth>(
    (await Promise.all(
      [...catalog.keys()].map(
        async (avID) => [avID, await checkOwnedDatabaseHealth(avID)] as const,
      ),
    )),
  );

  const entries: WorkspaceDatabaseEntry[] = [];
  for (const avID of ids) {
    const hit = hitByID.get(avID);
    const db = catalog.get(avID);

    if (db) {
      // Catalog wins over everything.
      entries.push({
        avID,
        name: db.name || "",
        ...(hit?.hPath ? { hostPath: hit.hPath } : {}),
        origin: db.source === "managed" ? "managed" : "collected",
        health: catalogHealth.get(avID) ?? "missing",
        ...(db.avBlockID ? { blockID: db.avBlockID } : {}),
      });
      continue;
    }

    if (hit) {
      entries.push({
        avID,
        name: hit.avName || "",
        ...(hit.hPath ? { hostPath: hit.hPath } : {}),
        origin: "active",
        health: "ok",
        ...(hit.blockID ? { blockID: hit.blockID } : {}),
      });
      continue;
    }

    // On disk, in no search hit, not catalogued → unreferenced.
    entries.push({ avID, name: "", origin: "unreferenced", health: "missing" });
  }

  // Host docs: search-hit blockIDs → root_id, in one SQL query per 50 ids.
  // Entries whose blockID resolves (i.e. originating from those hits) gain a
  // hostDocID; everything else (unreferenced disk ids) stays without one.
  const hostDocIDs = await fetchHostDocIDs([
    ...new Set(hits.map((h) => h.blockID).filter(Boolean)),
  ]);
  const withHostDoc = (entry: WorkspaceDatabaseEntry): WorkspaceDatabaseEntry => {
    if (entry.blockID && hostDocIDs.has(entry.blockID)) {
      return { ...entry, hostDocID: hostDocIDs.get(entry.blockID) };
    }
    return entry;
  };

  return entries.map(withHostDoc).sort((a, b) => {
    const byRank = ORIGIN_RANK[a.origin] - ORIGIN_RANK[b.origin];
    if (byRank !== 0) return byRank;
    const an = a.name.trim();
    const bn = b.name.trim();
    if (!an && bn) return 1;
    if (an && !bn) return -1;
    const byName = an.localeCompare(bn, "zh");
    if (byName !== 0) return byName;
    return a.avID.localeCompare(b.avID);
  });
}

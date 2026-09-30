import type { OwnedDatabase, AttributeViewSearchHit } from "@/models/ownedDatabase";
import {
  bindDocumentToDatabase,
  fetchAttributeViews,
  unbindDocumentFromDatabase,
} from "@/services/attributeView";
import { searchWorkspaceDatabases } from "@/services/ownedDatabase";
import { fetchSyncPost } from "siyuan";
import { assertSiyuanSuccess, SiyuanApiError } from "./siyuanResponse";

/**
 * Hang a document onto one owned database exclusively.
 * Removes the doc from every other AV currently bound under the title
 * (not only those still listed in the owned catalog), then binds target.
 */
export async function migrateDocumentToOwnedDatabase(input: {
  docId: string;
  target: OwnedDatabase;
  ownedAvIDs?: readonly string[];
  currentlyBoundAvIDs?: readonly string[];
  currentlyBoundOwnedAvIDs?: readonly string[];
}): Promise<{ unboundAvIDs: string[] }> {
  let currentlyBound =
    input.currentlyBoundAvIDs ?? input.currentlyBoundOwnedAvIDs;
  if (!currentlyBound) {
    const panels = await fetchAttributeViews(input.docId);
    currentlyBound = panels.map((p) => p.avID);
  }

  const unboundAvIDs: string[] = [];
  for (const avID of currentlyBound) {
    if (avID === input.target.avID) continue;
    await unbindDocumentFromDatabase({ avID, docId: input.docId });
    unboundAvIDs.push(avID);
  }

  const already = currentlyBound.includes(input.target.avID);
  if (!already) {
    await bindDocumentToDatabase({
      avID: input.target.avID,
      avBlockID: input.target.avBlockID,
      docId: input.docId,
      viewID: input.target.viewID,
    });
  }

  return { unboundAvIDs };
}

/**
 * Strip under-title database bindings. If keepAvID is set, leave that one.
 * Always re-reads live bindings from the kernel (not Dock cache).
 */
export async function clearDocumentDatabaseBindings(input: {
  docId: string;
  keepAvID?: string;
}): Promise<{ before: number; removed: number; kept?: string }> {
  const panels = await fetchAttributeViews(input.docId);
  const before = panels.length;
  let removed = 0;
  for (const panel of panels) {
    if (input.keepAvID && panel.avID === input.keepAvID) continue;
    await unbindDocumentFromDatabase({ avID: panel.avID, docId: input.docId });
    removed += 1;
  }
  return {
    before,
    removed,
    ...(input.keepAvID ? { kept: input.keepAvID } : {}),
  };
}

/** Delete the home document that hosts a managed database (and its AV block). */
export async function deleteOwnedDatabaseHome(db: OwnedDatabase): Promise<void> {
  if (!db.homeDocId) {
    throw new SiyuanApiError("该库没有可删除的库文档（可能是导入的库，请只从名单移除）");
  }
  // Prefer by-id API when available
  const byId = await fetchSyncPost("/api/filetree/removeDocByID", {
    id: db.homeDocId,
  });
  if (byId?.code === 0) return;

  const info = await fetchSyncPost("/api/block/getBlockInfo", { id: db.homeDocId });
  const data = info?.data as { box?: string; path?: string } | undefined;
  if (info?.code === 0 && data?.box && data?.path) {
    assertSiyuanSuccess(
      await fetchSyncPost("/api/filetree/removeDoc", {
        notebook: data.box,
        path: data.path,
      }),
      "Failed to delete database home document",
    );
    return;
  }
  throw new SiyuanApiError(
    byId?.msg || info?.msg || "无法删除库文档，请到文档树手动删除",
  );
}

/**
 * AV blocks of OTHER databases physically hosted inside `docId`'s document.
 * Tables created by buggy plugin versions nested their block inside another
 * table's home doc; deleting that doc destroys those blocks (the AV JSON
 * survives, but the under-title table is gone). The remove flow uses this to
 * warn before deleting a shared home doc.
 */
export async function findForeignDatabaseBlocksInDoc(input: {
  docId: string;
  excludeAvIDs?: readonly string[];
}): Promise<AttributeViewSearchHit[]> {
  const response = await fetchSyncPost("/api/filetree/getHPathByID", { id: input.docId });
  const docHPath = typeof response?.data === "string" ? response.data : "";
  if (!docHPath) return [];
  const hits = await searchWorkspaceDatabases("");
  const excluded = new Set(input.excludeAvIDs ?? []);
  return hits.filter((hit) => hit.hPath === docHPath && !excluded.has(hit.avID));
}

export function bindingsToUnbind(input: {
  targetAvID: string;
  currentlyBoundAvIDs: readonly string[];
}): string[] {
  return input.currentlyBoundAvIDs.filter((avID) => avID !== input.targetAvID);
}

export function ownedBindingsToUnbind(input: {
  targetAvID: string;
  ownedAvIDs: readonly string[];
  currentlyBoundOwnedAvIDs: readonly string[];
}): string[] {
  return bindingsToUnbind({
    targetAvID: input.targetAvID,
    currentlyBoundAvIDs: input.currentlyBoundOwnedAvIDs,
  });
}

import { fetchSyncPost } from "siyuan";
import type { OwnedDatabase } from "@/models/ownedDatabase";
import {
  normalizeAttributeViewSearchResults,
  type AttributeViewSearchHit,
} from "@/models/ownedDatabase";
import { assertSiyuanData, assertSiyuanSuccess } from "./siyuanResponse";

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
 * Create a home document for a new database. User still inserts a native DB block once,
 * then “收藏本文档中的数据库”.
 */
export async function createDatabaseHomeDoc(input: {
  notebookId: string;
  name: string;
}): Promise<string> {
  const name = input.name.trim() || "未命名库";
  const path = `/${name}`;
  const markdown = `# ${name}\n\n> 请在下方输入 \`/\` 插入「数据库」。插入后回到「文档数据库」Dock，点击「收藏本文档中的数据库」。\n`;
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

export async function openDocument(docId: string): Promise<void> {
  assertSiyuanSuccess(
    await fetchSyncPost("/api/filetree/openDoc", { id: docId }),
    "Failed to open document",
  );
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

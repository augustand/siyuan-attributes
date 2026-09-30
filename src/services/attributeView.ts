import { fetchSyncPost } from "siyuan";
import {
  buildDatabaseCellValue,
  normalizeAttributeViews,
} from "@/models/attributeView";
import type { DatabaseField, DatabasePanel } from "@/models/attributeView";
import { assertSiyuanData, assertSiyuanSuccess } from "./siyuanResponse";

export async function fetchAttributeViews(documentID: string): Promise<DatabasePanel[]> {
  const panels = assertSiyuanData<unknown>(
    await fetchSyncPost("/api/av/getAttributeViewKeys", { id: documentID }),
    "Failed to load database attributes",
  );

  return normalizeAttributeViews(panels, documentID);
}

export async function writeDatabaseCell(input: {
  avID: string;
  field: DatabaseField;
}): Promise<void> {
  const { avID, field } = input;
  if (!field.value.itemID) {
    throw new Error(`Database field has no itemID: ${field.name}`);
  }

  assertSiyuanSuccess(
    await fetchSyncPost("/api/av/setAttributeViewBlockAttr", {
      avID,
      keyID: field.keyID,
      itemID: field.value.itemID,
      value: buildDatabaseCellValue(field, field.value),
    }),
    "Failed to save database attribute",
  );
}

export async function bindDocumentToDatabase(input: {
  avID: string;
  avBlockID: string;
  docId: string;
  viewID?: string;
}): Promise<void> {
  const body: Record<string, unknown> = {
    avID: input.avID,
    blockID: input.avBlockID,
    srcs: [{ id: input.docId, isDetached: false }],
  };
  if (input.viewID) body.viewID = input.viewID;

  assertSiyuanSuccess(
    await fetchSyncPost("/api/av/addAttributeViewBlocks", body),
    "Failed to bind document to database",
  );

  // Native under-title panel reads custom-avs; verify bind actually stuck
  // (broken mirror AVs get auto-unbound by getAttributeViewKeys).
  const keys = await fetchSyncPost("/api/av/getAttributeViewKeys", { id: input.docId });
  const panels = Array.isArray(keys?.data) ? keys.data : [];
  const bound = panels.some(
    (panel) =>
      typeof panel === "object"
      && panel !== null
      && (panel as { avID?: string }).avID === input.avID,
  );
  if (!bound) {
    throw new Error(
      "已调用绑定，但文档标题下仍读不到该库属性（常见于旧版「直接写文件」创建的库）。请删除该库后重新「新建」。",
    );
  }
}

export async function unbindDocumentFromDatabase(input: {
  avID: string;
  docId: string;
}): Promise<void> {
  assertSiyuanSuccess(
    await fetchSyncPost("/api/av/removeAttributeViewBlocks", {
      avID: input.avID,
      srcIDs: [input.docId],
    }),
    "Failed to unbind document from database",
  );
}

export interface DatabaseBoundDoc {
  id: string;
  content: string;
}

export async function listDatabaseBoundDocs(avID: string): Promise<DatabaseBoundDoc[]> {
  const data = assertSiyuanData<unknown>(
    await fetchSyncPost("/api/av/getAttributeViewPrimaryKeyValues", {
      id: avID,
    }),
    "Failed to list database documents",
  );

  const root = typeof data === "object" && data !== null ? (data as Record<string, unknown>) : {};
  let rows: unknown[] = [];
  if (Array.isArray(root.rows)) {
    rows = root.rows;
  } else if (
    typeof root.rows === "object"
    && root.rows !== null
    && Array.isArray((root.rows as Record<string, unknown>).values)
  ) {
    rows = (root.rows as Record<string, unknown>).values as unknown[];
  } else if (Array.isArray(data)) {
    rows = data;
  } else if (Array.isArray(root.blockIDs)) {
    rows = (root.blockIDs as unknown[]).map((id) => ({ id, content: String(id) }));
  }

  return rows.flatMap((row) => {
    if (typeof row === "string") return [{ id: row, content: row }];
    if (typeof row !== "object" || row === null) return [];
    const r = row as Record<string, unknown>;
    const block =
      typeof r.block === "object" && r.block !== null
        ? (r.block as Record<string, unknown>)
        : undefined;
    const id =
      typeof block?.id === "string"
        ? block.id
        : typeof r.id === "string"
          ? r.id
          : typeof r.blockID === "string"
            ? r.blockID
            : "";
    if (!id) return [];
    const content =
      typeof block?.content === "string"
        ? block.content
        : typeof r.content === "string"
          ? r.content
          : typeof r.name === "string"
            ? r.name
            : id;
    return [{ id, content }];
  });
}

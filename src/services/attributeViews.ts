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

  return normalizeAttributeViews(panels);
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

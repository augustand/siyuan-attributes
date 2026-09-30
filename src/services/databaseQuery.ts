import { fetchSyncPost } from "siyuan";
import { assertSiyuanData } from "./siyuanResponse";

export interface DatabaseQueryColumn {
  keyID: string;
  name: string;
  type: string;
}

export interface DatabaseQueryCell {
  text: string;
  isEmpty: boolean;
}

export interface DatabaseQueryRow {
  docID: string;
  primaryText: string;
  cells: Record<string, DatabaseQueryCell>;
}

export type QueryOp = "equals" | "contains" | "isEmpty";

/**
 * Loads column definitions and row data of one attribute view for the docs
 * dialog filter. Tolerant by design: missing or malformed fields are skipped,
 * never thrown; an absent table yields empty columns/rows so the caller can
 * fall back to the legacy bound-docs list.
 */
export async function fetchDatabaseQueryData(
  avID: string,
): Promise<{ columns: DatabaseQueryColumn[]; rows: DatabaseQueryRow[] }> {
  const data = assertSiyuanData<unknown>(
    await fetchSyncPost("/api/av/renderAttributeView", { id: avID }),
    "Failed to load database query data",
  );
  return normalizeQueryTable(data);
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

function readString(source: Record<string, unknown> | undefined, key: string): string {
  const value = source?.[key];
  return typeof value === "string" ? value : "";
}

function readArray(source: Record<string, unknown>, key: string): unknown[] {
  const value = source[key];
  return Array.isArray(value) ? value : [];
}

function extractTable(data: unknown): Record<string, unknown> | undefined {
  const root = asRecord(data);
  const av = asRecord(root?.av);
  const view = asRecord(root?.view);
  const table =
    asRecord(av?.table) ?? asRecord(view?.table) ?? asRecord(root?.table);
  if (table) return table;
  if (Array.isArray(root?.columns) || Array.isArray(root?.rows)) return root;
  return undefined;
}

function normalizeColumn(raw: unknown): DatabaseQueryColumn | undefined {
  const col = asRecord(raw);
  if (!col) return undefined;
  const keyID = readString(col, "id") || readString(col, "keyID") || readString(col, "key");
  if (!keyID) return undefined;
  return {
    keyID,
    name: readString(col, "name") || readString(col, "title"),
    type: readString(col, "type"),
  };
}

/** Option/asset fields carry content arrays instead of scalar content. */
const CELL_OPTION_KEYS = ["mSelect", "select", "asset"] as const;
const CELL_CONTENT_KEYS = [
  "block",
  "text",
  "number",
  "date",
  "url",
  "email",
  "phone",
  "template",
  "created",
  "modified",
  "checkbox",
] as const;

function joinOptionContent(list: unknown[]): string {
  return list
    .map((item) => {
      const rec = asRecord(item);
      const content = rec?.content;
      if (typeof content === "string") return content.trim();
      if (typeof content === "number") return String(content);
      return "";
    })
    .filter((part) => part !== "")
    .join(", ");
}

function readScalarContent(container: Record<string, unknown>): string {
  const content = container.content;
  if (typeof content === "string") return content;
  if (typeof content === "number") return String(content);
  return "";
}

/**
 * Folds one AV cell value (text / block / select arrays / date / number / ...)
 * into display text. Returns undefined when the value has none of the known
 * shapes — the caller then skips the cell instead of guessing.
 */
function normalizeCellValue(value: unknown): string | undefined {
  const rec = asRecord(value);
  if (!rec) return undefined;

  let sawShape = false;
  let text = "";
  let filled = false;

  for (const key of CELL_OPTION_KEYS) {
    if (rec[key] === undefined || rec[key] === null) continue;
    sawShape = true;
    if (filled) continue;
    const joined = joinOptionContent(readArray(rec, key));
    if (joined) {
      text = joined;
      filled = true;
    }
  }

  for (const key of CELL_CONTENT_KEYS) {
    const nested = asRecord(rec[key]);
    if (!nested) continue;
    sawShape = true;
    if (filled) continue;
    if (key === "number" && nested.isNotEmpty === false) continue;
    const piece = readScalarContent(nested);
    if (piece) {
      text = piece;
      filled = true;
    }
  }

  if (!sawShape && typeof rec.content === "string") {
    sawShape = true;
    text = rec.content;
  }

  return sawShape ? text : undefined;
}

function normalizeQueryTable(
  data: unknown,
): { columns: DatabaseQueryColumn[]; rows: DatabaseQueryRow[] } {
  const table = extractTable(data);
  if (!table) return { columns: [], rows: [] };

  // Keep raw positions: row cells are positional against the raw column list.
  const columnKeys = readArray(table, "columns").map(normalizeColumn);
  const columns = columnKeys.flatMap((col) => (col ? [col] : []));
  const blockKey = columns.find((col) => col.type === "block")?.keyID;

  const rows = readArray(table, "rows").flatMap((rawRow): DatabaseQueryRow[] => {
    const row = asRecord(rawRow);
    if (!row) return [];

    const cells: Record<string, DatabaseQueryCell> = {};
    const cellList = readArray(row, "cells");
    let blockID = "";
    cellList.forEach((rawCell, index) => {
      const cell = asRecord(rawCell);
      if (!cell) return;
      const valueRec = asRecord(cell.value);
      const text = normalizeCellValue(cell.value);
      if (text === undefined) return;
      const key =
        readString(valueRec, "keyID") || readString(cell, "keyID") || columnKeys[index]?.keyID || "";
      if (!key) return;
      cells[key] = { text: text.trim(), isEmpty: !text.trim() };
      const cellBlockID = readString(asRecord(valueRec?.block), "id");
      if (cellBlockID && !blockID) blockID = cellBlockID;
    });

    const docID =
      readString(row, "id") || readString(row, "docID") || readString(row, "blockID") || blockID;
    if (!docID) return [];

    const primary = blockKey ? cells[blockKey] : undefined;
    const primaryText =
      (primary && !primary.isEmpty && primary.text)
      || Object.values(cells).find((cell) => !cell.isEmpty && cell.text)?.text
      || "";

    return [{ docID, primaryText, cells }];
  });

  return { columns, rows };
}

/**
 * Client-side single-column filter. equals compares trimmed text exactly;
 * contains is case-insensitive substring; isEmpty matches a missing or empty
 * cell. equals/contains never match a missing cell.
 */
export function matchDoc(
  row: DatabaseQueryRow,
  filter: { keyID: string; op: QueryOp; value?: string },
): boolean {
  const cell = row.cells[filter.keyID];
  if (filter.op === "isEmpty") return !cell || cell.isEmpty;
  if (!cell) return false;
  const needle = (filter.value ?? "").trim();
  if (filter.op === "equals") return cell.text === needle;
  return cell.text.toLowerCase().includes(needle.toLowerCase());
}

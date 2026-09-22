export interface OwnedDatabase {
  id: string;
  /** Display name shown in “添加到数据库” */
  name: string;
  avID: string;
  avBlockID: string;
  viewID?: string;
  /** Optional home doc that hosts the database block */
  homeDocId?: string;
  createdAt: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(source: Record<string, unknown>, key: string): string {
  const value = source[key];
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeOwnedDatabase(input: unknown): OwnedDatabase | undefined {
  if (!isRecord(input)) return undefined;
  const avID = readString(input, "avID");
  const avBlockID = readString(input, "avBlockID");
  if (!avID || !avBlockID) return undefined;
  const name = readString(input, "name") || avID;
  const id = readString(input, "id") || avID;
  const viewID = readString(input, "viewID") || undefined;
  const homeDocId = readString(input, "homeDocId") || undefined;
  const createdAt =
    typeof input.createdAt === "number" && Number.isFinite(input.createdAt)
      ? input.createdAt
      : Date.now();

  return {
    id,
    name,
    avID,
    avBlockID,
    ...(viewID ? { viewID } : {}),
    ...(homeDocId ? { homeDocId } : {}),
    createdAt,
  };
}

export function normalizeOwnedDatabases(input: unknown): OwnedDatabase[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: OwnedDatabase[] = [];
  for (const item of input) {
    const db = normalizeOwnedDatabase(item);
    if (!db || seen.has(db.avID)) continue;
    seen.add(db.avID);
    out.push(db);
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, "zh"));
}

export interface AttributeViewSearchHit {
  avID: string;
  avName: string;
  blockID: string;
  hPath: string;
}

export function normalizeAttributeViewSearchResults(input: unknown): AttributeViewSearchHit[] {
  const root = isRecord(input) ? input : {};
  const results = Array.isArray(root.results) ? root.results : Array.isArray(input) ? input : [];
  const out: AttributeViewSearchHit[] = [];
  const seen = new Set<string>();

  for (const item of results) {
    if (!isRecord(item)) continue;
    const avID = readString(item, "avID");
    const blockID = readString(item, "blockID");
    if (!avID || !blockID || seen.has(avID)) continue;
    seen.add(avID);
    out.push({
      avID,
      avName: readString(item, "avName") || avID,
      blockID,
      hPath: readString(item, "hPath"),
    });
  }
  return out;
}

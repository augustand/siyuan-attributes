import type { OwnedDatabase } from "@/models/ownedDatabase";
import {
  normalizeDatabaseTypeId,
  type DatabaseTypeColumn,
  type DatabaseTypeId,
} from "@/models/databaseTypes";
import type { OwnedDatabaseHealth } from "@/services/ownedDatabase";

const TYPE_ORDER: readonly DatabaseTypeId[] = [
  "task",
  "project",
  "product",
  "generic",
];

export type HangResolution =
  | { kind: "none" }
  | { kind: "bind"; db: OwnedDatabase }
  | { kind: "pick"; databases: OwnedDatabase[] };

function toSet(ids: Set<string> | string[] | undefined): Set<string> {
  if (!ids) return new Set();
  return ids instanceof Set ? ids : new Set(ids);
}

function dbTypeId(db: OwnedDatabase): DatabaseTypeId {
  return normalizeDatabaseTypeId(db.typeId);
}

/**
 * Decide how to hang the current document onto a business database type.
 */
export function resolveHangTarget(input: {
  typeId: DatabaseTypeId;
  databases: OwnedDatabase[];
  healthyAvIDs: Set<string> | string[];
  boundAvIDs: Set<string> | string[];
  lastAvID?: string;
}): HangResolution {
  const healthy = toSet(input.healthyAvIDs);
  const bound = toSet(input.boundAvIDs);
  const candidates = input.databases.filter(
    (db) =>
      dbTypeId(db) === input.typeId
      && healthy.has(db.avID)
      && !bound.has(db.avID),
  );

  if (!candidates.length) return { kind: "none" };
  if (candidates.length === 1) return { kind: "bind", db: candidates[0]! };

  const last = input.lastAvID?.trim();
  if (last) {
    const preferred = candidates.find((db) => db.avID === last);
    if (preferred) return { kind: "bind", db: preferred };
  }

  return { kind: "pick", databases: candidates };
}

/** Group owned DBs by type; omit empty types; fixed order. */
export function groupOwnedDatabasesByType(
  databases: OwnedDatabase[],
): Array<{ typeId: DatabaseTypeId; databases: OwnedDatabase[] }> {
  const buckets = new Map<DatabaseTypeId, OwnedDatabase[]>();
  for (const id of TYPE_ORDER) buckets.set(id, []);

  for (const db of databases) {
    const id = dbTypeId(db);
    buckets.get(id)!.push(db);
  }

  return TYPE_ORDER.flatMap((typeId) => {
    const list = buckets.get(typeId) ?? [];
    if (!list.length) return [];
    return [{ typeId, databases: list }];
  });
}

/** Types that have at least one healthy DB (for hang chips). */
export function hangableTypeIds(
  databases: OwnedDatabase[],
  healthyAvIDs: Set<string> | string[],
): DatabaseTypeId[] {
  const healthy = toSet(healthyAvIDs);
  const present = new Set<DatabaseTypeId>();
  for (const db of databases) {
    if (healthy.has(db.avID)) present.add(dbTypeId(db));
  }
  return TYPE_ORDER.filter((id) => present.has(id));
}

/**
 * Pick the primary database for a business type (doctree one-click classify).
 * Prefer explicit primary → last used → sole healthy of that type → first healthy.
 */
export function pickPrimaryDatabaseForType(input: {
  typeId: DatabaseTypeId;
  databases: OwnedDatabase[];
  healthyAvIDs: Set<string> | string[];
  primaryAvID?: string;
  lastAvID?: string;
}): OwnedDatabase | undefined {
  const healthy = toSet(input.healthyAvIDs);
  const ofType = input.databases.filter(
    (db) => dbTypeId(db) === input.typeId && healthy.has(db.avID),
  );
  if (!ofType.length) return undefined;
  if (ofType.length === 1) return ofType[0];

  const primary = input.primaryAvID?.trim();
  if (primary) {
    const hit = ofType.find((db) => db.avID === primary);
    if (hit) return hit;
  }
  const last = input.lastAvID?.trim();
  if (last) {
    const hit = ofType.find((db) => db.avID === last);
    if (hit) return hit;
  }
  return ofType[0];
}

/**
 * Explicitly mark a database as the type's primary.
 * Returns a shallow copy; the input map is never mutated.
 */
export function setPrimaryForType(
  map: Record<string, string>,
  typeId: DatabaseTypeId,
  avID: string,
): Record<string, string> {
  return { ...map, [typeId]: avID };
}

/**
 * Drop the explicit primary for a type → resolution falls back to
 * "last used" semantics. Returns a shallow copy; absent keys are safe.
 */
export function clearPrimaryForType(
  map: Record<string, string>,
  typeId: DatabaseTypeId,
): Record<string, string> {
  if (!(typeId in map)) return { ...map };
  const next = { ...map };
  delete next[typeId];
  return next;
}

/** Columns from the type template that are not yet present (by name). */
export function missingTemplateColumns(
  existingKeyNames: readonly string[],
  template: readonly DatabaseTypeColumn[],
): DatabaseTypeColumn[] {
  const have = new Set(
    existingKeyNames.map((n) => n.trim()).filter(Boolean),
  );
  return template.filter((col) => !have.has(col.name.trim()));
}

export function displayOwnedDatabaseName(
  name: string | undefined,
  typeFallback: string,
  templateName?: string,
): string {
  const trimmed = (name ?? "").trim();
  if (trimmed && trimmed !== "未命名" && trimmed.toLowerCase() !== "untitled") {
    return trimmed;
  }
  const template = (templateName ?? "").trim();
  if (template) return template;
  return `${typeFallback}`;
}

export interface OwnedFilter {
  keyword?: string;
  brokenOnly?: boolean;
}

/**
 * Filter the owned-database list for the management UIs.
 * - keyword: blank = no filter; otherwise matches name or type label
 *   (case-insensitive, substring).
 * - brokenOnly: keep only databases whose health is not "ok".
 *   Absent health entries count as "ok".
 */
export function filterOwnedDatabases(
  databases: OwnedDatabase[],
  filter: OwnedFilter,
  healthMap: Record<string, OwnedDatabaseHealth>,
  typeLabelOf: (db: OwnedDatabase) => string,
): OwnedDatabase[] {
  const keyword = (filter.keyword ?? "").trim().toLowerCase();
  const brokenOnly = filter.brokenOnly === true;

  return databases.filter((db) => {
    if (brokenOnly && (healthMap[db.avID] ?? "ok") === "ok") return false;
    if (!keyword) return true;
    const name = db.name.toLowerCase();
    const typeLabel = typeLabelOf(db).toLowerCase();
    return name.includes(keyword) || typeLabel.includes(keyword);
  });
}

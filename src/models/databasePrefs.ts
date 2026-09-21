import type { DatabaseField } from "@/models/attributeView";
import { isDatabaseValueEmpty } from "@/models/attributeView";

export interface DatabaseAvPrefs {
  hiddenKeyIDs: string[];
  hideEmpty: boolean;
  hidePrimaryKey: boolean;
}

export interface DatabaseDefaults {
  hideEmpty: boolean;
  hidePrimaryKey: boolean;
}

export const DEFAULT_DATABASE_DEFAULTS: DatabaseDefaults = {
  hideEmpty: false,
  hidePrimaryKey: true,
};

export function normalizeDatabaseAvPrefs(
  input: unknown,
  defaults: DatabaseDefaults = DEFAULT_DATABASE_DEFAULTS,
): DatabaseAvPrefs {
  const source = typeof input === "object" && input !== null ? (input as Record<string, unknown>) : {};
  const hiddenKeyIDs = Array.isArray(source.hiddenKeyIDs)
    ? source.hiddenKeyIDs.filter((id): id is string => typeof id === "string" && id !== "")
    : [];

  return {
    hiddenKeyIDs: [...new Set(hiddenKeyIDs)],
    hideEmpty: typeof source.hideEmpty === "boolean" ? source.hideEmpty : defaults.hideEmpty,
    hidePrimaryKey:
      typeof source.hidePrimaryKey === "boolean" ? source.hidePrimaryKey : defaults.hidePrimaryKey,
  };
}

export function normalizeDatabasePrefsMap(
  input: unknown,
  defaults: DatabaseDefaults = DEFAULT_DATABASE_DEFAULTS,
): Record<string, DatabaseAvPrefs> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return {};
  const out: Record<string, DatabaseAvPrefs> = {};
  for (const [avID, prefs] of Object.entries(input as Record<string, unknown>)) {
    if (!avID) continue;
    out[avID] = normalizeDatabaseAvPrefs(prefs, defaults);
  }
  return out;
}

/**
 * Filter order: column visibility → hide primary key → hide empty.
 */
export function filterVisibleFields(
  fields: DatabaseField[],
  prefs: DatabaseAvPrefs,
): DatabaseField[] {
  const hidden = new Set(prefs.hiddenKeyIDs);
  return fields.filter((field) => {
    if (hidden.has(field.keyID)) return false;
    if (prefs.hidePrimaryKey && field.type === "block") return false;
    if (prefs.hideEmpty && isDatabaseValueEmpty(field)) return false;
    return true;
  });
}

export function resolveAvPrefs(
  avID: string,
  prefsMap: Record<string, DatabaseAvPrefs>,
  defaults: DatabaseDefaults,
): DatabaseAvPrefs {
  const stored = prefsMap[avID];
  if (!stored) {
    return {
      hiddenKeyIDs: [],
      hideEmpty: defaults.hideEmpty,
      hidePrimaryKey: defaults.hidePrimaryKey,
    };
  }
  return stored;
}

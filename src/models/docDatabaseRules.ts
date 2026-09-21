export interface DocDatabaseRule {
  id: string;
  name: string;
  notebookId?: string;
  pathPrefix?: string;
  avID: string;
  avBlockID: string;
  viewID?: string;
  enabled: boolean;
}

export interface DocMatchContext {
  notebookId: string;
  path: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(source: Record<string, unknown>, key: string): string {
  const value = source[key];
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeDocDatabaseRule(input: unknown): DocDatabaseRule | undefined {
  if (!isRecord(input)) return undefined;
  const avID = readString(input, "avID");
  const avBlockID = readString(input, "avBlockID");
  if (!avID || !avBlockID) return undefined;

  const notebookId = readString(input, "notebookId") || undefined;
  const pathPrefix = readString(input, "pathPrefix") || undefined;
  if (!notebookId && !pathPrefix) return undefined;

  const id = readString(input, "id") || `${avID}::${notebookId || pathPrefix}`;
  const name = readString(input, "name") || avID;
  const viewID = readString(input, "viewID") || undefined;
  const enabled = typeof input.enabled === "boolean" ? input.enabled : true;

  return {
    id,
    name,
    ...(notebookId ? { notebookId } : {}),
    ...(pathPrefix ? { pathPrefix } : {}),
    avID,
    avBlockID,
    ...(viewID ? { viewID } : {}),
    enabled,
  };
}

export function normalizeDocDatabaseRules(input: unknown): DocDatabaseRule[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: DocDatabaseRule[] = [];
  for (const item of input) {
    const rule = normalizeDocDatabaseRule(item);
    if (!rule || seen.has(rule.id)) continue;
    seen.add(rule.id);
    out.push(rule);
  }
  return out;
}

function ruleMatches(rule: DocDatabaseRule, doc: DocMatchContext): boolean {
  if (!rule.enabled) return false;
  if (rule.pathPrefix) {
    if (!doc.path.startsWith(rule.pathPrefix)) return false;
    if (rule.notebookId && rule.notebookId !== doc.notebookId) return false;
    return true;
  }
  return Boolean(rule.notebookId && rule.notebookId === doc.notebookId);
}

/**
 * Enabled matching rules, longest pathPrefix first, then notebook-only rules.
 */
export function matchDocDatabaseRules(
  doc: DocMatchContext,
  rules: DocDatabaseRule[],
): DocDatabaseRule[] {
  return rules
    .filter((rule) => ruleMatches(rule, doc))
    .sort((a, b) => {
      const aLen = a.pathPrefix?.length ?? 0;
      const bLen = b.pathPrefix?.length ?? 0;
      if (aLen !== bLen) return bLen - aLen;
      return a.name.localeCompare(b.name);
    });
}

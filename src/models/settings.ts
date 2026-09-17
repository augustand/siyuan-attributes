export type DisplayRuleScope = "document" | "database" | "all";
export type DisplayMatchMethod = "exact" | "wildcard" | "regex";

export interface DisplayRule {
  id: string;
  name: string;
  rule: string;
  matchMethod: DisplayMatchMethod;
  scope: DisplayRuleScope;
  display: boolean;
  displayAs: string;
  editable: boolean;
  renderMethod?: string;
  order: number;
  icon?: string;
  system?: boolean;
}

export interface PanelSettings {
  version: 1;
  showPanel: boolean;
  showDocumentPanel: boolean;
  showDatabasePanel: boolean;
  rules: DisplayRule[];
  fieldRules: DatabaseFieldRule[];
}

export interface DatabaseFieldRule {
  id: string;
  databaseId: string;
  fieldId: string;
  display: boolean;
  displayAs: string;
  editable: boolean;
  order: number;
  icon?: string;
}

export const READ_ONLY_DOCUMENT_ATTRIBUTE_KEYS = new Set([
  "id",
  "updated",
  "created",
  "type",
  "subtype",
  "fold",
  "scroll",
  "title",
  "icon",
  "custom-avs",
]);

export function isReadOnlyDocumentAttributeName(name: string): boolean {
  if (READ_ONLY_DOCUMENT_ATTRIBUTE_KEYS.has(name)) return true;
  return name.startsWith("custom-avs");
}

const EDITABLE_SYSTEM_RULE_IDS = new Set([
  "system-name",
  "system-alias",
]);

function ruleID(rule: string, name: string): string {
  return `${rule}::${name}`;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function string(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function number(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeMatchMethod(value: unknown): DisplayMatchMethod {
  if (value === "exact" || value === "精确") return "exact";
  if (value === "wildcard" || value === "通配符") return "wildcard";
  if (value === "regex" || value === "正则") return "regex";
  return "exact";
}

function normalizeScope(value: unknown): DisplayRuleScope {
  return value === "document" || value === "database" || value === "all" ? value : "all";
}

function normalizeDatabaseFieldRule(input: unknown): DatabaseFieldRule | undefined {
  if (typeof input !== "object" || input === null) return undefined;
  const source = input as Record<string, unknown>;
  const databaseId = string(source.databaseId, "");
  const fieldId = string(source.fieldId, "");
  if (!databaseId || !fieldId) return undefined;

  return {
    id: string(source.id, `field:${databaseId}:${fieldId}`),
    databaseId,
    fieldId,
    display: bool(source.display, false),
    displayAs: string(source.displayAs, fieldId),
    editable: bool(source.editable, true),
    order: number(source.order, 1000),
    icon: typeof source.icon === "string" ? source.icon : undefined,
  };
}

export function normalizeDatabaseFieldRules(input: unknown): DatabaseFieldRule[] {
  if (!Array.isArray(input)) return [];
  return input
    .map(normalizeDatabaseFieldRule)
    .filter((rule): rule is DatabaseFieldRule => Boolean(rule));
}

export function findExactDisplayRule(
  rules: DisplayRule[],
  attributeKey: string,
): DisplayRule | undefined {
  return rules.find((rule) => (
    rule.scope !== "database"
    && rule.matchMethod === "exact"
    && rule.rule === attributeKey
  ));
}

export const DEFAULT_PANEL_SETTINGS: PanelSettings = {
  version: 1,
  showPanel: true,
  showDocumentPanel: true,
  showDatabasePanel: true,
  rules: [
    {
      id: "system-id", name: "文档ID", rule: "id", matchMethod: "exact", scope: "document",
      display: true, displayAs: "块 ID", editable: false, renderMethod: "link", order: 0, icon: "link", system: true,
    },
    {
      id: "system-scroll", name: "阅读进度", rule: "scroll", matchMethod: "exact", scope: "document",
      display: false, displayAs: "阅读进度", editable: false, order: 1000, system: true,
    },
    {
      id: "system-title", name: "标题", rule: "title", matchMethod: "exact", scope: "document",
      display: false, displayAs: "标题", editable: false, order: 1000, system: true,
    },
    {
      id: "system-name", name: "命名", rule: "name", matchMethod: "exact", scope: "document",
      display: true, displayAs: "命名", editable: true, renderMethod: "input", order: 1000, system: true,
    },
    {
      id: "system-alias", name: "别名", rule: "alias", matchMethod: "exact", scope: "document",
      display: true, displayAs: "别名", editable: true, renderMethod: "tag-input", order: 1000, system: true,
    },
    {
      id: "system-type", name: "类型", rule: "type", matchMethod: "exact", scope: "document",
      display: false, displayAs: "类型", editable: false, order: 1000, system: true,
    },
    {
      id: "system-icon", name: "文档图标", rule: "icon", matchMethod: "exact", scope: "document",
      display: false, displayAs: "文档图标", editable: false, order: 1000, system: true,
    },
    {
      id: "system-updated", name: "更新日期", rule: "updated", matchMethod: "exact", scope: "document",
      display: true, displayAs: "更新日期", editable: false, renderMethod: "datetime", order: 10, icon: "calendar-event", system: true,
    },
    {
      id: "system-fold", name: "折叠状态", rule: "fold", matchMethod: "exact", scope: "document",
      display: false, displayAs: "折叠状态", editable: false, order: 1000, system: true,
    },
    {
      id: "system-custom-avs", name: "关联数据库", rule: "custom-avs", matchMethod: "exact", scope: "all",
      display: false, displayAs: "关联数据库", editable: false, order: 1000, system: true,
    },
    {
      id: "system-custom-avs-wildcard", name: "关联数据库", rule: "custom-avs*", matchMethod: "wildcard", scope: "database",
      display: false, displayAs: "关联数据库", editable: false, order: 1000, system: true,
    },
  ],
  fieldRules: [],
};

export function normalizeDisplayRule(input: unknown): DisplayRule | undefined {
  if (typeof input !== "object" || input === null) return undefined;
  const source = input as Record<string, unknown>;
  let rule = string(source.rule, "");
  let name = string(source.name, rule);
  if (!rule || !name) return undefined;

  const id = string(source.id, ruleID(rule, name));
  const isSystem = bool(source.system, false) || id.startsWith("system-");
  let matchMethod = normalizeMatchMethod(source.matchMethod);
  let scope = normalizeScope(source.scope);
  let editable = bool(source.editable, true);

  // System rules identify SiYuan-managed fields. Settings may change display
  // metadata, but cannot retarget the rule or grant write access that the
  // underlying field does not have.
  if (isSystem) {
    const defaultRule = DEFAULT_PANEL_SETTINGS.rules.find((item) => item.id === id);
    if (defaultRule) {
      rule = defaultRule.rule;
      name = defaultRule.name;
      matchMethod = defaultRule.matchMethod;
      scope = defaultRule.scope;
    }
    if (!EDITABLE_SYSTEM_RULE_IDS.has(id)) editable = false;
  }

  // A user-created rule cannot grant edit access to an immutable key either.
  if (matchMethod === "exact" && isReadOnlyDocumentAttributeName(rule)) {
    editable = false;
  }

  return {
    id,
    name,
    rule,
    matchMethod,
    scope,
    display: bool(source.display, true),
    displayAs: string(source.displayAs, name),
    editable,
    renderMethod: typeof source.renderMethod === "string" ? source.renderMethod : undefined,
    order: number(source.order, 1000),
    icon: typeof source.icon === "string" ? source.icon : undefined,
    system: isSystem,
  };
}

export function normalizePanelSettings(input: unknown): PanelSettings {
  const source = typeof input === "object" && input !== null ? input as Record<string, unknown> : {};
  const version = source.version === 1 ? 1 : 1;
  const rules = Array.isArray(source.rules)
    ? source.rules.map(normalizeDisplayRule).filter((rule): rule is DisplayRule => Boolean(rule))
    : [...DEFAULT_PANEL_SETTINGS.rules];

  return {
    version,
    showPanel: bool(source.showPanel, true),
    showDocumentPanel: bool(source.showDocumentPanel, true),
    showDatabasePanel: bool(source.showDatabasePanel, true),
    rules,
    fieldRules: normalizeDatabaseFieldRules(source.fieldRules),
  };
}

export function normalizeLegacySettings(input: {
  settings?: unknown;
  legacyRules?: unknown;
  legacyConfigurations?: unknown;
}): PanelSettings {
  if (typeof input.settings === "object" && input.settings !== null && (input.settings as Record<string, unknown>).version === 1) {
    return normalizePanelSettings(input.settings);
  }

  const legacyConfigurations = typeof input.legacyConfigurations === "object" && input.legacyConfigurations !== null
    ? input.legacyConfigurations as Record<string, unknown>
    : {};
  const legacyShowSettings = typeof legacyConfigurations.showSettings === "object" && legacyConfigurations.showSettings !== null
    ? legacyConfigurations.showSettings as Record<string, unknown>
    : {};
  const legacyRules = Array.isArray(input.legacyRules) ? input.legacyRules : [];
  const migrated = legacyRules.map(normalizeDisplayRule).filter((rule): rule is DisplayRule => Boolean(rule));
  const migratedRules = new Set(migrated.map((rule) => rule.rule));

  for (const defaultRule of DEFAULT_PANEL_SETTINGS.rules) {
    if (!migratedRules.has(defaultRule.rule)) migrated.push({ ...defaultRule });
  }

  return {
    version: 1,
    showPanel: bool(legacyConfigurations.show, true),
    showDocumentPanel: bool(legacyConfigurations.show, true),
    showDatabasePanel: bool(legacyShowSettings.page, true),
    rules: migrated,
    fieldRules: [],
  };
}

export function matchDisplayRule(rule: DisplayRule, name: string): boolean {
  if (rule.matchMethod === "exact") return rule.rule === name;
  if (rule.matchMethod === "wildcard") {
    const pattern = rule.rule
      .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
      .replace(/\*/g, ".*");
    return new RegExp(`^${pattern}$`, "i").test(name);
  }
  if (rule.matchMethod === "regex") {
    try {
      return new RegExp(rule.rule, "u").test(name);
    } catch {
      return false;
    }
  }
  return false;
}

export function compareDisplayRules(left: DisplayRule, right: DisplayRule): number {
  const byOrder = left.order - right.order;
  return byOrder !== 0 ? byOrder : left.id.localeCompare(right.id);
}

export type DisplayRuleScope = "document";
export type DisplayMatchMethod = "exact" | "wildcard" | "regex";
export type DisplayRenderMethod = "input" | "tag-input" | "datetime" | "link";

export interface DisplayRule {
    id: string;
    name: string;
    rule: string;
    matchMethod: DisplayMatchMethod;
    scope: DisplayRuleScope;
    display: boolean;
    displayAs: string;
    editable: boolean;
    renderMethod?: DisplayRenderMethod;
    order: number;
    icon?: string;
    system?: boolean;
}

export interface PanelSettings {
    version: 1;
    showPanel: boolean;
    rules: DisplayRule[];
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

export function normalizeRenderMethod(value: unknown): DisplayRenderMethod | undefined {
    if (value === undefined || value === null || value === "") return undefined;
    if (value === "tag-input") return "tag-input";
    if (value === "datetime") return "datetime";
    if (value === "link") return "link";
    if (value === "input" || value === "checkbox") return "input";
    return "input";
}

export const DEFAULT_PANEL_SETTINGS: PanelSettings = {
    version: 1,
    showPanel: true,
    rules: [
        {
            id: "system-id", name: "文档ID", rule: "id", matchMethod: "exact", scope: "document",
            display: true, displayAs: "块 ID", editable: false, renderMethod: "link", order: 0, icon: "link", system: true,
        },
        {
            id: "system-scroll", name: "阅读进度", rule: "scroll", matchMethod: "exact", scope: "document",
            display: false, displayAs: "阅读进度", editable: false, renderMethod: "input", order: 1000, system: true,
        },
        {
            id: "system-title", name: "标题", rule: "title", matchMethod: "exact", scope: "document",
            display: false, displayAs: "标题", editable: false, renderMethod: "input", order: 1000, system: true,
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
            display: false, displayAs: "类型", editable: false, renderMethod: "input", order: 1000, system: true,
        },
        {
            id: "system-icon", name: "文档图标", rule: "icon", matchMethod: "exact", scope: "document",
            display: false, displayAs: "文档图标", editable: false, renderMethod: "input", order: 1000, system: true,
        },
        {
            id: "system-updated", name: "更新日期", rule: "updated", matchMethod: "exact", scope: "document",
            display: true, displayAs: "更新日期", editable: false, renderMethod: "datetime", order: 10, icon: "calendar-event", system: true,
        },
        {
            id: "system-fold", name: "折叠状态", rule: "fold", matchMethod: "exact", scope: "document",
            display: false, displayAs: "折叠状态", editable: false, renderMethod: "input", order: 1000, system: true,
        },
    ],
};

function isDatabaseScopedLegacyRule(source: Record<string, unknown>): boolean {
    return source.scope === "database";
}

export function normalizeDisplayRule(input: unknown): DisplayRule | undefined {
    if (typeof input !== "object" || input === null) return undefined;
    const source = input as Record<string, unknown>;
    if (isDatabaseScopedLegacyRule(source)) return undefined;

  let rule = string(source.rule, "");
  let name = string(source.name, rule);
    if (!rule || !name) return undefined;

    const id = string(source.id, ruleID(rule, name));
    const isSystem = bool(source.system, false) || id.startsWith("system-");
    let matchMethod = normalizeMatchMethod(source.matchMethod);
    let scope: DisplayRuleScope = "document";
    let editable = bool(source.editable, true);
    let renderMethod = normalizeRenderMethod(source.renderMethod);

    if (isSystem) {
        const defaultRule = DEFAULT_PANEL_SETTINGS.rules.find((item) => item.id === id);
        if (defaultRule) {
            rule = defaultRule.rule;
            name = defaultRule.name;
            matchMethod = defaultRule.matchMethod;
            if (renderMethod === undefined) renderMethod = defaultRule.renderMethod;
        }
        if (!EDITABLE_SYSTEM_RULE_IDS.has(id)) editable = false;
    }

    if (matchMethod === "exact" && isReadOnlyDocumentAttributeName(rule)) {
        editable = false;
    }

    if (renderMethod === undefined) renderMethod = "input";

    return {
        id,
        name,
        rule,
        matchMethod,
        scope,
        display: bool(source.display, true),
        displayAs: string(source.displayAs, name),
        editable,
        renderMethod,
        order: number(source.order, 1000),
        system: isSystem,
        ...(typeof source.icon === "string" ? { icon: source.icon } : {}),
    };
}

export function findExactDisplayRule(
  rules: DisplayRule[],
  attributeKey: string,
): DisplayRule | undefined {
  return rules.find((rule) => (
    rule.matchMethod === "exact"
    && rule.rule === attributeKey
  ));
}

export function normalizePanelSettings(input: unknown): PanelSettings {
    const source = typeof input === "object" && input !== null ? input as Record<string, unknown> : {};
    const rules = Array.isArray(source.rules)
        ? source.rules.map(normalizeDisplayRule).filter((rule): rule is DisplayRule => Boolean(rule))
        : [...DEFAULT_PANEL_SETTINGS.rules];

    return {
        version: 1,
        showPanel: bool(source.showPanel, true),
        rules,
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
    const legacyRules = Array.isArray(input.legacyRules) ? input.legacyRules : [];
    const migrated = legacyRules
        .filter((rule): rule is Record<string, unknown> => (
            typeof rule === "object" && rule !== null && (rule as Record<string, unknown>).scope !== "database"
        ))
        .map(normalizeDisplayRule)
        .filter((rule): rule is DisplayRule => Boolean(rule));
    const migratedRules = new Set(migrated.map((rule) => rule.rule));

    for (const defaultRule of DEFAULT_PANEL_SETTINGS.rules) {
        if (!migratedRules.has(defaultRule.rule)) migrated.push({ ...defaultRule });
    }

    return {
        version: 1,
        showPanel: bool(legacyConfigurations.show, true),
        rules: migrated,
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

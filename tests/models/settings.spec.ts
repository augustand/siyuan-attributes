import { describe, expect, it } from "vitest";
import {
  compareDisplayRules,
  DEFAULT_PANEL_SETTINGS,
  matchDisplayRule,
  normalizeLegacySettings,
  normalizePanelSettings,
} from "@/models/settings";

describe("normalizePanelSettings", () => {
  it("returns defaults for invalid input", () => {
    expect(normalizePanelSettings(undefined)).toEqual(DEFAULT_PANEL_SETTINGS);
  });

  it("locks immutable document keys even when persisted input is editable", () => {
    const settings = normalizePanelSettings({
      version: 1,
      showPanel: true,
      showDocumentPanel: true,
      showDatabasePanel: true,
      rules: [
        ...DEFAULT_PANEL_SETTINGS.rules,
        { id: "user-id", name: "ID", rule: "id", matchMethod: "exact", scope: "document", display: true, displayAs: "ID", editable: true, order: 1 },
      ],
    });

    expect(settings.rules.find((rule) => rule.id === "system-id")?.editable).toBe(false);
    expect(settings.rules.find((rule) => rule.id === "system-updated")?.editable).toBe(false);
    expect(settings.rules.find((rule) => rule.rule === "id")?.editable).toBe(false);
  });

  it("locks system rule target fields but keeps display metadata editable", () => {
    const settings = normalizePanelSettings({
      version: 1,
      rules: [{
        ...DEFAULT_PANEL_SETTINGS.rules.find((rule) => rule.id === "system-id"),
        name: "Changed internal name",
        rule: "name",
        matchMethod: "wildcard",
        scope: "all",
        displayAs: "Changed display",
        editable: true,
        order: 99,
      }],
    });
    const rule = settings.rules.find((item) => item.id === "system-id");

    expect(rule).toMatchObject({
      name: "文档ID",
      rule: "id",
      matchMethod: "exact",
      scope: "document",
      displayAs: "Changed display",
      editable: false,
      order: 99,
    });
  });

  it("normalizes versioned rules and preserves unknown rules", () => {
    const settings = normalizePanelSettings({
      version: 1,
      showPanel: false,
      showDocumentPanel: false,
      showDatabasePanel: true,
      rules: [
        ...DEFAULT_PANEL_SETTINGS.rules,
        {
          id: "user-project",
          name: "Project",
          rule: "custom-project",
          matchMethod: "exact",
          scope: "document",
          display: true,
          displayAs: "Project",
          editable: true,
          order: 5,
        },
      ],
    });

    expect(settings.showPanel).toBe(false);
    expect(settings.showDocumentPanel).toBe(false);
    expect(settings.rules.some((rule) => rule.id === "user-project")).toBe(true);
    expect(settings.rules.some((rule) => rule.id === "system-id")).toBe(true);
  });
});

describe("normalizeLegacySettings", () => {
  it("migrates legacy rules and configurations", () => {
    const settings = normalizeLegacySettings({
      legacyConfigurations: { show: false, showSettings: { page: false, block: true } },
      legacyRules: [{
        name: "命名",
        rule: "name",
        matchMethod: "精确",
        display: true,
        displayAs: "Old name",
        editable: false,
        order: 7,
      }],
    });

    expect(settings.version).toBe(1);
    expect(settings.showPanel).toBe(false);
    expect(settings.showDatabasePanel).toBe(false);
    const nameRule = settings.rules.find((rule) => rule.rule === "name");
    expect(nameRule).toMatchObject({
      matchMethod: "exact",
      displayAs: "Old name",
      editable: false,
      order: 7,
    });
    expect(settings.rules.some((rule) => rule.rule === "updated")).toBe(true);
    expect(settings.rules.find((rule) => rule.rule === "id")?.editable).toBe(false);
    expect(nameRule?.editable).toBe(false); // legacy fixture explicitly disables name
  });
});

describe("display matching", () => {
  const base = DEFAULT_PANEL_SETTINGS.rules[0];

  it("matches exact names", () => {
    expect(matchDisplayRule({ ...base, rule: "name", matchMethod: "exact" }, "name")).toBe(true);
    expect(matchDisplayRule({ ...base, rule: "name", matchMethod: "exact" }, "named")).toBe(false);
  });

  it("matches wildcard expressions", () => {
    const rule = { ...base, rule: "custom-project-*", matchMethod: "wildcard" as const };
    expect(matchDisplayRule(rule, "custom-project-alpha")).toBe(true);
    expect(matchDisplayRule(rule, "custom-projectalpha")).toBe(false);
  });

  it("matches regex and ignores invalid expressions", () => {
    const valid = { ...base, rule: "^custom-(a|b)$", matchMethod: "regex" as const };
    expect(matchDisplayRule(valid, "custom-a")).toBe(true);
    expect(matchDisplayRule(valid, "custom-c")).toBe(false);

    const invalid = { ...base, rule: "[invalid", matchMethod: "regex" as const };
    expect(matchDisplayRule(invalid, "anything")).toBe(false);
  });
});

describe("compareDisplayRules", () => {
  it("sorts by order then stable id", () => {
    const rules = [
      { ...DEFAULT_PANEL_SETTINGS.rules[0], id: "b", order: 1 },
      { ...DEFAULT_PANEL_SETTINGS.rules[0], id: "a", order: 1 },
      { ...DEFAULT_PANEL_SETTINGS.rules[0], id: "c", order: 0 },
    ];
    expect([...rules].sort(compareDisplayRules).map((rule) => rule.id)).toEqual(["c", "a", "b"]);
  });
});

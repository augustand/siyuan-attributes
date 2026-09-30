import { describe, expect, it } from "vitest";
import {
  DATABASE_TYPES,
  DEFAULT_TABLE_TEMPLATES,
  getDatabaseType,
  getTableTemplate,
  normalizeDatabaseTypeId,
} from "@/models/databaseTypes";

describe("databaseTypes", () => {
  it("exposes task, project, product, generic", () => {
    expect(DATABASE_TYPES.map((t) => t.id).sort()).toEqual(
      ["generic", "product", "project", "task"].sort(),
    );
  });

  it("task has 状态 select with options", () => {
    const task = getDatabaseType("task");
    const status = task.columns.find((c) => c.name === "状态");
    expect(status?.type).toBe("select");
    expect(status?.options?.map((o) => o.name)).toEqual([
      "待办",
      "进行中",
      "完成",
      "取消",
    ]);
  });

  it("normalizeDatabaseTypeId falls back to generic", () => {
    expect(normalizeDatabaseTypeId(undefined)).toBe("generic");
    expect(normalizeDatabaseTypeId("task")).toBe("task");
    expect(normalizeDatabaseTypeId("nope")).toBe("generic");
  });
});

describe("DEFAULT_TABLE_TEMPLATES", () => {
  it("orders tasks → projects → inbox with unique keys", () => {
    expect(DEFAULT_TABLE_TEMPLATES.map((t) => t.key)).toEqual([
      "tasks",
      "projects",
      "inbox",
    ]);
    expect(new Set(DEFAULT_TABLE_TEMPLATES.map((t) => t.key)).size).toBe(
      DEFAULT_TABLE_TEMPLATES.length,
    );
  });

  it("each template has nameKey, nameFallback and columns without a primary block column", () => {
    for (const template of DEFAULT_TABLE_TEMPLATES) {
      expect(template.nameKey).toBe(`ownedDb.tables.${template.key}`);
      expect(template.nameFallback.trim()).toBeTruthy();
      expect(template.columns.length).toBeGreaterThan(0);
      for (const col of template.columns) {
        expect(col.type).not.toBe("block");
        expect(col.name.trim()).toBeTruthy();
      }
    }
  });

  it("tasks template carries the spec columns with colored starter options", () => {
    const tasks = getTableTemplate("tasks")!;
    expect(tasks.nameFallback).toBe("任务清单");
    expect(tasks.columns.map((c) => [c.name, c.type])).toEqual([
      ["状态", "select"],
      ["优先级", "select"],
      ["截止日期", "date"],
      ["标签", "mSelect"],
      ["完成", "checkbox"],
    ]);
    const status = tasks.columns[0]!;
    expect(status.options?.map((o) => o.name)).toEqual([
      "待办",
      "进行中",
      "已完成",
      "取消",
    ]);
    const tags = tasks.columns.find((c) => c.name === "标签")!;
    expect(tags.options?.map((o) => o.name)).toEqual(["工作", "个人", "灵感"]);
    for (const option of [...(status.options ?? []), ...(tags.options ?? [])]) {
      expect(option.color).toBeTruthy();
    }
  });

  it("projects and inbox templates carry the spec columns", () => {
    const projects = getTableTemplate("projects")!;
    expect(projects.nameFallback).toBe("项目追踪");
    expect(projects.columns.map((c) => [c.name, c.type])).toEqual([
      ["状态", "select"],
      ["阶段", "text"],
      ["开始日期", "date"],
      ["结束日期", "date"],
      ["标签", "mSelect"],
    ]);
    expect(projects.columns[0]!.options?.map((o) => o.name)).toEqual([
      "规划",
      "进行中",
      "暂停",
      "已完结",
    ]);

    const inbox = getTableTemplate("inbox")!;
    expect(inbox.nameFallback).toBe("素材收集箱");
    expect(inbox.columns.map((c) => [c.name, c.type])).toEqual([
      ["来源", "url"],
      ["标签", "mSelect"],
      ["收集日期", "date"],
      ["摘要", "text"],
    ]);
  });

  it("getTableTemplate returns undefined for unknown or blank keys", () => {
    expect(getTableTemplate("nope")).toBeUndefined();
    expect(getTableTemplate("")).toBeUndefined();
    expect(getTableTemplate("  ")).toBeUndefined();
    expect(getTableTemplate("tasks")!.key).toBe("tasks");
  });
});

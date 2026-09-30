import { describe, expect, it } from "vitest";
import type { OwnedDatabase } from "@/models/ownedDatabase";
import type { OwnedDatabaseHealth } from "@/services/ownedDatabase";
import {
  groupOwnedDatabasesByType,
  hangableTypeIds,
  resolveHangTarget,
  missingTemplateColumns,
  displayOwnedDatabaseName,
  pickPrimaryDatabaseForType,
  setPrimaryForType,
  clearPrimaryForType,
  filterOwnedDatabases,
} from "@/models/ownedDatabaseHang";

function db(
  partial: Partial<OwnedDatabase> & Pick<OwnedDatabase, "avID" | "name">,
): OwnedDatabase {
  return {
    id: partial.avID,
    avBlockID: partial.avBlockID ?? `blk-${partial.avID}`,
    createdAt: 1,
    ...partial,
  };
}

describe("resolveHangTarget", () => {
  const taskA = db({ avID: "a", name: "任务A", typeId: "task" });
  const taskB = db({ avID: "b", name: "任务B", typeId: "task" });
  const project = db({ avID: "p", name: "项目", typeId: "project" });

  it("returns none when no healthy unbound DB of that type", () => {
    expect(
      resolveHangTarget({
        typeId: "task",
        databases: [taskA, project],
        healthyAvIDs: ["p"],
        boundAvIDs: [],
      }),
    ).toEqual({ kind: "none" });

    expect(
      resolveHangTarget({
        typeId: "task",
        databases: [taskA],
        healthyAvIDs: ["a"],
        boundAvIDs: ["a"],
      }),
    ).toEqual({ kind: "none" });
  });

  it("binds when exactly one candidate", () => {
    expect(
      resolveHangTarget({
        typeId: "task",
        databases: [taskA, project],
        healthyAvIDs: ["a", "p"],
        boundAvIDs: [],
      }),
    ).toEqual({ kind: "bind", db: taskA });
  });

  it("prefers lastAvID when multiple candidates", () => {
    expect(
      resolveHangTarget({
        typeId: "task",
        databases: [taskA, taskB],
        healthyAvIDs: ["a", "b"],
        boundAvIDs: [],
        lastAvID: "b",
      }),
    ).toEqual({ kind: "bind", db: taskB });
  });

  it("picks filtered list when multiple and no usable last", () => {
    expect(
      resolveHangTarget({
        typeId: "task",
        databases: [taskA, taskB, project],
        healthyAvIDs: ["a", "b", "p"],
        boundAvIDs: [],
        lastAvID: "p",
      }),
    ).toEqual({ kind: "pick", databases: [taskA, taskB] });
  });
});

describe("groupOwnedDatabasesByType", () => {
  it("orders types and omits empty", () => {
    const groups = groupOwnedDatabasesByType([
      db({ avID: "g", name: "G", typeId: "generic" }),
      db({ avID: "t", name: "T", typeId: "task" }),
      db({ avID: "pr", name: "P", typeId: "product" }),
    ]);
    expect(groups.map((g) => g.typeId)).toEqual(["task", "product", "generic"]);
  });
});

describe("hangableTypeIds", () => {
  it("lists types with healthy DBs in order", () => {
    expect(
      hangableTypeIds(
        [
          db({ avID: "a", name: "A", typeId: "product" }),
          db({ avID: "b", name: "B", typeId: "task" }),
          db({ avID: "c", name: "C", typeId: "project" }),
        ],
        ["a", "c"],
      ),
    ).toEqual(["project", "product"]);
  });
});

describe("pickPrimaryDatabaseForType", () => {
  const taskA = db({ avID: "a", name: "任务A", typeId: "task" });
  const taskB = db({ avID: "b", name: "任务B", typeId: "task" });

  it("returns sole healthy of type", () => {
    expect(
      pickPrimaryDatabaseForType({
        typeId: "task",
        databases: [taskA],
        healthyAvIDs: ["a"],
      }),
    ).toEqual(taskA);
  });

  it("prefers primaryAvID then lastAvID", () => {
    expect(
      pickPrimaryDatabaseForType({
        typeId: "task",
        databases: [taskA, taskB],
        healthyAvIDs: ["a", "b"],
        primaryAvID: "b",
        lastAvID: "a",
      }),
    ).toEqual(taskB);
  });
});

describe("setPrimaryForType", () => {
  it("adds a new key and overwrites an existing one without mutating input", () => {
    const original = { task: "a" };
    expect(setPrimaryForType(original, "task", "b")).toEqual({ task: "b" });
    expect(setPrimaryForType(original, "project", "p")).toEqual({
      task: "a",
      project: "p",
    });
    expect(original).toEqual({ task: "a" });
  });

  it("is safe on an empty map", () => {
    expect(setPrimaryForType({}, "generic", "g")).toEqual({ generic: "g" });
  });
});

describe("clearPrimaryForType", () => {
  it("removes only the target key and keeps the rest untouched", () => {
    const original = { task: "a", project: "p" };
    const next = clearPrimaryForType(original, "task");
    expect(next).toEqual({ project: "p" });
    expect("task" in next).toBe(false);
    expect(original).toEqual({ task: "a", project: "p" });
  });

  it("is safe when the key is absent or the map is empty", () => {
    expect(clearPrimaryForType({}, "task")).toEqual({});
    expect(clearPrimaryForType({ project: "p" }, "task")).toEqual({
      project: "p",
    });
  });
});

describe("missingTemplateColumns", () => {
  it("returns only columns not present by name", () => {
    expect(
      missingTemplateColumns(
        ["主键", "状态"],
        [
          { name: "状态", type: "select" },
          { name: "优先级", type: "select" },
          { name: "截止日期", type: "date" },
        ],
      ).map((c) => c.name),
    ).toEqual(["优先级", "截止日期"]);
  });
});

describe("displayOwnedDatabaseName", () => {
  it("falls back when blank or 未命名", () => {
    expect(displayOwnedDatabaseName("", "任务")).toBe("任务");
    expect(displayOwnedDatabaseName("未命名", "任务")).toBe("任务");
    expect(displayOwnedDatabaseName("本周任务", "任务")).toBe("本周任务");
  });

  it("prefers templateName over typeFallback when the name is blank", () => {
    expect(displayOwnedDatabaseName("", "任务", "任务清单")).toBe("任务清单");
    expect(displayOwnedDatabaseName("未命名", "任务", "素材收集箱")).toBe("素材收集箱");
    expect(displayOwnedDatabaseName("  ", "任务", "项目追踪")).toBe("项目追踪");
  });

  it("keeps real names ahead of templateName and trims blank templateName", () => {
    expect(displayOwnedDatabaseName("我的表", "任务", "任务清单")).toBe("我的表");
    expect(displayOwnedDatabaseName("", "任务", "  ")).toBe("任务");
    expect(displayOwnedDatabaseName(undefined, "任务", "任务清单")).toBe("任务清单");
  });
});

describe("filterOwnedDatabases", () => {
  const task = db({ avID: "t1", name: "本周任务", typeId: "task" });
  const task2 = db({ avID: "t2", name: "Sprint Plan", typeId: "task" });
  const project = db({ avID: "p1", name: "装修", typeId: "project" });
  const broken = db({ avID: "b1", name: "坏库", typeId: "generic" });
  const typeLabelOf = (d: OwnedDatabase): string =>
    d.typeId === "task" ? "任务" : d.typeId === "project" ? "项目" : "通用";

  it("blank or missing keyword keeps all databases in order", () => {
    const all = [task, task2, project, broken];
    expect(filterOwnedDatabases(all, {}, {}, typeLabelOf)).toEqual(all);
    expect(filterOwnedDatabases(all, { keyword: "   " }, {}, typeLabelOf)).toEqual(all);
  });

  it("keyword matches name case-insensitively", () => {
    expect(
      filterOwnedDatabases([task, task2], { keyword: "sprint" }, {}, typeLabelOf),
    ).toEqual([task2]);
    expect(
      filterOwnedDatabases([task, task2], { keyword: "本周" }, {}, typeLabelOf),
    ).toEqual([task]);
  });

  it("keyword matches type label case-insensitively", () => {
    expect(
      filterOwnedDatabases([task, project], { keyword: "项目" }, {}, typeLabelOf),
    ).toEqual([project]);
    expect(
      filterOwnedDatabases([task, project], { keyword: "任" }, {}, typeLabelOf),
    ).toEqual([task]);
  });

  it("brokenOnly keeps only unhealthy DBs; absent health counts as ok", () => {
    const missing = db({ avID: "m1", name: "丢库", typeId: "task" });
    const list = [task, broken, missing];
    const health: Record<string, OwnedDatabaseHealth> = { b1: "broken" };
    expect(filterOwnedDatabases(list, { brokenOnly: true }, health, typeLabelOf)).toEqual([
      broken,
    ]);
    const health2: Record<string, OwnedDatabaseHealth> = {
      b1: "broken",
      m1: "missing",
    };
    expect(
      filterOwnedDatabases(list, { brokenOnly: true }, health2, typeLabelOf),
    ).toEqual([broken, missing]);
    // brokenOnly=false keeps everything, even with broken entries present
    expect(filterOwnedDatabases(list, { brokenOnly: false }, health2, typeLabelOf)).toEqual(list);
  });

  it("combines keyword and brokenOnly", () => {
    const badTask = db({ avID: "bt", name: "坏任务", typeId: "task" });
    const health: Record<string, OwnedDatabaseHealth> = {
      b1: "broken",
      bt: "broken",
    };
    expect(
      filterOwnedDatabases(
        [task, broken, badTask],
        { keyword: "任务", brokenOnly: true },
        health,
        typeLabelOf,
      ),
    ).toEqual([badTask]);
  });
});

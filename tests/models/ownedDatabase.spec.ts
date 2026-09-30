import { describe, expect, it } from "vitest";
import {
  normalizeAttributeViewSearchResults,
  normalizeOwnedDatabase,
  normalizeOwnedDatabases,
} from "@/models/ownedDatabase";

describe("normalizeOwnedDatabase", () => {
  it("requires avID and avBlockID", () => {
    expect(normalizeOwnedDatabase({ name: "A", avID: "x" })).toBeUndefined();
    expect(
      normalizeOwnedDatabase({ name: "Tasks", avID: "av-1", avBlockID: "b-1" }),
    ).toMatchObject({ name: "Tasks", avID: "av-1", avBlockID: "b-1" });
  });

  it("keeps typeId when valid", () => {
    expect(
      normalizeOwnedDatabase({
        name: "Tasks",
        avID: "av-1",
        avBlockID: "b-1",
        typeId: "task",
      }),
    ).toMatchObject({ typeId: "task" });
  });

  it("normalizes unknown typeId to generic", () => {
    expect(
      normalizeOwnedDatabase({
        name: "X",
        avID: "av-1",
        avBlockID: "b-1",
        typeId: "nope",
      }),
    ).toMatchObject({ typeId: "generic" });
  });

  it("keeps templateKey when present", () => {
    expect(
      normalizeOwnedDatabase({
        name: "任务清单",
        avID: "av-1",
        avBlockID: "b-1",
        templateKey: "tasks",
      }),
    ).toMatchObject({ templateKey: "tasks" });
  });

  it("drops blank templateKey", () => {
    const normalized = normalizeOwnedDatabase({
      name: "X",
      avID: "av-1",
      avBlockID: "b-1",
      templateKey: "   ",
    });
    expect(normalized).toBeDefined();
    expect("templateKey" in normalized!).toBe(false);
  });
});

describe("normalizeOwnedDatabases", () => {
  it("dedupes by avID and sorts by name", () => {
    const list = normalizeOwnedDatabases([
      { name: "Zed", avID: "av-2", avBlockID: "b2" },
      { name: "Alpha", avID: "av-1", avBlockID: "b1" },
      { name: "Dup", avID: "av-1", avBlockID: "b1b" },
    ]);
    expect(list.map((d) => d.name)).toEqual(["Alpha", "Zed"]);
  });

  it("preserves templateKey through list normalize", () => {
    const list = normalizeOwnedDatabases([
      { name: "任务清单", avID: "av-1", avBlockID: "b1", templateKey: "tasks" },
    ]);
    expect(list[0]?.templateKey).toBe("tasks");
  });
});

describe("normalizeAttributeViewSearchResults", () => {
  it("flattens search payload", () => {
    const hits = normalizeAttributeViewSearchResults({
      results: [
        {
          avID: "av-1",
          avName: "项目",
          blockID: "blk-1",
          hPath: "/库/项目",
        },
      ],
    });
    expect(hits).toEqual([
      { avID: "av-1", avName: "项目", blockID: "blk-1", hPath: "/库/项目" },
    ]);
  });
});

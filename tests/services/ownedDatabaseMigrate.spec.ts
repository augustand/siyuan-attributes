import { describe, expect, it, vi, beforeEach } from "vitest";
import { fetchSyncPost } from "siyuan";
import {
  clearDocumentDatabaseBindings,
  findForeignDatabaseBlocksInDoc,
  migrateDocumentToOwnedDatabase,
  bindingsToUnbind,
} from "@/services/ownedDatabaseMigrate";
import {
  bindDocumentToDatabase,
  unbindDocumentFromDatabase,
  fetchAttributeViews,
} from "@/services/attributeView";

vi.mock("@/services/attributeView", () => ({
  bindDocumentToDatabase: vi.fn(),
  unbindDocumentFromDatabase: vi.fn(),
  fetchAttributeViews: vi.fn(),
}));

vi.mock("siyuan", () => ({
  fetchSyncPost: vi.fn(),
  openTab: vi.fn(),
}));

const bindMock = vi.mocked(bindDocumentToDatabase);
const unbindMock = vi.mocked(unbindDocumentFromDatabase);
const fetchMock = vi.mocked(fetchAttributeViews);
const fetchSyncPostMock = vi.mocked(fetchSyncPost);

describe("bindingsToUnbind", () => {
  it("removes every binding except target", () => {
    expect(
      bindingsToUnbind({
        targetAvID: "task",
        currentlyBoundAvIDs: ["orphan-1", "generic", "task"],
      }),
    ).toEqual(["orphan-1", "generic"]);
  });
});

describe("clearDocumentDatabaseBindings", () => {
  beforeEach(() => {
    unbindMock.mockReset();
    fetchMock.mockReset();
    unbindMock.mockResolvedValue(undefined);
  });

  it("unbinds all when no keepAvID", async () => {
    fetchMock.mockResolvedValue([
      { avID: "a", name: "", fields: [], documentID: "d" } as never,
      { avID: "b", name: "", fields: [], documentID: "d" } as never,
    ]);
    const result = await clearDocumentDatabaseBindings({ docId: "d" });
    expect(result).toEqual({ before: 2, removed: 2 });
    expect(unbindMock).toHaveBeenCalledTimes(2);
  });

  it("keeps one avID", async () => {
    fetchMock.mockResolvedValue([
      { avID: "a", name: "", fields: [], documentID: "d" } as never,
      { avID: "b", name: "", fields: [], documentID: "d" } as never,
    ]);
    const result = await clearDocumentDatabaseBindings({
      docId: "d",
      keepAvID: "b",
    });
    expect(result.removed).toBe(1);
    expect(unbindMock).toHaveBeenCalledWith({ avID: "a", docId: "d" });
  });
});

describe("migrateDocumentToOwnedDatabase", () => {
  beforeEach(() => {
    bindMock.mockReset();
    unbindMock.mockReset();
    fetchMock.mockReset();
    bindMock.mockResolvedValue(undefined);
    unbindMock.mockResolvedValue(undefined);
  });

  it("unbinds all other AVs including non-catalog orphans then binds", async () => {
    const target = {
      id: "task",
      name: "任务",
      avID: "task",
      avBlockID: "blk-task",
      createdAt: 1,
    };
    const result = await migrateDocumentToOwnedDatabase({
      docId: "doc-1",
      target,
      currentlyBoundAvIDs: ["orphan-未命名", "generic"],
    });
    expect(result.unboundAvIDs).toEqual(["orphan-未命名", "generic"]);
    expect(unbindMock).toHaveBeenCalledTimes(2);
    expect(bindMock).toHaveBeenCalled();
  });
});

describe("findForeignDatabaseBlocksInDoc", () => {
  beforeEach(() => {
    fetchSyncPostMock.mockReset();
  });

  it("returns only foreign av blocks hosted inside the doc (excluded avIDs skipped)", async () => {
    fetchSyncPostMock.mockImplementation(async (url: string) => {
      if (url === "/api/filetree/getHPathByID") {
        return { code: 0, msg: "", data: "/数据库/表 · A" };
      }
      if (url === "/api/av/searchAttributeView") {
        return {
          code: 0,
          msg: "",
          data: {
            results: [
              { avID: "av-a", blockID: "b1", hPath: "/数据库/表 · A", avName: "A" },
              { avID: "av-b", blockID: "b2", hPath: "/数据库/表 · A", avName: "B" },
              { avID: "av-c", blockID: "b3", hPath: "/数据库/表 · C", avName: "C" },
            ],
          },
        };
      }
      return { code: 0, msg: "", data: null };
    });

    const hits = await findForeignDatabaseBlocksInDoc({
      docId: "doc-a",
      excludeAvIDs: ["av-a"],
    });
    expect(hits.map((h) => h.avID)).toEqual(["av-b"]);
    expect(hits[0]).toMatchObject({ avName: "B", blockID: "b2" });
  });

  it("returns nothing when the doc path cannot be resolved", async () => {
    fetchSyncPostMock.mockImplementation(async (url: string) => {
      if (url === "/api/filetree/getHPathByID") {
        return { code: -1, msg: "not found", data: null };
      }
      throw new Error(`unexpected call: ${url}`);
    });

    await expect(findForeignDatabaseBlocksInDoc({ docId: "doc-x" })).resolves.toEqual([]);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchSyncPost } from "siyuan";
import type { OwnedDatabase } from "@/models/ownedDatabase";
import {
  listWorkspaceDatabases,
  removeDatabaseCompletely,
} from "@/services/workspaceDatabase";

const fetchSyncPostMock = vi.mocked(fetchSyncPost);

vi.mock("siyuan", () => ({
  fetchSyncPost: vi.fn(),
  openTab: vi.fn(),
}));

/**
 * Kernel endpoint mocks. Verified shapes (kernel 3.8.6, live-verified):
 * - /api/file/readDir → data: Array<{ name, isDir, isSymlink, updated }>
 * - /api/av/searchAttributeView("") → data.results: Array<{avID, avName,
 *   blockID, hPath, …}>; its count EXACTLY equals the blocks-table
 *   `SELECT COUNT(*) FROM blocks WHERE type='av'` → COMPLETE for referenced
 *   databases. This is the ONLY in-use primitive.
 * - /api/av/getUnusedAttributeViews → data: [] ALWAYS on 3.8.6 (broken) —
 *   REMOVED from classification entirely; it is never called here.
 * - /api/file/getFile → RAW file body (dual-shape reader in ownedDatabase.ts);
 *   missing files come back as {code: 404, …}
 * - /api/query/sql → data: Array<{id, root_id, …}> (blockID → host doc id)
 * - /api/file/removeFile → {code: 0} on success, {code: 404, "path does not
 *   exist"} for missing files
 * - /api/block/deleteBlock → code -1 "tree not found" for unknown ids
 *
 * getMirrorDatabaseBlocks is deliberately NOT mocked here: it returns
 * refDefs: [] for every database (healthy or not) and must never be consulted
 * for classification or health.
 */
interface KernelState {
  avDir?: unknown[];
  readDirError?: boolean;
  hits?: Array<{ avID: string; avName: string; blockID: string; hPath: string }>;
  failSearch?: boolean;
  /** avIDs whose AV file reads back fine (default: unreadable). */
  readable?: Set<string>;
  failGetFile?: boolean;
  /** blockID → root_id rows the SQL index answers with (default: no rows). */
  sqlBlocks?: Record<string, string>;
  failSql?: boolean;
}

function installKernel(state: KernelState): void {
  fetchSyncPostMock.mockImplementation(async (url: string, body?: unknown) => {
    switch (url) {
      case "/api/file/readDir":
        if (state.readDirError) {
          return { code: 404, msg: "path does not exist", data: null };
        }
        return { code: 0, msg: "", data: state.avDir ?? [] };
      case "/api/file/getFile": {
        if (state.failGetFile) throw new Error("getFile boom");
        const path = (body as { path?: string } | undefined)?.path ?? "";
        const avID = path.slice("/data/storage/av/".length, -".json".length);
        if (state.readable?.has(avID)) {
          return { id: avID, name: "", keyValues: [] }; // raw file body
        }
        return { code: 404, msg: "file not found", data: null };
      }
      case "/api/av/searchAttributeView":
        if (state.failSearch) throw new Error("search boom");
        return { code: 0, msg: "", data: { results: state.hits ?? [] } };
      case "/api/query/sql": {
        if (state.failSql) throw new Error("sql boom");
        const stmt = (body as { stmt?: string } | undefined)?.stmt ?? "";
        const asked = [...stmt.matchAll(/'([^']*)'/g)].map((m) => m[1]);
        return {
          code: 0,
          msg: "",
          data: asked
            .filter((id) => state.sqlBlocks?.[id])
            .map((id) => ({ id, root_id: state.sqlBlocks?.[id], parent_id: "", type: "" })),
        };
      }
      default:
        throw new Error(`unexpected endpoint: ${url}`);
    }
  });
}

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

describe("listWorkspaceDatabases", () => {
  beforeEach(() => {
    fetchSyncPostMock.mockReset();
  });

  it("classifies managed/collected/active/unreferenced from search hits, disk files and catalog", async () => {
    installKernel({
      avDir: [
        { name: "av-managed.json", isDir: false },
        { name: "av-collected.json", isDir: false },
        { name: "av-unref.json", isDir: false }, // on disk, NO search hit, not catalog → unreferenced
        { name: "notes.txt", isDir: false }, // not an AV file — skipped
        { name: "av-ghost.json", isDir: true }, // dir named *.json — skipped here
      ],
      hits: [
        { avID: "av-managed", avName: "搜索名", blockID: "blk-hit-managed", hPath: "/库/托管" },
        { avID: "av-active", avName: "A在用", blockID: "blk-active", hPath: "/日记/今天" },
        { avID: "av-ghost", avName: "B幽灵", blockID: "blk-ghost", hPath: "/其他/文档" },
      ],
      readable: new Set(["av-managed", "av-collected", "av-default"]),
    });
    const owned = [
      db({ avID: "av-managed", name: "托管任务", source: "managed" }),
      db({ avID: "av-collected", name: "已收录A", source: "collected" }),
      db({ avID: "av-default", name: "默认收录" }), // no source field → collected
    ];

    const entries = await listWorkspaceDatabases({ owned });

    const byID = new Map(entries.map((e) => [e.avID, e]));
    expect(entries).toHaveLength(6);

    // Catalog hit: catalog name is AUTHORITATIVE (not 搜索名), catalog blockID
    // wins over the hit blockID (blk-hit-managed); health = file readability
    expect(byID.get("av-managed")).toEqual({
      avID: "av-managed",
      name: "托管任务",
      hostPath: "/库/托管",
      origin: "managed",
      health: "ok",
      blockID: "blk-av-managed",
    });
    // Catalog hit, no search hit, readable file → still collected, health ok
    expect(byID.get("av-collected")).toEqual({
      avID: "av-collected",
      name: "已收录A",
      origin: "collected",
      health: "ok",
      blockID: "blk-av-collected",
    });
    // Missing source field defaults to collected
    expect(byID.get("av-default")).toMatchObject({ origin: "collected", health: "ok" });

    // Search hit, not in catalog → active with hostPath + hit blockID
    expect(byID.get("av-active")).toEqual({
      avID: "av-active",
      name: "A在用",
      hostPath: "/日记/今天",
      origin: "active",
      health: "ok",
      blockID: "blk-active",
    });
    // Search hit wins even when the AV file is NOT on disk (search is the
    // complete in-use primitive) → active, health ok
    expect(byID.get("av-ghost")).toEqual({
      avID: "av-ghost",
      name: "B幽灵",
      hostPath: "/其他/文档",
      origin: "active",
      health: "ok",
      blockID: "blk-ghost",
    });

    // On disk but in NO search hit and not catalogued → unreferenced
    // (the file demonstrably exists — readDir found it)
    expect(byID.get("av-unref")).toEqual({
      avID: "av-unref",
      name: "",
      origin: "unreferenced",
      health: "missing",
    });

    // The mirror probe must never fire.
    expect(fetchSyncPostMock).not.toHaveBeenCalledWith(
      "/api/av/getMirrorDatabaseBlocks",
      expect.anything(),
    );
    // The dead 3.8.6 unused-list primitive must never fire either.
    expect(fetchSyncPostMock).not.toHaveBeenCalledWith(
      "/api/av/getUnusedAttributeViews",
      expect.anything(),
    );
  });

  it("a disk id WITHOUT a search hit is unreferenced; a catalogued hit stays collected", async () => {
    installKernel({
      avDir: [
        { name: "av-bare.json", isDir: false },
        { name: "av-cat.json", isDir: false },
      ],
      hits: [{ avID: "av-cat", avName: "搜索名", blockID: "b2", hPath: "/y" }],
      readable: new Set(["av-cat"]),
    });

    const entries = await listWorkspaceDatabases({
      owned: [db({ avID: "av-cat", name: "已收录", source: "collected" })],
    });

    const byID = new Map(entries.map((e) => [e.avID, e]));
    // On disk, not searched, not catalogued → unreferenced
    expect(byID.get("av-bare")).toEqual({
      avID: "av-bare",
      name: "",
      origin: "unreferenced",
      health: "missing",
    });
    // Catalogued → catalog wins, even though the file is on disk unsearched
    expect(byID.get("av-cat")).toMatchObject({
      origin: "collected",
      name: "已收录",
      health: "ok",
    });
  });

  it("posts readDir against the av storage dir and only accepts *.json file entries", async () => {
    installKernel({
      avDir: [
        { name: "av1.json", isDir: false },
        { name: "av2.json", isDir: true }, // dir entry — skipped
        { name: "readme.md", isDir: false }, // not an av file — skipped
        null, // malformed — skipped
      ],
    });

    const entries = await listWorkspaceDatabases({ owned: [] });

    expect(fetchSyncPostMock).toHaveBeenCalledWith("/api/file/readDir", {
      path: "/data/storage/av",
    });
    expect(entries.map((e) => e.avID)).toEqual(["av1"]);
    // On disk, not in any search hit → unreferenced
    expect(entries[0]).toMatchObject({ origin: "unreferenced", name: "", health: "missing" });
  });

  it("degrades silently when readDir fails (fresh workspace, no av dir yet)", async () => {
    installKernel({
      readDirError: true,
      hits: [{ avID: "av-active", avName: "在用", blockID: "blk-a", hPath: "/x" }],
      readable: new Set(["av-managed"]),
    });

    const entries = await listWorkspaceDatabases({
      owned: [db({ avID: "av-managed", name: "托管", source: "managed" })],
    });

    expect(entries.map((e) => e.avID).sort()).toEqual(["av-active", "av-managed"]);
    expect(entries.map((e) => e.origin).sort()).toEqual(["active", "managed"]);
    expect(new Map(entries.map((e) => [e.avID, e])).get("av-managed")).toMatchObject({
      health: "ok",
    });
  });

  it("degrades silently when search fails — disk ids become unreferenced", async () => {
    installKernel({
      failSearch: true,
      avDir: [{ name: "av-live.json", isDir: false }],
      readable: new Set(["av-managed"]),
    });

    const entries = await listWorkspaceDatabases({
      owned: [db({ avID: "av-managed", name: "托管", source: "managed" })],
    });

    const byID = new Map(entries.map((e) => [e.avID, e]));
    // No hits → cannot prove in use → unreferenced (file exists on disk)
    expect(byID.get("av-live")).toMatchObject({
      origin: "unreferenced",
      name: "",
      health: "missing",
    });
    // No search hit → no hostPath
    expect(byID.get("av-live")?.hostPath).toBeUndefined();
    expect(byID.get("av-managed")).toMatchObject({ origin: "managed", health: "ok" });
  });

  it("catalog entry with an unreadable AV file reports health missing (never broken)", async () => {
    installKernel({
      avDir: [{ name: "av-dead.json", isDir: false }],
      readable: new Set(),
    });

    const entries = await listWorkspaceDatabases({
      owned: [db({ avID: "av-dead", name: "死表", source: "managed" })],
    });

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ origin: "managed", health: "missing" });
  });

  it("survives a failing getFile for catalog health (entry degrades to missing)", async () => {
    installKernel({
      failGetFile: true,
      avDir: [],
    });

    const entries = await listWorkspaceDatabases({
      owned: [db({ avID: "av-x", name: "表X", source: "managed" })],
    });

    expect(entries).toEqual([
      { avID: "av-x", name: "表X", origin: "managed", health: "missing", blockID: "blk-av-x" },
    ]);
  });

  it("empty dir and empty hits yield just the catalog", async () => {
    installKernel({ avDir: [], hits: [], readable: new Set(["av-only"]) });

    const entries = await listWorkspaceDatabases({
      owned: [db({ avID: "av-only", name: "唯一", source: "collected" })],
    });

    expect(entries).toEqual([
      {
        avID: "av-only",
        name: "唯一",
        origin: "collected",
        health: "ok",
        blockID: "blk-av-only",
      },
    ]);
  });

  it("sorts managed → collected → active → unreferenced, alphabetical with empty names last", async () => {
    installKernel({
      avDir: [
        { name: "u-c.json", isDir: false },
        { name: "u-a.json", isDir: false },
        { name: "u-b.json", isDir: false },
      ],
      hits: [
        { avID: "act-a", avName: "A备", blockID: "b1", hPath: "/a" },
        { avID: "act-b", avName: "B备", blockID: "b2", hPath: "/b" },
      ],
      readable: new Set(["m-a", "m-b", "c-c"]),
    });

    const entries = await listWorkspaceDatabases({
      owned: [
        db({ avID: "m-b", name: "B表", source: "managed" }),
        db({ avID: "m-a", name: "A表", source: "managed" }),
        db({ avID: "c-c", name: "C表", source: "collected" }),
      ],
    });

    expect(entries.map((e) => e.avID)).toEqual([
      "m-a", "m-b", // managed: alphabetical
      "c-c", // collected
      "act-a", "act-b", // active: A备 < B备
      "u-a", "u-b", "u-c", // unreferenced: unnamed → by avID
    ]);
  });

  it("resolves hostDocID from search-hit blockIDs via /api/query/sql; missing blocks stay unset", async () => {
    installKernel({
      avDir: [{ name: "av-unref.json", isDir: false }],
      hits: [
        { avID: "av-a", avName: "甲", blockID: "blk-a", hPath: "/x/a" },
        { avID: "av-b", avName: "乙", blockID: "blk-b", hPath: "/x/b" },
      ],
      sqlBlocks: { "blk-a": "doc-a" }, // blk-b missing from the index → no row
    });

    const entries = await listWorkspaceDatabases({ owned: [] });

    const byID = new Map(entries.map((e) => [e.avID, e]));
    expect(byID.get("av-a")).toEqual({
      avID: "av-a",
      name: "甲",
      hostPath: "/x/a",
      origin: "active",
      health: "ok",
      blockID: "blk-a",
      hostDocID: "doc-a",
    });
    // No SQL row for blk-b → no hostDocID (key absent, not undefined-valued)
    expect(byID.get("av-b")).toEqual({
      avID: "av-b",
      name: "乙",
      hostPath: "/x/b",
      origin: "active",
      health: "ok",
      blockID: "blk-b",
    });
    // Unreferenced rows carry no blockID → never a hostDocID
    expect(byID.get("av-unref")?.hostDocID).toBeUndefined();
    expect(byID.get("av-unref")?.blockID).toBeUndefined();

    expect(fetchSyncPostMock).toHaveBeenCalledWith(
      "/api/query/sql",
      expect.objectContaining({ stmt: expect.stringContaining("blk-a") }),
    );
  });

  it("queries /api/query/sql in chunks of 50 block ids", async () => {
    const hits = Array.from({ length: 51 }, (_, i) => ({
      avID: `av-${i}`,
      avName: `n${i}`,
      blockID: `blk-${i}`,
      hPath: `/p${i}`,
    }));
    installKernel({ hits, sqlBlocks: {} });

    const entries = await listWorkspaceDatabases({ owned: [] });

    expect(entries).toHaveLength(51);
    const sqlCalls = fetchSyncPostMock.mock.calls.filter(
      ([url]) => url === "/api/query/sql",
    );
    expect(sqlCalls).toHaveLength(2);
    const firstStmt = (sqlCalls[0]?.[1] as { stmt: string }).stmt;
    const secondStmt = (sqlCalls[1]?.[1] as { stmt: string }).stmt;
    expect(firstStmt).toContain("blk-0");
    expect(firstStmt).not.toContain("blk-50");
    expect(secondStmt).toContain("blk-50");
  });

  it("SQL failure degrades silently — entries listed without hostDocID", async () => {
    installKernel({
      failSql: true,
      hits: [{ avID: "av-a", avName: "甲", blockID: "blk-a", hPath: "/x/a" }],
    });

    const entries = await listWorkspaceDatabases({ owned: [] });

    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual({
      avID: "av-a",
      name: "甲",
      hostPath: "/x/a",
      origin: "active",
      health: "ok",
      blockID: "blk-a",
    });
  });
});

describe("removeDatabaseCompletely (raw fetch — app fetchSyncPost toasts errors itself)", () => {
  type FetchCall = { url: string; body?: unknown };
  let calls: FetchCall[];
  let responder: (url: string, body?: unknown) => { status: number; text: string } | Promise<never>;

  beforeEach(() => {
    fetchSyncPostMock.mockReset();
    calls = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: unknown, init?: { body?: unknown }) => {
        calls.push({ url: String(url), body: init?.body });
        const out = await responder(String(url), init?.body);
        return { status: out.status, text: async () => out.text };
      }),
    );
  });

  it("deletes the block first, then the AV file, when a blockID is present", async () => {
    responder = (url) =>
      url === "/api/block/deleteBlock"
        ? { status: 200, text: '{"code":0,"msg":"","data":null}' }
        : { status: 200, text: '{"code":0,"msg":"","data":null}' };

    await expect(
      removeDatabaseCompletely({ avID: "av-orphan", blockID: "blk-av-orphan" }),
    ).resolves.toBe("deleted");

    expect(calls).toHaveLength(2);
    // Block first (removes the embedded database from its document)…
    expect(calls[0]!.url).toBe("/api/block/deleteBlock");
    expect(JSON.parse(String(calls[0]!.body))).toEqual({ id: "blk-av-orphan" });
    // …then the AV data file (database-level deletion, documents irrelevant).
    expect(calls[1]!.url).toBe("/api/file/removeFile");
    expect(JSON.parse(String(calls[1]!.body))).toEqual({
      path: "/data/storage/av/av-orphan.json",
    });
    // The app-layer fetchSyncPost (which toasts kernel errors) stays out of it.
    expect(fetchSyncPostMock).not.toHaveBeenCalled();
  });

  it("tolerates a deleteBlock kernel rejection (tree not found) and still deletes the file", async () => {
    responder = (url) =>
      url === "/api/block/deleteBlock"
        ? { status: 200, text: '{"code":-1,"msg":"tree not found","data":null}' }
        : { status: 200, text: '{"code":0,"msg":"","data":null}' };

    await expect(
      removeDatabaseCompletely({ avID: "av-x", blockID: "blk-gone" }),
    ).resolves.toBe("deleted");

    expect(calls.map((c) => c.url)).toEqual(["/api/block/deleteBlock", "/api/file/removeFile"]);
  });

  it("tolerates a deleteBlock network failure", async () => {
    responder = (url) =>
      url === "/api/block/deleteBlock"
        ? Promise.reject(new Error("network boom"))
        : { status: 200, text: '{"code":0,"msg":"","data":null}' };

    await expect(removeDatabaseCompletely({ avID: "av-x", blockID: "blk-y" })).resolves.toBe(
      "deleted",
    );
    expect(calls).toHaveLength(2);
  });

  it("skips deleteBlock entirely when no blockID is given", async () => {
    responder = () => ({ status: 200, text: '{"code":0,"msg":"","data":null}' });

    await expect(removeDatabaseCompletely({ avID: "av-bare" })).resolves.toBe("deleted");

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("/api/file/removeFile");
  });

  it("treats removeFile 404 (path does not exist) as success — already gone", async () => {
    responder = () => ({
      status: 200,
      text: '{"code":404,"msg":"path does not exist","data":null}',
    });

    await expect(removeDatabaseCompletely({ avID: "av-gone" })).resolves.toBe("deleted");
  });

  it("throws with the kernel message on other removeFile errors", async () => {
    responder = () => ({
      status: 200,
      text: '{"code":-1,"msg":"permission denied","data":null}',
    });

    await expect(removeDatabaseCompletely({ avID: "av-x" })).rejects.toThrow("permission denied");
  });

  it("throws on removeFile network failure", async () => {
    responder = () => Promise.reject(new Error("network boom"));

    await expect(removeDatabaseCompletely({ avID: "av-x" })).rejects.toThrow("network boom");
  });
});

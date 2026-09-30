import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchSyncPost } from "siyuan";
import { createOwnedDatabase } from "@/services/ownedDatabase";
import { getDatabaseType, getTableTemplate } from "@/models/databaseTypes";

const fetchSyncPostMock = vi.mocked(fetchSyncPost);

vi.mock("siyuan", () => ({
  fetchSyncPost: vi.fn(),
  openTab: vi.fn(),
}));

interface FakeKey {
  id: string;
  name: string;
  type: string;
  options?: Array<{ name: string; color?: string }>;
}

/**
 * Stateful in-memory AV: putFile writes replace the whole payload,
 * addAttributeViewKey appends keys — mirrors the kernel closely enough
 * to assert seed naming, column order and option patches.
 */
let avState: { name: string; keyValues: Array<{ key: FakeKey }> };
/** Simulates the kernel's in-memory AV cache serving a stale name. */
let kernelCachedName: string | null = null;

function freshHomeDocId(suffix = "homedoc"): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp =
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
    + `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  return `${stamp}-${suffix}`;
}

async function putFilePayloads(): Promise<Array<Record<string, unknown>>> {
  const calls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.filter(
    (c) => String(c[0]).includes("/api/file/putFile"),
  );
  const out: Array<Record<string, unknown>> = [];
  for (const call of calls) {
    const form = (call[1] as { body: FormData }).body;
    const file = form.get("file") as File;
    out.push(JSON.parse(await file.text()) as Record<string, unknown>);
  }
  return out;
}

function putFilePaths(): string[] {
  const calls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.filter(
    (c) => String(c[0]).includes("/api/file/putFile"),
  );
  return calls.map((c) => String((c[1] as { body: FormData }).body.get("path")));
}

function duplicateCalls(): Array<{ avID: string }> {
  return fetchSyncPostMock.mock.calls
    .filter((c) => c[0] === "/api/av/duplicateAttributeViewBlock")
    .map((c) => c[1] as { avID: string });
}

let duplicateSeq = 0;
let homeDocIdMock = "";

describe("createOwnedDatabase", () => {
  beforeEach(() => {
    fetchSyncPostMock.mockReset();
    avState = { name: "", keyValues: [] };
    kernelCachedName = null;
    duplicateSeq = 0;
    homeDocIdMock = freshHomeDocId();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: unknown, init?: { body?: unknown }) => {
        if (String(url).includes("/api/file/putFile")) {
          const form = init?.body as FormData;
          const file = form.get("file") as File;
          avState = JSON.parse(await file.text());
        }
        return {
          ok: true,
          status: 200,
          text: async () => '{"code":0,"msg":"","data":null}',
        };
      }),
    );

    fetchSyncPostMock.mockImplementation(async (url: string, body?: unknown) => {
      if (url === "/api/av/getAttributeView") {
        const av = JSON.parse(JSON.stringify(avState)) as { name: string };
        if (kernelCachedName !== null) av.name = kernelCachedName;
        return { code: 0, msg: "", data: { av } };
      }
      if (url === "/api/file/getFile") {
        // rename/sync read the DISK file, not the kernel cache.
        return {
          code: 0,
          msg: "",
          data: JSON.stringify(JSON.parse(JSON.stringify(avState))),
        };
      }
      if (url === "/api/filetree/createDocWithMd") {
        return { code: 0, msg: "", data: homeDocIdMock };
      }
      if (url === "/api/av/duplicateAttributeViewBlock") {
        // The duplicate inherits the seed contents (kernel behavior).
        duplicateSeq += 1;
        avState = JSON.parse(JSON.stringify(avState));
        return {
          code: 0,
          msg: "",
          data: {
            avID: `20260101120000-newdb0${duplicateSeq}`,
            blockID: `20260101120000-newblk${duplicateSeq}`,
          },
        };
      }
      if (url === "/api/block/appendBlock") {
        return { code: 0, msg: "", data: [{ doOperations: [] }] };
      }
      if (url === "/api/av/getMirrorDatabaseBlocks") {
        return {
          code: 0,
          msg: "",
          data: { refDefs: [{ refID: "20260101120000-newblk1", defIDs: [] }] },
        };
      }
      if (url === "/api/av/addAttributeViewKey") {
        const b = body as { keyID: string; keyName: string; keyType: string };
        avState.keyValues.push({ key: { id: b.keyID, name: b.keyName, type: b.keyType } });
        return { code: 0, msg: "", data: null };
      }
      return { code: 0, msg: "", data: null };
    });
  });

  it("duplicates an EMPTY-named seed and stamps the final name right after duplication (legacy typeId path)", async () => {
    const db = await createOwnedDatabase({
      notebookId: "nb-1",
      name: "项目库",
    });

    expect(db.name).toBe("项目库");
    expect(db.homeDocId).toBe(homeDocIdMock);
    expect(db.source).toBe("managed");
    expect(db.typeId).toBe("generic");
    expect(db.avID).toBe("20260101120000-newdb01");
    expect(db.avBlockID).toBe("20260101120000-newblk1");
    expect("templateKey" in db).toBe(false);

    const paths = putFilePaths();
    const puts = await putFilePayloads();
    // 1 seed write + 1 final-name write (generic columns carry no options).
    expect(puts).toHaveLength(2);

    // Seed: empty AV name (kernel only suffixes non-empty names), block key
    // already carries the final table title.
    expect(paths[0]).toMatch(/\/data\/storage\/av\/[^/]+\.json$/);
    const seedKeys = puts[0]!.keyValues as Array<{ key: { name: string; type: string } }>;
    expect(puts[0]!.name).toBe("");
    expect(seedKeys).toHaveLength(1);
    expect(seedKeys[0]!.key).toMatchObject({ name: "项目库", type: "block" });

    // Duplicate consumed the per-create seed.
    expect(duplicateCalls()).toEqual([{ avID: expect.any(String) }]);
    const seedAvID = (paths[0]!.match(/\/av\/([^/]+)\.json$/) as RegExpMatchArray)[1];
    expect(duplicateCalls()[0]!.avID).toBe(seedAvID);

    // Name stamp runs BEFORE column writes: at that point the file only
    // holds the primary key, so the merge cannot clobber columns (live-kernel
    // lesson: a late rename over a lagging kernel cache dropped them).
    const genericCols = getDatabaseType("generic").columns;
    expect(puts[1]!.name).toBe("项目库");
    const stampKeys = puts[1]!.keyValues as Array<{ key: { name: string } }>;
    expect(stampKeys.map((k) => k.key.name)).toEqual(["项目库"]);
    // Columns are added AFTER the stamp and survive on disk.
    expect(avState.name).toBe("项目库");
    expect(
      (avState.keyValues as Array<{ key: { name: string } }>).map((k) => k.key.name),
    ).toEqual(["项目库", ...genericCols.map((c) => c.name)]);

    // Home doc named after the table itself (no 表 · prefix).
    const createDocCalls = fetchSyncPostMock.mock.calls.filter(
      (c) => c[0] === "/api/filetree/createDocWithMd",
    );
    expect((createDocCalls[0]![1] as { path: string }).path).toBe("/项目库");
  });

  it("creates from a template key: name stamped before columns, options intact, plain home doc", async () => {
    const tasks = getTableTemplate("tasks")!;
    const db = await createOwnedDatabase({
      notebookId: "nb-1",
      name: "任务清单",
      templateKey: "tasks",
    });

    expect(db.templateKey).toBe("tasks");
    expect("typeId" in db).toBe(false);

    const createDocCalls = fetchSyncPostMock.mock.calls.filter(
      (c) => c[0] === "/api/filetree/createDocWithMd",
    );
    expect(createDocCalls).toHaveLength(1);
    expect((createDocCalls[0]![1] as { path: string }).path).toBe("/任务清单");

    const paths = putFilePaths();
    const puts = await putFilePayloads();
    const optionCols = tasks.columns.filter((c) => c.options?.length);
    // 1 seed write + 1 name stamp + 1 put per option column.
    expect(puts).toHaveLength(2 + optionCols.length);
    expect(puts[0]!.name).toBe("");

    // The name stamp is the SECOND putFile and predates every column write:
    // it merges primary-only JSON, so it cannot drop template columns.
    expect(puts[1]!.name).toBe("任务清单");
    expect(
      (puts[1]!.keyValues as Array<{ key: { name: string } }>).map((k) => k.key.name),
    ).toEqual(["任务清单"]);
    expect(avState.name).toBe("任务清单");
    expect(avState.keyValues.map((k) => k.key.name)).toEqual([
      "任务清单",
      ...tasks.columns.map((c) => c.name),
    ]);
    const status = avState.keyValues.find((k) => k.key.name === "状态")!;
    expect(status.key.options?.map((o) => o.name)).toEqual([
      "待办",
      "进行中",
      "已完成",
      "取消",
    ]);
    const tags = avState.keyValues.find((k) => k.key.name === "标签")!;
    expect(tags.key.options?.map((o) => o.name)).toEqual(["工作", "个人", "灵感"]);
  });

  it("mints a fresh seed per creation (no cross-creation seed reuse)", async () => {
    await createOwnedDatabase({
      notebookId: "nb-1",
      name: "第一张",
      columns: [{ name: "备注", type: "text" }],
    });
    const run1Paths = putFilePaths();
    await createOwnedDatabase({
      notebookId: "nb-1",
      name: "第二张",
      columns: [{ name: "备注", type: "text" }],
    });
    const run2Paths = putFilePaths().slice(run1Paths.length);

    expect(duplicateCalls()).toHaveLength(2);
    const seedOf = (paths: string[]) =>
      (paths[0]!.match(/\/av\/([^/]+)\.json$/) as RegExpMatchArray)[1];
    // Each creation duplicates its own freshly written seed AV.
    expect(duplicateCalls()[0]!.avID).toBe(seedOf(run1Paths));
    expect(duplicateCalls()[1]!.avID).toBe(seedOf(run2Paths));
    expect(seedOf(run1Paths)).not.toBe(seedOf(run2Paths));
  });

  it("adds explicit columns verbatim (url type passes through)", async () => {
    const db = await createOwnedDatabase({
      notebookId: "nb-1",
      name: "空白表",
      columns: [
        { name: "备注", type: "text" },
        { name: "来源", type: "url" },
      ],
    });

    expect(db.name).toBe("空白表");
    const addKeyCalls = fetchSyncPostMock.mock.calls.filter(
      (c) => c[0] === "/api/av/addAttributeViewKey",
    );
    expect(addKeyCalls).toHaveLength(2);
    expect(addKeyCalls[0]![1]).toMatchObject({ keyName: "备注", keyType: "text" });
    expect(addKeyCalls[1]![1]).toMatchObject({ keyName: "来源", keyType: "url" });
    expect(avState.keyValues.map((k) => k.key.type)).toEqual(["block", "text", "url"]);
  });

  it("rejects when the home doc id is not freshly created (same-name doc reuse)", async () => {
    fetchSyncPostMock.mockImplementation(async (url: string) => {
      if (url === "/api/av/getAttributeView") {
        return { code: 0, msg: "", data: { av: JSON.parse(JSON.stringify(avState)) } };
      }
      if (url === "/api/filetree/createDocWithMd") {
        // Old kernels return an EXISTING same-named doc instead of creating one.
        return { code: 0, msg: "", data: "20240101120000-oldhome" };
      }
      return { code: 0, msg: "", data: null };
    });

    await expect(
      createOwnedDatabase({ notebookId: "nb-1", name: "撞名表" }),
    ).rejects.toThrow(/同名文档/);
    // Nothing was written: no seed, no duplicate, no block insertion.
    expect(putFilePaths()).toHaveLength(0);
    expect(duplicateCalls()).toHaveLength(0);
    const appendCalls = fetchSyncPostMock.mock.calls.filter(
      (c) => c[0] === "/api/block/appendBlock",
    );
    expect(appendCalls).toHaveLength(0);
  });

  it("warns (not throws) when the AV file is unreadable at name stamp", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    fetchSyncPostMock.mockImplementation(async (url: string) => {
      if (url === "/api/file/getFile") {
        return { code: -1, msg: "disk io error", data: null };
      }
      if (url === "/api/av/getAttributeView") {
        // Seed-write verification reads (rename reads getFile, which errors).
        return { code: 0, msg: "", data: { av: JSON.parse(JSON.stringify(avState)) } };
      }
      if (url === "/api/filetree/createDocWithMd") {
        return { code: 0, msg: "", data: homeDocIdMock };
      }
      if (url === "/api/av/duplicateAttributeViewBlock") {
        duplicateSeq += 1;
        avState = JSON.parse(JSON.stringify(avState));
        return {
          code: 0,
          msg: "",
          data: {
            avID: `20260101120000-newdb0${duplicateSeq}`,
            blockID: `20260101120000-newblk${duplicateSeq}`,
          },
        };
      }
      if (url === "/api/block/appendBlock") {
        return { code: 0, msg: "", data: [{ doOperations: [] }] };
      }
      if (url === "/api/av/getMirrorDatabaseBlocks") {
        return { code: 0, msg: "", data: { refDefs: [{ refID: "x" }] } };
      }
      return { code: 0, msg: "", data: null };
    });
    try {
      const db = await createOwnedDatabase({
        notebookId: "nb-1",
        name: "缓存表",
        columns: [{ name: "备注", type: "text" }],
      });
      // Creation succeeds; the catalog keeps the intended name…
      expect(db.name).toBe("缓存表");
      // …the name stamp could not be written (only the seed put ran)…
      expect(putFilePaths()).toHaveLength(1);
      expect(avState.name).toBe("");
      // …and the failure was reported, not thrown.
      expect(warnSpy).toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("rejects unknown template keys", async () => {
    await expect(
      createOwnedDatabase({
        notebookId: "nb-1",
        name: "X",
        templateKey: "nope",
      }),
    ).rejects.toThrow(/nope/);
  });
});

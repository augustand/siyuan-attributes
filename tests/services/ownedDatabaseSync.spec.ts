import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchSyncPost } from "siyuan";
import type { OwnedDatabase } from "@/models/ownedDatabase";
import { syncOwnedDatabaseNames } from "@/services/ownedDatabase";

const fetchSyncPostMock = vi.mocked(fetchSyncPost);

vi.mock("siyuan", () => ({
  fetchSyncPost: vi.fn(),
  openTab: vi.fn(),
}));

interface PutPayload extends Record<string, unknown> {
  name?: string;
}

let avState: { name: string; keyValues: Array<{ key: { name: string } }> };
const putPayloads: PutPayload[] = [];

function db(avID: string, name: string): OwnedDatabase {
  return {
    id: avID,
    name,
    avID,
    avBlockID: `blk-${avID}`,
    createdAt: 1,
  };
}

describe("syncOwnedDatabaseNames", () => {
  beforeEach(() => {
    fetchSyncPostMock.mockReset();
    avState = { name: "", keyValues: [{ key: { name: "任务清单" } }] };
    putPayloads.length = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: unknown, init?: { body?: unknown }) => {
        if (String(url).includes("/api/file/putFile")) {
          const form = init?.body as FormData;
          const file = form.get("file") as File;
          const payload = JSON.parse(await file.text()) as PutPayload;
          putPayloads.push(payload);
          avState = payload as typeof avState;
        }
        return {
          ok: true,
          status: 200,
          text: async () => '{"code":0,"msg":"","data":null}',
        };
      }),
    );
    fetchSyncPostMock.mockImplementation(async (url: string) => {
      if (url === "/api/file/getFile") {
        // sync reads the DISK file, not the kernel cache.
        return {
          code: 0,
          msg: "",
          data: JSON.stringify(JSON.parse(JSON.stringify(avState))),
        };
      }
      return { code: 0, msg: "", data: null };
    });
  });

  it("re-stamps the catalog name when the AV name is empty (kernel cache clobber)", async () => {
    avState.name = "";
    await syncOwnedDatabaseNames([db("av-1", "任务清单")]);

    expect(putPayloads).toHaveLength(1);
    expect(putPayloads[0]!.name).toBe("任务清单");
    expect(avState.name).toBe("任务清单");
    // Full AV JSON merged — the block key survives.
    expect(avState.keyValues).toEqual([{ key: { name: "任务清单" } }]);
  });

  it("re-stamps legacy ' (Duplicated …)' names", async () => {
    avState.name = "任务清单 (Duplicated 2026-09-30 09:57:00)";
    await syncOwnedDatabaseNames([db("av-1", "任务清单")]);

    expect(putPayloads).toHaveLength(1);
    expect(putPayloads[0]!.name).toBe("任务清单");
  });

  it("respects user renames (non-Duplicated non-empty names are left alone)", async () => {
    avState.name = "我的改名";
    await syncOwnedDatabaseNames([db("av-1", "任务清单")]);

    expect(putPayloads).toHaveLength(0);
    expect(avState.name).toBe("我的改名");
  });

  it("skips when the AV name already matches the catalog", async () => {
    avState.name = "任务清单";
    await syncOwnedDatabaseNames([db("av-1", "任务清单")]);

    expect(putPayloads).toHaveLength(0);
  });

  it("accepts the RAW file-body response shape (no envelope)", async () => {
    avState.name = "";
    fetchSyncPostMock.mockImplementation(async () =>
      JSON.parse(JSON.stringify(avState)) as never,
    );
    await syncOwnedDatabaseNames([db("av-1", "任务清单")]);

    expect(putPayloads).toHaveLength(1);
    expect(putPayloads[0]!.name).toBe("任务清单");
  });

  it("skips databases without a catalog name", async () => {
    avState.name = "";
    await syncOwnedDatabaseNames([db("av-1", "")]);

    expect(putPayloads).toHaveLength(0);
  });

  it("logs and continues when one database fails", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      fetchSyncPostMock.mockImplementation(async (url: string) => {
        if (url === "/api/file/getFile") {
          throw new Error("kernel down");
        }
        return { code: 0, msg: "", data: null };
      });
      avState.name = "";
      await expect(
        syncOwnedDatabaseNames([db("av-1", "任务清单"), db("av-2", "项目")]),
      ).resolves.toBeUndefined();
      expect(warnSpy).toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });
});

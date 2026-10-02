import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchSyncPost } from "siyuan";
import {
  bindDocumentToDatabase,
  unbindDocumentFromDatabase,
} from "@/services/attributeView";

const fetchSyncPostMock = vi.mocked(fetchSyncPost);

vi.mock("siyuan", () => ({
  fetchSyncPost: vi.fn(),
}));

beforeEach(() => {
  fetchSyncPostMock.mockReset();
});


describe("unbindDocumentFromDatabase on kernel 3.8.6 (row id != doc id)", () => {
  function installKeys(handlers: Record<string, unknown>): void {
    fetchSyncPostMock.mockImplementation(async (url: string, body?: unknown) => {
      if (url === "/api/av/getAttributeViewKeys") {
        const id = (body as { id: string }).id;
        return { code: 0, msg: "", data: (handlers[id] ?? []) as unknown };
      }
      if (url === "/api/av/removeAttributeViewBlocks") {
        const args = body as { avID: string; srcIDs: string[] };
        calls.push(args);
        return { code: 0, msg: "", data: null };
      }
      return { code: 0, msg: "", data: null };
    });
  }
  let calls: Array<{ avID: string; srcIDs: string[] }>;
  const keysWhileBound = [
    {
      avID: "av-1",
      keyValues: [{ values: [{ blockID: "row-99" }] }],
    },
  ];

  beforeEach(() => {
    fetchSyncPostMock.mockReset();
    calls = [];
  });

  it("removes by the resolved ROW id, not the doc id", async () => {
    installKeys({ "doc-1": keysWhileBound, "doc-1-after": [] });
    // 第一次读(解析行 id)返回绑定态;解绑后的复核读取返回空。
    let read = 0;
    fetchSyncPostMock.mockImplementation(async (url: string, body?: unknown) => {
      if (url === "/api/av/getAttributeViewKeys") {
        read += 1;
        return { code: 0, msg: "", data: read === 1 ? keysWhileBound : [] };
      }
      if (url === "/api/av/removeAttributeViewBlocks") {
        const args = body as { avID: string; srcIDs: string[] };
        calls.push(args);
        return { code: 0, msg: "", data: null };
      }
      return { code: 0, msg: "", data: null };
    });

    await expect(unbindDocumentFromDatabase({ avID: "av-1", docId: "doc-1" })).resolves.toBeUndefined();
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({ avID: "av-1", srcIDs: ["row-99"] });
  });

  it("falls back to the doc id when row resolution finds nothing", async () => {
    fetchSyncPostMock.mockImplementation(async (url: string, body?: unknown) => {
      if (url === "/api/av/getAttributeViewKeys") {
        return { code: 0, msg: "", data: [] };
      }
      if (url === "/api/av/removeAttributeViewBlocks") {
        const args = body as { avID: string; srcIDs: string[] };
        calls.push(args);
        return { code: 0, msg: "", data: null };
      }
      return { code: 0, msg: "", data: null };
    });

    await expect(unbindDocumentFromDatabase({ avID: "av-1", docId: "doc-1" })).resolves.toBeUndefined();
    expect(calls[0]).toEqual({ avID: "av-1", srcIDs: ["doc-1"] });
  });

  it("throws a guided error when the kernel reports the binding still present", async () => {
    fetchSyncPostMock.mockImplementation(async (url: string) => {
      if (url === "/api/av/getAttributeViewKeys") {
        return { code: 0, msg: "", data: keysWhileBound };
      }
      if (url === "/api/av/removeAttributeViewBlocks") {
        return { code: 0, msg: "", data: null };
      }
      return { code: 0, msg: "", data: null };
    });

    await expect(unbindDocumentFromDatabase({ avID: "av-1", docId: "doc-1" })).rejects.toThrow(
      "解绑未生效",
    );
  });
});

describe("bindDocumentToDatabase", () => {
  it("posts addAttributeViewBlocks for a bound doc", async () => {
    fetchSyncPostMock.mockImplementation(async (url: string) => {
      if (url === "/api/av/addAttributeViewBlocks") {
        return { code: 0, msg: "", data: null };
      }
      if (url === "/api/av/getAttributeViewKeys") {
        return {
          code: 0,
          msg: "",
          data: [{ avID: "av-1", avName: "Tasks", keyValues: [] }],
        };
      }
      return { code: 0, msg: "", data: null };
    });
    await bindDocumentToDatabase({
      avID: "av-1",
      avBlockID: "block-av",
      docId: "doc-1",
    });
    expect(fetchSyncPostMock).toHaveBeenCalledWith("/api/av/addAttributeViewBlocks", {
      avID: "av-1",
      blockID: "block-av",
      srcs: [{ id: "doc-1", isDetached: false }],
    });
    expect(fetchSyncPostMock).toHaveBeenCalledWith("/api/av/getAttributeViewKeys", {
      id: "doc-1",
    });
  });

  it("throws when bind does not stick for under-title attributes", async () => {
    fetchSyncPostMock.mockImplementation(async (url: string) => {
      if (url === "/api/av/addAttributeViewBlocks") {
        return { code: 0, msg: "", data: null };
      }
      if (url === "/api/av/getAttributeViewKeys") {
        return { code: 0, msg: "", data: [] };
      }
      return { code: 0, msg: "", data: null };
    });
    await expect(
      bindDocumentToDatabase({
        avID: "av-1",
        avBlockID: "block-av",
        docId: "doc-1",
      }),
    ).rejects.toThrow(/标题下仍读不到/);
  });
});

describe("unbindDocumentFromDatabase", () => {
  it("posts removeAttributeViewBlocks", async () => {
    fetchSyncPostMock.mockResolvedValue({ code: 0, msg: "", data: null });
    await unbindDocumentFromDatabase({ avID: "av-1", docId: "doc-1" });
    expect(fetchSyncPostMock).toHaveBeenCalledWith("/api/av/removeAttributeViewBlocks", {
      avID: "av-1",
      srcIDs: ["doc-1"],
    });
  });
});

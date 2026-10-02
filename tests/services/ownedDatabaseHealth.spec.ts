import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchSyncPost } from "siyuan";
import { checkOwnedDatabaseHealth } from "@/services/ownedDatabase";

const fetchSyncPostMock = vi.mocked(fetchSyncPost);

vi.mock("siyuan", () => ({
  fetchSyncPost: vi.fn(),
  openTab: vi.fn(),
}));

describe("checkOwnedDatabaseHealth", () => {
  beforeEach(() => {
    fetchSyncPostMock.mockReset();
  });

  it("returns ok when the AV file reads back off disk — mirror probe never consulted", async () => {
    fetchSyncPostMock.mockImplementation(async (url: string) => {
      if (url === "/api/file/getFile") {
        // Raw file body (dual-shape reader): no {code,msg,data} envelope.
        return { id: "av-1", name: "任务", keyValues: [], views: [] };
      }
      throw new Error(`unexpected endpoint: ${url}`);
    });

    expect(await checkOwnedDatabaseHealth("av-1")).toBe("ok");

    // getMirrorDatabaseBlocks returns refDefs: [] for healthy databases on
    // kernel 3.8.4 — it must never be used for health classification.
    expect(fetchSyncPostMock).toHaveBeenCalledTimes(1);
    expect(fetchSyncPostMock).toHaveBeenCalledWith("/api/file/getFile", {
      path: "/data/storage/av/av-1.json",
    });
  });

  it("returns missing when the AV file is missing or unreadable", async () => {
    fetchSyncPostMock.mockImplementation(async (url: string) => {
      if (url === "/api/file/getFile") {
        return { code: 404, msg: "file not found", data: null };
      }
      throw new Error(`unexpected endpoint: ${url}`);
    });

    expect(await checkOwnedDatabaseHealth("av-1")).toBe("missing");
  });

  it("returns missing when getFile itself throws (network/kernel failure)", async () => {
    fetchSyncPostMock.mockRejectedValue(new Error("network down"));
    expect(await checkOwnedDatabaseHealth("av-1")).toBe("missing");
  });

  it("never produces broken anymore — only ok/missing exist at runtime", async () => {
    fetchSyncPostMock.mockImplementation(async (url: string) => {
      if (url === "/api/file/getFile") {
        return { code: -1, msg: "no", data: null };
      }
      throw new Error(`unexpected endpoint: ${url}`);
    });
    const health = await checkOwnedDatabaseHealth("av-1");
    expect(["ok", "missing"]).toContain(health);
    expect(health).toBe("missing");
  });
});

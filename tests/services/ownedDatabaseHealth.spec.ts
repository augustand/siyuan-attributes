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

  it("returns missing when AV cannot be read", async () => {
    fetchSyncPostMock.mockResolvedValueOnce({ code: -1, msg: "no", data: null });
    expect(await checkOwnedDatabaseHealth("av-1")).toBe("missing");
  });

  it("returns broken when mirror refs are empty", async () => {
    fetchSyncPostMock
      .mockResolvedValueOnce({ code: 0, msg: "", data: { av: { id: "av-1" } } })
      .mockResolvedValueOnce({ code: 0, msg: "", data: { refDefs: [] } });
    expect(await checkOwnedDatabaseHealth("av-1")).toBe("broken");
  });

  it("returns ok when mirror has refs", async () => {
    fetchSyncPostMock
      .mockResolvedValueOnce({ code: 0, msg: "", data: { av: { id: "av-1" } } })
      .mockResolvedValueOnce({
        code: 0,
        msg: "",
        data: { refDefs: [{ refID: "blk-1", defIDs: [] }] },
      });
    expect(await checkOwnedDatabaseHealth("av-1")).toBe("ok");
  });
});

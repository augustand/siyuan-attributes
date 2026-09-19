import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchSyncPost } from "siyuan";
import { fetchBlockAttrs, writeBlockAttrs } from "@/services/blockAttrs";

const fetchSyncPostMock = vi.mocked(fetchSyncPost);

vi.mock("siyuan", () => ({
  fetchSyncPost: vi.fn(),
}));

describe("blockAttrs service", () => {
  beforeEach(() => {
    fetchSyncPostMock.mockReset();
  });

  it("fetches block attributes", async () => {
    fetchSyncPostMock.mockResolvedValue({ code: 0, msg: "", data: { id: "doc" } });
    await expect(fetchBlockAttrs("doc")).resolves.toEqual({ id: "doc" });
    expect(fetchSyncPostMock).toHaveBeenCalledWith("/api/attr/getBlockAttrs", { id: "doc" });
  });

  it("deletes by writing an empty string", async () => {
    fetchSyncPostMock.mockResolvedValue({ code: 0, msg: "", data: null });
    await writeBlockAttrs("doc", { "custom-old": "" });
    expect(fetchSyncPostMock).toHaveBeenCalledWith("/api/attr/setBlockAttrs", {
      id: "doc",
      attrs: { "custom-old": "" },
    });
  });

  it("throws normalized errors", async () => {
    fetchSyncPostMock.mockResolvedValue({ code: -1, msg: "bad attribute" });
    await expect(writeBlockAttrs("doc", { "custom-x": "1" })).rejects.toThrow("bad attribute");
  });
});

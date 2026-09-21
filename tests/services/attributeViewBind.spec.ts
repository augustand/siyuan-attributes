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

describe("bindDocumentToDatabase", () => {
  it("posts addAttributeViewBlocks for a bound doc", async () => {
    fetchSyncPostMock.mockResolvedValue({ code: 0, msg: "", data: null });
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

import { describe, expect, it } from "vitest";
import { listDatabaseBoundDocs } from "@/services/attributeView";
import { fetchSyncPost } from "siyuan";
import { beforeEach, vi } from "vitest";

const fetchSyncPostMock = vi.mocked(fetchSyncPost);

vi.mock("siyuan", () => ({
  fetchSyncPost: vi.fn(),
}));

describe("listDatabaseBoundDocs", () => {
  beforeEach(() => {
    fetchSyncPostMock.mockReset();
  });

  it("reads document id from rows.values[].block", async () => {
    fetchSyncPostMock.mockResolvedValue({
      code: 0,
      msg: "",
      data: {
        rows: {
          key: { id: "k", type: "block" },
          values: [
            {
              id: "cell-1",
              blockID: "item-1",
              block: { id: "doc-1", content: "标题A" },
            },
          ],
        },
      },
    });
    expect(await listDatabaseBoundDocs("av-1")).toEqual([
      { id: "doc-1", content: "标题A" },
    ]);
  });
});

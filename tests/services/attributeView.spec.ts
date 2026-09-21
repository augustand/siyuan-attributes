import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchSyncPost } from "siyuan";
import { fetchAttributeViews, writeDatabaseCell } from "@/services/attributeView";
import type { DatabaseField } from "@/models/attributeView";

const fetchSyncPostMock = vi.mocked(fetchSyncPost);

vi.mock("siyuan", () => ({
  fetchSyncPost: vi.fn(),
}));

beforeEach(() => {
  fetchSyncPostMock.mockReset();
});

describe("fetchAttributeViews", () => {
  it("normalizes getAttributeViewKeys data with documentID fallback", async () => {
    fetchSyncPostMock.mockResolvedValue({
      code: 0,
      msg: "",
      data: [
        {
          avID: "av-1",
          avName: "Tasks",
          keyValues: [
            {
              key: { id: "key-text", name: "Note", type: "text" },
              values: [],
            },
          ],
        },
      ],
    });

    const panels = await fetchAttributeViews("doc-1");
    expect(fetchSyncPostMock).toHaveBeenCalledWith("/api/av/getAttributeViewKeys", { id: "doc-1" });
    expect(panels[0].fields[0].value.itemID).toBe("doc-1");
  });
});

describe("writeDatabaseCell", () => {
  it("posts setAttributeViewBlockAttr with itemID", async () => {
    fetchSyncPostMock.mockResolvedValue({ code: 0, msg: "", data: null });
    const field: DatabaseField = {
      keyID: "key-text",
      name: "Note",
      type: "text",
      icon: "view-list",
      editable: true,
      options: [],
      value: {
        id: "",
        keyID: "key-text",
        itemID: "doc-1",
        type: "text",
        text: "hello",
        url: "",
        email: "",
        phone: "",
        template: "",
        checked: false,
        options: [],
        blockContent: "",
        raw: {},
      },
    };

    await writeDatabaseCell({ avID: "av-1", field });
    expect(fetchSyncPostMock).toHaveBeenCalledWith("/api/av/setAttributeViewBlockAttr", {
      avID: "av-1",
      keyID: "key-text",
      itemID: "doc-1",
      value: { text: { content: "hello" } },
    });
  });
});

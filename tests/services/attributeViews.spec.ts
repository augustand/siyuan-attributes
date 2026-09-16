import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchSyncPost } from "siyuan";
import {
  fetchAttributeViews,
  writeDatabaseCell,
} from "@/services/attributeViews";
import { normalizeAttributeViews } from "@/models/attributeView";

const fetchSyncPostMock = vi.mocked(fetchSyncPost);

vi.mock("siyuan", () => ({
  fetchSyncPost: vi.fn(),
}));

const rawFields = [
  {
    avID: "av-1",
    avName: "Tasks",
    keyValues: [
      {
        key: { id: "key-title", name: "Title", type: "block" },
        values: [{ id: "value-title", blockID: "item-1", type: "block", block: { content: "Task" } }],
      },
      {
        key: { id: "key-text", name: "Notes", type: "text" },
        values: [{
          id: "value-text",
          keyID: "key-text",
          blockID: "item-1",
          type: "text",
          text: { content: "old" },
        }],
      },
    ],
  },
];

describe("attributeViews service", () => {
  beforeEach(() => {
    fetchSyncPostMock.mockReset();
  });

  it("fetches and normalizes database fields", async () => {
    fetchSyncPostMock.mockResolvedValue({ code: 0, msg: "", data: rawFields });

    await expect(fetchAttributeViews("doc-1")).resolves.toEqual(
      normalizeAttributeViews(rawFields),
    );
    expect(fetchSyncPostMock).toHaveBeenCalledWith("/api/av/getAttributeViewKeys", {
      id: "doc-1",
    });
  });

  it("writes cells with itemID and never rowID", async () => {
    fetchSyncPostMock.mockResolvedValue({ code: 0, msg: "", data: null });
    const [field] = normalizeAttributeViews(rawFields)[0].fields;
    field.value.text = "new";

    await writeDatabaseCell({
      avID: "av-1",
      field,
    });

    const [url, payload] = fetchSyncPostMock.mock.calls[0];
    expect(url).toBe("/api/av/setAttributeViewBlockAttr");
    expect(payload).toEqual({
      avID: "av-1",
      keyID: "key-text",
      itemID: "item-1",
      value: { text: { content: "new" } },
    });
    expect(JSON.stringify(payload)).not.toContain("rowID");
  });

  it("throws normalized write errors", async () => {
    fetchSyncPostMock.mockResolvedValue({ code: -1, msg: "item not found" });
    const [field] = normalizeAttributeViews(rawFields)[0].fields;

    await expect(writeDatabaseCell({ avID: "av-1", field })).rejects.toThrow("item not found");
  });
});

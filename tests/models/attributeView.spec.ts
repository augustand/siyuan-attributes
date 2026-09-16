import { describe, expect, it } from "vitest";
import {
  buildDatabaseCellValue,
  normalizeAttributeViews,
} from "@/models/attributeView";

const rawInput = [
  {
    avID: "av-1",
    avName: "Tasks",
    keyValues: [
      {
        key: { id: "key-title", name: "Title", type: "block" },
        values: [{ id: "value-title", blockID: "item-1", type: "block", block: { content: "Task" } }],
      },
      {
        key: {
          id: "key-status",
          name: "Status",
          type: "mSelect",
          options: [
            { name: "Todo", color: "1" },
            { name: "Done", color: "2" },
          ],
        },
        values: [{
          id: "value-status",
          keyID: "key-status",
          blockID: "item-1",
          type: "mSelect",
          mSelect: [{ content: "Done", color: "2" }],
        }],
      },
      {
        key: { id: "key-url", name: "Link", type: "url" },
        values: [{
          id: "value-url",
          keyID: "key-url",
          blockID: "item-1",
          type: "url",
          url: { content: "https://example.com" },
        }],
      },
    ],
  },
];

describe("normalizeAttributeViews", () => {
  it("normalizes stable fields and preserves selected option objects", () => {
    const panels = normalizeAttributeViews(rawInput);

    expect(panels).toHaveLength(1);
    expect(panels[0]).toMatchObject({ avID: "av-1", avName: "Tasks" });
    expect(panels[0].fields).toHaveLength(2);

    const status = panels[0].fields[0];
    expect(status.keyID).toBe("key-status");
    expect(status.value.itemID).toBe("item-1");
    expect(status.options).toEqual([{ name: "Todo", color: "1" }, { name: "Done", color: "2" }]);
    expect(status.value.options).toEqual([{ name: "Done", color: "2" }]);

    const link = panels[0].fields[1];
    expect(link.value.url).toBe("https://example.com");
  });
});

describe("buildDatabaseCellValue", () => {
  it("builds a current itemID-based database payload", () => {
    const panels = normalizeAttributeViews(rawInput);
    const link = panels[0].fields[1];

    expect(buildDatabaseCellValue(link, link.value)).toEqual({
      url: { content: "https://example.com" },
    });
  });
});

import { describe, expect, it } from "vitest";
import {
  buildDatabaseCellValue,
  isDatabaseValueEmpty,
  normalizeAttributeViews,
} from "@/models/attributeView";

const rawInput = [
  {
    avID: "av-1",
    avName: "Tasks",
    keyValues: [
      {
        key: { id: "key-title", name: "Title", type: "block" },
        values: [
          {
            id: "value-title",
            blockID: "item-1",
            type: "block",
            block: { content: "Task" },
          },
        ],
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
        values: [
          {
            id: "value-status",
            keyID: "key-status",
            blockID: "item-1",
            type: "mSelect",
            mSelect: [{ content: "Done", color: "2" }],
          },
        ],
      },
      {
        key: { id: "key-note", name: "Note", type: "text" },
        values: [
          {
            id: "value-note",
            keyID: "key-note",
            blockID: "item-1",
            type: "text",
            text: { content: "" },
          },
        ],
      },
      {
        key: { id: "key-empty-url", name: "Link", type: "url" },
        values: [],
      },
    ],
  },
];

describe("normalizeAttributeViews", () => {
  it("keeps block primary key and marks common types editable", () => {
    const panels = normalizeAttributeViews(rawInput, "item-1");

    expect(panels).toHaveLength(1);
    expect(panels[0]).toMatchObject({ avID: "av-1", avName: "Tasks" });
    expect(panels[0].fields.some((f) => f.type === "block")).toBe(true);

    const status = panels[0].fields.find((f) => f.keyID === "key-status")!;
    expect(status.editable).toBe(true);
    expect(status.value.itemID).toBe("item-1");
    expect(status.options).toEqual([
      { name: "Todo", color: "1" },
      { name: "Done", color: "2" },
    ]);
    expect(status.value.options).toEqual([{ name: "Done", color: "2" }]);

    const note = panels[0].fields.find((f) => f.keyID === "key-note")!;
    expect(note.value.text).toBe("");

    const emptyUrl = panels[0].fields.find((f) => f.keyID === "key-empty-url")!;
    expect(emptyUrl.value.itemID).toBe("item-1");
    expect(emptyUrl.value.url).toBe("");
  });
});

describe("buildDatabaseCellValue", () => {
  it("builds mSelect payload with content keys for the kernel", () => {
    const status = normalizeAttributeViews(rawInput, "item-1")[0].fields.find(
      (f) => f.keyID === "key-status",
    )!;

    expect(buildDatabaseCellValue(status, status.value)).toEqual({
      mSelect: [{ content: "Done", color: "2" }],
    });
  });
});

describe("isDatabaseValueEmpty", () => {
  it("detects empty text", () => {
    const note = normalizeAttributeViews(rawInput, "item-1")[0].fields.find(
      (f) => f.keyID === "key-note",
    )!;
    expect(isDatabaseValueEmpty(note)).toBe(true);
  });
});

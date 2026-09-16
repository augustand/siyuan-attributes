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
      {
        key: {
          id: "key-stage",
          name: "Stage",
          type: "select",
          options: [
            { name: "Active", color: "3" },
            { name: "Archived", color: "4" },
          ],
        },
        values: [{
          id: "value-stage",
          keyID: "key-stage",
          blockID: "item-1",
          type: "select",
          mSelect: [{ content: "Active", color: "3" }],
        }],
      },
      {
        key: { id: "key-range", name: "Window", type: "date" },
        values: [{
          id: "value-range",
          keyID: "key-range",
          blockID: "item-1",
          type: "date",
          date: {
            content: 1700000000000,
            content2: 1700100000000,
            isNotEmpty: true,
            isNotEmpty2: true,
            hasEndDate: true,
            isNotTime: false,
          },
        }],
      },
      {
        key: { id: "key-empty-date", name: "Due", type: "date" },
        values: [{
          id: "value-empty-date",
          keyID: "key-empty-date",
          blockID: "item-1",
          type: "date",
        }],
      },
      {
        key: { id: "key-no-options", name: "No options", type: "select" },
        values: [{ id: "value-no-options", keyID: "key-no-options", blockID: "item-1", type: "select", mSelect: [] }],
      },
    ],
  },
];

describe("normalizeAttributeViews", () => {
  it("normalizes stable fields and preserves selected option objects", () => {
    const panels = normalizeAttributeViews(rawInput);

    expect(panels).toHaveLength(1);
    expect(panels[0]).toMatchObject({ avID: "av-1", avName: "Tasks" });
    expect(panels[0].fields).toHaveLength(6);

    const status = panels[0].fields[0];
    expect(status.keyID).toBe("key-status");
    expect(status.value.itemID).toBe("item-1");
    expect(status.options).toEqual([{ name: "Todo", color: "1" }, { name: "Done", color: "2" }]);
    expect(status.value.options).toEqual([{ name: "Done", color: "2" }]);

    const link = panels[0].fields[1];
    expect(link.value.url).toBe("https://example.com");

    const stage = panels[0].fields[2];
    expect(stage.editable).toBe(true);
    expect(stage.value.options).toEqual([{ name: "Active", color: "3" }]);

    const range = panels[0].fields[3];
    expect(range.editable).toBe(true);
    expect(range.value.date).toEqual({
      content: 1700000000000,
      content2: 1700100000000,
      isNotEmpty: true,
      isNotEmpty2: true,
      hasEndDate: true,
      isNotTime: false,
    });

    const emptyDate = panels[0].fields[4];
    expect(emptyDate.editable).toBe(true);
    expect(emptyDate.value.date).toEqual({
      content: 0,
      content2: 0,
      isNotEmpty: false,
      isNotEmpty2: false,
      hasEndDate: false,
      isNotTime: true,
    });

    const noOptions = panels[0].fields[5];
    expect(noOptions.editable).toBe(false);
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

  it("builds select and multi-select payloads with option colors", () => {
    const panels = normalizeAttributeViews(rawInput);
    const status = panels[0].fields[0];
    const stage = panels[0].fields[2];

    expect(buildDatabaseCellValue(status, status.value)).toEqual({
      mSelect: [{ name: "Done", color: "2" }],
    });
    expect(buildDatabaseCellValue(stage, stage.value)).toEqual({
      mSelect: [{ name: "Active", color: "3" }],
    });
  });

  it("builds complete date and date-range payloads", () => {
    const panels = normalizeAttributeViews(rawInput);
    const range = panels[0].fields[3];
    const emptyDate = panels[0].fields[4];

    expect(buildDatabaseCellValue(range, range.value)).toEqual({
      date: {
        content: 1700000000000,
        content2: 1700100000000,
        isNotEmpty: true,
        isNotEmpty2: true,
        hasEndDate: true,
        isNotTime: false,
      },
    });
    expect(buildDatabaseCellValue(emptyDate, emptyDate.value)).toEqual({
      date: {
        content: 0,
        content2: 0,
        isNotEmpty: false,
        isNotEmpty2: false,
        hasEndDate: false,
        isNotTime: true,
      },
    });
  });
});

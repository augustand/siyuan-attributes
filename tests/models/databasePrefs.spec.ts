import { describe, expect, it } from "vitest";
import type { DatabaseField, DatabaseValue } from "@/models/attributeView";
import {
  filterVisibleFields,
  normalizeDatabaseAvPrefs,
  resolveAvPrefs,
} from "@/models/databasePrefs";

function makeValue(partial: Partial<DatabaseValue> = {}): DatabaseValue {
  return {
    id: "",
    keyID: partial.keyID ?? "",
    itemID: "doc-1",
    type: partial.type ?? "text",
    text: "",
    url: "",
    email: "",
    phone: "",
    template: "",
    checked: false,
    options: [],
    blockContent: "",
    raw: {},
    ...partial,
  };
}

function field(
  keyID: string,
  type: DatabaseField["type"],
  valuePartial: Partial<DatabaseValue> = {},
): DatabaseField {
  return {
    keyID,
    name: keyID,
    type,
    icon: "view-list",
    editable: false,
    options: [],
    value: makeValue({ keyID, type, ...valuePartial }),
  };
}

describe("filterVisibleFields", () => {
  const fields: DatabaseField[] = [
    field("pk", "block", { blockContent: "Title" }),
    field("status", "mSelect", { options: [{ name: "A", color: "1" }] }),
    field("note", "text", { text: "" }),
  ];

  it("applies hidden → primary → empty in order", () => {
    const visible = filterVisibleFields(fields, {
      hiddenKeyIDs: ["status"],
      hideEmpty: true,
      hidePrimaryKey: true,
    });
    expect(visible.map((f) => f.keyID)).toEqual([]);
  });

  it("keeps primary key when hidePrimaryKey is false", () => {
    const visible = filterVisibleFields(fields, {
      hiddenKeyIDs: [],
      hideEmpty: false,
      hidePrimaryKey: false,
    });
    expect(visible.map((f) => f.keyID)).toEqual(["pk", "status", "note"]);
  });

  it("hides empty text when hideEmpty is true", () => {
    const visible = filterVisibleFields(fields, {
      hiddenKeyIDs: [],
      hideEmpty: true,
      hidePrimaryKey: true,
    });
    expect(visible.map((f) => f.keyID)).toEqual(["status"]);
  });
});

describe("normalizeDatabaseAvPrefs", () => {
  it("fills defaults for missing fields", () => {
    expect(normalizeDatabaseAvPrefs({}, { hideEmpty: false, hidePrimaryKey: true })).toEqual({
      hiddenKeyIDs: [],
      hideEmpty: false,
      hidePrimaryKey: true,
    });
  });
});

describe("resolveAvPrefs", () => {
  it("uses global defaults when av has no stored prefs", () => {
    expect(resolveAvPrefs("av-x", {}, { hideEmpty: true, hidePrimaryKey: false })).toEqual({
      hiddenKeyIDs: [],
      hideEmpty: true,
      hidePrimaryKey: false,
    });
  });
});

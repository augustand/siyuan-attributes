import { describe, expect, it } from "vitest";
import {
  DOCUMENT_FIELD_OVERRIDES_ATTR,
  applyDocumentFieldOverride,
  isReservedDocumentAttributeKey,
  parseDocumentFieldOverrides,
  readDocumentFieldOverridesFromAttrs,
  serializeDocumentFieldOverrides,
} from "@/models/documentFieldOverrides";

describe("documentFieldOverrides", () => {
  it("recognizes the reserved storage key only", () => {
    expect(DOCUMENT_FIELD_OVERRIDES_ATTR).toBe("custom-mux-attrs-doc-fields");
    expect(isReservedDocumentAttributeKey(DOCUMENT_FIELD_OVERRIDES_ATTR)).toBe(true);
    expect(isReservedDocumentAttributeKey("custom-mux-attrs__doc__fields")).toBe(true);
    expect(isReservedDocumentAttributeKey("custom-priority")).toBe(false);
    expect(isReservedDocumentAttributeKey("custom-avs")).toBe(false);
  });

  it("parses valid JSON and ignores corrupt payloads", () => {
    expect(parseDocumentFieldOverrides('{"v":1,"fields":{"custom-a":{"display":false,"displayAs":"A","order":2,"editable":true}}}').fields["custom-a"]).toEqual({
      display: false,
      displayAs: "A",
      order: 2,
      editable: true,
    });
    expect(parseDocumentFieldOverrides("{not-json").fields).toEqual({});
    expect(parseDocumentFieldOverrides(undefined).fields).toEqual({});
  });

  it("serializes and round-trips", () => {
    const data = {
      v: 1 as const,
      fields: {
        "custom-a": { display: true, displayAs: "A", order: 3, editable: false },
      },
    };
    expect(parseDocumentFieldOverrides(serializeDocumentFieldOverrides(data))).toEqual(data);
  });

  it("overlays override fields onto a base rule result", () => {
    const merged = applyDocumentFieldOverride(
      { display: true, displayAs: "Base", order: 10, editable: true },
      { display: false, displayAs: "Over", order: 20, editable: false },
    );
    expect(merged).toEqual({
      display: false,
      displayAs: "Over",
      order: 20,
      editable: false,
    });
    expect(applyDocumentFieldOverride(
      { display: true, displayAs: "Base", order: 10, editable: true },
      undefined,
    )).toEqual({ display: true, displayAs: "Base", order: 10, editable: true });
  });

  it("reads overrides from the valid key and falls back to legacy", () => {
    expect(readDocumentFieldOverridesFromAttrs({
      [DOCUMENT_FIELD_OVERRIDES_ATTR]: JSON.stringify({
        v: 1,
        fields: { "custom-a": { display: false, displayAs: "A", order: 1, editable: true } },
      }),
    }).fields["custom-a"]?.displayAs).toBe("A");

    expect(readDocumentFieldOverridesFromAttrs({
      "custom-mux-attrs__doc__fields": JSON.stringify({
        v: 1,
        fields: { "custom-b": { display: true, displayAs: "B", order: 2, editable: false } },
      }),
    }).fields["custom-b"]?.displayAs).toBe("B");
  });
});

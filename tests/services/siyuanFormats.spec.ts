import { describe, expect, it } from "vitest";
import {
  formatSiYuanTimestampDisplay,
  parseAliasTags,
  parseSiYuanTimestamp,
  serializeAliasTags,
  toSiYuanTimestamp,
} from "@/services/siyuanFormats";
import { normalizeRenderMethod } from "@/models/settings";

describe("alias tags", () => {
  it("parses comma-separated aliases", () => {
    expect(parseAliasTags("a, b,,a, c")).toEqual(["a", "b", "c"]);
    expect(parseAliasTags("")).toEqual([]);
    expect(parseAliasTags(undefined)).toEqual([]);
  });

  it("serializes tags", () => {
    expect(serializeAliasTags(["a", " b ", "", "a", "c"])).toBe("a,b,c");
    expect(serializeAliasTags([])).toBe("");
  });
});

describe("siyuan timestamps", () => {
  it("parses and formats compact timestamps", () => {
    const parsed = parseSiYuanTimestamp("20260918153045");
    expect(parsed).toBeInstanceOf(Date);
    expect(formatSiYuanTimestampDisplay("20260918153045")).toMatch(/2026/);
    expect(toSiYuanTimestamp(parsed!)).toBe("20260918153045");
  });

  it("rejects invalid timestamps", () => {
    expect(parseSiYuanTimestamp("nope")).toBeUndefined();
    expect(formatSiYuanTimestampDisplay("nope")).toBe("nope");
    expect(toSiYuanTimestamp(undefined)).toBe("");
  });
});

describe("normalizeRenderMethod", () => {
  it("accepts known methods and falls back", () => {
    expect(normalizeRenderMethod("tag-input")).toBe("tag-input");
    expect(normalizeRenderMethod("datetime")).toBe("datetime");
    expect(normalizeRenderMethod("link")).toBe("link");
    expect(normalizeRenderMethod("input")).toBe("input");
    expect(normalizeRenderMethod("checkbox")).toBe("input");
    expect(normalizeRenderMethod("weird")).toBe("input");
    expect(normalizeRenderMethod(undefined)).toBeUndefined();
  });
});

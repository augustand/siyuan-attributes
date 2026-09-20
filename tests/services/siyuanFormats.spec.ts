import { describe, expect, it } from "vitest";
import {
  formatSiYuanDateDisplay,
  formatSiYuanTimestampDisplay,
  parseAliasTags,
  parseCheckboxValue,
  parseNumberValue,
  parseSiYuanDate,
  parseSiYuanTimestamp,
  serializeAliasTags,
  serializeCheckboxValue,
  toSiYuanDate,
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

describe("siyuan date (YYYYMMDD)", () => {
  it("parses and formats date-only values", () => {
    const d = parseSiYuanDate("20260919");
    expect(d).toBeInstanceOf(Date);
    expect(formatSiYuanDateDisplay("20260919")).toBe("2026-09-19");
    expect(toSiYuanDate(d!)).toBe("20260919");
  });

  it("rejects datetime-length and invalid strings", () => {
    expect(parseSiYuanDate("20260919153045")).toBeUndefined();
    expect(parseSiYuanDate("nope")).toBeUndefined();
    expect(formatSiYuanDateDisplay("nope")).toBe("nope");
  });
});

describe("checkbox values", () => {
  it("parses and serializes", () => {
    expect(parseCheckboxValue("true")).toBe(true);
    expect(parseCheckboxValue("TRUE")).toBe(true);
    expect(parseCheckboxValue("false")).toBe(false);
    expect(parseCheckboxValue("")).toBe(false);
    expect(serializeCheckboxValue(true)).toBe("true");
    expect(serializeCheckboxValue(false)).toBe("false");
  });
});

describe("number values", () => {
  it("accepts decimals and rejects junk", () => {
    expect(parseNumberValue("12.5")).toBe("12.5");
    expect(parseNumberValue(" 3 ")).toBe("3");
    expect(parseNumberValue("")).toBe("");
    expect(parseNumberValue("abc")).toBeUndefined();
  });
});

describe("normalizeRenderMethod", () => {
  it("accepts known methods and falls back", () => {
    expect(normalizeRenderMethod("tag-input")).toBe("tag-input");
    expect(normalizeRenderMethod("datetime")).toBe("datetime");
    expect(normalizeRenderMethod("link")).toBe("link");
    expect(normalizeRenderMethod("input")).toBe("input");
    expect(normalizeRenderMethod("checkbox")).toBe("checkbox");
    expect(normalizeRenderMethod("select")).toBe("select");
    expect(normalizeRenderMethod("multi-select")).toBe("multi-select");
    expect(normalizeRenderMethod("date")).toBe("date");
    expect(normalizeRenderMethod("number")).toBe("number");
    expect(normalizeRenderMethod("weird")).toBe("input");
    expect(normalizeRenderMethod(undefined)).toBeUndefined();
  });
});

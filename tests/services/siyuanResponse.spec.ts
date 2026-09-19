import { describe, expect, it } from "vitest";
import { assertSiyuanData, assertSiyuanSuccess, SiyuanApiError } from "@/services/siyuanResponse";

describe("assertSiyuanData", () => {
  it("returns data for a successful response", () => {
    expect(assertSiyuanData({ code: 0, msg: "", data: { id: "doc" } })).toEqual({
      id: "doc",
    });
  });

  it("throws a typed error for a non-zero response", () => {
    try {
      assertSiyuanData({ code: -1, msg: "invalid attribute" });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(SiyuanApiError);
      expect((error as SiyuanApiError).code).toBe(-1);
      expect((error as SiyuanApiError).message).toBe("invalid attribute");
    }
  });

  it("throws when data is missing", () => {
    expect(() => assertSiyuanData({ code: 0, msg: "" })).toThrow(SiyuanApiError);
  });
});

describe("assertSiyuanSuccess", () => {
  it("accepts a successful response without data", () => {
    expect(() => assertSiyuanSuccess({ code: 0, msg: "", data: null })).not.toThrow();
  });

  it("throws a typed error for a non-zero response", () => {
    expect(() => assertSiyuanSuccess({ code: -1, msg: "write failed" })).toThrow(SiyuanApiError);
  });
});

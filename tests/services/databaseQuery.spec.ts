import { describe, expect, it } from "vitest";
import { beforeEach, vi } from "vitest";
import {
  fetchDatabaseQueryData,
  matchDoc,
  type DatabaseQueryRow,
} from "@/services/databaseQuery";
import { fetchSyncPost } from "siyuan";

const fetchSyncPostMock = vi.mocked(fetchSyncPost);

vi.mock("siyuan", () => ({
  fetchSyncPost: vi.fn(),
}));

describe("fetchDatabaseQueryData", () => {
  beforeEach(() => {
    fetchSyncPostMock.mockReset();
  });

  it("posts to renderAttributeView with the av id", async () => {
    fetchSyncPostMock.mockResolvedValue({
      code: 0,
      msg: "",
      data: { av: { table: { columns: [], rows: [] } } },
    });
    await fetchDatabaseQueryData("av-1");
    expect(fetchSyncPostMock).toHaveBeenCalledWith("/api/av/renderAttributeView", {
      id: "av-1",
    });
  });

  it("normalizes standard shape: columns, cells, primary text", async () => {
    fetchSyncPostMock.mockResolvedValue({
      code: 0,
      msg: "",
      data: {
        av: {
          table: {
            columns: [
              { id: "key-block", name: "标题", type: "block" },
              { id: "key-text", name: "备注", type: "text" },
              { id: "key-select", name: "状态", type: "select" },
              { id: "key-date", name: "截止", type: "date" },
            ],
            rows: [
              {
                id: "doc-1",
                cells: [
                  { value: { type: "block", keyID: "key-block", block: { id: "doc-1", content: "文档一" } } },
                  { value: { type: "text", keyID: "key-text", text: { content: " Hello " } } },
                  {
                    value: {
                      type: "select",
                      keyID: "key-select",
                      mSelect: [{ content: "进行中", color: "1" }, { content: "高优", color: "2" }],
                    },
                  },
                  { value: { type: "date", keyID: "key-date", date: { content: "2026-09-30" } } },
                ],
              },
            ],
          },
        },
      },
    });

    const { columns, rows } = await fetchDatabaseQueryData("av-1");
    expect(columns).toEqual([
      { keyID: "key-block", name: "标题", type: "block" },
      { keyID: "key-text", name: "备注", type: "text" },
      { keyID: "key-select", name: "状态", type: "select" },
      { keyID: "key-date", name: "截止", type: "date" },
    ]);
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row.docID).toBe("doc-1");
    expect(row.primaryText).toBe("文档一");
    expect(row.cells["key-text"]).toEqual({ text: "Hello", isEmpty: false });
    expect(row.cells["key-select"]).toEqual({ text: "进行中, 高优", isEmpty: false });
    expect(row.cells["key-date"]).toEqual({ text: "2026-09-30", isEmpty: false });
  });

  it("falls back to positional cells when value.keyID is missing", async () => {
    fetchSyncPostMock.mockResolvedValue({
      code: 0,
      msg: "",
      data: {
        av: {
          table: {
            columns: [
              { keyID: "key-a", name: "A", type: "text" },
              { key: "key-b", title: "B", type: "number" },
            ],
            rows: [
              {
                id: "doc-2",
                cells: [
                  { value: { type: "text", text: { content: "甲" } } },
                  { value: { type: "number", number: { content: 42, isNotEmpty: true } } },
                ],
              },
            ],
          },
        },
      },
    });

    const { columns, rows } = await fetchDatabaseQueryData("av-2");
    expect(columns).toEqual([
      { keyID: "key-a", name: "A", type: "text" },
      { keyID: "key-b", name: "B", type: "number" },
    ]);
    expect(rows[0].cells["key-a"]).toEqual({ text: "甲", isEmpty: false });
    expect(rows[0].cells["key-b"]).toEqual({ text: "42", isEmpty: false });
  });

  it("treats empty text/select content as empty cells", async () => {
    fetchSyncPostMock.mockResolvedValue({
      code: 0,
      msg: "",
      data: {
        av: {
          table: {
            columns: [
              { id: "key-text", name: "T", type: "text" },
              { id: "key-select", name: "S", type: "mSelect" },
            ],
            rows: [
              {
                id: "doc-3",
                cells: [
                  { value: { type: "text", text: { content: "" } } },
                  { value: { type: "mSelect", mSelect: [] } },
                ],
              },
            ],
          },
        },
      },
    });

    const { rows } = await fetchDatabaseQueryData("av-1");
    expect(rows[0].cells["key-text"]).toEqual({ text: "", isEmpty: true });
    expect(rows[0].cells["key-select"]).toEqual({ text: "", isEmpty: true });
  });

  it("skips malformed fields without throwing", async () => {
    fetchSyncPostMock.mockResolvedValue({
      code: 0,
      msg: "",
      data: {
        av: {
          table: {
            columns: [
              { id: "key-a", name: "A", type: "text" },
              { name: "no-id" },
              null,
              { id: "key-b", type: "date" },
            ],
            rows: [
              {
                cells: [{ value: { type: "text", text: { content: "orphan" } } }],
              },
              {
                id: "doc-4",
                cells: [
                  { value: { type: "weird", unknown: { deep: true } } },
                  { value: null },
                  null,
                  { value: { type: "text", text: { content: "已知" } } },
                ],
              },
            ],
          },
        },
      },
    });

    const { columns, rows } = await fetchDatabaseQueryData("av-1");
    expect(columns).toEqual([
      { keyID: "key-a", name: "A", type: "text" },
      { keyID: "key-b", name: "", type: "date" },
    ]);
    // Row 1 (no id, no block cell) is skipped entirely.
    expect(rows).toHaveLength(1);
    expect(rows[0].docID).toBe("doc-4");
    // Unknown shapes and null values are skipped, never thrown; the one
    // well-formed cell still lands on its raw column position (key-b).
    expect(rows[0].cells["key-a"]).toBeUndefined();
    expect(rows[0].cells["key-b"]).toEqual({ text: "已知", isEmpty: false });
  });

  it("derives docID from the block cell when row id is missing", async () => {
    fetchSyncPostMock.mockResolvedValue({
      code: 0,
      msg: "",
      data: {
        av: {
          table: {
            columns: [{ id: "key-block", name: "标题", type: "block" }],
            rows: [
              {
                cells: [
                  { value: { type: "block", block: { id: "doc-5", content: "标题五" } } },
                ],
              },
            ],
          },
        },
      },
    });

    const { rows } = await fetchDatabaseQueryData("av-1");
    expect(rows[0].docID).toBe("doc-5");
    expect(rows[0].primaryText).toBe("标题五");
  });

  it("returns empty columns/rows for a missing or malformed table", async () => {
    fetchSyncPostMock.mockResolvedValue({ code: 0, msg: "", data: { av: {} } });
    expect(await fetchDatabaseQueryData("av-1")).toEqual({ columns: [], rows: [] });

    fetchSyncPostMock.mockResolvedValue({ code: 0, msg: "", data: { av: { table: null } } });
    expect(await fetchDatabaseQueryData("av-1")).toEqual({ columns: [], rows: [] });

    fetchSyncPostMock.mockResolvedValue({ code: 0, msg: "", data: "not-an-object" });
    expect(await fetchDatabaseQueryData("av-1")).toEqual({ columns: [], rows: [] });
  });

  it("rejects when the kernel reports an error (fallback trigger)", async () => {
    fetchSyncPostMock.mockResolvedValue({ code: -1, msg: "boom", data: null });
    await expect(fetchDatabaseQueryData("av-1")).rejects.toThrow("boom");
  });
});

describe("matchDoc", () => {
  const baseRow = (cells: DatabaseQueryRow["cells"], docID = "doc-1"): DatabaseQueryRow => ({
    docID,
    primaryText: "主标题",
    cells,
  });

  it("equals matches exact trimmed text only", () => {
    const row = baseRow({ k: { text: "待办", isEmpty: false } });
    expect(matchDoc(row, { keyID: "k", op: "equals", value: "待办" })).toBe(true);
    expect(matchDoc(row, { keyID: "k", op: "equals", value: "  待办  " })).toBe(true);
    expect(matchDoc(row, { keyID: "k", op: "equals", value: "待" })).toBe(false);
    expect(matchDoc(row, { keyID: "k", op: "equals", value: "TODO" })).toBe(false);
  });

  it("equals on empty text cell only matches an empty needle", () => {
    const row = baseRow({ k: { text: "", isEmpty: true } });
    expect(matchDoc(row, { keyID: "k", op: "equals", value: "" })).toBe(true);
    expect(matchDoc(row, { keyID: "k", op: "equals", value: "x" })).toBe(false);
  });

  it("equals on missing cell never matches", () => {
    const row = baseRow({});
    expect(matchDoc(row, { keyID: "k", op: "equals", value: "" })).toBe(false);
    expect(matchDoc(row, { keyID: "k", op: "equals", value: "x" })).toBe(false);
  });

  it("contains is case-insensitive and matches substrings", () => {
    const row = baseRow({ k: { text: "Weekly Review 计划", isEmpty: false } });
    expect(matchDoc(row, { keyID: "k", op: "contains", value: "review" })).toBe(true);
    expect(matchDoc(row, { keyID: "k", op: "contains", value: "计划" })).toBe(true);
    expect(matchDoc(row, { keyID: "k", op: "contains", value: "monthly" })).toBe(false);
  });

  it("contains on empty/missing cell", () => {
    const empty = baseRow({ k: { text: "", isEmpty: true } });
    expect(matchDoc(empty, { keyID: "k", op: "contains", value: "x" })).toBe(false);
    const missing = baseRow({});
    expect(matchDoc(missing, { keyID: "k", op: "contains", value: "x" })).toBe(false);
  });

  it("isEmpty matches empty text and missing cells, not filled ones", () => {
    expect(
      matchDoc(baseRow({ k: { text: "", isEmpty: true } }), { keyID: "k", op: "isEmpty" }),
    ).toBe(true);
    expect(matchDoc(baseRow({}), { keyID: "k", op: "isEmpty" })).toBe(true);
    expect(
      matchDoc(baseRow({ k: { text: "有值", isEmpty: false } }), { keyID: "k", op: "isEmpty" }),
    ).toBe(false);
  });
});

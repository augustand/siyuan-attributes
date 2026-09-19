import { describe, expect, it } from "vitest";
import {
  resolveBlockIdFromBlockElements,
  resolveBlockIdFromContentTarget,
} from "@/services/blockMenu";

describe("blockMenu", () => {
  it("takes the first data-node-id from blockElements", () => {
    const a = document.createElement("div");
    a.dataset.nodeId = "20240101120000-aaaaaaa";
    const b = document.createElement("div");
    b.dataset.nodeId = "20240101120000-bbbbbbb";
    expect(resolveBlockIdFromBlockElements([a, b])).toBe("20240101120000-aaaaaaa");
  });

  it("skips empty ids and null entries", () => {
    const empty = document.createElement("div");
    empty.dataset.nodeId = "";
    const ok = document.createElement("div");
    ok.setAttribute("data-node-id", "20240101120000-ccccccc");
    expect(resolveBlockIdFromBlockElements([null, empty, ok])).toBe("20240101120000-ccccccc");
    expect(resolveBlockIdFromBlockElements([])).toBeUndefined();
  });

  it("resolves content target via closest data-node-id", () => {
    const block = document.createElement("div");
    block.dataset.nodeId = "20240101120000-ddddddd";
    const child = document.createElement("span");
    block.append(child);
    document.body.append(block);
    expect(resolveBlockIdFromContentTarget(child)).toBe("20240101120000-ddddddd");
    expect(resolveBlockIdFromContentTarget(null)).toBeUndefined();
    block.remove();
  });
});

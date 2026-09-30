import { describe, expect, it } from "vitest";
import { pickCreateNotebookId } from "@/services/ownedDatabase";

describe("pickCreateNotebookId", () => {
  const notebooks = [
    { id: "nb-a", name: "A" },
    { id: "nb-b", name: "B" },
  ];

  it("prefers active document notebook", () => {
    expect(
      pickCreateNotebookId({
        activeNotebookId: "nb-b",
        savedNotebookId: "nb-a",
        notebooks,
      }),
    ).toBe("nb-b");
  });

  it("falls back to saved then first", () => {
    expect(
      pickCreateNotebookId({
        activeNotebookId: "missing",
        savedNotebookId: "nb-a",
        notebooks,
      }),
    ).toBe("nb-a");
    expect(
      pickCreateNotebookId({
        notebooks,
      }),
    ).toBe("nb-a");
  });
});

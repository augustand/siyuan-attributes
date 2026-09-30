import { describe, expect, it, vi, beforeEach } from "vitest";
import { refreshDocumentEditor } from "@/services/refreshEditor";

describe("refreshDocumentEditor", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("calls protyle.reload when matching editor exists", async () => {
    const reload = vi.fn();
    const el = document.createElement("div");
    el.className = "protyle";
    (el as unknown as { protyle: { block: { rootID: string }; reload: typeof reload } }).protyle = {
      block: { rootID: "doc-1" },
      reload,
    };
    document.body.appendChild(el);

    const result = await refreshDocumentEditor("doc-1");
    expect(result).toBe("reloaded");
    expect(reload).toHaveBeenCalledWith(false);
  });

  it("returns noop when nothing to refresh", async () => {
    expect(await refreshDocumentEditor("doc-missing")).toBe("noop");
  });
});

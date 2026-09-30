import type { Plugin } from "siyuan";
import { openDocument } from "@/services/ownedDatabase";

type ProtyleLike = {
  block?: { rootID?: string };
  options?: { blockId?: string };
  reload?: (focus: boolean) => void;
};

function readProtyle(node: Element): ProtyleLike | undefined {
  const anyNode = node as unknown as { protyle?: ProtyleLike };
  return anyNode.protyle;
}

/**
 * Refresh the open editor so native under-title AV UI picks up bind/unbind.
 * Prefers Protyle.reload; falls back to reopening the tab.
 */
export async function refreshDocumentEditor(
  docId: string,
  plugin?: Plugin,
): Promise<"reloaded" | "reopened" | "noop"> {
  if (!docId) return "noop";

  const nodes = document.querySelectorAll(".protyle");
  let hit = false;
  nodes.forEach((node) => {
    if (node.classList.contains("fn__none")) return;
    const p = readProtyle(node);
    if (!p?.reload) return;
    const root = p.block?.rootID || p.options?.blockId || "";
    if (root && root !== docId) return;
    try {
      p.reload(false);
      hit = true;
    } catch {
      /* ignore */
    }
  });
  if (hit) return "reloaded";

  if (plugin) {
    try {
      await openDocument(docId, plugin);
      return "reopened";
    } catch {
      return "noop";
    }
  }
  return "noop";
}

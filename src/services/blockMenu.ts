function readNodeId(el: HTMLElement | null | undefined): string | undefined {
  if (!el) return undefined;
  const id = el.dataset?.nodeId || el.getAttribute?.("data-node-id") || "";
  const trimmed = id.trim();
  return trimmed || undefined;
}

export function resolveBlockIdFromBlockElements(
  blockElements: Array<HTMLElement | null | undefined>,
): string | undefined {
  for (const el of blockElements) {
    const id = readNodeId(el ?? undefined);
    if (id) return id;
  }
  return undefined;
}

export function resolveBlockIdFromContentTarget(
  target: EventTarget | null | undefined,
): string | undefined {
  if (!target || !(target instanceof Node)) return undefined;
  const el = target instanceof Element ? target : target.parentElement;
  const host = el?.closest?.("[data-node-id]") as HTMLElement | null | undefined;
  return readNodeId(host ?? undefined);
}

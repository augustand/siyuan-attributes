import { fetchSyncPost } from "siyuan";
import { assertSiyuanData, assertSiyuanSuccess } from "./siyuanResponse";

export async function fetchBlockAttrs(id: string): Promise<Record<string, string>> {
  return assertSiyuanData<Record<string, string>>(
    await fetchSyncPost("/api/attr/getBlockAttrs", { id }),
    "Failed to load block attributes",
  );
}

export async function writeBlockAttrs(
  id: string,
  attrs: Record<string, string>,
): Promise<void> {
  assertSiyuanSuccess(
    await fetchSyncPost("/api/attr/setBlockAttrs", { id, attrs }),
    "Failed to save block attributes",
  );
}

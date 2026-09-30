import { describe, expect, it } from "vitest";
import {
  attributeViewBlockDom,
  buildEmptyAttributeViewJson,
  newSiYuanID,
} from "@/models/ownedDatabaseCreate";

describe("newSiYuanID", () => {
  it("matches YYYYMMDDHHmmss-xxxxxxx", () => {
    expect(newSiYuanID()).toMatch(/^\d{14}-[a-z0-9]{7}$/);
  });
});

describe("buildEmptyAttributeViewJson", () => {
  it("builds a primary-block-only schema named after the table (no seeded select)", () => {
    const av = buildEmptyAttributeViewJson({
      avID: "20260101120000-aaaaaaa",
      name: "任务清单",
      ids: {
        blockKeyID: "20260101120000-block01",
        viewID: "20260101120000-view001",
        tableID: "20260101120000-table01",
      },
    });

    expect(av.id).toBe("20260101120000-aaaaaaa");
    expect(av.name).toBe("任务清单");
    expect(av.spec).toBe(8);

    const keys = av.keyValues as Array<{ key: { id: string; name: string; type: string } }>;
    expect(keys).toHaveLength(1);
    expect(keys[0]?.key).toMatchObject({
      id: "20260101120000-block01",
      name: "任务清单",
      type: "block",
    });

    const views = av.views as Array<{
      id: string;
      table: { columns: Array<{ id: string }>; rowIds: null };
    }>;
    expect(views[0]?.id).toBe("20260101120000-view001");
    expect(views[0]?.table.rowIds).toBeNull();
    expect(views[0]?.table.columns.map((c) => c.id)).toEqual([
      "20260101120000-block01",
    ]);
  });

  it("generates SiYuan-shaped ids when not provided", () => {
    const av = buildEmptyAttributeViewJson({ avID: "av-1", name: "表" });
    const keys = av.keyValues as Array<{ key: { id: string } }>;
    expect(String(keys[0]?.key.id)).toMatch(/^\d{14}-[a-z0-9]{7}$/);
    expect(av.name).toBe("表");
  });

  it("keeps an empty AV name while the block key carries keyName (duplicate-seed shape)", () => {
    // Kernel duplicateDatabaseBlock only appends " (Duplicated ts)" when the AV
    // name is non-empty — the seed must carry an EMPTY AV name, while the
    // primary block key still shows the final table title.
    const av = buildEmptyAttributeViewJson({
      avID: "av-1",
      name: "",
      keyName: "任务清单",
    });
    expect(av.name).toBe("");
    const keys = av.keyValues as Array<{ key: { name: string; type: string } }>;
    expect(keys[0]?.key).toMatchObject({ name: "任务清单", type: "block" });
  });

  it("falls back to 未命名 for the block key when name and keyName are empty", () => {
    const av = buildEmptyAttributeViewJson({ avID: "av-1", name: "" });
    expect(av.name).toBe("");
    const keys = av.keyValues as Array<{ key: { name: string } }>;
    expect(keys[0]?.key.name).toBe("未命名");
  });
});

describe("attributeViewBlockDom", () => {
  it("emits NodeAttributeView markup", () => {
    expect(attributeViewBlockDom("av-1", "blk-1")).toContain('data-av-id="av-1"');
    expect(attributeViewBlockDom("av-1", "blk-1")).toContain('data-node-id="blk-1"');
    expect(attributeViewBlockDom("av-1", "blk-1")).toContain('data-type="NodeAttributeView"');
  });
});

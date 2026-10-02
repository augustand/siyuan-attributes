import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchSyncPost } from "siyuan";
import { pickPrimaryDatabaseForType } from "@/models/ownedDatabaseHang";
import type { OwnedDatabase } from "@/models/ownedDatabase";

vi.mock("@/services/attributeView", () => ({
  fetchAttributeViews: vi.fn(),
}));
vi.mock("@/services/ownedDatabase", () => ({
  checkOwnedDatabasesHealth: vi.fn(),
  ensureOwnedDatabaseTemplateColumns: vi.fn(),
  ensureTableForTemplateKey: vi.fn(),
}));
vi.mock("@/services/ownedDatabaseMigrate", () => ({
  migrateDocumentToOwnedDatabase: vi.fn(),
}));
vi.mock("@/services/refreshEditor", () => ({
  refreshDocumentEditor: vi.fn(),
}));
vi.mock("@/services/settings", () => ({
  loadPanelSettings: vi.fn(),
  savePanelSettings: vi.fn(),
}));
vi.mock("@/services/settingEvents", () => ({
  emitSettingsChanged: vi.fn(),
}));

import { fetchAttributeViews } from "@/services/attributeView";
import {
  checkOwnedDatabasesHealth,
  ensureOwnedDatabaseTemplateColumns,
  ensureTableForTemplateKey,
} from "@/services/ownedDatabase";
import { migrateDocumentToOwnedDatabase } from "@/services/ownedDatabaseMigrate";
import { refreshDocumentEditor } from "@/services/refreshEditor";
import { loadPanelSettings, savePanelSettings } from "@/services/settings";
import { classifyDocumentToType, createDocIntoTable, joinTableByKey } from "@/services/doctreeClassify";
import {
  CLASSIFY_NEED_CREATE_EVENT,
  CLASSIFY_PICK_TABLE_EVENT,
} from "@/services/doctreeClassifyEvents";

const fetchAttributeViewsMock = vi.mocked(fetchAttributeViews);
const checkHealthMock = vi.mocked(checkOwnedDatabasesHealth);
const ensureColsMock = vi.mocked(ensureOwnedDatabaseTemplateColumns);
const ensureTableMock = vi.mocked(ensureTableForTemplateKey);
const migrateMock = vi.mocked(migrateDocumentToOwnedDatabase);
const refreshMock = vi.mocked(refreshDocumentEditor);
const loadSettingsMock = vi.mocked(loadPanelSettings);
const saveSettingsMock = vi.mocked(savePanelSettings);

function db(
  partial: Partial<OwnedDatabase> & Pick<OwnedDatabase, "avID" | "name">,
): OwnedDatabase {
  return {
    id: partial.avID,
    avBlockID: partial.avBlockID ?? `blk-${partial.avID}`,
    createdAt: 1,
    ...partial,
  };
}

describe("classifyDocumentToType", () => {
  const plugin = {
    loadData: vi.fn(),
    saveData: vi.fn(),
  } as never;

  beforeEach(() => {
    vi.clearAllMocks();
    ensureColsMock.mockResolvedValue({ added: [] });
    migrateMock.mockResolvedValue({ unboundAvIDs: [] });
    saveSettingsMock.mockResolvedValue(undefined);
  });

  it("returns needCreate when no healthy DB of type", async () => {
    loadSettingsMock.mockResolvedValue({
      ownedDatabases: [db({ avID: "a", name: "A", typeId: "project" })],
      ownedDbPrimaryByType: {},
      ownedDbLastAvID: "",
    } as never);
    checkHealthMock.mockResolvedValue({ a: "ok" });

    expect(
      await classifyDocumentToType({ plugin, docId: "doc-1", typeId: "task" }),
    ).toEqual({ kind: "needCreate", typeId: "task" });
    expect(migrateMock).not.toHaveBeenCalled();
  });

  it("returns already when solely bound to primary", async () => {
    const task = db({ avID: "t1", name: "任务", typeId: "task" });
    loadSettingsMock.mockResolvedValue({
      ownedDatabases: [task],
      ownedDbPrimaryByType: { task: "t1" },
      ownedDbLastAvID: "t1",
    } as never);
    checkHealthMock.mockResolvedValue({ t1: "ok" });
    fetchAttributeViewsMock.mockResolvedValue([{ avID: "t1" }] as never);

    expect(
      await classifyDocumentToType({ plugin, docId: "doc-1", typeId: "task" }),
    ).toEqual({ kind: "already", db: task });
    expect(migrateMock).not.toHaveBeenCalled();
  });

  it("migrates to primary and persists", async () => {
    const task = db({ avID: "t1", name: "任务", typeId: "task" });
    loadSettingsMock.mockResolvedValue({
      ownedDatabases: [task],
      ownedDbPrimaryByType: {},
      ownedDbLastAvID: "",
      ownedDbLastTypeId: "",
      showUnderTitlePanel: true,
    } as never);
    checkHealthMock.mockResolvedValue({ t1: "ok" });
    fetchAttributeViewsMock.mockResolvedValue([]);
    ensureColsMock.mockResolvedValue({ added: ["状态"] });

    const result = await classifyDocumentToType({
      plugin,
      docId: "doc-1",
      typeId: "task",
    });
    expect(result).toEqual({
      kind: "hung",
      db: task,
      addedColumns: ["状态"],
    });
    expect(migrateMock).toHaveBeenCalledWith({
      docId: "doc-1",
      target: task,
    });
    expect(saveSettingsMock).toHaveBeenCalled();
  });
});

describe("pickPrimary used by classify", () => {
  it("prefers primary map", () => {
    const a = db({ avID: "a", name: "A", typeId: "task" });
    const b = db({ avID: "b", name: "B", typeId: "task" });
    expect(
      pickPrimaryDatabaseForType({
        typeId: "task",
        databases: [a, b],
        healthyAvIDs: ["a", "b"],
        primaryAvID: "b",
      }),
    ).toEqual(b);
  });
});

describe("joinTableByKey", () => {
  const plugin = {
    loadData: vi.fn(),
    saveData: vi.fn(),
  } as never;
  const tasks = db({ avID: "av-tasks", name: "任务清单", templateKey: "tasks" });

  beforeEach(() => {
    vi.clearAllMocks();
    migrateMock.mockResolvedValue({ unboundAvIDs: [] });
    saveSettingsMock.mockResolvedValue(undefined);
    refreshMock.mockResolvedValue("reloaded");
    loadSettingsMock.mockResolvedValue({
      ownedDatabases: [tasks],
      ownedDbPrimaryByType: {},
      ownedDbLastAvID: "",
      showUnderTitlePanel: true,
    } as never);
  });

  it("created: table generated → migrate, backfill columns, persist lastAvID + catalog, refresh", async () => {
    ensureTableMock.mockResolvedValue({ db: tasks, created: true });
    fetchAttributeViewsMock.mockResolvedValue([]);
    ensureColsMock.mockResolvedValue({ added: ["状态"] });

    const result = await joinTableByKey({
      plugin,
      docId: "doc-1",
      templateKey: "tasks",
      nameOf: (t) => `T:${t.key}`,
    });

    expect(result).toEqual({ kind: "created", db: tasks, addedColumns: ["状态"] });
    expect(ensureTableMock).toHaveBeenCalledWith({
      plugin,
      templateKey: "tasks",
      nameOf: expect.any(Function),
    });
    expect(migrateMock).toHaveBeenCalledWith({
      docId: "doc-1",
      target: tasks,
      ownedAvIDs: ["av-tasks"],
    });
    expect(ensureColsMock).toHaveBeenCalledWith(tasks);

    const saved = saveSettingsMock.mock.calls[0]![1];
    expect(saved.ownedDbLastAvID).toBe("av-tasks");
    expect(saved.ownedDatabases.map((d) => d.avID)).toContain("av-tasks");
    expect(refreshMock).toHaveBeenCalledWith("doc-1", plugin);
  });

  it("bound: table already existed → migrate onto it and persist", async () => {
    ensureTableMock.mockResolvedValue({ db: tasks, created: false });
    fetchAttributeViewsMock.mockResolvedValue([]);
    ensureColsMock.mockResolvedValue({ added: [] });

    const result = await joinTableByKey({ plugin, docId: "doc-1", templateKey: "tasks" });

    expect(result.kind).toBe("bound");
    expect(result.db).toEqual(tasks);
    expect(migrateMock).toHaveBeenCalledWith({
      docId: "doc-1",
      target: tasks,
      ownedAvIDs: ["av-tasks"],
    });
    expect(saveSettingsMock).toHaveBeenCalled();
    expect(refreshMock).toHaveBeenCalledWith("doc-1", plugin);
  });

  it("passes the catalog avID set so NATIVE bindings survive the exclusive bind", async () => {
    const other = db({ avID: "av-other", name: "其他表格" });
    loadSettingsMock.mockResolvedValue({
      ownedDatabases: [tasks, other],
      ownedDbPrimaryByType: {},
      ownedDbLastAvID: "",
      showUnderTitlePanel: true,
    } as never);
    ensureTableMock.mockResolvedValue({ db: tasks, created: false });
    // The doc also carries a NATIVE (non-catalog) database binding.
    fetchAttributeViewsMock.mockResolvedValue([{ avID: "av-native-日记" }] as never);
    ensureColsMock.mockResolvedValue({ added: [] });

    await joinTableByKey({ plugin, docId: "doc-1", templateKey: "tasks" });

    // The unbind scope handed to migrate is the catalog set only —
    // "av-native-日记" is absent, so the migrate layer never unbinds it.
    expect(migrateMock).toHaveBeenCalledWith({
      docId: "doc-1",
      target: tasks,
      ownedAvIDs: ["av-tasks", "av-other"],
    });
  });

  it("already: doc solely bound to the table → early return, no migrate/persist/refresh", async () => {
    ensureTableMock.mockResolvedValue({ db: tasks, created: false });
    fetchAttributeViewsMock.mockResolvedValue([{ avID: "av-tasks" }] as never);

    const result = await joinTableByKey({ plugin, docId: "doc-1", templateKey: "tasks" });

    expect(result).toEqual({ kind: "already", db: tasks, addedColumns: [] });
    expect(migrateMock).not.toHaveBeenCalled();
    expect(ensureColsMock).not.toHaveBeenCalled();
    expect(saveSettingsMock).not.toHaveBeenCalled();
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("exposes the pick-table window event name for the doctree host", () => {
    expect(CLASSIFY_PICK_TABLE_EVENT).toBe("mux-doctree-classify:pick-table");
    expect(CLASSIFY_NEED_CREATE_EVENT).toBe("mux-doctree-classify:need-create");
  });
});

describe("createDocIntoTable", () => {
  const db = { avID: "av-1", avBlockID: "blk-1", homeDocId: "home-1" };

  const fetchSyncPostAsMock = vi.mocked(fetchSyncPost);
  const migrateSpy = migrateMock;

  function sqlRows(rows: Array<Record<string, unknown>>): void {
    fetchSyncPostAsMock.mockImplementation(async (url: string) => {
      if (url === "/api/query/sql") return { code: 0, msg: "", data: rows };
      if (url === "/api/filetree/createDocWithMd") return { code: 0, msg: "", data: "new-doc-1" };
      if (url === "/api/av/removeAttributeViewBlocks") return { code: 0, msg: "", data: null };
      if (url === "/api/av/getAttributeViewKeys") return { code: 0, msg: "", data: [] };
      return { code: 0, msg: "", data: null };
    });
  }

  beforeEach(() => {
    fetchSyncPostAsMock.mockReset();
  });

  it("resolves the notebook from the home doc, creates the doc, and migrates", async () => {
    sqlRows([{ box: "nb-1", root_id: "home-1" }]);
    const { docId } = await createDocIntoTable({ db, title: "  新任务  " });

    expect(docId).toBe("new-doc-1");
    const createCall = fetchSyncPostAsMock.mock.calls.find(
      ([url]) => url === "/api/filetree/createDocWithMd",
    );
    expect(createCall?.[1]).toEqual({ notebook: "nb-1", path: "/新任务", markdown: "" });
    expect(migrateSpy).toHaveBeenCalled();

    const withBody = await createDocIntoTable({ db, title: "带正文", markdown: "# 要点\n- a" });
    expect(withBody.docId).toBe("new-doc-1");
    const createCall2 = fetchSyncPostAsMock.mock.calls.find(
      ([url, body]) => url === "/api/filetree/createDocWithMd" && (body as {path:string}).path === "/带正文",
    );
    expect((createCall2?.[1] as { markdown: string }).markdown).toBe("# 要点\n- a");
  });

  it("throws on blank title and on unresolvable notebook", async () => {
    sqlRows([{ box: "nb-1" }]);
    await expect(createDocIntoTable({ db, title: "   " })).rejects.toThrow("标题");
    await expect(createDocIntoTable({ db: { ...db, homeDocId: undefined }, title: "x" })).rejects.toThrow(
      "存放笔记本",
    );
    sqlRows([]);
    await expect(createDocIntoTable({ db, title: "x" })).rejects.toThrow("存放笔记本");
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchSyncPost } from "siyuan";
import type { OwnedDatabase } from "@/models/ownedDatabase";
import type { TableTemplate } from "@/models/databaseTypes";
import { DEFAULT_TABLE_TEMPLATES } from "@/models/databaseTypes";
import type { PanelSettings } from "@/models/settings";
import {
  ensureTableForTemplateKey,
  generateDefaultTables,
} from "@/services/ownedDatabase";

const fetchSyncPostMock = vi.mocked(fetchSyncPost);

vi.mock("siyuan", () => ({
  fetchSyncPost: vi.fn(),
  openTab: vi.fn(),
}));
vi.mock("@/services/settings", () => ({
  loadPanelSettings: vi.fn(),
  savePanelSettings: vi.fn(),
}));
vi.mock("@/services/settingEvents", () => ({
  emitSettingsChanged: vi.fn(),
}));

import { loadPanelSettings, savePanelSettings } from "@/services/settings";

const loadSettingsMock = vi.mocked(loadPanelSettings);
const saveSettingsMock = vi.mocked(savePanelSettings);

function db(avID: string, templateKey?: string): OwnedDatabase {
  return {
    id: avID,
    name: templateKey ?? avID,
    avID,
    avBlockID: `blk-${avID}`,
    ...(templateKey ? { templateKey } : {}),
    createdAt: 1,
  };
}

const plugin = {
  loadData: vi.fn(),
  saveData: vi.fn(),
} as never;

/** Healthy kernel: every AV readable and mirror-registered. */
function mockHealthyKernel(): void {
  fetchSyncPostMock.mockImplementation(async (url: string) => {
    if (url === "/api/av/getAttributeView") {
      return { code: 0, msg: "", data: { av: { name: "x", keyValues: [] } } };
    }
    if (url === "/api/av/getMirrorDatabaseBlocks") {
      return { code: 0, msg: "", data: { refDefs: [{ refID: "r", defIDs: [] }] } };
    }
    if (url === "/api/notebook/lsNotebooks") {
      return {
        code: 0,
        msg: "",
        data: { notebooks: [{ id: "nb-a", name: "A" }, { id: "nb-saved", name: "S" }] },
      };
    }
    return { code: 0, msg: "", data: null };
  });
}

/** Broken mirrors → every db health-checks as "broken". */
function mockBrokenKernel(): void {
  fetchSyncPostMock.mockImplementation(async (url: string) => {
    if (url === "/api/av/getAttributeView") {
      return { code: 0, msg: "", data: { av: { name: "x", keyValues: [] } } };
    }
    if (url === "/api/av/getMirrorDatabaseBlocks") {
      return { code: 0, msg: "", data: { refDefs: [] } };
    }
    if (url === "/api/notebook/lsNotebooks") {
      return { code: 0, msg: "", data: { notebooks: [{ id: "nb-a", name: "A" }] } };
    }
    return { code: 0, msg: "", data: null };
  });
}

describe("ensureTableForTemplateKey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchSyncPostMock.mockReset();
    saveSettingsMock.mockResolvedValue(undefined);
  });

  it("creates the missing table, persists catalog + lastAvID without touching primaries", async () => {
    mockHealthyKernel();
    loadSettingsMock.mockResolvedValue({
      ownedDatabases: [],
      ownedDbNotebookId: "nb-saved",
      ownedDbPrimaryByType: { task: "keep-me" },
      ownedDbLastAvID: "",
    } as never);
    const createMock = vi.fn().mockResolvedValue(db("av-tasks", "tasks"));

    const result = await ensureTableForTemplateKey({
      plugin,
      templateKey: "tasks",
      notebookId: "nb-1",
      nameOf: (t: TableTemplate) => `T:${t.key}`,
      create: createMock,
    });

    expect(result.created).toBe(true);
    expect(result.db.avID).toBe("av-tasks");
    expect(createMock).toHaveBeenCalledWith({
      notebookId: "nb-1",
      name: "T:tasks",
      templateKey: "tasks",
    });

    expect(saveSettingsMock).toHaveBeenCalledTimes(1);
    const saved = saveSettingsMock.mock.calls[0]![1];
    expect(saved.ownedDatabases.map((d) => d.avID)).toEqual(["av-tasks"]);
    expect(saved.ownedDbLastAvID).toBe("av-tasks");
    expect(saved.ownedDbNotebookId).toBe("nb-1");
    expect(saved.ownedDbPrimaryByType).toEqual({ task: "keep-me" });
  });

  it("reuses an existing healthy table with the same templateKey", async () => {
    mockHealthyKernel();
    loadSettingsMock.mockResolvedValue({
      ownedDatabases: [db("av-existing", "tasks")],
      ownedDbNotebookId: "nb-saved",
      ownedDbPrimaryByType: {},
      ownedDbLastAvID: "",
    } as never);
    const createMock = vi.fn();

    const result = await ensureTableForTemplateKey({
      plugin,
      templateKey: "tasks",
      create: createMock,
    });

    expect(result).toEqual({ db: expect.objectContaining({ avID: "av-existing" }), created: false });
    expect(createMock).not.toHaveBeenCalled();
    expect(saveSettingsMock).not.toHaveBeenCalled();
  });

  it("ignores unhealthy tables and creates a fresh one", async () => {
    mockBrokenKernel();
    loadSettingsMock.mockResolvedValue({
      ownedDatabases: [db("av-broken", "tasks")],
      ownedDbNotebookId: "nb-saved",
      ownedDbPrimaryByType: {},
      ownedDbLastAvID: "",
    } as never);
    const createMock = vi.fn().mockResolvedValue(db("av-fresh", "tasks"));

    const result = await ensureTableForTemplateKey({
      plugin,
      templateKey: "tasks",
      create: createMock,
    });

    expect(result.created).toBe(true);
    expect(result.db.avID).toBe("av-fresh");
    expect(createMock).toHaveBeenCalled();
  });

  it("falls back to the template nameFallback when nameOf is absent", async () => {
    mockHealthyKernel();
    loadSettingsMock.mockResolvedValue({
      ownedDatabases: [],
      ownedDbNotebookId: "",
      ownedDbPrimaryByType: {},
      ownedDbLastAvID: "",
    } as never);
    const createMock = vi.fn().mockResolvedValue(db("av-inbox", "inbox"));

    await ensureTableForTemplateKey({
      plugin,
      templateKey: "inbox",
      create: createMock,
    });

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: "素材收集箱", templateKey: "inbox" }),
    );
  });

  it("infers the notebook via saved/active inference when not given", async () => {
    mockHealthyKernel();
    loadSettingsMock.mockResolvedValue({
      ownedDatabases: [],
      ownedDbNotebookId: "nb-saved",
      ownedDbPrimaryByType: {},
      ownedDbLastAvID: "",
    } as never);
    const createMock = vi.fn().mockResolvedValue(db("av-tasks", "tasks"));

    await ensureTableForTemplateKey({ plugin, templateKey: "tasks", create: createMock });

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ notebookId: "nb-saved" }),
    );
  });

  it("rejects unknown template keys", async () => {
    await expect(
      ensureTableForTemplateKey({ templateKey: "nope", create: vi.fn() }),
    ).rejects.toThrow(/nope/);
  });

  it("persists on top of a FRESH catalog re-read, not the snapshot taken before creation", async () => {
    mockHealthyKernel();
    // 1st read: catalog before creation. 2nd read (at persist time): another
    // path (e.g. the Dock) added an entry while the kernel ops were running.
    loadSettingsMock
      .mockResolvedValueOnce({
        ownedDatabases: [],
        ownedDbNotebookId: "nb-saved",
        ownedDbPrimaryByType: {},
        ownedDbLastAvID: "",
      } as never)
      .mockResolvedValue({
        ownedDatabases: [db("av-concurrent", "projects")],
        ownedDbNotebookId: "nb-saved",
        ownedDbPrimaryByType: {},
        ownedDbLastAvID: "",
      } as never);
    const createMock = vi.fn().mockResolvedValue(db("av-tasks", "tasks"));

    const result = await ensureTableForTemplateKey({
      plugin,
      templateKey: "tasks",
      notebookId: "nb-1",
      create: createMock,
    });

    expect(result.created).toBe(true);
    expect(saveSettingsMock).toHaveBeenCalledTimes(1);
    const saved = saveSettingsMock.mock.calls[0]![1];
    // The concurrently-added entry survives the persist.
    expect(saved.ownedDatabases.map((d) => d.avID).sort()).toEqual([
      "av-concurrent",
      "av-tasks",
    ]);
  });
});

describe("ensureTableForTemplateKey in-flight mutex", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchSyncPostMock.mockReset();
    saveSettingsMock.mockResolvedValue(undefined);
    // Notebook resolution talks to the kernel when notebookId is omitted.
    mockHealthyKernel();
  });

  it("shares ONE creation between concurrent ensures for the same templateKey", async () => {
    const createMock = vi.fn(async (input: { templateKey?: string }) => {
      // Creation takes real (mock) time — both calls overlap inside it.
      await new Promise((r) => setTimeout(r, 20));
      return db(`av-${input.templateKey}`, input.templateKey);
    });

    const [a, b] = await Promise.all([
      ensureTableForTemplateKey({ templateKey: "tasks", create: createMock }),
      ensureTableForTemplateKey({ templateKey: "tasks", create: createMock }),
    ]);

    expect(createMock).toHaveBeenCalledTimes(1);
    expect(a.db.avID).toBe("av-tasks");
    expect(b.db.avID).toBe(a.db.avID);
  });

  it("does not dedupe SEQUENTIAL ensures (mutex covers in-flight only)", async () => {
    const createMock = vi.fn(async (input: { templateKey?: string }) =>
      db(`av-${input.templateKey}`, input.templateKey));

    const first = await ensureTableForTemplateKey({ templateKey: "tasks", create: createMock });
    const second = await ensureTableForTemplateKey({ templateKey: "tasks", create: createMock });

    expect(createMock).toHaveBeenCalledTimes(2);
    expect(first.db.avID).toBe("av-tasks");
    expect(second.db.avID).toBe("av-tasks");
  });

  it("runs concurrent ensures for DIFFERENT templateKeys independently", async () => {
    const createMock = vi.fn(async (input: { templateKey?: string }) =>
      db(`av-${input.templateKey}`, input.templateKey));

    await Promise.all([
      ensureTableForTemplateKey({ templateKey: "tasks", create: createMock }),
      ensureTableForTemplateKey({ templateKey: "projects", create: createMock }),
    ]);

    expect(createMock).toHaveBeenCalledTimes(2);
  });
});

describe("generateDefaultTables", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchSyncPostMock.mockReset();
    saveSettingsMock.mockResolvedValue(undefined);
  });

  it("is idempotent: skips all templates when all three exist and are healthy", async () => {
    mockHealthyKernel();
    loadSettingsMock.mockResolvedValue({
      ownedDatabases: [
        db("av-tasks", "tasks"),
        db("av-projects", "projects"),
        db("av-inbox", "inbox"),
      ],
      ownedDbNotebookId: "nb-saved",
      ownedDbPrimaryByType: {},
      ownedDbLastAvID: "",
    } as never);
    const createMock = vi.fn();

    const result = await generateDefaultTables({ plugin, create: createMock });

    expect(result).toEqual({ created: [], skipped: 3 });
    expect(createMock).not.toHaveBeenCalled();
    expect(saveSettingsMock).not.toHaveBeenCalled();
  });

  it("creates only the missing templateKeys in template order and marks the last created", async () => {
    mockHealthyKernel();
    // loadPanelSettings re-reads what was saved (like the real data store).
    let current = {
      ownedDatabases: [db("av-tasks", "tasks")],
      ownedDbNotebookId: "nb-saved",
      ownedDbPrimaryByType: {},
      ownedDbLastAvID: "",
    } as PanelSettings;
    loadSettingsMock.mockImplementation(async () => current);
    saveSettingsMock.mockImplementation(async (_store, next) => {
      current = next;
    });
    const createMock = vi.fn(async (input: { templateKey?: string }) =>
      db(`av-${input.templateKey}`, input.templateKey));

    const result = await generateDefaultTables({ plugin, create: createMock });

    expect(result.created.map((d) => d.avID)).toEqual(["av-projects", "av-inbox"]);
    expect(result.skipped).toBe(1);
    expect(DEFAULT_TABLE_TEMPLATES.map((t) => t.key)).toEqual([
      "tasks",
      "projects",
      "inbox",
    ]);

    const lastSave = saveSettingsMock.mock.calls.at(-1)![1];
    expect(lastSave.ownedDbLastAvID).toBe("av-inbox");
    expect(lastSave.ownedDatabases.map((d) => d.avID).sort()).toEqual([
      "av-inbox",
      "av-projects",
      "av-tasks",
    ]);
  });

  it("passes nameOf through so UI i18n names land on the created tables", async () => {
    mockHealthyKernel();
    loadSettingsMock.mockResolvedValue({
      ownedDatabases: [],
      ownedDbNotebookId: "",
      ownedDbPrimaryByType: {},
      ownedDbLastAvID: "",
    } as never);
    const createMock = vi.fn(async (input: { templateKey?: string }) =>
      db(`av-${input.templateKey}`, input.templateKey));

    const result = await generateDefaultTables({
      plugin,
      nameOf: (t: TableTemplate) => `名-${t.key}`,
      create: createMock,
    });

    expect(result.created).toHaveLength(3);
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: "名-projects", templateKey: "projects" }),
    );
  });
});

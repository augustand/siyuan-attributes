import { DEFAULT_OWNED_DATABASE_COLUMNS } from "@/models/ownedDatabaseCreate";

export type DatabaseTypeId = "task" | "project" | "product" | "generic";

export interface DatabaseTypeColumn {
  name: string;
  type: string;
  options?: Array<{ name: string; color?: string }>;
}

export interface DatabaseTypeDef {
  id: DatabaseTypeId;
  /** i18n path under ownedDb.types.* */
  nameKey: string;
  descriptionKey: string;
  columns: DatabaseTypeColumn[];
}

const SELECT_COLORS = ["1", "2", "3", "4", "5", "6", "7"] as const;

function selectOptions(names: string[]): Array<{ name: string; color: string }> {
  return names.map((name, i) => ({
    name,
    color: SELECT_COLORS[i % SELECT_COLORS.length]!,
  }));
}

export const DATABASE_TYPES: readonly DatabaseTypeDef[] = [
  {
    id: "task",
    nameKey: "ownedDb.types.task",
    descriptionKey: "ownedDb.types.taskDesc",
    columns: [
      {
        name: "状态",
        type: "select",
        options: selectOptions(["待办", "进行中", "完成", "取消"]),
      },
      {
        name: "优先级",
        type: "select",
        options: selectOptions(["高", "中", "低"]),
      },
      { name: "截止日期", type: "date" },
      { name: "负责人", type: "text" },
      { name: "完成", type: "checkbox" },
    ],
  },
  {
    id: "project",
    nameKey: "ownedDb.types.project",
    descriptionKey: "ownedDb.types.projectDesc",
    columns: [
      {
        name: "状态",
        type: "select",
        options: selectOptions(["规划", "进行", "暂停", "完成"]),
      },
      { name: "阶段", type: "text" },
      { name: "开始日期", type: "date" },
      { name: "结束日期", type: "date" },
      { name: "负责人", type: "text" },
    ],
  },
  {
    id: "product",
    nameKey: "ownedDb.types.product",
    descriptionKey: "ownedDb.types.productDesc",
    columns: [
      {
        name: "状态",
        type: "select",
        options: selectOptions(["构想", "开发", "上线", "归档"]),
      },
      { name: "版本", type: "text" },
      {
        name: "优先级",
        type: "select",
        options: selectOptions(["P0", "P1", "P2"]),
      },
      { name: "负责人", type: "text" },
    ],
  },
  {
    id: "generic",
    nameKey: "ownedDb.types.generic",
    descriptionKey: "ownedDb.types.genericDesc",
    columns: DEFAULT_OWNED_DATABASE_COLUMNS.map((col) => ({
      name: col.name,
      type: col.type,
    })),
  },
];

const TYPE_BY_ID = new Map(DATABASE_TYPES.map((t) => [t.id, t]));

export function normalizeDatabaseTypeId(raw: unknown): DatabaseTypeId {
  if (raw === "task" || raw === "project" || raw === "product" || raw === "generic") {
    return raw;
  }
  return "generic";
}

export function getDatabaseType(id: DatabaseTypeId | string | undefined): DatabaseTypeDef {
  const normalized = normalizeDatabaseTypeId(id);
  return TYPE_BY_ID.get(normalized)!;
}

/** A ready-to-use table template (数据库 = 表格,行 = 文档). */
export interface TableTemplate {
  key: string;
  /** i18n path under ownedDb.tables.* */
  nameKey: string;
  nameFallback: string;
  columns: DatabaseTypeColumn[];
}

/** Starter options for the shared 标签 column (each with a color). */
const TAG_STARTER_OPTIONS = selectOptions(["工作", "个人", "灵感"]);

export const DEFAULT_TABLE_TEMPLATES: readonly TableTemplate[] = [
  {
    key: "tasks",
    nameKey: "ownedDb.tables.tasks",
    nameFallback: "任务清单",
    columns: [
      {
        name: "状态",
        type: "select",
        options: selectOptions(["待办", "进行中", "已完成", "取消"]),
      },
      {
        name: "优先级",
        type: "select",
        options: selectOptions(["高", "中", "低"]),
      },
      { name: "截止日期", type: "date" },
      { name: "标签", type: "mSelect", options: TAG_STARTER_OPTIONS },
      { name: "完成", type: "checkbox" },
    ],
  },
  {
    key: "projects",
    nameKey: "ownedDb.tables.projects",
    nameFallback: "项目追踪",
    columns: [
      {
        name: "状态",
        type: "select",
        options: selectOptions(["规划", "进行中", "暂停", "已完结"]),
      },
      { name: "阶段", type: "text" },
      { name: "开始日期", type: "date" },
      { name: "结束日期", type: "date" },
      { name: "标签", type: "mSelect", options: TAG_STARTER_OPTIONS },
    ],
  },
  {
    key: "inbox",
    nameKey: "ownedDb.tables.inbox",
    nameFallback: "素材收集箱",
    columns: [
      // url passed through verbatim; SiYuan supports url keys natively.
      { name: "来源", type: "url" },
      { name: "标签", type: "mSelect", options: TAG_STARTER_OPTIONS },
      { name: "收集日期", type: "date" },
      { name: "摘要", type: "text" },
    ],
  },
];

const TEMPLATE_BY_KEY = new Map(DEFAULT_TABLE_TEMPLATES.map((t) => [t.key, t]));

export function getTableTemplate(key: string): TableTemplate | undefined {
  const trimmed = (key ?? "").trim();
  return trimmed ? TEMPLATE_BY_KEY.get(trimmed) : undefined;
}

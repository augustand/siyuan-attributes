# 文档表格重定位 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax. 按 刀A → 刀B → 刀C 顺序执行,每把刀结束跑验证三件套。

**Goal:** 概念从「类型化库目录」转为「文档表格」:三张默认模板一键生成、命名修复、名称+起点建库、扁平管理列表、文档树「加入表格」。

**Architecture:** 刀A 只动模型/服务(保持全部既有导出,UI 照常编译);刀B 换 Dock+设置页 UI 皮;刀C 换文档树菜单与宿主。类型机制休眠不删。

**Tech Stack:** Vue 3 + TDesign、Vitest、思源 `/api/av/*`

**Spec:** `docs/superpowers/specs/2026-09-29-doc-tables-redesign-design.md`

## Global Constraints

- 既有导出一律保留(休眠);`typeId`/`ownedDbPrimaryByType` 数据字段不删不读新逻辑
- i18n 两包同步;`node scripts/check-i18n.mjs` 每刀退出 0;不动休眠段(attributes.* 等)
- 每刀结束:`npm run typecheck && npm run test && node scripts/check-i18n.mjs` 全绿;不 commit
- 大文件编辑用 python3 精确替换 + 断言;每次编辑后 `grep -n` 验证落点

---

## 刀A:模型 + 服务(TDD)

**Files:**
- Modify: `src/models/databaseTypes.ts`(加 `TableTemplate` + `DEFAULT_TABLE_TEMPLATES`,保留 `DATABASE_TYPES`/`DatabaseTypeId`)
- Modify: `src/models/ownedDatabase.ts`(`templateKey?: string` + normalize 透传)
- Modify: `src/models/ownedDatabaseCreate.ts`(种子只含主键 block 列(名=表名)+表格视图;去种子单选列)
- Modify: `src/services/ownedDatabase.ts`(`createOwnedDatabase` 加 `templateKey?`/`columns?` 入参、`typeId?` 仅兼容、跳过 rename、宿主文档名 `表 · <name>`;新增 `generateDefaultTables`、`ensureTableForTemplateKey`)
- Modify: `src/services/doctreeClassify.ts` + `src/services/doctreeClassifyEvents.ts`(`joinTableByKey`;新事件 `CLASSIFY_PICK_TABLE_EVENT`;`classifyDocumentToType` 保留休眠)
- Modify: `src/models/ownedDatabaseHang.ts`(`displayOwnedDatabaseName` 加第三参 `templateName?: string`,兜底顺序 templateName→typeFallback→原值)
- Tests: `tests/models/databaseTypes.spec.ts`(模板:顺序 tasks→projects→inbox、key 唯一、每张含 nameKey/columns 且不含主键列)、`tests/models/ownedDatabaseCreate.spec.ts`(种子无单选列、主键名=表名)、`tests/models/ownedDatabase.spec.ts`(templateKey normalize)、`tests/services/ownedDatabaseCreate.spec.ts`(create 不再调 rename、传 templateKey 落库、宿主文档名带「表 · 」前缀——mock 内核)、`tests/services/ownedDatabaseGenerate.spec.ts`(新建:generateDefaultTables 幂等——mock create;ensureTableForTemplateKey 命中现有/缺省生成)、`tests/services/doctreeClassify.spec.ts`(joinTableByKey:already/created/bound 三分支,mock ensure+migrate+refresh)

**Interfaces(刀B/C 消费):**
```ts
export interface TableTemplate { key: string; nameKey: string; nameFallback: string; columns: DatabaseTypeColumn[]; }
export const DEFAULT_TABLE_TEMPLATES: readonly TableTemplate[]; // ["tasks","projects","inbox"]
export function getTableTemplate(key: string): TableTemplate | undefined;

// ownedDatabase service
generateDefaultTables(input: { plugin?: Plugin; notebookId?: string; nameOf?: (t: TableTemplate) => string })
  : Promise<{ created: OwnedDatabase[]; skipped: number }>;
ensureTableForTemplateKey(input: { plugin?: Plugin; templateKey: string; notebookId?: string; nameOf?: (t: TableTemplate)=>string })
  : Promise<{ db: OwnedDatabase; created: boolean }>;

// doctreeClassify
joinTableByKey(input: { plugin: Plugin; docId: string; templateKey: string; nameOf?: (t: TableTemplate)=>string })
  : Promise<{ kind: "bound" | "created" | "already"; db: OwnedDatabase; addedColumns: string[] }>;
export const CLASSIFY_PICK_TABLE_EVENT = "mux-doctree-classify:pick-table";
```
- [x] 测试先行全红 → 实现 → 全绿
- [x] `来源` 列用 `url` 类型直传(addAttributeViewKeys payload 原样透传 keyType,内核未拒;无需降级)

## 刀B:Dock + 设置页 UI

**Files:** `src/views/DocDatabaseDock.vue`、`src/views/SettingContent.vue`、`src/i18n/zh_CN.json`、`src/i18n/en_US.json`

- [x] Dock 建库对话框:「类型选择」→「起点」`t-select`(空白表格/tasks/projects/inbox,选项 label 走 `ownedDb.tables.*`);`runCreate` 按起点传 `templateKey` 或空白列;移除 `createTypeId`
- [x] 当前文档区:未挂 = 三张默认表快捷按钮(label=表名,click → `joinTableByKey` → toast bound/created/already + `afterBindingMutation`)+「选择其它表格…」;已挂 = 表名 + 移出。摘除 hangTypeButtons/hangType chips/换类型确认(showChangeType/onHangType/migrateToType 相关 UI 与函数引用——函数本体在 models 已休眠,只摘 UI 调用)/主库设/清/徽标/类型分组头(`groupedDatabases` 改为 `filterOwnedDatabases` → 扁平行,保留关键字+只看异常过滤行)
- [x] 列表行:文档数徽标(新 `docCounts` ref,`refreshDocCounts()` 在 mount/绑定变更/生成后跑,`fetchDatabaseQueryData(db.avID)` rows.length,失败该行隐藏;显示 `N 篇`);行动作=文档/打开/补齐列/移除
- [x] 空名单态:「一键生成默认表格」大按钮 → `generateDefaultTables`(nameOf 走 i18n)→ toast 已生成 n 张 + 刷新健康图/计数;保留「新建」入口
- [x] 显示名兜底:`dbDisplayName` 传 templateName(经 `getTableTemplate(db.templateKey)?.nameKey` i18n 解析)
- [x] 设置页:建库对话框同「名称+起点」;「补齐缺失的默认表」按钮(`generateDefaultTables` → toast `已生成 {n} 张` 或 `三张默认表已就绪`);卡片 templateKey → 「默认」小徽标;摘除类型徽标显示
- [x] i18n 新增(两包):`tables.tasks` 任务清单/Task List、`tables.projects` 项目追踪/Projects、`tables.inbox` 素材收集箱/Inbox、`startLabel` 起点/Starting point、`startBlank` 空白表格/Blank table、`generateDefault` 一键生成默认表格/Generate default tables、`generateOk` 已生成 {n} 张表/Generated {n} table(s)、`tablesReady` 三张默认表已就绪/All default tables exist、`backfillMissing` 补齐缺失的默认表/Backfill missing defaults、`joinOther` 选择其它表格…/Choose another table…、`docCount` {n} 篇/{n} docs、`defaultBadge` 默认/Default;`ownedDb.ours` 改「表格/Tables」、`oursEmpty` 改表格语境文案;`settings.title` 改「文档表格/Doc Tables」
- [x] 验证三件套全绿

## 刀C:文档树菜单 + 宿主

**Files:** `src/index.ts`、`src/views/DoctreeClassifyHost.vue`、两 i18n 包

- [x] `onDoctreeMenu`:菜单项 = 三张默认表名(`ownedDb.tables.*`)+ `更多表格…`(`ownedDb.menuJoinMore`);前三项 → `joinTableByKey({plugin, docId, templateKey})` → toast(`joinOk` 已加入「{name}」/`createdJoin` 已生成并加入「{name}」/already 复用;有补列复用 `columnsAdded`);`更多表格…` → `window.dispatchEvent(new CustomEvent(CLASSIFY_PICK_TABLE_EVENT, {detail:{docId}}))`;摘除 marks/typeLabel 类型逻辑
- [x] `DoctreeClassifyHost`:监听 `CLASSIFY_PICK_TABLE_EVENT` → 打开 `AddToDatabaseDialog`(docId、健康表格、ownedAvIds;bound → `refreshDocumentEditor`);摘除 need-create 建库对话框流程(生成已自动化,创建失败走 error toast)
- [x] i18n:`menuJoinMore` 更多表格…/More tables…、`joinOk` 已加入「{name}」/Joined "{name}"、`createdJoin` 已生成并加入「{name}」/Created and joined "{name}"
- [x] 验证三件套 + `npm run verify` 全链 + build

---

## Spec coverage

| Spec 目标 | 刀 |
|---|---|
| TableTemplate/模板定稿/templateKey | A |
| 命名修复 + 种子重构 | A |
| generate/ensure/joinTable 服务 | A |
| 名称+起点建库、去类型 UI、扁平列表+计数、一键生成按钮 | B |
| 设置页镜像 + 补齐按钮 + 默认徽标 | B |
| 文档树加入表格 + 宿主选表 | C |

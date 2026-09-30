# 库列表管理(过滤/只看异常/行内改名/补齐列)Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** 「我们的库」支持关键字过滤与「只看异常」;Dock 行内改名;Dock+设置页行级「补齐列」按钮。

**Architecture:** 过滤为纯函数(输入库名+类型标签+健康图);改名/补齐复用既有 settings 写入与 `ensureOwnedDatabaseTemplateColumns`(幂等,返回 `{ added }`)。

**Tech Stack:** Vue 3 + TDesign、Vitest

**Spec:** `docs/superpowers/specs/2026-09-29-owned-list-management-design.md`

## Global Constraints

- 不加新 settings 字段;改名写 `OwnedDatabase.name`
- i18n 只新增 4 键(两包同步):`filterPh`(搜索库名或类型/Search name or type)、`brokenOnly`(只看异常/Unavailable only)、`backfill`(补齐列/Backfill columns)、`backfillNone`(列已齐全/Columns up to date);成功提示复用现有 `ownedDb.columnsAdded`("已补齐字段：{cols}")
- 不动休眠 i18n 段;不 commit;`node scripts/check-i18n.mjs` 必须退出 0

---

### Task 1: 纯函数 + 单测(TDD)

**Files:** Modify `src/models/ownedDatabaseHang.ts`(追加)、`tests/models/ownedDatabaseHang.spec.ts`

**Produces:**
```ts
export interface OwnedFilter { keyword?: string; brokenOnly?: boolean; }
export function filterOwnedDatabases(
  databases: OwnedDatabase[],
  filter: OwnedFilter,
  healthMap: Record<string, "ok" | "broken" | "missing">,
): OwnedDatabase[];
```
语义:keyword 空白=不过滤;非空时匹配「库名(小写包含)」或「类型标签(由调用方传入会太绕——改为接收 `typeLabelOf: (db) => string` 第四参)」;brokenOnly=true 只留 health!=="ok" 的库。健康缺省按 "ok" 处理。
- [x] 先写失败测试(关键词命中名/类型、大小写不敏感、brokenOnly 组合、空关键词全量),跑测试确认失败,再实现到绿。

### Task 2: Dock UI

**Files:** Modify `src/views/DocDatabaseDock.vue`

- [x] 「我们的库」标题行下加过滤行:`t-input`(clearable,`placeholder=labels.filterPh`,新 ref `listKeyword`,注意与既有 `searchKeyword`(导入搜索用)区分)+ `t-checkbox`「只看异常」(新 ref `brokenOnly`,仅 `brokenCount>0` 时显示)。
- [x] 分组列表改为消费 `filteredGroupedDatabases` computed:先 `filterOwnedDatabases(ownedDatabases.value, {keyword, brokenOnly}, healthMap.value, dbTypeIdLabel)` 再 `groupOwnedDatabasesByType`;过滤后为空显示 `labels.noHits`(键已存在)。
- [x] 行内改名:点库名进入编辑(行内 `t-input` 替换名字 span,Enter/失焦提交、Esc 取消);提交走 Dock 既有 `persistOwned`(更新对应项 `name`)。空名/空白取消不提交。
- [x] 行操作加「补齐列」:调 `ensureOwnedDatabaseTemplateColumns(db)`(该文件已 import),`added.length ? MessagePlugin.info(labels.columnsAdded.replace("{cols}", added.join("、"))) : MessagePlugin.success(labels.backfillNone)`;异常走既有 error toast 模式。
- [x] 过滤行、改名输入框、补齐按钮均需在任何状态下不破坏现有行操作(打开/文档/移除)。

### Task 3: 设置页同步

**Files:** Modify `src/views/SettingContent.vue`

- [x] 每张库卡加「补齐列」按钮,处理器与 Dock 同逻辑(该页也调 `ensureOwnedDatabaseTemplateColumns`,注意传 draft 中的库对象后如名字被改需以 draft 为准);改名字段沿用该页既有输入框,不重复做行内改名。

### Task 4: i18n

- [x] 两包 `ownedDb` 加 4 键(见 Global Constraints),跑 `node scripts/check-i18n.mjs` 确认 0 缺失。

### Task 5: 验证

- [x] `npm run typecheck && npm run test && node scripts/check-i18n.mjs` 全绿;ownedDatabaseHang 既有 14 例不回归。

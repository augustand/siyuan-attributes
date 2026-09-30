# 按库查询(文档对话框筛选)Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** 「文档」对话框按库真实列做单列筛选(equals/contains/isEmpty),客户端过滤,命中数可见,点击结果打开文档。

**Architecture:** 新 service 封装 `/api/av/renderAttributeView`(按 avID 取列定义+行数据,容错归一化);`matchDoc` 纯函数过滤;Dock 对话框消费;内核返回异常时回退既有 `listDatabaseBoundDocs`(无筛选 UI)。

**Tech Stack:** Vue 3 + TDesign、Vitest

**Spec:** `docs/superpowers/specs/2026-09-29-db-query-filter-design.md`

## Global Constraints

- 所有绑定/查询走官方 `/api/av/*`,不另造数据源;不做保存视图/跨库/SQL
- i18n 只新增 6 键(两包同步):`queryEquals`(等于/Equals)、`queryContains`(包含/Contains)、`queryIsEmpty`(为空/Is empty)、`queryValuePh`(筛选值/Filter value)、`queryHits`({n} 篇命中/{n} match(es))、`queryClear`(清除筛选/Clear filter)
- 不动休眠 i18n 段;不 commit;`node scripts/check-i18n.mjs` 必须退出 0

---

### Task 1: service(容错归一化)

**Files:** Create `src/services/databaseQuery.ts`;Create `tests/services/databaseQuery.spec.ts`

**Produces:**
```ts
export interface DatabaseQueryColumn { keyID: string; name: string; type: string; }
export interface DatabaseQueryCell { text: string; isEmpty: boolean; }
export interface DatabaseQueryRow { docID: string; primaryText: string; cells: Record<string, DatabaseQueryCell>; }
export async function fetchDatabaseQueryData(avID: string): Promise<{ columns: DatabaseQueryColumn[]; rows: DatabaseQueryRow[] }>;
```
- 内核调用方式与请求封装**照抄 `src/services/attributeView.ts` 里 fetchAttributeViews 的做法**(读该文件确定 helper 与错误风格);POST `/api/av/renderAttributeView` `{ id: avID }`。
- 容错解析:列从返回的 av/view 表格列取(keyID/key、name/title/name、type);行取表格行(docID/id);单元格值(文本/选项 content 数组/日期)统一折叠为 `text`(数组用合适分隔符连接),`isEmpty = !text.trim()`;主键列文本进 `primaryText`。任何字段缺失/形状不符 → 跳过该字段而非抛错;完全无表格 → 返回空 columns/rows。
- [x] 测试:mock 内核响应(仿 `tests/services/listDatabaseBoundDocs.spec.ts` 的 mock 风格),覆盖:标准形状、缺字段、未知形状、空表格。先红后绿。

### Task 2: matchDoc 纯函数

**Files:** 同 Task 1 两个文件

```ts
export type QueryOp = "equals" | "contains" | "isEmpty";
export function matchDoc(row: DatabaseQueryRow, filter: { keyID: string; op: QueryOp; value?: string }): boolean;
```
- equals:`text === value.trim()`;contains:大小写不敏感 `includes(value.trim())`;isEmpty:cell 缺失或 `isEmpty`。
- [x] 单测覆盖三操作 × 命中/未命中/空单元格/缺单元格,先红后绿。

### Task 3: Dock 文档对话框接筛选

**Files:** Modify `src/views/DocDatabaseDock.vue`

- [x] `openDocs(db)` 改为先 `fetchDatabaseQueryData(db.avID)`;成功 → 存 columns/rows,行渲染替换为 rows(primaryText + 点击 openDoc 走既有流程);失败 → 回退既有 `store.loadBoundDocs` 路径并隐藏筛选 UI。
- [x] 筛选行(仅 columns.length>0 时渲染):列 `t-select`(列名)、条件 `t-select`(labels.queryEquals/queryContains/queryIsEmpty)、值 `t-input`(isEmpty 时隐藏,placeholder labels.queryValuePh)、命中数 `labels.queryHits.replace("{n}", String(n))`、清除按钮 labels.queryClear;过滤后空列表显示既有 `ownedDb.noHits`。
- [x] 关闭对话框时重置筛选状态;不影响对话框外其它功能。

### Task 4: i18n

- [x] 两包 `ownedDb` 加 6 键(见 Global Constraints),跑 `node scripts/check-i18n.mjs` 确认 0 缺失。

### Task 5: 验证

- [x] `npm run typecheck && npm run test && node scripts/check-i18n.mjs` 全绿;既有 128 例不回归。

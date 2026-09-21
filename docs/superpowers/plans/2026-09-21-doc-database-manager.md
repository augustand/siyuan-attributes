# 文档数据库管理器实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让位原生标题下 AV UI；交付 Dock「文档数据库」= 规则定义 + 绑定管理 + 单字段简易查询。

**Architecture:** 扩展 settings 存 `docDatabaseRules`；`addDock` 挂 `DocDatabaseDock`；AV service 增加 bind/unbind/render；默认关闭 `mountDatabasePanel`。

**Tech Stack:** Vue 3、Pinia、TDesign、Vitest、SiYuan Plugin Dock + `/api/av/*`

**Spec:** `docs/superpowers/specs/2026-09-21-doc-database-manager-design.md`

## Global Constraints

- 默认不挂标题下插件属性面板（`showUnderTitlePanel` 默认 `false`）。
- 不修改 AV schema（不建列）。
- 绑定/解绑不删文档。
- 查询第一刀：单字段 + equals/contains/isEmpty；可客户端过滤。
- 中文 UI 文案优先。

## File map

| Path | Role |
|------|------|
| `src/models/docDatabaseRules.ts` | 规则类型、normalize、match |
| `src/models/settings.ts` | 接入 rules + showUnderTitlePanel |
| `src/services/attributeView.ts` | add/remove blocks；render/list helpers |
| `src/store/docDatabase.ts` | Dock 状态 |
| `src/views/DocDatabaseDock.vue` | Dock UI |
| `src/index.ts` | addDock；条件 mount 标题下面板 |
| `src/views/SettingContent.vue` | 规则编辑 + 高级开关 |
| i18n / README | 文案更新 |

---

### Task 1: 规则模型（TDD）

**Files:** Create `src/models/docDatabaseRules.ts`, `tests/models/docDatabaseRules.spec.ts`；Modify `src/models/settings.ts`

**Produces:**
- `DocDatabaseRule`, `normalizeDocDatabaseRule`, `normalizeDocDatabaseRules`, `matchDocDatabaseRules(doc: { notebookId, path }, rules): DocDatabaseRule[]`

匹配：仅 `enabled`；`pathPrefix` 用 `path.startsWith`；无 pathPrefix 时用 `notebookId` 相等；更长 pathPrefix 优先。

- [ ] 写测试（命中、禁用、前缀长短、空）
- [ ] 实现 + `PanelSettings` 增加：
  - `showUnderTitlePanel: boolean`（默认 false）
  - `docDatabaseRules: DocDatabaseRule[]`（默认 []）
  - 保留 `showPanel` 语义或与 under-title 对齐（实现时：`showUnderTitlePanel` 控制挂载；`showPanel` 可弃用或同值）
- [ ] Commit: `feat: add doc-database binding rules model`

---

### Task 2: AV bind / list API

**Files:** Modify `src/services/attributeView.ts`；Create `tests/services/attributeViewBind.spec.ts`

**Produces:**
- `bindDocumentToDatabase({ avID, avBlockID, docId, viewID? })`
- `unbindDocumentFromDatabase({ avID, docId })`
- `listDatabaseBoundDocs(avID)` — 优先 `getAttributeViewPrimaryKeyValues` 或 `renderAttributeView`（选一，测试 mock）

- [ ] Commit: `feat: add AV bind/unbind and list helpers`

---

### Task 3: 关闭标题下面板默认挂载

**Files:** `src/index.ts`, `src/App.vue`（若需）, `src/views/SettingContent.vue`, settings normalize

- [ ] `mountDatabasePanel` 仅当 `showUnderTitlePanel === true`
- [ ] 设置页：高级「在标题下显示插件字段面板（与原生重复）」开关；主文案强调让位原生
- [ ] 同步 `dev` + `reloadUI` 验证只剩原生一块
- [ ] Commit: `fix: yield under-title editing to native AV panel`

---

### Task 4: Dock UI + store

**Files:** `src/store/docDatabase.ts`, `src/views/DocDatabaseDock.vue`, `src/index.ts` (`addDock`)

Dock 分区：
1. **当前文档**：绑定列表；按命中规则一键绑定；解绑
2. **规则**：只读摘要 + 链到设置（或内嵌简表）
3. **查询**：选库、选列、条件、结果列表

- [ ] `typecheck` + 手动冒烟
- [ ] Commit: `feat: add document database manager dock`

---

### Task 5: 设置里规则 CRUD + 文档

- [ ] SettingContent：规则增删改（name, notebookId/pathPrefix, avID, avBlockID, enabled）
- [ ] README / plugin.json 描述改为「文档数据库管理」
- [ ] `npm run verify`
- [ ] Commit: `feat: settings and docs for doc-database manager`

---

## Spec coverage

| Spec | Task |
|------|------|
| 让位原生 | 3 |
| 定义规则 | 1, 5 |
| 管理绑定 | 2, 4 |
| 查询 | 2, 4 |
| 设置 | 3, 5 |

用户已要求继续 → 本会话 Inline Execution，从 Task 1 开始。

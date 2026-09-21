# 数据库属性面板（P1+P2）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将标题下面板换成以思源 AV 为中心的文档行属性编辑（常见类型可写 + 多库 Tab + 按库列偏好），并休眠 `custom-*` UI。

**Architecture:** 新建 `models/attributeView` + `services/attributeView` + `store/databasePanel` + `views/DatabasePanel` + `components/av/*`；`App.vue` 只挂 AV；设置扩展 `databasePrefs` 并隐藏 custom 规则 UI。参考已删除实现（`2899608`）重写，不原样恢复。

**Tech Stack:** Vue 3、Pinia、TDesign、Vitest、SiYuan `/api/av/*`

## Global Constraints

- 不删除 dormant custom 源码，仅断开运行时入口。
- 写接口使用 `itemID`（不用 `cellID`）；值 payload 按列类型组装。
- 列偏好存插件 settings，不写文档属性。
- 主键列对应 key `type === "block"`；默认隐藏。
- 可写类型：`text` | `number` | `url` | `email` | `phone` | `checkbox` | `date` | `select` | `mSelect`。
- 只读展示：`relation` | `mAsset` | `template` | `rollup` | `created` | `updated` 等。

## File map

| Path | Responsibility |
|------|----------------|
| `src/models/attributeView.ts` | 规范化 AV 响应、build 写 payload、空值判断 |
| `src/models/databasePrefs.ts` | 按 avID 的列偏好 + 过滤可见字段 |
| `src/models/settings.ts` | PanelSettings 增加 showPanel 保留 + databaseDefaults + databasePrefs；rules 仍 normalize 但 UI 不展示 |
| `src/services/attributeView.ts` | fetch / write API |
| `src/store/databasePanel.ts` | 加载、activeAv、保存、偏好读写 |
| `src/views/DatabasePanel.vue` | Tab、工具条、空态、字段列表 |
| `src/components/av/AvFieldRow.vue` | 单字段编辑 |
| `src/App.vue` | 挂 DatabasePanel |
| `src/index.ts` | 容器类名 `.mux-database-panel`；停用块菜单 custom 对话框 |
| `src/views/SettingContent.vue` | 仅 AV 相关设置 |
| `docs/README*.md` / i18n / `plugin.json` | 文案转向数据库面板 |

---

### Task 1: AV 模型与写 payload（TDD）

**Files:**
- Create: `src/models/attributeView.ts`
- Create: `tests/models/attributeView.spec.ts`

**Produces:**
- `normalizeAttributeViews(input: unknown): DatabasePanel[]`
- `buildDatabaseCellValue(field: DatabaseField, value: DatabaseValue): unknown`
- `isDatabaseValueEmpty(field: DatabaseField): boolean`
- Types: `DatabaseFieldType`, `DatabaseOption`, `DatabaseValue`, `DatabaseField`, `DatabasePanel`

- [ ] **Step 1: 写失败测试**（基于历史用例，并扩展 editable 与 empty）

```ts
import { describe, expect, it } from "vitest";
import {
  buildDatabaseCellValue,
  isDatabaseValueEmpty,
  normalizeAttributeViews,
} from "@/models/attributeView";

const rawInput = [
  {
    avID: "av-1",
    avName: "Tasks",
    keyValues: [
      {
        key: { id: "key-title", name: "Title", type: "block" },
        values: [{ id: "value-title", blockID: "item-1", type: "block", block: { content: "Task" } }],
      },
      {
        key: {
          id: "key-status",
          name: "Status",
          type: "mSelect",
          options: [
            { name: "Todo", color: "1" },
            { name: "Done", color: "2" },
          ],
        },
        values: [{
          id: "value-status",
          keyID: "key-status",
          blockID: "item-1",
          type: "mSelect",
          mSelect: [{ content: "Done", color: "2" }],
        }],
      },
      {
        key: { id: "key-note", name: "Note", type: "text" },
        values: [{
          id: "value-note",
          keyID: "key-note",
          blockID: "item-1",
          type: "text",
          text: { content: "" },
        }],
      },
    ],
  },
];

describe("normalizeAttributeViews", () => {
  it("keeps block primary key when requested via includePrimaryKey later filtered outside", () => {
    const panels = normalizeAttributeViews(rawInput);
    expect(panels[0].fields.some((f) => f.type === "block")).toBe(true);
    expect(panels[0].fields.find((f) => f.keyID === "key-status")?.editable).toBe(true);
    expect(panels[0].fields.find((f) => f.keyID === "key-note")?.value.text).toBe("");
  });
});

describe("buildDatabaseCellValue", () => {
  it("builds mSelect payload from selected options", () => {
    const status = normalizeAttributeViews(rawInput)[0].fields.find((f) => f.keyID === "key-status")!;
    expect(buildDatabaseCellValue(status, status.value)).toEqual({
      mSelect: [{ content: "Done", color: "2" }],
    });
  });
});

describe("isDatabaseValueEmpty", () => {
  it("detects empty text", () => {
    const note = normalizeAttributeViews(rawInput)[0].fields.find((f) => f.keyID === "key-note")!;
    expect(isDatabaseValueEmpty(note)).toBe(true);
  });
});
```

注意：`buildDatabaseCellValue` 对 select/mSelect 输出 `{ mSelect: [{ content, color }] }`（与内核一致；旧实现用 `name` 是错误的，以 `content` 为准）。

- [ ] **Step 2: 运行确认失败**

Run: `npm test -- tests/models/attributeView.spec.ts`  
Expected: FAIL module not found

- [ ] **Step 3: 实现 `src/models/attributeView.ts`**

从 `git show 2899608:src/models/attributeView.ts` 移植并改：
1. `normalizeAttributeViews` **保留** `type === "block"` 字段（供 hidePrimaryKey 过滤），`editable: false`。
2. `editableTypes` 含：`text` `number` `url` `email` `phone` `checkbox` `date` `select` `mSelect`。
3. `buildDatabaseCellValue` 的 mSelect 用 `{ content: name, color }`。
4. 增加 `isDatabaseValueEmpty`：text/url/email/phone 空串；number undefined；checkbox 恒 false 不算空（有值）；date `!isNotEmpty`；mSelect/select options.length===0；block 看 block content。
5. `itemID` 仍从 value.`blockID` 读取（内核字段名）。

- [ ] **Step 4: 测试通过**

Run: `npm test -- tests/models/attributeView.spec.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/models/attributeView.ts tests/models/attributeView.spec.ts
git commit -m "feat: add AV normalize and cell value builders"
```

---

### Task 2: 列偏好模型（TDD）

**Files:**
- Create: `src/models/databasePrefs.ts`
- Create: `tests/models/databasePrefs.spec.ts`
- Modify: `src/models/settings.ts` — 扩展 `PanelSettings`

**Produces:**
- `DatabaseAvPrefs`, `normalizeDatabaseAvPrefs`, `filterVisibleFields(fields, prefs): DatabaseField[]`
- `PanelSettings` 增加：
  - `databaseDefaults: { hideEmpty: boolean; hidePrimaryKey: boolean }`
  - `databasePrefs: Record<string, DatabaseAvPrefs>`
  - 保留 `rules` / `version` / `showPanel`

```ts
export interface DatabaseAvPrefs {
  hiddenKeyIDs: string[];
  hideEmpty: boolean;
  hidePrimaryKey: boolean;
}
```

- [ ] **Step 1: 失败测试** `filterVisibleFields` 顺序：hidden → primary → empty

- [ ] **Step 2: 实现 prefs + settings normalize 兼容旧 JSON（缺字段给默认）**

Defaults: `hideEmpty: false`, `hidePrimaryKey: true`, `hiddenKeyIDs: []`, `databasePrefs: {}`

- [ ] **Step 3: 测试通过并 commit**

```bash
git commit -m "feat: add per-database column preference filtering"
```

---

### Task 3: AV service + databasePanel store

**Files:**
- Create: `src/services/attributeView.ts`
- Create: `tests/services/attributeView.spec.ts`（mock fetchSyncPost）
- Create: `src/store/databasePanel.ts`

**Produces:**
- `fetchAttributeViews(documentID: string): Promise<DatabasePanel[]>`
- `writeDatabaseCell({ avID, field }): Promise<void>` — body: `{ avID, keyID, itemID, value }`
- Store actions: `load(docId)`, `setActiveAv(avID)`, `saveField(field)`, `updateAvPrefs(avID, patch)`，computed `visibleFields`

- [ ] 实现后：`npm test -- tests/services/attributeView.spec.ts` PASS
- [ ] Commit: `feat: add AV fetch/write service and database panel store`

---

### Task 4: DatabasePanel UI + AvFieldRow

**Files:**
- Create: `src/components/av/AvFieldRow.vue`
- Create: `src/views/DatabasePanel.vue`
- Modify: `src/App.vue` — 挂 `DatabasePanel`
- Modify: `src/index.ts` — 类名 `mux-database-panel`；移除块菜单注册

**UI 行为：**
- 无库：空态文案（i18n）
- 多库：`t-tabs`
- 工具条：隐藏空字段开关 + 列设置（`t-checkbox-group` 或 popup 勾选当前库列）
- AvFieldRow：按 type 编辑；只读类型 `readonly` + placeholder「暂不支持编辑」；保存调 store.saveField，失败 MessagePlugin + reload 该库

- [ ] `npm run typecheck` 通过
- [ ] Commit: `feat: mount database panel under document title`

---

### Task 5: 设置页休眠 custom + 文案

**Files:**
- Modify: `src/views/SettingContent.vue` — 仅 showPanel、databaseDefaults；移除规则列表 UI（或整页替换为简易表单）
- Modify: `src/i18n/zh_CN.json`, `src/i18n/en_US.json`
- Modify: `docs/README_zh_CN.md`, `docs/README.md`, `plugin.json`

- [ ] Commit: `feat: switch settings and docs to database-centric panel`

---

### Task 6: 验证

- [ ] `npm run verify`（typecheck + test + build）全绿
- [ ] 手动：绑定库的文档标题下可编辑；未绑定见空态；custom 面板与块菜单入口消失

---

## Spec coverage

| Spec 项 | Task |
|---------|------|
| 挂载 / Tab / 空态 | 4 |
| 读写常见类型 | 1, 3, 4 |
| 列偏好 P2 | 2, 3, 4 |
| custom 休眠 | 4, 5 |
| itemID API | 3 |
| README/i18n | 5 |

## 执行说明

用户已要求「开始开发」→ 本会话 **Inline Execution**，按 Task 1→6 顺序提交。

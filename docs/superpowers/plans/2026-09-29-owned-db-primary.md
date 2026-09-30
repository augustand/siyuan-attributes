# 显式「设为主库」Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** 同类型健康库 ≥2 时,行内可显式「设为主库 / 清除主库」;主库行显徽标;Dock 与设置页同步。

**Architecture:** 纯函数写 `ownedDbPrimaryByType`(字段已在 `PanelSettings`,零迁移);UI 消费现有 `groupOwnedDatabasesByType` 分组与健康图;挂接即主库语义保留。

**Tech Stack:** Vue 3 + TDesign、Vitest

**Spec:** `docs/superpowers/specs/2026-09-29-owned-db-primary-design.md`

## Global Constraints

- 不改 `ownedDbPrimaryByType` 结构;不改归类/挂接服务语义
- i18n 键进 zh_CN/en_US 两包(2 空格缩进、ensure_ascii=false、尾部换行);`node scripts/check-i18n.mjs` 必须退出 0
- 现有测试不回归;最后跑 `npm run typecheck && npm run test && node scripts/check-i18n.mjs`

---

### Task 1: 纯函数 + 单测(TDD)

**Files:** Modify `src/models/ownedDatabaseHang.ts`(追加导出)、`tests/models/ownedDatabaseHang.spec.ts`

**Produces:**
```ts
export function setPrimaryForType(map: Record<string,string>, typeId: DatabaseTypeId, avID: string): Record<string,string>;
export function clearPrimaryForType(map: Record<string,string>, typeId: DatabaseTypeId): Record<string,string>;
```
- [x] 先写失败测试(set 覆盖/新增、clear 移除且不改其余键、空 map 安全),跑 `npx vitest run tests/models/ownedDatabaseHang.spec.ts` 确认失败,再实现到绿。

### Task 2: Dock 行内动作 + 徽标

**Files:** Modify `src/views/DocDatabaseDock.vue`(分组行 `row-actions` 区,`openDocs` 按钮附近)

- [x] 行内:健康且非主库 →「设为主库」文本按钮;主库行 → 徽标 +「清除主库」。显示条件:该类型健康库数 ≥2。计算:`primaryAvId(typeId) = settingsStore.settings.ownedDbPrimaryByType?.[typeId]`。
- [x] 处理器复用 Dock 既有 settings 写入路径(参考挂接处对 `ownedDbPrimaryByType` 的展开写法与 `persistOwned`/`updateSettings` 调用),写入后无需手动刷健康图。

### Task 3: 设置页同步

**Files:** Modify `src/views/SettingContent.vue`(库卡片操作区)

- [x] 卡片上同条件显示同两个动作,写 `draft.ownedDbPrimaryByType` 并走该页既有保存路径;主库卡片显徽标。

### Task 4: i18n

- [x] 两包 `ownedDb` 下加:`setPrimary`(设为主库/Set as primary)、`clearPrimary`(清除主库/Clear primary)、`primaryBadge`(主库/Primary)。跑 `node scripts/check-i18n.mjs` 确认 0 缺失。

### Task 5: 验证

- [x] `npm run typecheck && npm run test && node scripts/check-i18n.mjs` 全绿;现有测试(含 ownedDatabaseHang 10 例)不回归。

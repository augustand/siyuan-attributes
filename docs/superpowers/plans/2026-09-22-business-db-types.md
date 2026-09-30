# Business DB Types Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create owned databases from built-in business types (task / project / product / generic) that write native SiYuan AV columns (with select options), with no plugin field editors.

**Architecture:** Add `databaseTypes` model (built-in defs). Extend `createOwnedDatabase({ typeId })` to add template columns via `/api/av/addAttributeViewKey`, then patch select options via get+put AV file. Persist `typeId` on `OwnedDatabase` and show type picker + badges in Dock.

**Tech Stack:** Vue 3, Pinia settings, Vitest, SiYuan `/api/av/*`

**Spec:** `docs/superpowers/specs/2026-09-22-business-db-types-design.md`

## Global Constraints

- Field values are edited only in native under-title AV — no plugin value editors.
- Columns must be added through official AV APIs (addAttributeViewKey); do not invent a parallel schema.
- Old owned DBs without `typeId` normalize to `generic`.

---

### Task 1: Built-in database type definitions

**Files:**
- Create: `src/models/databaseTypes.ts`
- Create: `tests/models/databaseTypes.spec.ts`

**Interfaces:**
- Produces: `DatabaseTypeId`, `DatabaseTypeColumn`, `DatabaseTypeDef`, `DATABASE_TYPES`, `getDatabaseType(id)`, `normalizeDatabaseTypeId(raw)`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from "vitest";
import {
  DATABASE_TYPES,
  getDatabaseType,
  normalizeDatabaseTypeId,
} from "@/models/databaseTypes";

describe("databaseTypes", () => {
  it("exposes task, project, product, generic", () => {
    expect(DATABASE_TYPES.map((t) => t.id).sort()).toEqual(
      ["generic", "product", "project", "task"].sort(),
    );
  });

  it("task has 状态 select with options", () => {
    const task = getDatabaseType("task");
    const status = task.columns.find((c) => c.name === "状态");
    expect(status?.type).toBe("select");
    expect(status?.options?.map((o) => o.name)).toEqual(
      ["待办", "进行中", "完成", "取消"],
    );
  });

  it("normalizeDatabaseTypeId falls back to generic", () => {
    expect(normalizeDatabaseTypeId(undefined)).toBe("generic");
    expect(normalizeDatabaseTypeId("task")).toBe("task");
    expect(normalizeDatabaseTypeId("nope")).toBe("generic");
  });
});
```

- [ ] **Step 2: Run test — expect FAIL (module missing)**

Run: `npm run test -- tests/models/databaseTypes.spec.ts`

- [ ] **Step 3: Implement `src/models/databaseTypes.ts`**

Match column tables in the spec. `generic.columns` = import `DEFAULT_OWNED_DATABASE_COLUMNS` mapped to `{ name, type }` (no options). Prefer Chinese column names (consistent with current create UX / zh-first plugin).

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/models/databaseTypes.ts tests/models/databaseTypes.spec.ts
git commit -m "$(cat <<'EOF'
feat: define built-in business database type templates

EOF
)"
```

---

### Task 2: Persist typeId on OwnedDatabase + settings

**Files:**
- Modify: `src/models/ownedDatabase.ts`
- Modify: `src/models/settings.ts` (`ownedDbLastTypeId`)
- Modify: `tests/` covering normalizeOwnedDatabase (add or extend)

- [ ] **Step 1: Failing test** — `normalizeOwnedDatabase` keeps `typeId: "task"`; missing → omit or `"generic"` per chosen rule (prefer: store explicit `typeId` only when present; display layer uses `normalizeDatabaseTypeId(db.typeId)`).

- [ ] **Step 2: Implement** — add optional `typeId?: DatabaseTypeId` to `OwnedDatabase`; normalize with `normalizeDatabaseTypeId` when string present. Settings: `ownedDbLastTypeId: string` default `""`.

- [ ] **Step 3: Tests pass + commit**

```bash
git commit -m "$(cat <<'EOF'
feat: persist owned database typeId and last type preference

EOF
)"
```

---

### Task 3: Create owned DB by typeId (columns + select options)

**Files:**
- Modify: `src/services/ownedDatabase.ts`
- Modify: `tests/services/ownedDatabaseCreate.spec.ts`
- Create: `tests/services/ownedDatabaseColumns.spec.ts` (unit for option patch helper if extracted)

**Approach:**
1. Replace `addDefaultColumns` with `addTemplateColumns(avID, blockID, typeId)`.
2. For each column: `addAttributeViewKey` with `keyType` / `keyName`.
3. If `options?.length`: `getAttributeView` → locate key by `keyID` → set `key.options = [{ name, color }]` (color `"1"`..`"14"`) → `putAttributeViewFile`.
4. `createOwnedDatabase` accepts `typeId?: DatabaseTypeId`, returns db with `typeId`.
5. `generic` uses same column list as today’s `DEFAULT_OWNED_DATABASE_COLUMNS`.

- [ ] **Step 1: Extend create test** — `createOwnedDatabase({ typeId: "task", ... })` asserts addKey call count = task.columns.length and at least one putFile after options (or getAttributeView for option patch).

- [ ] **Step 2: Implement + pass tests**

- [ ] **Step 3: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat: create owned databases from business type column templates

EOF
)"
```

---

### Task 4: Dock create UI — type picker + list badge

**Files:**
- Modify: `src/views/DocDatabaseDock.vue`
- Modify: `src/i18n/zh_CN.json`, `src/i18n/en_US.json`
- Modify: `src/views/SettingContent.vue` if it also creates DBs (pass `typeId: "generic"` or same picker)

- [ ] **Step 1: Create dialog** — `t-select` bound to `createTypeId` (options from `DATABASE_TYPES` labels via i18n). Default from `ownedDbLastTypeId` or `"task"`.

- [ ] **Step 2: `runCreate`** — pass `typeId`, persist `ownedDbLastTypeId`.

- [ ] **Step 3: List badge** — show short type label next to name (`getDatabaseType` + i18n).

- [ ] **Step 4: i18n keys under `ownedDb.types.task` etc. + `dbType` form label.

- [ ] **Step 5: Typecheck + targeted tests + `npm run dev` reload

```bash
npm run typecheck
npm run test -- tests/models/databaseTypes.spec.ts tests/services/ownedDatabaseCreate.spec.ts
```

- [ ] **Step 6: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat: pick business database type when creating from Dock

EOF
)"
```

---

### Task 5: Manual verify in SiYuan

- [ ] Create **任务** DB named `验证任务库`
- [ ] Open home doc / bind a note → under-title native AV shows 状态/优先级/… with status options
- [ ] Confirm Dock list shows type badge
- [ ] Create **通用** DB → still gets generic columns

---

## Spec coverage

| Spec item | Task |
|-----------|------|
| Built-in types + columns | 1 |
| typeId on OwnedDatabase + lastTypeId | 2 |
| create with native columns/options | 3 |
| Dock picker + badge | 4 |
| Success criteria / no plugin editors | 4–5 |
| Non-goals (upgrade/query/rules) | omitted |

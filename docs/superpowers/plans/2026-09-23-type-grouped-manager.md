# Type-Grouped Manager Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Dock manages owned DBs by business type and hangs the current document onto a type with one click when possible.

**Architecture:** Pure helpers for grouping + hang target resolution; DocDatabaseDock UI consumes them. Reuse existing bind + AddToDatabaseDialog (filter by type when needed).

**Tech Stack:** Vue 3, Vitest, existing owned DB / attributeView services

**Spec:** `docs/superpowers/specs/2026-09-23-type-grouped-manager-design.md`

## Global Constraints

- Native AV only for field values; no plugin editors.
- No auto-bind; no column backfill in this knife.

---

### Task 1: Hang + group helpers

**Files:**
- Create: `src/models/ownedDatabaseHang.ts`
- Create: `tests/models/ownedDatabaseHang.spec.ts`

**Interfaces:**

```ts
export type HangResolution =
  | { kind: "none" }
  | { kind: "bind"; db: OwnedDatabase }
  | { kind: "pick"; databases: OwnedDatabase[] };

export function resolveHangTarget(input: {
  typeId: DatabaseTypeId;
  databases: OwnedDatabase[];
  healthyAvIDs: Set<string> | string[];
  boundAvIDs: Set<string> | string[];
  lastAvID?: string;
}): HangResolution;

export function groupOwnedDatabasesByType(
  databases: OwnedDatabase[],
): Array<{ typeId: DatabaseTypeId; databases: OwnedDatabase[] }>;
```

- [ ] **Step 1: Tests** — none → `{kind:"none"}`; one healthy unbound → bind; lastAvID matching type preferred; multiple without last → pick filtered list; group order task→project→product→generic; empty types omitted.

- [ ] **Step 2: Implement + pass**

- [ ] **Step 3: Commit** (only if user asked; otherwise skip)

---

### Task 2: Dock UI — type hang + grouped list

**Files:**
- Modify: `src/views/DocDatabaseDock.vue`
- Modify: `src/i18n/zh_CN.json`, `src/i18n/en_US.json`
- Possibly: `AddToDatabaseDialog` unchanged if parent passes filtered `databases`

- [ ] **Step 1:** Current section: type chip/buttons for task/project/product (+ generic if any healthy of that type). `onHangType(typeId)` uses `resolveHangTarget`; none → Message + optional `openCreateDialog` with type prefilled; bind → `bindDocumentToDatabase` + `onBound`; pick → set `showAdd` with filtered list (`addFilterDatabases` ref).

- [ ] **Step 2:** Replace flat owned list with `v-for="group in groupedDatabases"` section heads + rows.

- [ ] **Step 3:** Bound rows show type badge; i18n keys.

- [ ] **Step 4:** `npm run typecheck` + hang tests + rebuild/reload

---

## Spec coverage

| Spec | Task |
|------|------|
| resolve hang rules | 1 |
| group by type | 1 |
| Dock hang UI + grouped list | 2 |
| Non-goals | omitted |

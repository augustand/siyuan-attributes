# Database Field Editing Expansion Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Safely enable editing for SiYuan database date, date-range, select, and multi-select fields while keeping computed, relational, and asset fields read-only.

**Architecture:** Extend the database value model to always carry a normalized date state and distinguish all field options from selected options. Let `DbRow.vue` mutate only these normalized values and call the existing `itemID`-based write service. Keep unsupported types read-only and validate every write through the existing SiYuan response helper.

**Tech Stack:** Vue 3, TDesign Vue Next, SiYuan Attribute View API, TypeScript, Vitest.

**Spec:** `docs/superpowers/plans/2026-09-15-siyuan-attribute-panel-completion.md`, milestone M2 follow-up.

## Global Constraints

- Date writes use `time-stamp` picker values and send kernel-compatible fields: `content`, `content2`, `isNotEmpty`, `isNotEmpty2`, `hasEndDate`, and `isNotTime`.
- Clearing a date sends zero timestamps and false non-empty flags rather than omitting the fields.
- Select and multi-select writes use the `mSelect` payload shape for both types.
- Select/multi-select writes preserve option colors and only permit options already defined by the database field.
- An empty select/multi-select sends `mSelect: []`.
- Relation, rollup, asset, template, created, updated, primary key, and line-number fields remain read-only.
- Every write continues through `writeDatabaseCell` with `itemID`.
- Runtime verification must cover single date, date range, single select, and multi-select.

## Tasks

### Task 1: Normalize expanded database values

**Files:**
- Modify: `src/models/attributeView.ts`
- Test: `tests/models/attributeView.spec.ts`

- [x] Always normalize a `date` state, even when the raw database value omits it.
- [x] Normalize `isNotEmpty2` for date ranges.
- [x] Mark select/multi-select editable only when the field has at least one configured option.
- [x] Keep option names and colors in the stable model.

### Task 2: Build expanded cell payloads

**Files:**
- Modify: `src/models/attributeView.ts`
- Test: `tests/models/attributeView.spec.ts`

- [x] Select/multi-select emits `{ mSelect: [{ name, color }] }`.
- [x] Empty select/multi-select emits `{ mSelect: [] }`.
- [x] Single dates emit complete non-empty or cleared date state.
- [x] Date ranges emit `content`, `content2`, `isNotEmpty`, `isNotEmpty2`, `hasEndDate`, and `isNotTime`.

### Task 3: Enable date and select controls

**Files:**
- Modify: `src/components/DbRow.vue`

- [x] Enable TDesign single date and date-range pickers with `value-type="time-stamp"`.
- [x] Handle picker changes, including clearing a value.
- [x] Enable single-select and multi-select controls using database-defined options.
- [x] Keep unsupported controls explicitly read-only.
- [x] Use the existing save/error messaging path.

### Task 4: Documentation and release gate

**Files:**
- Modify: `docs/README.md`
- Modify: `docs/README_zh_CN.md`

- [x] Update supported/read-only field documentation.
- [x] Run `npm run verify`.
- [x] Verify runtime writes against a disposable database with date, date range, select, and multi-select fields.

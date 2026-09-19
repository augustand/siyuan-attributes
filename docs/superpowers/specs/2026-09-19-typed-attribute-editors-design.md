# Typed Attribute Editors Design

**Date:** 2026-09-19  
**Status:** Approved for planning  
**Branch:** `feat/typed-attribute-editors`

## Problem

Global display rules already expose `renderMethod` for `input` | `tag-input` | `datetime` | `link`. Common typed editors—single select, multi-select, date-only, checkbox, and number—are missing. Users cannot configure a `custom-*` attribute to edit with those controls without storing opaque free text.

Database / AV field editing remains out of scope for this spec (planned as a later subsystem).

## Goals

- Add render methods: `select` | `multi-select` | `date` | `checkbox` | `number`.
- Configure option lists for select / multi-select on **global rules only**.
- Reuse the same `AttributeRow` path for document panel and block attribute dialog.
- Keep simple string storage compatible with SiYuan `getBlockAttrs` / `setBlockAttrs`.

## Non-Goals

- SiYuan database (AV) attribute types and APIs.
- Per-document or per-block override of `renderMethod` or `options`.
- In-panel editing of option lists.
- Extra types (rating, color, progress, etc.).
- Changing document field-override storage (`custom-mux-attrs-doc-fields`).

## Product Contract

### Render methods

| Method | UI | Storage | Save |
|--------|----|---------|------|
| `input` | Single-line text | Raw string | blur if changed |
| `tag-input` | Tag chips | Comma-joined | change / blur |
| `datetime` | Date-time picker / formatted read-only | `YYYYMMDDHHmmss` | change when editable |
| `link` | Read-only + copy | Never written | — |
| `select` | Single `t-select` from rule `options` | Option string as-is | change |
| `multi-select` | Multi select or tag UI + suggestions | Comma-joined (trim, drop empties, dedupe) | change |
| `date` | Date picker (no time) / formatted read-only | `YYYYMMDD` | change when editable |
| `checkbox` | Switch / checkbox | `true` \| `false` (empty ⇒ false for display) | change |
| `number` | Number input | Decimal string | blur (align with `input`) |

### Options

- `DisplayRule.options?: string[]` — meaningful only when `renderMethod` is `select` or `multi-select`.
- Edited in global「属性面板设置」when those methods are selected (e.g. `t-tag-input`).
- Normalized on load/save: trim, drop empties, dedupe; default `[]`.
- Document「字段设置」does **not** override `renderMethod` or `options`.

### Approach

**A — Extend the existing pipeline:** widen `DisplayRenderMethod`, pass `options` through the attribute store row, implement widgets in `AttributeRow`, put encode/decode in pure helpers under `src/services/` (alongside or inside `siyuanFormats`).

## Technical Design

### Settings model

- Extend `DisplayRenderMethod` union with the five new literals.
- Add `options?: string[]` on `DisplayRule`.
- `normalizePanelSettings` / rule normalize: unknown method → `input`; normalize `options`; clear or ignore `options` for non-select methods on save if convenient (empty array is fine).
- Settings UI: add options to the render-method select; show options editor only for `select` / `multi-select`.
- Keep settings `version: 1` (backward compatible).

### Attribute store

- When a rule matches, copy `renderMethod` and `options` onto `innerAttribute` (extend the interface).
- Unmatched `custom-*` → `renderMethod: "input"`, no options.

### AttributeRow

- Recognize the new methods in the `method` computed.
- **select:** `t-select`; if current value ∉ options, still show it (do not drop data).
- **multi-select:** multi select or tag input with option suggestions; unknown tokens kept until user removes them.
- **date:** picker without time; parse/format `YYYYMMDD`; parse failure → show raw string, do not save until valid.
- **checkbox:** bind boolean ↔ `true`/`false` strings.
- **number:** reject invalid numbers on write; empty value on an existing row may clear the attribute value (same as writing empty via `setBlockAttrs` — consistent with delete-by-empty elsewhere). Add-row still requires non-empty value.
- Read-only / non-editable / `isSaving` / `lastSaved` no-op rules unchanged.

### Errors

- Save failures: toast (existing pattern).
- Empty `options`: panel must not crash; select shows current raw value with empty dropdown list.

## Acceptance scenarios

1. Global rule `exact` on `custom-status` with `select` and options `待办,进行中,完成` → row shows select; choosing a value persists and reloads.
2. `multi-select` round-trips comma storage with trim/dedupe.
3. `date` stores `YYYYMMDD`; `datetime` rules still use compact timestamps with time.
4. `checkbox` stores `true`/`false`; empty displays as off.
5. `number` accepts decimals as strings; invalid input does not write.
6. Document field settings cannot change render method or options; block dialog uses the same editors.
7. Value not in options still displays for select / multi-select.

## Decisions log

| Decision | Choice |
|----------|--------|
| Scope order | Custom typed editors first; AV later |
| Phase 1 types | select, multi-select, date, checkbox, number |
| Options config | Global rules only |
| Storage | Simple strings (comma for multi) |
| Implementation | Extend existing pipeline (A) |

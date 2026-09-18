# Attribute Value Editors Design

**Date:** 2026-09-18  
**Status:** Approved for planning  
**Branch context:** `feat/refactor` (document attributes; follow-on to document-scoped field settings)

## Problem

Document attribute value editors in `AttributeRow.vue` are incomplete or wrong:

- `tag-input` (`alias`) uses `t-input-number` and never saves.
- `datetime` (`updated`) has a date picker with no save wiring; the default target is read-only and SiYuan stores compact timestamps (`YYYYMMDDHHmmss`).
- `link` (`id`) is a plain input, not a useful read-only/copy affordance.
- Row binding snapshots `builtInAttributes[index]` then `toRefs`, which risks lost reactivity after reload/reorder.
- Settings cannot assign `renderMethod` to custom rules, so polished editors cannot be reused for custom attributes.

## Goals

- Make each supported `renderMethod` correct for display, editability, SiYuan storage formats, and save timing.
- Allow global display rules to set `renderMethod`: `input` | `tag-input` | `datetime` | `link`.
- Fix row reactivity so values track the store after reload/reorder.
- Align with full-polish expectations for alias tags and datetime formatting (including editable custom datetime/tag fields when configured).

## Non-Goals

- Block-level attribute panel.
- Configuring `renderMethod` in per-document field settings (stays global-rule only).
- Real checkbox editor (remove unused `checkbox` branch or fold into `input`).
- Changing document-scoped override storage (`custom-mux-attrs__doc__fields`).

## Product Contract

### Render methods

| Method | Typical use | UI | Storage | Save |
|--------|-------------|----|---------|------|
| `input` | Default, `name`, most customs | Single-line text | Raw string | On blur if value changed |
| `tag-input` | `alias`; rules that opt in | Tag chips (`t-tag-input`) | Comma-joined string `a,b,c` (trim, drop empties, dedupe) | On tag change / blur |
| `datetime` | `updated` / `created` (read-only); editable customs when configured | Read-only: formatted display; editable: date-time picker | SiYuan compact `YYYYMMDDHHmmss` ↔ picker | On confirm/change when editable |
| `link` | `id` | Read-only text + copy control | Never written by panel | — |

### Read-only

`isReadOnlyDocumentAttributeName` remains authoritative. Read-only keys never call `setAttribute`, even if the widget looks like an editor (disabled + correct display).

### Settings

Global「属性面板设置」each rule gains a **渲染方式** select: `input` | `tag-input` | `datetime` | `link`.

- Defaults for system rules stay as today (`id`→`link`, `name`→`input`, `alias`→`tag-input`, `updated`→`datetime`).
- Users may change `renderMethod` on rules (including system rules’ display behavior).
- Write protection for locked keys is unchanged.

Per-document field settings continue to override only `display` / `displayAs` / `order` / `editable` — not `renderMethod`. Effective `renderMethod` always comes from the matched global rule (or `input` for unmatched custom attrs).

### Approach

Implement primarily inside `AttributeRow` plus small pure helpers for timestamp and alias encode/decode (Approach A). Extract helpers as modules under `src/services/` or `src/models/` for testability; do not require a full multi-component editor split unless the file becomes unmaintainable during implementation.

## Technical Design

### Reactivity

Stop snapshotting `builtInAttributes.value[props.index]` into `toRefs`. Prefer:

- Pass the attribute object (or `key`) as a prop from the parent list, **or**
- `computed(() => builtInAttributes.value[props.index])` / find-by-key so the row always tracks the current store entry.

### Save behavior

- Compare against last successfully loaded/saved value; skip no-op writes.
- Suppress success toast spam where reasonable; always surface failures.
- While `isSaving`, avoid duplicate submits on the same row.

### Helpers (illustrative)

- `parseSiYuanTimestamp` / `formatSiYuanTimestamp` / `toSiYuanTimestamp`
- `parseAliasTags` / `serializeAliasTags`

### Tests

- Unit tests for timestamp and alias helpers (round-trip, empty, corrupt).
- Store/UI-adjacent tests as practical; at minimum helpers + any pure normalize of `renderMethod` on rules.
- Manual SiYuan checks for acceptance scenarios below.

## Acceptance scenarios

1. Edit `alias` tags → persist; reopen document → tags remain.
2. `updated` shows human-readable local date-time; not editable.
3. `id` shows value with copy; not editable.
4. Global rule sets a custom attr to `datetime` or `tag-input` → editor and storage format are correct.
5. After panel refresh/reorder, editing still targets the correct attribute.
6. Read-only keys never produce successful writes.

## Decisions log

| Decision | Choice |
|----------|--------|
| Polish level | Full (option 3) |
| Custom attr editors | Configurable via global rule `renderMethod` (option 1) |
| Implementation shape | Approach A (fix AttributeRow + helpers + settings select) |
| Alias storage | Comma-separated string |
| Datetime storage | `YYYYMMDDHHmmss` |
| `link` UX | Read-only + copy (no fake navigation) |
| `checkbox` | Drop / fold into `input` |
| Field-settings `renderMethod` | Out of scope |

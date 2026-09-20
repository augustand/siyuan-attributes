# Document Field Settings: Editor Type Overrides Design

**Date:** 2026-09-20  
**Status:** Approved for planning  
**Branch:** `feat/typed-attribute-editors`  
**Supersedes (partial):** typed-editors decision that `renderMethod` / `options` are global-only — document「字段设置」may now override them per document.

## Problem

Global「属性面板设置」exposes edit type (标签 / 单选 / 多选 / …) and options. Document「字段设置」only overrides display / displayAs / order / editable. The two surfaces do not align; users cannot get WYSIWYG type control from the panel they use while editing a document.

## Goals

- Extend per-document field overrides so「字段设置」can set **编辑方式** (`renderMethod`) and **选项** (`options`) for attributes already on the current document.
- Global rules remain **defaults**; document overrides win when present (same merge order as today).
- Field settings UI shows the same type controls the value editor will use (所见即所得).
- Keep storage on `custom-mux-attrs-doc-fields` (`v: 1`); old payloads without type fields remain valid.

## Non-Goals

- Changing global rule matching (exact / wildcard / regex) UX in this change (can be a follow-up polish).
- Per-block type overrides in the block attribute dialog.
- Database / AV fields.
- Moving type configuration *out* of global settings (global defaults stay).

## Product Contract

### Field settings (per document)

For each attribute key present on the document, the dialog edits:

| Field | Meaning |
|-------|---------|
| 显示 | Show in panel |
| 显示名 | Label in panel |
| 排序值 | Order |
| 可编辑 | Editable |
| 编辑方式 | `renderMethod` (same enum as global) |
| 选项 | Only when 编辑方式 is 单选 / 多选 |

Copy: overrides apply to **this document only**; unset / 恢复默认 removes the document override for that key (falls back to global).

### Merge order

1. Match global display rule → base `{ display, displayAs, order, editable, renderMethod, options }`.
2. If no global match and key is `custom-*` → base defaults (`display: true`, `renderMethod: input`, `options: []`, …).
3. If document override exists for the key → overlay **all** stored override fields (including `renderMethod` / `options` when present).
4. Panel `AttributeRow` uses the effective `renderMethod` / `options` (existing empty multi-select → tag-input fallback remains).

### Storage

Same reserved attribute. Extend each field snapshot:

```json
{
  "v": 1,
  "fields": {
    "custom-tags": {
      "display": true,
      "displayAs": "tags",
      "order": 1000,
      "editable": true,
      "renderMethod": "tag-input",
      "options": []
    }
  }
}
```

Rules:

- Saving from field settings writes a **full snapshot** including `renderMethod` + normalized `options`.
- Parsing legacy entries without `renderMethod` / `options`: those keys are absent → apply step does not override type (global/default wins for type only).
- `options` normalized: trim, drop empty, dedupe (reuse `normalizeRuleOptions`).
- Invalid `renderMethod` → treat as `input`.

### Block dialog

Unchanged: uses global rules only; no document-style overrides on arbitrary blocks in this phase.

## Technical Design

- Extend `DocumentFieldOverride` + `normalizeOverride` + `applyDocumentFieldOverride`.
- `FieldSettingsDialog`: draft includes type fields; baseline from matched global (or defaults); save/restore unchanged flow.
- `attribute` store: build base with `renderMethod`/`options` from match; apply override; pass effective values to rows.
- Tests: parse/serialize/apply with and without type fields; store row effective type after override.
- i18n: 「编辑方式」label in field settings (can reuse settings.render* strings).

## Acceptance

1. Document A: field settings set `custom-tags` → 标签; panel shows tag chips. Document B without override still uses global (or input).
2. Override 多选 + options → panel multi-select; 恢复默认 → global type returns.
3. Old override JSON without `renderMethod` still loads; type stays global.
4. Global settings still define defaults / wildcards; field settings never shows match expression.

## Decisions log

| Decision | Choice |
|----------|--------|
| Where to edit type for “this doc” | Field settings (option 2) |
| Storage | Extend existing doc override JSON |
| Global rules | Remain defaults |
| Block panel | No per-block type override yet |

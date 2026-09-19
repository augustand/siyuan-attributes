# Document-Scoped Field Settings Design

**Date:** 2026-09-18  
**Status:** Approved for planning  
**Branch context:** `feat/refactor` (document attributes only; database support removed)

## Problem

The plugin currently has two overlapping settings surfaces:

1. **属性面板设置** (global plugin settings) — abstract display rules (exact / wildcard / regex).
2. **字段设置** (panel dialog) — edits the same global rule store for keys present on the current document.

Users expect「字段设置」changes to affect **only the current document**. Today they write global rules, so the same attribute key changes on every document. The two entry points also feel redundant and unclear.

## Goals

- Keep both entry points, with **clearly split responsibilities**.
- Persist per-document field overrides on the document itself.
- Global rules remain **defaults**; document overrides win when present.
- Hide the storage attribute from normal panel / field-settings / add / delete UX via a hard reserved-key rule.
- Remove or stop advertising the unused `showDocumentPanel` toggle so global settings are not misleading.

## Non-Goals

- Reintroducing database field support.
- A full “field schema / catalog” product (define fields once, fill everywhere).
- User-configurable reserved-key list in global settings.
- Broad reserved prefix such as `custom-mux-attrs__*` (only one exact key for now).

## Product Contract

### Entry points

| Surface | Responsibility | Must not do |
|---------|----------------|-------------|
| **属性面板设置** | Master switches; default / wildcard / regex rules; default display name, visibility, editable, order | Per-document exceptions |
| **字段设置** | Overrides for attributes **already on the current document**: display, displayAs, order, editable | Create wildcard/regex rules; edit the global rule list |

Copy in both UIs must state this split explicitly.

### Merge order

When resolving how an attribute appears on a document:

1. Match **global** display rules (existing precedence).
2. If the document override map contains that attribute key, overlay the stored fields onto the matched result.
3. Keys absent from the override map keep the global result unchanged.

### Reserved storage key

| Item | Value |
|------|--------|
| Key | `custom-mux-attrs__doc__fields` |
| Purpose | JSON document of per-document field overrides |
| Visibility | Never listed in the attribute panel |
| Field settings | Never listed |
| Add attribute | Reject this key with an error message |
| Delete attribute | Ignore this key in user delete actions |
| Mechanism | Hard-coded reserved-key filter (same class as `custom-avs` / `custom-avs:*`), **not** a user “display = off” rule |

### Override payload

Stored as the string value of `custom-mux-attrs__doc__fields`:

```json
{
  "v": 1,
  "fields": {
    "custom-priority": {
      "display": false,
      "displayAs": "优先级",
      "order": 20,
      "editable": true
    }
  }
}
```

Rules:

- Only attribute keys the user has customized are stored (key-level sparsity).
- For each stored key, persist a full snapshot of `{ display, displayAs, order, editable }` as shown in field settings when saving that document (not a partial property patch).
- On merge, overlay those four properties onto the global match result for that key.
- “Restore default” for a field removes that key from `fields`.
- If `fields` becomes empty, clear the reserved attribute (empty value / remove via `setBlockAttrs` as the plugin already deletes attrs).
- Invalid / corrupt JSON is treated as empty overrides; do not block the panel (optional light warning).

### Field settings interactions

- Open: list current document attributes after reserved-key filtering.
- Edits are draft until Save; Save writes the reserved attribute and refreshes the panel.
- Per-field “恢复默认” drops that override entry.
- Read-only SiYuan-managed keys (`id`, `updated`, etc.): overrides may still change display / displayAs / order; editable stays locked off.
- Empty document: empty state points users to panel「添加属性」, not to global「添加规则」.

### Global settings interactions

- Still edit global rules only.
- After save, all documents recompute; existing document overrides remain higher priority.
- Help text clarifies defaults vs per-document overrides.

### Lifecycle edges

- When a user deletes a normal attribute from the document, also remove that key from the override map (avoid orphan overrides).
- Reserved key is never offered as a deletable row in the panel.

### Cleanup in the same effort

- Remove unused `showDocumentPanel` wiring from settings model/UI, **or** wire it for real if product still wants a separate switch — default decision: **remove** the dead toggle and keep a single `showPanel` switch unless implementation discovers a needed split.

## Acceptance scenarios

1. Global rule hides attribute `X` → new documents hide `X`.
2. On document A, field settings shows `X` → only A shows `X`; document B still hides `X`.
3. On A, restore default for `X` → A follows global again.
4. `custom-mux-attrs__doc__fields` never appears in the panel list, field settings list, or successful add-attribute flow.
5. Global rule edits do not erase existing per-document overrides.

## Implementation notes (non-binding)

Planning may place reserved-key checks next to existing `custom-avs` filters in the attribute store, add parse/serialize helpers for the override JSON, change `FieldSettingsDialog` to read/write document attrs instead of upserting global exact rules, and update i18n/README for the dual-entry explanation. Exact file split belongs in the implementation plan.

## Decisions log

| Decision | Choice |
|----------|--------|
| Consolidate settings? | Keep both; split responsibilities |
| Override scope | Current document only |
| Global rules when no override | Still apply as defaults |
| Storage | Document attribute (approach A) |
| Reserved key | `custom-mux-attrs__doc__fields` |
| Hide mechanism | Hard reserved-key filter |
| Dead `showDocumentPanel` | Remove unless proven needed |

# Attribute Value Editors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix document panel value editors (`input` / `tag-input` / `datetime` / `link`), add global-rule `renderMethod` selection, and repair row reactivity.

**Architecture:** Pure helpers for SiYuan timestamp and alias tags; rewrite `AttributeRow` to bind by attribute key and save correctly; add `renderMethod` select on settings rules; normalize `renderMethod` in settings model.

**Tech Stack:** Vue 3, Pinia, TDesign Vue Next, TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-18-attribute-value-editors-design.md`

## Global Constraints

- Alias storage: comma-separated `a,b,c` (trim, drop empty, dedupe).
- Datetime storage: `YYYYMMDDHHmmss`.
- Read-only keys never call `setAttribute`.
- `renderMethod` configured only on global rules, not field-settings overrides.
- Drop unused `checkbox` branch (treat as `input`).
- `npm run verify` must pass at the end.

## File map

| File | Role |
|------|------|
| `src/services/siyuanFormats.ts` | Timestamp + alias parse/serialize |
| `tests/services/siyuanFormats.spec.ts` | Helper unit tests |
| `src/models/settings.ts` | Normalize `renderMethod` union |
| `src/components/AttributeRow.vue` | Editors + save |
| `src/components/BuiltInAttrs.vue` | Pass `attribute-key`; stable `:key` |
| `src/views/SettingContent.vue` | Rule `renderMethod` select |
| `src/i18n/zh_CN.json`, `en_US.json` | Labels |

---

### Task 1: Format helpers + renderMethod normalize

**Files:** create `src/services/siyuanFormats.ts`, `tests/services/siyuanFormats.spec.ts`; modify `src/models/settings.ts`, `tests/models/settings.spec.ts`

- [ ] TDD: alias round-trip, empty, duplicates; timestamp round-trip and invalid → undefined/empty display
- [ ] Export: `parseAliasTags`, `serializeAliasTags`, `parseSiYuanTimestamp`, `formatSiYuanTimestampDisplay`, `toSiYuanTimestamp`
- [ ] `normalizeRenderMethod(value): 'input' | 'tag-input' | 'datetime' | 'link'` (unknown → `input` or preserve undefined for system defaults as today)
- [ ] Use normalize in `normalizeDisplayRule`
- [ ] Commit

### Task 2: AttributeRow + BuiltInAttrs

**Files:** `AttributeRow.vue`, `BuiltInAttrs.vue`

- [ ] Parent passes `:attribute-key="attribute.key"` and `:key="attribute.key"`
- [ ] Row resolves attribute via `computed` from store by key (no index snapshot)
- [ ] `input`: blur save if changed
- [ ] `tag-input`: `t-tag-input`, bind tags array ↔ alias string, save on change
- [ ] `datetime`: if editable, picker ↔ compact stamp + save; if read-only, formatted text (no picker write)
- [ ] `link`: read-only + copy button
- [ ] Remove `checkbox` branch
- [ ] Skip save when `!editable` or value unchanged
- [ ] Commit

### Task 3: Settings renderMethod UI + i18n

**Files:** `SettingContent.vue`, i18n

- [ ] Add select for 渲染方式 on each rule
- [ ] Labels for four methods
- [ ] Commit

### Task 4: Verify + SiYuan reload

- [ ] `npm run verify`
- [ ] `npm run dev` / `reloadUI`
- [ ] Manual checklist from spec acceptance

---

## Spec coverage

| Spec item | Task |
|-----------|------|
| Alias tags save | 1–2 |
| Datetime format / read-only updated | 1–2 |
| Link copy | 2 |
| Custom rule renderMethod | 1, 3 |
| Reactivity | 2 |
| Drop checkbox | 2 |

# Contextual Field Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users configure real document attributes and linked database fields directly from the current attribute panel, instead of writing abstract matching rules.

**Architecture:** Add exact `fieldRules` to settings for database fields, and use stable exact document display rules for document attributes. Add a contextual settings dialog that reads live fields from the current panel, edits visibility/display name/editability/order, saves exact bindings, and refreshes the panel through the existing settings-change event.

**Tech Stack:** Vue 3, Pinia, TDesign Vue Next, SiYuan plugin storage, TypeScript, Vitest.

## Global Constraints

- Database field rules bind by `databaseId` and `fieldId`; they must not rely on field-name equality.
- Document field rules bind by exact attribute key.
- Unsupported database fields may be configured for visibility/display name, but remain read-only in the attribute panel.
- Existing abstract display rules remain supported as legacy rules.
- Settings normalization must preserve exact field rules.
- Saving contextual settings must persist and emit the existing settings-change event.
- `npm run verify` and a real SiYuan panel check must pass.

## Tasks

### Task 1: Settings model

- [ ] Add `DatabaseFieldRule`.
- [ ] Add `fieldRules` to `PanelSettings`.
- [ ] Normalize exact database field rules.
- [ ] Preserve legacy rules and defaults.

### Task 2: Rules store

- [ ] Prefer exact database field rules over legacy matches.
- [ ] Add document exact-rule upserts.
- [ ] Add database exact-rule replacement.
- [ ] Keep unsupported database fields read-only even when a rule is enabled.

### Task 3: Contextual settings dialog

- [ ] Create `FieldSettingsDialog.vue`.
- [ ] List live document attributes and linked database fields.
- [ ] Edit visibility, display alias, editability, and order.
- [ ] Save all changes in one settings write.
- [ ] Explain that display names are plugin aliases only.

### Task 4: Panel entry and release gate

- [ ] Add a field-settings button to the attribute panel header.
- [ ] Add localized labels.
- [ ] Run `npm run verify`.
- [ ] Verify panel changes in SiYuan.

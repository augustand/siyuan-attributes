# Block-Level Attribute Panel Design

**Date:** 2026-09-19  
**Status:** Approved for planning  
**Branch:** `feat/block-level-attributes`  
**Issue:** [#7](https://github.com/InEase/SiYuan-Attributes-Panel/issues/7)

## Problem

The plugin already provides a full document attribute panel (CRUD, global rules, editors). Block-level attributes are still missing, despite being listed as “coming soon” in the README. Users cannot open the same editing experience for an arbitrary block without leaving the editor workflow.

## Goals

- Open a **dialog** from the **block menu** to view/edit attributes of that block.
- Reuse the document panel’s list + CRUD + global display rules / `renderMethod` (Approach A).
- Leave the document title panel behavior unchanged.
- Unmount cleanly; avoid stale DOM or cross-block data bleed.

## Non-Goals (phase 1)

- Floating panel anchored to the block, or inline expand under the block.
- Per-block field-settings overrides (no block-scoped `custom-mux-attrs-doc-fields` equivalent yet).
- Database / AV attributes on blocks.
- Changing global settings model for “block vs document” scopes beyond reusing existing document rules.
- Mobile-specific layout.

## Product Contract

### Entry

- Add a menu item labeled **属性面板** / **Attribute panel**.
- Primary hook: SiYuan plugin event **`click-blockicon`** (block gutter icon menu — standard plugin pattern).
- Optional same-phase addition if low-cost: **`open-menu-content`** when the target resolves to a block `data-node-id`, so editor content right-click also works.
- Resolve `blockId` from the event detail / `data-node-id`. Skip invalid IDs.

### Dialog UI

- Modal dialog (same family as field-settings: overlay + card).
- Header: short title + block id (copyable).
- Body: reuse attribute list + add/edit/delete editors used by the document panel.
- Close button / overlay click closes and unmounts.

### Behavior parity with document panel

| Capability | Phase 1 |
|------------|---------|
| Load/save via `getBlockAttrs` / `setBlockAttrs` | Yes |
| Add / edit / delete `custom-*` | Yes |
| Global rules (display, displayAs, editable, order, renderMethod) | Yes |
| Read-only system keys | Yes |
| Reserved override key hidden | Yes (same filter) |
| Per-target field-settings overrides | **No** |

### Architecture (Approach A)

- Extract or parameterize the panel so it accepts a **target block id** (already injected as `$docId` today).
- Block dialog = `createApp` + Pinia + `provide("$docId", blockId)` + mount into dialog root (same pattern as document mount, different host).
- At most **one** block-attribute dialog at a time; opening another closes the previous.
- On dialog close, plugin unload, or protyle destroy for that id: unmount app and remove DOM.

### Errors

- Load failure: show error inside dialog; allow close.
- Save/delete failure: toast (same as document panel).
- Missing block / empty id: do not open, or open with error state.

## Acceptance scenarios

1. From a leaf or container block menu, open the dialog; add a `custom-*` attr; reload / reopen → value persists.
2. Global rule hide / display name / `renderMethod` affects block attrs the same way as document attrs.
3. Document title panel still mounts and works independently.
4. Closing the dialog leaves no leftover `.mux-*` dialog nodes; switching blocks does not show the previous block’s values.
5. Read-only keys cannot be deleted or written.

## Decisions log

| Decision | Choice |
|----------|--------|
| Entry | Block menu (`click-blockicon`; optional `open-menu-content`) |
| UI | Dialog |
| Scope | Full CRUD + global rules; no per-block overrides |
| Implementation | Reuse panel/store with target block id (A) |
| Database | Out of scope |

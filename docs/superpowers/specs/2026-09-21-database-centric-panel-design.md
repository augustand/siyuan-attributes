# Database-Centric Properties Panel Design

**Date:** 2026-09-21  
**Status:** Approved for planning  
**Branch intent:** `feat/database-centric-panel` (new workstream; `custom-*` feature work paused)

## Problem

The plugin currently centers on `custom-*` block attributes with global rules, per-document field overrides, and typed editors. That recreates schema and UX that SiYuan’s built-in **database (Attribute View)** already provides. Users who bind documents to databases already see AV fields elsewhere (e.g. marketplace plugin Macavity/siyuan-database-properties-panel, or core’s attribute dialog “数据库” tab), while our under-title panel ignores AV and invents parallel types/options.

We previously shipped AV support and removed it (`3310fe5`) due to complexity and type-write bugs. The product direction now pivots back: **design around SiYuan databases first**, and pause `custom-*` as the primary surface.

## Goals (this delivery = P1 + P2)

- Replace the under-title panel with an **AV row properties panel** for the current document.
- Read/write common AV field types via kernel APIs.
- Multi-database documents: **Tab** per `avID`.
- Per-database column visibility, hide-empty, hide-primary-key (plugin settings, not document attrs).
- Dormant `custom-*` UI: no runtime mount, settings entry hidden; code retained (Approach A).

## Non-Goals (this delivery)

- Editing or evolving `custom-*` (rules, field settings, block custom dialog).
- Creating/renaming AV columns or editing option definitions in-panel.
- Full “add this doc to a database” wizard (empty state copy only).
- Writable relation / mAsset / template / rollup / created-updated system columns.
- Macavity coexistence detection or mutual exclusion.
- Mobile-specific layout.
- Block-level AV editing and unbound-row flows (**P3**, separate spec).

## Competitive context (research summary)

| Plugin | Role |
|--------|------|
| Macavity/siyuan-database-properties-panel | Under-title AV edit; column visibility; inspiration cited from TransMux Attributes Panel |
| loonghfut/siyuan-database-display | Mostly read-only AV display on many block types |
| famotime/siyuan-property-manager | Dock + inline for `custom-*` (competes with our paused surface) |

**Stance:** Rebuild our own under-title AV panel (option 1). Reference public APIs and UX patterns; do not depend on Macavity at runtime. Differentiate later via P3 and eventual AV-centered integration of other features—not by cloning every Macavity detail in v1.

## Approach

**A — New AV module + dormant `custom-*` code (chosen)**

- New `DatabasePanel` (name flexible), AV service/store, value editors keyed by AV column type.
- `App.vue` mounts only the AV panel when “show panel” is on.
- Keep AttributePanel / FieldSettings / rules / typed custom editors in the repo but unreferenced from runtime entry points.
- Do **not** restore pre-`3310fe5` `DbAttrs`/`DbRow` as-is (known type corruption risks); rewrite against current `itemID` API conventions.

Rejected for this phase: hard-delete all custom UI (B); revive old DB components unchanged (C).

## Product contract

### Mounting

- Same protyle hook pattern: `loaded-protyle-static` inserts under document title (`protyle-title` / before `protyle-attr`).
- Container class e.g. `.mux-database-panel` (distinct from legacy attribute panel class).
- `switch-protyle` / `loaded-protyle-dynamic`: reload for new `docId`.
- `destroy-protyle`: unmount via existing panel registry.
- Master switch: plugin setting “show panel” — on → mount AV panel; off → nothing.

### Data load

- Call `/api/av/getAttributeViewKeys` with document id.
- Zero AVs → empty state: prompt that binding the document to a database enables field editing. **No** fallback to `custom-*` panel.
- One or more AVs → Tab per database (prefer AV name; fallback short id). Active tab selects field list only (no full protyle remount).

### Read / write

- **Read:** keys/values from `getAttributeViewKeys` for the active `avID`.
- **Write:** `/api/av/setAttributeViewBlockAttr` with `avID`, `keyID`, `itemID` (bound document row uses doc id), and typed `value` payload. Do not require deprecated `cellID`. Encapsulate any transitional `rowID` alias inside the service layer if a kernel version still needs it.
- Save failure: toast + revert optimistic UI.

### Editable types (P1)

| AV type | Panel behavior |
|---------|----------------|
| `text` | Editable text |
| `number` | Editable number |
| `mSelect` (single / multi per column config) | Select / multi-select from column options (incl. colors when present) |
| `date` | Date editor |
| `checkbox` | Toggle |

Clearing a value writes the empty/clear shape appropriate to that type.

### Read-only in panel (P1+P2)

`relation`, `mAsset`, `template`, `rollup`, created/updated and similar system columns: display value only; edit attempt may show “not supported in panel yet”.

Schema source of truth is the AV column definition—not custom `renderMethod` rules. UI may reuse TDesign patterns from typed editors; data path is new.

### Column preferences (P2)

Stored in **plugin settings/data**, keyed by `avID` (not as document attributes):

| Field | Meaning | Default |
|-------|---------|---------|
| `hiddenKeyIDs` | Columns hidden in panel | `[]` |
| `hideEmpty` | Hide fields with empty values | `false` |
| `hidePrimaryKey` | Hide primary key column | `true` |

- Panel toolbar: column settings (checklist for current DB) + hide-empty toggle.
- Filter order: column visibility → hide primary key → hide empty.
- Each `avID` remembers its own prefs; tabs do not share lists.
- Global settings may expose defaults for `hidePrimaryKey` / `hideEmpty` applied when a DB has no saved prefs yet.

### Settings & dormancy

- Settings page shows AV panel options only (show panel, default hide PK, default hide empty). Hide custom rule list / render methods / doc-override help.
- Preserve existing settings JSON fields for rules/overrides **unread, unmigrated, undeleted**.
- Disable block-menu custom attribute dialog registration for this phase.
- README / i18n / `plugin.json` descriptions shift toward “database properties panel”; state that custom document-attribute editing is paused.
- If the user also installs Macavity, two under-title panels may appear; document this in settings help. No active conflict resolution.

### Success criteria

1. Document bound to ≥1 database: under-title panel shows and edits common field types.
2. Multi-DB tabs work; per-DB column hide / hide-empty / hide-PK work.
3. Unbound document: clear empty state; custom panel does not appear.

## Technical sketch (for planning)

Suggested modules (names indicative):

- `src/services/attributeView.ts` — get keys, set attr, map kernel payloads / `itemID`.
- `src/models/attributeView.ts` — normalize AV key/value shapes; type guards.
- `src/store/databasePanel.ts` (or similar) — current docId, av list, active avID, field rows, prefs.
- `src/views/DatabasePanel.vue` — tabs, toolbar, field list host.
- `src/components/av/*` — row + per-type value editors.
- Settings: extend or replace active settings view; keep dormant custom models on disk.

Tests: pure normalize/filter helpers; set-attr payload builders; prefs merge; avoid brittle full protyle E2E in unit suite.

## Phasing beyond this spec

| Phase | Scope |
|-------|--------|
| **This spec (P1+P2)** | Doc under-title AV panel + prefs |
| **P3** | Block-level AV entry; unbound rows; later AV-centered reintegration of custom if needed |
| **Future** | Complex type editors; bind-to-DB flows; optional unified AV+custom surface |

## Open points for implementation plan (not blockers)

- Exact AV name resolution if `getAttributeViewKeys` omits display names (may need a follow-up AV meta API).
- Precise empty-value payload per type (confirm against current kernel).
- Whether primary key is identified via a stable flag on the key object or by convention.

## Spec self-review

- [x] No TBD placeholders for product decisions already made
- [x] Consistent with Approach A and P1+P2 scope
- [x] Non-goals and P3 explicitly deferred
- [x] Custom dormancy vs deletion clarified
- [x] API naming notes `itemID` vs legacy `rowID`

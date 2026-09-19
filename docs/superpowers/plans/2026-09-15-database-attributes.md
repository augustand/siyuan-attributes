# Database Attributes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the prototype database-attribute path with a typed, refreshable, and write-safe implementation that uses SiYuan's current `itemID` protocol.

**Architecture:** Introduce `src/models/attributeView.ts` and `src/services/attributeViews.ts` as the only places that understand raw `BlockAttributeViewKeys` and database cell payloads. Normalize read data into stable database/field/value models before Pinia sees it. Move every database mutation out of `DbRow.vue` into the attribute store, migrate payloads from `rowID` to `itemID`, and refresh from SiYuan `ws-main` broadcasts plus protyle lifecycle events with debounce and cleanup.

**Tech Stack:** Vue 3, Pinia, TDesign Vue Next, SiYuan Plugin API, TypeScript, Vitest, Vue Test Utils.

**Spec:** `docs/superpowers/plans/2026-09-15-siyuan-attribute-panel-completion.md`, milestone M2; upstream acceptance is [Issue #4](https://github.com/InEase/SiYuan-Attributes-Panel/issues/4).

## Global Constraints

- Never send `rowID` to `/api/av/setAttributeViewBlockAttr`; the current kernel treats it as deprecated and rejects it.
- Every database cell write must send `avID`, `keyID`, `itemID`, and `value`.
- Preserve option names and colors; do not convert select options to array indexes.
- Every HTTP response must pass through `assertSiyuanData` or `assertSiyuanSuccess`.
- A UI success message may appear only after a non-error response and a successful state refresh.
- Unsupported database field types remain visible and read-only.
- External database changes must be detected by a 5-second panel-owned poll; lifecycle refreshes must be removed when the panel unmounts.
- `npm run verify` must pass before M2 is complete.

## Raw Protocol Used By This Plan

`/api/av/getAttributeViewKeys` with `{ id: documentID }` returns an array of:

```ts
interface BlockAttributeViewKeys {
  avID: string;
  avName: string;
  keyValues: Array<{
    key: {
      id: string;
      name: string;
      type: DatabaseFieldType;
      icon?: string;
      options?: Array<{ name: string; color: string }>;
    };
    values: Array<Record<string, unknown> & {
      id?: string;
      keyID?: string;
      blockID?: string; // This is the itemID used by the write API.
      type: DatabaseFieldType;
    }>;
  }>;
}
```

Primary keys (`key.type === "block"`) are skipped because they duplicate the document title. The first matching `values[].blockID` for every remaining key is normalized as `itemID`. For select and multi-select, the raw value lives in `mSelect` for both types and contains option names/colors.

## File Structure

```text
src/
  models/
    attributeView.ts        # Stable database/field/value models and normalizers
  services/
    attributeViews.ts       # Read/write API wrappers and payload builders
  store/
    attribute.ts            # Typed database state, refresh, and mutation actions
  components/
    AttributePanel.vue      # Typed database tabs
    DbAttrs.vue             # Typed field list
    DbRow.vue               # Editable fields; no direct API calls
tests/
  models/attributeView.spec.ts
  services/attributeViews.spec.ts
  store/attribute.spec.ts
```

### Task 1: Define stable database models and normalizers

**Files:**
- Create: `src/models/attributeView.ts`
- Test: `tests/models/attributeView.spec.ts`

**Interfaces:**

```ts
export type DatabaseFieldType =
  | "text" | "number" | "date" | "select" | "mSelect" | "url"
  | "email" | "phone" | "checkbox" | "template" | "relation"
  | "rollup" | "mAsset" | "created" | "updated" | "block" | "lineNumber";

export interface DatabaseOption {
  name: string;
  color: string;
}

export interface DatabaseValue {
  id: string;
  keyID: string;
  itemID: string;
  type: DatabaseFieldType;
  text: string;
  number?: number;
  url: string;
  email: string;
  phone: string;
  template: string;
  checked: boolean;
  date?: {
    content?: number;
    content2?: number;
    hasEndDate: boolean;
    isNotTime: boolean;
    isNotEmpty: boolean;
  };
  options: DatabaseOption[];
  raw: Record<string, unknown>;
}

export interface DatabaseField {
  keyID: string;
  name: string;
  type: DatabaseFieldType;
  icon: string;
  editable: boolean;
  value: DatabaseValue;
  options: DatabaseOption[];
}

export interface DatabasePanel {
  avID: string;
  avName: string;
  fields: DatabaseField[];
}

export function normalizeAttributeViews(input: unknown): DatabasePanel[];
export function buildDatabaseCellValue(field: DatabaseField, value: DatabaseValue): unknown;
```

- [x] Normalize one value per `keyValues.values[]`, preferring the first `blockID`.
- [x] Map `text`, `number`, `url`, `email`, `phone`, `template`, `checkbox`, `date`, and `mSelect`.
- [x] Treat `select` and `mSelect` as `mSelect[]`; preserve option names and colors.
- [x] Mark `text`, `url`, `number`, and `checkbox` editable; leave all other types read-only in M2.
- [x] `buildDatabaseCellValue` emits only the current type's payload and never emits `rowID`.

### Task 2: Add the database API service

**Files:**
- Create: `src/services/attributeViews.ts`
- Test: `tests/services/attributeViews.spec.ts`

**Interfaces:**

```ts
export async function fetchAttributeViews(documentID: string): Promise<DatabasePanel[]>;
export async function writeDatabaseCell(input: {
  avID: string;
  keyID: string;
  itemID: string;
  field: DatabaseField;
}): Promise<void>;
```

- [x] `fetchAttributeViews` calls `POST /api/av/getAttributeViewKeys` with `{ id: documentID }`.
- [x] `writeDatabaseCell` calls `POST /api/av/setAttributeViewBlockAttr`.
- [x] The write payload contains exactly `avID`, `keyID`, `itemID`, and `value`.
- [x] Failed responses throw `SiyuanApiError`.

### Task 3: Migrate Pinia state and refresh lifecycle

**Files:**
- Modify: `src/store/attribute.ts`
- Modify: `src/App.vue`

**Interfaces:**

```ts
dataBaseAttributes: Record<string, DatabasePanel>;
isLoadingDatabaseAttributes: Ref<boolean>;
isSavingDatabaseAttributes: Ref<boolean>;
loadDatabaseAttributes(): Promise<void>;
writeDatabaseCell(input: {
  avID: string;
  field: DatabaseField;
}): Promise<void>;
```

The caller mutates `field.value` before calling `writeDatabaseCell`. This keeps the store action argument serializable and avoids Pinia dropping callback arguments.

- [x] Replace raw `any` database state with `DatabasePanel`.
- [x] Replace the callback-based raw `fetchPost` read with `fetchAttributeViews`.
- [x] Replace existing database state atomically after each load and remove panels when the document no longer has `custom-avs`.
- [x] After a write, refresh from SiYuan before showing success.
- [x] Subscribe in the panel app to `loaded-protyle-dynamic` and `switch-protyle`, debounced at 250 ms.
- [x] Poll every 5 seconds. SiYuan broadcasts `refreshAttributeView` on the protyle WebSocket, not the plugin `ws-main` event, so polling is required for external changes.
- [x] Remove all listeners, polling, and the pending debounce on unmount.

### Task 4: Migrate TDesign database UI

**Files:**
- Modify: `src/components/AttributePanel.vue`
- Modify: `src/components/DbAttrs.vue`
- Modify: `src/components/DbRow.vue`

**Interfaces:**

```ts
DbAttrs props: { avID: string }
DbRow props: { avID: string; keyID: string }
```

- [x] Replace index-based field lookup with `keyID` lookup.
- [x] Remove all direct `fetchPost` calls from `DbRow.vue`.
- [x] Use `field.value.itemID` for all writes through `store.writeDatabaseCell`.
- [x] Enable text, URL, number, and checkbox editing.
- [x] Keep select, multi-select, date, relation, rollup, asset, and template read-only until their dedicated tests land.
- [x] Show success/error messages only after store actions resolve or reject.

### Task 5: Documentation and M2 release gate

**Files:**
- Modify: `docs/README.md`
- Modify: `docs/README_zh_CN.md`

- [x] Update database feature status to reflect implemented field types and remaining read-only types.
- [x] Document that external database changes refresh the panel.
- [x] Run:

```bash
npm run verify
rg -n "rowID" src tests --glob '!**/*.spec.ts.snap'
```

Expected: all checks pass and the `rowID` search returns no database write payload references.

### Runtime Acceptance

Using a disposable document with database fields:

1. Text, URL, number, and checkbox values round-trip from the panel to SiYuan's database view.
2. Editing a value in SiYuan's database view refreshes the plugin panel without reloading the document.
3. Unsupported fields display values but cannot be changed.
4. Refresh, plugin disable/enable, and document switching do not leave duplicate Vue apps or active listeners.
5. The desktop browser console contains no plugin errors.

## Risks

| Risk | Mitigation |
|---|---|
| Option ordering changes | Normalize by option name/color from raw values; never store only indexes |
| Missing database value | Render `null`/empty and mark unsupported writes read-only |
| Repeated broadcasts | Debounce and ignore refresh while a load for the same document is active |
| Stale field closure | Look up fields by `keyID` on each render/action |
| API rejects old payload | Enforce `itemID` in the service type and search for `rowID` at the release gate |

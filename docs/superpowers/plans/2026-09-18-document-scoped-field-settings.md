# Document-Scoped Field Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make panel「字段设置」persist per-document overrides on `custom-mux-attrs__doc__fields`, while global「属性面板设置」keeps providing defaults.

**Architecture:** Add a pure overrides model (parse / serialize / merge / reserved-key checks). Attribute store skips the reserved key, applies overrides after global rule match, and prunes overrides when attributes are deleted. Field settings dialog stops calling `upsertDocumentFieldRules` and instead writes the reserved document attribute. Remove unused `showDocumentPanel` and update copy.

**Tech Stack:** Vue 3, Pinia, TDesign Vue Next, TypeScript, Vitest, SiYuan `getBlockAttrs` / `setBlockAttrs`.

**Spec:** `docs/superpowers/specs/2026-09-18-document-scoped-field-settings-design.md`

## Global Constraints

- Reserved key is exactly `custom-mux-attrs__doc__fields` (underscores intentional; never go through `normalizeCustomAttributeKey`).
- Reserved key is hard-filtered like `custom-avs` — not a user display rule.
- Global rules remain defaults; document overrides win per attribute key.
- Each stored override key holds a full snapshot `{ display, displayAs, order, editable }`.
- Only customized keys are stored; restore-default removes that key.
- Empty `fields` clears the reserved attribute value.
- Corrupt JSON ⇒ empty overrides; panel still loads.
- Database support stays removed.
- `npm run verify` must pass after the final task.

## File map

| File | Responsibility |
|------|----------------|
| `src/models/documentFieldOverrides.ts` | Reserved key, parse/serialize, apply overlay |
| `tests/models/documentFieldOverrides.spec.ts` | Unit tests for overrides model |
| `src/store/attribute.ts` | Filter reserved key; apply overrides; reject create; protect delete; prune on delete |
| `tests/store/attribute.spec.ts` | Store behavior with overrides |
| `src/components/FieldSettingsDialog.vue` | Edit/save document overrides; restore default |
| `src/store/rules.ts` | Remove `upsertDocumentFieldRules` |
| `src/models/settings.ts` | Remove `showDocumentPanel` |
| `src/views/SettingContent.vue` | Remove dead toggle; clarify help copy |
| `src/i18n/zh_CN.json`, `src/i18n/en_US.json` | Copy for dual entry + restore + reserved reject |
| `docs/README_zh_CN.md`, `docs/README.md` | Document dual settings + remove stale “即将推出” |
| `tests/models/settings.spec.ts`, `tests/services/settings.spec.ts` | Drop `showDocumentPanel` expectations |

---

### Task 1: Document field overrides model

**Files:**
- Create: `src/models/documentFieldOverrides.ts`
- Create: `tests/models/documentFieldOverrides.spec.ts`

**Interfaces:**
- Produces:
  - `DOCUMENT_FIELD_OVERRIDES_ATTR: "custom-mux-attrs__doc__fields"`
  - `isReservedDocumentAttributeKey(name: string): boolean`
  - `parseDocumentFieldOverrides(raw: unknown): DocumentFieldOverrides`
  - `serializeDocumentFieldOverrides(data: DocumentFieldOverrides): string`
  - `applyDocumentFieldOverride(base, override): merged`
  - Types: `DocumentFieldOverride`, `DocumentFieldOverrides`

- [ ] **Step 1: Write failing tests**

Create `tests/models/documentFieldOverrides.spec.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  DOCUMENT_FIELD_OVERRIDES_ATTR,
  applyDocumentFieldOverride,
  isReservedDocumentAttributeKey,
  parseDocumentFieldOverrides,
  serializeDocumentFieldOverrides,
} from "@/models/documentFieldOverrides";

describe("documentFieldOverrides", () => {
  it("recognizes the reserved storage key only", () => {
    expect(DOCUMENT_FIELD_OVERRIDES_ATTR).toBe("custom-mux-attrs__doc__fields");
    expect(isReservedDocumentAttributeKey(DOCUMENT_FIELD_OVERRIDES_ATTR)).toBe(true);
    expect(isReservedDocumentAttributeKey("custom-priority")).toBe(false);
    expect(isReservedDocumentAttributeKey("custom-avs")).toBe(false);
  });

  it("parses valid JSON and ignores corrupt payloads", () => {
    expect(parseDocumentFieldOverrides('{"v":1,"fields":{"custom-a":{"display":false,"displayAs":"A","order":2,"editable":true}}}').fields["custom-a"]).toEqual({
      display: false,
      displayAs: "A",
      order: 2,
      editable: true,
    });
    expect(parseDocumentFieldOverrides("{not-json").fields).toEqual({});
    expect(parseDocumentFieldOverrides(undefined).fields).toEqual({});
  });

  it("serializes and round-trips", () => {
    const data = {
      v: 1 as const,
      fields: {
        "custom-a": { display: true, displayAs: "A", order: 3, editable: false },
      },
    };
    expect(parseDocumentFieldOverrides(serializeDocumentFieldOverrides(data))).toEqual(data);
  });

  it("overlays override fields onto a base rule result", () => {
    const merged = applyDocumentFieldOverride(
      { display: true, displayAs: "Base", order: 10, editable: true },
      { display: false, displayAs: "Over", order: 20, editable: false },
    );
    expect(merged).toEqual({
      display: false,
      displayAs: "Over",
      order: 20,
      editable: false,
    });
    expect(applyDocumentFieldOverride(
      { display: true, displayAs: "Base", order: 10, editable: true },
      undefined,
    )).toEqual({ display: true, displayAs: "Base", order: 10, editable: true });
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npm test -- tests/models/documentFieldOverrides.spec.ts`  
Expected: FAIL (module not found)

- [ ] **Step 3: Implement model**

Create `src/models/documentFieldOverrides.ts`:

```ts
export const DOCUMENT_FIELD_OVERRIDES_ATTR = "custom-mux-attrs__doc__fields";

export interface DocumentFieldOverride {
  display: boolean;
  displayAs: string;
  order: number;
  editable: boolean;
}

export interface DocumentFieldOverrides {
  v: 1;
  fields: Record<string, DocumentFieldOverride>;
}

export function isReservedDocumentAttributeKey(name: string): boolean {
  return name === DOCUMENT_FIELD_OVERRIDES_ATTR;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function string(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function number(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeOverride(input: unknown): DocumentFieldOverride | undefined {
  if (typeof input !== "object" || input === null) return undefined;
  const source = input as Record<string, unknown>;
  return {
    display: bool(source.display, true),
    displayAs: string(source.displayAs, ""),
    order: number(source.order, 1000),
    editable: bool(source.editable, true),
  };
}

export function parseDocumentFieldOverrides(raw: unknown): DocumentFieldOverrides {
  const empty: DocumentFieldOverrides = { v: 1, fields: {} };
  let parsed: unknown = raw;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return empty;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return empty;
    }
  }
  if (typeof parsed !== "object" || parsed === null) return empty;
  const source = parsed as Record<string, unknown>;
  const fieldsIn = typeof source.fields === "object" && source.fields !== null
    ? source.fields as Record<string, unknown>
    : {};
  const fields: Record<string, DocumentFieldOverride> = {};
  for (const [key, value] of Object.entries(fieldsIn)) {
    if (!key || isReservedDocumentAttributeKey(key)) continue;
    const override = normalizeOverride(value);
    if (override) fields[key] = override;
  }
  return { v: 1, fields };
}

export function serializeDocumentFieldOverrides(data: DocumentFieldOverrides): string {
  return JSON.stringify({
    v: 1,
    fields: data.fields ?? {},
  });
}

export function applyDocumentFieldOverride<T extends DocumentFieldOverride>(
  base: T,
  override: DocumentFieldOverride | undefined,
): T {
  if (!override) return base;
  return {
    ...base,
    display: override.display,
    displayAs: override.displayAs,
    order: override.order,
    editable: override.editable,
  };
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `npm test -- tests/models/documentFieldOverrides.spec.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/models/documentFieldOverrides.ts tests/models/documentFieldOverrides.spec.ts
git commit -m "$(cat <<'EOF'
feat: add document field overrides model

Introduce reserved-key helpers and parse/merge for per-document
attribute display overrides.
EOF
)"
```

---

### Task 2: Attribute store applies overrides and hides reserved key

**Files:**
- Modify: `src/store/attribute.ts`
- Modify: `tests/store/attribute.spec.ts`

**Interfaces:**
- Consumes: `DOCUMENT_FIELD_OVERRIDES_ATTR`, `isReservedDocumentAttributeKey`, `parseDocumentFieldOverrides`, `applyDocumentFieldOverride`, `serializeDocumentFieldOverrides`
- Produces (store API additions/behavior):
  - `loadDocumentAttributes` skips reserved key and applies overrides
  - `createCustomAttribute` / `setAttribute(..., { requireCustom: true })` reject reserved key
  - `deleteCustomAttribute` rejects reserved key; after deleting a normal custom attr, prunes that key from overrides and writes updated reserved attr (or clears it)

- [ ] **Step 1: Extend failing tests in `tests/store/attribute.spec.ts`**

Add cases (keep existing mocks; reserved key must not need `matchDocumentRule`):

```ts
import { DOCUMENT_FIELD_OVERRIDES_ATTR } from "@/models/documentFieldOverrides";

it("hides the reserved overrides attribute from panel lists", async () => {
  fetchBlockAttrs.mockResolvedValue({
    id: "doc",
    "custom-x": "1",
    [DOCUMENT_FIELD_OVERRIDES_ATTR]: JSON.stringify({
      v: 1,
      fields: { "custom-x": { display: true, displayAs: "X", order: 1, editable: true } },
    }),
  });
  const store = initializeStore();
  await store.loadDocumentAttributes();
  expect(store.allDocumentAttributes.map((i) => i.key)).not.toContain(DOCUMENT_FIELD_OVERRIDES_ATTR);
  expect(store.builtInAttributes.map((i) => i.key)).not.toContain(DOCUMENT_FIELD_OVERRIDES_ATTR);
});

it("applies document overrides on top of global rules", async () => {
  fetchBlockAttrs.mockResolvedValue({
    id: "doc",
    "custom-hidden": "secret",
    [DOCUMENT_FIELD_OVERRIDES_ATTR]: JSON.stringify({
      v: 1,
      fields: {
        "custom-hidden": { display: true, displayAs: "Shown Here", order: 5, editable: true },
      },
    }),
  });
  const store = initializeStore();
  await store.loadDocumentAttributes();
  const row = store.builtInAttributes.find((i) => i.key === "custom-hidden");
  expect(row?.displayAs).toBe("Shown Here");
  expect(row?.order).toBe(5);
});

it("rejects creating the reserved overrides key", async () => {
  const store = initializeStore();
  await expect(store.createCustomAttribute(DOCUMENT_FIELD_OVERRIDES_ATTR, "{}")).rejects.toThrow();
});

it("prunes overrides when a custom attribute is deleted", async () => {
  writeBlockAttrs.mockResolvedValue(undefined);
  fetchBlockAttrs
    .mockResolvedValueOnce({
      id: "doc",
      "custom-x": "1",
      [DOCUMENT_FIELD_OVERRIDES_ATTR]: JSON.stringify({
        v: 1,
        fields: {
          "custom-x": { display: false, displayAs: "X", order: 1, editable: true },
        },
      }),
    })
    .mockResolvedValueOnce({ id: "doc" });
  const store = initializeStore();
  await store.loadDocumentAttributes();
  await store.deleteCustomAttribute("custom-x");
  expect(writeBlockAttrs).toHaveBeenCalledWith("doc", { "custom-x": "" });
  expect(writeBlockAttrs).toHaveBeenCalledWith(
    "doc",
    expect.objectContaining({ [DOCUMENT_FIELD_OVERRIDES_ATTR]: "" }),
  );
});
```

Note: adjust the prune expectation to match the chosen clear strategy (`""` empty string is the existing delete convention).

- [ ] **Step 2: Run targeted tests — expect FAIL**

Run: `npm test -- tests/store/attribute.spec.ts`  
Expected: new cases FAIL

- [ ] **Step 3: Update `src/store/attribute.ts`**

Required behavior sketch:

```ts
import {
  DOCUMENT_FIELD_OVERRIDES_ATTR,
  applyDocumentFieldOverride,
  isReservedDocumentAttributeKey,
  parseDocumentFieldOverrides,
  serializeDocumentFieldOverrides,
} from "@/models/documentFieldOverrides";

// inside loadDocumentAttributes:
const overrides = parseDocumentFieldOverrides(attrs[DOCUMENT_FIELD_OVERRIDES_ATTR]);

for (const [attributeName, attributeValue] of Object.entries(attrs)) {
  if (isReservedDocumentAttributeKey(attributeName)) continue;
  if (attributeName === "custom-avs" || attributeName.startsWith("custom-avs:")) continue;

  const matched = matchRules(attributeName);
  const override = overrides.fields[attributeName];

  if (matched) {
    const effective = applyDocumentFieldOverride(
      {
        display: matched.display,
        displayAs: matched.displayAs || attributeName,
        order: matched.order,
        editable: matched.editable,
      },
      override,
    );
    const hidden = !effective.display;
    next.push({
      key: attributeName,
      value: attributeValue,
      name: matched.name,
      displayAs: effective.displayAs,
      editable: effective.editable && !hidden && !isReadOnlyDocumentAttributeName(attributeName),
      renderMethod: matched.renderMethod,
      order: effective.order,
      icon: matched.icon,
    });
  } else if (attributeName.startsWith("custom-")) {
    const base = {
      display: true,
      displayAs: attributeName.replace(/^custom-/, ""),
      order: 1000,
      editable: true,
    };
    const effective = applyDocumentFieldOverride(base, override);
    const hidden = !effective.display;
    next.push({
      key: attributeName,
      value: attributeValue,
      name: attributeName,
      displayAs: effective.displayAs,
      editable: effective.editable && !hidden,
      renderMethod: "input",
      order: effective.order,
    });
  }
}

allDocumentAttributes.value = next.sort(...);
builtInAttributes.value = allDocumentAttributes.value.filter((attribute) => {
  // Prefer recomputing effective display: attributes with display:false stay in allDocumentAttributes only.
  // Keep current pattern: push always when rule/custom matched; filter built-in by effective display.
});
```

Important: for unmatched custom attrs with override `display: false`, still push into `allDocumentAttributes` but exclude from `builtInAttributes`. Implement by storing effective display during the loop (e.g. temporary map or include only when building builtIn via the same effective display flag). Simplest approach: always push to `next` with a local `show` flag carried only for filtering:

```ts
type Row = innerAttribute & { show: boolean };
// ... set show = effective.display
allDocumentAttributes.value = next.map(({ show, ...row }) => row)...
builtInAttributes.value = next.filter((row) => row.show).map(({ show, ...row }) => row)
```

Or keep prior approach: push all candidates into `allDocumentAttributes`, and when filtering `builtInAttributes`, re-read overrides + rules. Prefer computing `show` once in the loop to avoid drift.

Also:

```ts
async function createCustomAttribute(input: string, value: string): Promise<void> {
  if (isReservedDocumentAttributeKey(input) || isReservedDocumentAttributeKey(`custom-${input}`)) {
    throw new Error(`Attribute key is reserved: ${DOCUMENT_FIELD_OVERRIDES_ATTR}`);
  }
  const key = normalizeCustomAttributeKey(input);
  if (isReservedDocumentAttributeKey(key)) {
    throw new Error(`Attribute key is reserved: ${DOCUMENT_FIELD_OVERRIDES_ATTR}`);
  }
  // ... existing write
}

async function deleteCustomAttribute(key: string): Promise<void> {
  if (isReservedDocumentAttributeKey(key) || protectedDeleteKeys.has(key) || !key.startsWith("custom-")) {
    throw new Error(`Attribute key is protected and cannot be deleted: ${key}`);
  }
  isSaving.value = true;
  try {
    const attrs = await fetchBlockAttrs(documentId.value);
    const overrides = parseDocumentFieldOverrides(attrs[DOCUMENT_FIELD_OVERRIDES_ATTR]);
    const nextFields = { ...overrides.fields };
    delete nextFields[key];
    const payload: Record<string, string> = { [key]: "" };
    payload[DOCUMENT_FIELD_OVERRIDES_ATTR] = Object.keys(nextFields).length === 0
      ? ""
      : serializeDocumentFieldOverrides({ v: 1, fields: nextFields });
    await writeBlockAttrs(documentId.value, payload);
    await loadDocumentAttributes();
  } finally {
    isSaving.value = false;
  }
}
```

Add a store method used by FieldSettingsDialog (Task 3):

```ts
async function saveDocumentFieldOverrides(fields: Record<string, DocumentFieldOverride>): Promise<void> {
  isSaving.value = true;
  try {
    const value = Object.keys(fields).length === 0
      ? ""
      : serializeDocumentFieldOverrides({ v: 1, fields });
    await writeBlockAttrs(documentId.value, { [DOCUMENT_FIELD_OVERRIDES_ATTR]: value });
    await loadDocumentAttributes();
  } finally {
    isSaving.value = false;
  }
}
```

Export `saveDocumentFieldOverrides` from the store return object.

- [ ] **Step 4: Run tests — expect PASS**

Run: `npm test -- tests/store/attribute.spec.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/store/attribute.ts tests/store/attribute.spec.ts
git commit -m "$(cat <<'EOF'
feat: apply per-document field overrides in attribute store

Hide the reserved storage key, overlay document overrides on global
rules, and prune overrides when attributes are deleted.
EOF
)"
```

---

### Task 3: Field settings dialog writes document overrides

**Files:**
- Modify: `src/components/FieldSettingsDialog.vue`
- Modify: `src/i18n/zh_CN.json`
- Modify: `src/i18n/en_US.json`
- Modify: `src/store/rules.ts` (remove `upsertDocumentFieldRules`)
- Modify: `tests/store/rules.spec.ts` if it covers upsert

**Interfaces:**
- Consumes: `attributeStore.saveDocumentFieldOverrides`, `parseDocumentFieldOverrides` (via current attrs value), `applyDocumentFieldOverride`, global `matchDocumentRule`
- Produces: dialog saves only document overrides; no global rule mutation

- [ ] **Step 1: Update i18n strings**

In both locale files under `fieldSettings`:

```json
"subtitle": "仅影响当前文档；未覆盖的字段仍使用全局默认规则",
"restoreDefault": "恢复默认",
"emptyHint": "当前文档还没有属性。请先在面板中「添加属性」。"
```

EN equivalents:

```json
"subtitle": "Applies to this document only. Unoverridden fields still use global defaults.",
"restoreDefault": "Restore default",
"emptyHint": "This document has no attributes yet. Add one from the panel first."
```

Update `settings.help` (zh) to remove any database wording and mention defaults vs document overrides.

- [ ] **Step 2: Rewrite dialog logic**

Replace global upsert flow:

1. On load: read `attributeStore.allDocumentAttributes` plus raw override map. Prefer exposing `getDocumentFieldOverrides()` from the attribute store that returns the last-parsed map, **or** re-fetch attrs once in the dialog. Cleanest: attribute store keeps `documentFieldOverrides` ref updated in `loadDocumentAttributes`.

Add to attribute store in this task if not done in Task 2:

```ts
const documentFieldOverrides = ref<DocumentFieldOverrides>({ v: 1, fields: {} });
// set during loadDocumentAttributes from parseDocumentFieldOverrides(...)
```

2. Draft item shape:

```ts
{
  key: string;
  attr: { key, value, displayAs, editable };
  baseline: DocumentFieldOverride; // global-only effective snapshot
  draft: DocumentFieldOverride;    // editable
  overridden: boolean;             // key in overrides.fields at load, or draft !== baseline
}
```

`baseline` computation:

```ts
function baselineFor(key: string, fallbackDisplayAs: string, fallbackOrder: number): DocumentFieldOverride {
  const matched = settingsStore.matchDocumentRule(key);
  if (matched) {
    return {
      display: matched.display,
      displayAs: matched.displayAs || fallbackDisplayAs,
      order: matched.order,
      editable: !isReadOnlyDocumentAttributeName(key) && matched.editable,
    };
  }
  return {
    display: true,
    displayAs: fallbackDisplayAs,
    order: fallbackOrder,
    editable: !isReadOnlyDocumentAttributeName(key),
  };
}
```

Initial `draft = applyDocumentFieldOverride(baseline, existingOverride)`.

3. Template: keep existing controls bound to `item.draft.*` instead of `item.rule.*`. Add button「恢复默认」calling `restore(item)` which sets `draft = { ...baseline }`.

4. Empty state: use `emptyHint` when `documentItems.length === 0`.

5. Save:

```ts
const fields: Record<string, DocumentFieldOverride> = {};
for (const item of documentDrafts.value) {
  const same =
    item.draft.display === item.baseline.display
    && item.draft.displayAs === item.baseline.displayAs
    && item.draft.order === item.baseline.order
    && item.draft.editable === item.baseline.editable;
  if (!same) {
    fields[item.key] = {
      display: item.draft.display,
      displayAs: item.draft.displayAs,
      order: item.draft.order,
      editable: isDocumentKeyReadonly(item.key) ? false : item.draft.editable,
    };
  }
}
await attributeStore.saveDocumentFieldOverrides(fields);
```

Do **not** call `settingsStore.upsertDocumentFieldRules`.

6. Remove unused imports (`findExactDisplayRule`, `normalizeDisplayRule` as rule builder) if no longer needed.

- [ ] **Step 3: Remove `upsertDocumentFieldRules` from `src/store/rules.ts` and its export; update/remove related tests**

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/store/attribute.spec.ts tests/store/rules.spec.ts tests/models/documentFieldOverrides.spec.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/FieldSettingsDialog.vue src/store/rules.ts src/store/attribute.ts src/i18n/zh_CN.json src/i18n/en_US.json tests/store/rules.spec.ts
git commit -m "$(cat <<'EOF'
feat: save field settings as per-document overrides

Point the panel field-settings dialog at document-scoped storage and
stop upserting global display rules from that entry point.
EOF
)"
```

---

### Task 4: Remove `showDocumentPanel` + clarify global settings copy

**Files:**
- Modify: `src/models/settings.ts`
- Modify: `src/views/SettingContent.vue`
- Modify: `src/i18n/zh_CN.json`, `src/i18n/en_US.json`
- Modify: `tests/models/settings.spec.ts`, `tests/services/settings.spec.ts`
- Modify: `docs/README_zh_CN.md`, `docs/README.md`

- [ ] **Step 1: Update failing tests** for settings normalization without `showDocumentPanel`

Remove expectations on `showDocumentPanel`. Keep `showPanel` behavior. Legacy migration should only set `showPanel`.

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npm test -- tests/models/settings.spec.ts tests/services/settings.spec.ts`

- [ ] **Step 3: Implement removals**

- Delete `showDocumentPanel` from `PanelSettings`, `DEFAULT_PANEL_SETTINGS`, `normalizePanelSettings`, `normalizeLegacySettings`.
- Remove checkbox block from `SettingContent.vue`.
- Update `settings.help` / section subtitle to: global defaults; per-doc exceptions live in panel「字段设置」.
- README: remove stale「即将推出…高度可配置的自定义设置」; document:
  1. 属性面板设置 = 全局默认规则  
  2. 字段设置 = 仅当前文档覆盖  
  3. 内部保留属性 `custom-mux-attrs__doc__fields` 用户不可见

- [ ] **Step 4: Run tests — expect PASS**

Run: `npm test -- tests/models/settings.spec.ts tests/services/settings.spec.ts`

- [ ] **Step 5: Commit**

```bash
git add src/models/settings.ts src/views/SettingContent.vue src/i18n/zh_CN.json src/i18n/en_US.json tests/models/settings.spec.ts tests/services/settings.spec.ts docs/README_zh_CN.md docs/README.md
git commit -m "$(cat <<'EOF'
refactor: drop unused showDocumentPanel and clarify settings roles

Keep a single panel visibility switch and document global defaults vs
per-document field overrides in user-facing copy.
EOF
)"
```

---

### Task 5: Full verify + manual SiYuan check

**Files:** none required unless verify fails

- [ ] **Step 1: Run full verify**

Run: `export PATH="/usr/local/opt/node@22/bin:$PATH" && npm run verify`  
Expected: typecheck + tests + build all PASS

- [ ] **Step 2: Ensure `npm run dev` is running (watch → `./dev`) and SiYuan UI reloaded**

Run reload: `curl -s -X POST http://127.0.0.1:6806/api/ui/reloadUI -H 'Content-Type: application/json' -d '{}'`

- [ ] **Step 3: Manual acceptance (from spec)**

1. Global hide attribute `X` → other docs hide `X`.
2. On doc A, field settings show `X` → only A shows it.
3. Restore default on A → A follows global again.
4. Reserved key never appears in panel / field settings / add flow.
5. Editing global rules does not wipe doc A overrides.

- [ ] **Step 4: Commit any fixups if needed; otherwise stop**

---

## Spec coverage self-review

| Spec requirement | Task |
|------------------|------|
| Split entry point responsibilities | Task 3 + 4 copy |
| Per-document storage on reserved key | Task 1–3 |
| Hard hide reserved key | Task 1–2 |
| Global defaults + override merge | Task 2–3 |
| Full snapshot per overridden key | Task 1 + 3 save |
| Restore default | Task 3 |
| Clear attr when fields empty | Task 2–3 |
| Corrupt JSON safe | Task 1 |
| Reject add reserved key | Task 2 |
| Prune override on delete | Task 2 |
| Remove `showDocumentPanel` | Task 4 |
| Acceptance scenarios | Task 5 |

## Placeholder / consistency check

- Reserved key name consistent: `custom-mux-attrs__doc__fields`
- Store method name consistent: `saveDocumentFieldOverrides`
- No `upsertDocumentFieldRules` after Task 3
- Override type fields: `display`, `displayAs`, `order`, `editable` only

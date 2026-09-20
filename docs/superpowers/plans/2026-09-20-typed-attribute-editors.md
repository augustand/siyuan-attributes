# Typed Attribute Editors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add global-rule `renderMethod` editors for `select`, `multi-select`, `date`, `checkbox`, and `number`, with select options configured only on global rules.

**Architecture:** Extend `DisplayRenderMethod` / `DisplayRule.options`, normalize in settings, pass `options` through the attribute store onto each row, and implement widgets in `AttributeRow` using pure encode/decode helpers (reuse comma helpers for multi-select).

**Tech Stack:** Vue 3, Pinia, TDesign Vue Next, TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-19-typed-attribute-editors-design.md`

## Global Constraints

- New methods exactly: `select` | `multi-select` | `date` | `checkbox` | `number`.
- Keep existing: `input` | `tag-input` | `datetime` | `link`.
- Options only on global rules (`DisplayRule.options?: string[]`); document field settings do not override `renderMethod` or `options`.
- Storage: select = raw option string; multi-select = comma-joined; checkbox = `true`/`false`; number = decimal string; date = `YYYYMMDD` (not `datetime`’s 14-digit stamp).
- Settings `version` stays `1`.
- Document panel and block dialog share `AttributeRow` (no separate wiring).
- No AV / database work.
- **Breaking note:** `normalizeRenderMethod("checkbox")` currently collapses to `input`; this plan makes `"checkbox"` a real method. Update tests accordingly.
- `npm run verify` must pass after the final task.

## File map

| File | Responsibility |
|------|----------------|
| `src/models/settings.ts` | Widen render method union; `options` on rules; normalize |
| `tests/models/settings.spec.ts` | Rule/options/renderMethod normalization |
| `tests/services/siyuanFormats.spec.ts` | Update checkbox expectation; date/number/checkbox helpers |
| `src/services/siyuanFormats.ts` | Date (`YYYYMMDD`), checkbox, number helpers (multi-select reuses alias tag helpers) |
| `src/views/SettingContent.vue` | Render-method options + conditional options editor |
| `src/i18n/zh_CN.json`, `src/i18n/en_US.json` | Labels for new methods + options |
| `src/store/attribute.ts` | Pass `options` onto `innerAttribute` |
| `src/components/AttributeRow.vue` | New editor widgets |
| `docs/README_zh_CN.md`, `docs/README.md` | Mention new render methods |

---

### Task 1: Settings model — render methods + options

**Files:**
- Modify: `src/models/settings.ts`
- Modify: `tests/models/settings.spec.ts` (create if missing coverage; extend existing)
- Modify: `tests/services/siyuanFormats.spec.ts` (`normalizeRenderMethod` checkbox case)

**Interfaces:**
- Produces:
  - `DisplayRenderMethod` includes the five new literals
  - `DisplayRule.options?: string[]`
  - `normalizeRenderMethod` returns real `"checkbox"` (not `"input"`)
  - `normalizeRuleOptions(raw: unknown): string[]` (trim, drop empty, dedupe) — can be exported from `settings.ts`

- [ ] **Step 1: Write failing tests**

In `tests/services/siyuanFormats.spec.ts`, change the checkbox expectation:

```ts
expect(normalizeRenderMethod("checkbox")).toBe("checkbox");
expect(normalizeRenderMethod("select")).toBe("select");
expect(normalizeRenderMethod("multi-select")).toBe("multi-select");
expect(normalizeRenderMethod("date")).toBe("date");
expect(normalizeRenderMethod("number")).toBe("number");
```

Add or extend `tests/models/settings.spec.ts`:

```ts
import { describe, expect, it } from "vitest";
import { normalizeDisplayRule, normalizePanelSettings } from "@/models/settings";

describe("typed render methods and options", () => {
  it("normalizes select options on a rule", () => {
    const rule = normalizeDisplayRule({
      name: "status",
      rule: "custom-status",
      matchMethod: "exact",
      renderMethod: "select",
      options: [" 待办 ", "", "进行中", "待办", "完成"],
    });
    expect(rule?.renderMethod).toBe("select");
    expect(rule?.options).toEqual(["待办", "进行中", "完成"]);
  });

  it("defaults missing options to empty array for select-like methods", () => {
    const rule = normalizeDisplayRule({
      name: "tags",
      rule: "custom-tags",
      renderMethod: "multi-select",
    });
    expect(rule?.options).toEqual([]);
  });

  it("round-trips options through panel settings normalize", () => {
    const settings = normalizePanelSettings({
      version: 1,
      showPanel: true,
      rules: [{
        name: "n",
        rule: "custom-n",
        renderMethod: "select",
        options: ["a", "b"],
      }],
    });
    expect(settings.rules[0].options).toEqual(["a", "b"]);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run:

```bash
npm run test -- tests/services/siyuanFormats.spec.ts tests/models/settings.spec.ts
```

Expected: FAIL on new method / options expectations.

- [ ] **Step 3: Implement settings model**

In `src/models/settings.ts`:

1. Widen type:

```ts
export type DisplayRenderMethod =
  | "input"
  | "tag-input"
  | "datetime"
  | "link"
  | "select"
  | "multi-select"
  | "date"
  | "checkbox"
  | "number";
```

2. Add `options?: string[]` to `DisplayRule`.

3. Replace `normalizeRenderMethod`:

```ts
export function normalizeRenderMethod(value: unknown): DisplayRenderMethod | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (
    value === "input"
    || value === "tag-input"
    || value === "datetime"
    || value === "link"
    || value === "select"
    || value === "multi-select"
    || value === "date"
    || value === "checkbox"
    || value === "number"
  ) {
    return value;
  }
  return "input";
}
```

4. Add:

```ts
export function normalizeRuleOptions(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    const text = String(item ?? "").trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    out.push(text);
  }
  return out;
}
```

5. In `normalizeDisplayRule`, after resolving `renderMethod`, set:

```ts
const options = normalizeRuleOptions(source.options);
```

Include `options` on the returned object when `renderMethod` is `select` or `multi-select` (always include `options: options` for those; for other methods either omit or set `[]` — prefer always attach `options` normalized so UI binding is stable:

```ts
options,
```

on every rule).

- [ ] **Step 4: Run tests — expect PASS**

```bash
npm run test -- tests/services/siyuanFormats.spec.ts tests/models/settings.spec.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/models/settings.ts tests/models/settings.spec.ts tests/services/siyuanFormats.spec.ts
git commit -m "$(cat <<'EOF'
feat: add typed render methods and rule options to settings model

EOF
)"
```

---

### Task 2: Encode/decode helpers for date, checkbox, number

**Files:**
- Modify: `src/services/siyuanFormats.ts`
- Modify: `tests/services/siyuanFormats.spec.ts`

**Interfaces:**
- Produces:
  - `parseSiYuanDate(raw): Date | undefined` — `YYYYMMDD` only
  - `formatSiYuanDateDisplay(raw): string` — `YYYY-MM-DD` or raw if invalid
  - `toSiYuanDate(date): string` — `YYYYMMDD` or `""`
  - `parseCheckboxValue(raw): boolean` — `true` only if trimmed lower-case `"true"`; else false (empty ⇒ false)
  - `serializeCheckboxValue(on: boolean): "true" | "false"`
  - `parseNumberValue(raw): string | undefined` — empty string → `""` (caller may clear); invalid non-empty → `undefined`; valid → canonical decimal string without junk
  - Multi-select continues to use `parseAliasTags` / `serializeAliasTags`

- [ ] **Step 1: Write failing tests**

Append to `tests/services/siyuanFormats.spec.ts`:

```ts
import {
  formatSiYuanDateDisplay,
  parseCheckboxValue,
  parseNumberValue,
  parseSiYuanDate,
  serializeCheckboxValue,
  toSiYuanDate,
} from "@/services/siyuanFormats";

describe("siyuan date (YYYYMMDD)", () => {
  it("parses and formats date-only values", () => {
    const d = parseSiYuanDate("20260919");
    expect(d).toBeInstanceOf(Date);
    expect(formatSiYuanDateDisplay("20260919")).toBe("2026-09-19");
    expect(toSiYuanDate(d!)).toBe("20260919");
  });

  it("rejects datetime-length and invalid strings", () => {
    expect(parseSiYuanDate("20260919153045")).toBeUndefined();
    expect(parseSiYuanDate("nope")).toBeUndefined();
    expect(formatSiYuanDateDisplay("nope")).toBe("nope");
  });
});

describe("checkbox values", () => {
  it("parses and serializes", () => {
    expect(parseCheckboxValue("true")).toBe(true);
    expect(parseCheckboxValue("TRUE")).toBe(true);
    expect(parseCheckboxValue("false")).toBe(false);
    expect(parseCheckboxValue("")).toBe(false);
    expect(serializeCheckboxValue(true)).toBe("true");
    expect(serializeCheckboxValue(false)).toBe("false");
  });
});

describe("number values", () => {
  it("accepts decimals and rejects junk", () => {
    expect(parseNumberValue("12.5")).toBe("12.5");
    expect(parseNumberValue(" 3 ")).toBe("3");
    expect(parseNumberValue("")).toBe("");
    expect(parseNumberValue("abc")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npm run test -- tests/services/siyuanFormats.spec.ts
```

- [ ] **Step 3: Implement helpers**

In `src/services/siyuanFormats.ts` add:

```ts
const COMPACT_DATE = /^(\d{4})(\d{2})(\d{2})$/;

export function parseSiYuanDate(raw: unknown): Date | undefined {
  if (typeof raw !== "string") return undefined;
  const match = COMPACT_DATE.exec(raw.trim());
  if (!match) return undefined;
  const [, y, mo, d] = match;
  const date = new Date(Number(y), Number(mo) - 1, Number(d));
  if (Number.isNaN(date.getTime())) return undefined;
  // reject overflow dates (e.g. 20260231)
  if (
    date.getFullYear() !== Number(y)
    || date.getMonth() !== Number(mo) - 1
    || date.getDate() !== Number(d)
  ) {
    return undefined;
  }
  return date;
}

export function formatSiYuanDateDisplay(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const date = parseSiYuanDate(raw);
  if (!date) return raw;
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function toSiYuanDate(date: Date | undefined | null): string {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}`;
}

export function parseCheckboxValue(raw: unknown): boolean {
  return typeof raw === "string" && raw.trim().toLowerCase() === "true";
}

export function serializeCheckboxValue(on: boolean): "true" | "false" {
  return on ? "true" : "false";
}

export function parseNumberValue(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  if (trimmed === "") return "";
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(trimmed)) return undefined;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return undefined;
  // Keep a stable string: prefer trimmed input if Number(trimmed) matches
  return String(n);
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
npm run test -- tests/services/siyuanFormats.spec.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/services/siyuanFormats.ts tests/services/siyuanFormats.spec.ts
git commit -m "$(cat <<'EOF'
feat: add date, checkbox, and number attribute value helpers

EOF
)"
```

---

### Task 3: Settings UI + i18n for new methods and options

**Files:**
- Modify: `src/views/SettingContent.vue`
- Modify: `src/i18n/zh_CN.json`
- Modify: `src/i18n/en_US.json`

**Interfaces:**
- Consumes: `rule.renderMethod`, `rule.options` (ensure new rules init `options: []`)
- When adding a rule, set `renderMethod: 'input', options: []`

- [ ] **Step 1: Add i18n keys**

`zh_CN.json` under `settings`:

```json
"renderSelect": "单选",
"renderMultiSelect": "多选",
"renderDate": "日期",
"renderCheckbox": "开关",
"renderNumber": "数字",
"options": "选项",
"optionsHint": "仅单选/多选有效；回车添加选项"
```

`en_US.json`:

```json
"renderSelect": "Select",
"renderMultiSelect": "Multi-select",
"renderDate": "Date",
"renderCheckbox": "Checkbox",
"renderNumber": "Number",
"options": "Options",
"optionsHint": "Only for select / multi-select; press Enter to add"
```

- [ ] **Step 2: Update SettingContent.vue**

1. Extend render-method `<t-select>` with the five new `t-option`s.
2. After the render-method label block, add a conditional options editor:

```vue
<label v-if="rule.renderMethod === 'select' || rule.renderMethod === 'multi-select'">
    <span>{{ labels.options }}</span>
    <t-tag-input
        :model-value="rule.options ?? []"
        :placeholder="labels.optionsHint"
        clearable
        @update:model-value="(v: string[]) => { rule.options = v }"
    />
</label>
```

(If `v-model` on `rule.options` works directly with array, prefer `v-model="rule.options"` after ensuring `options` always exists.)

3. In `labels` object, wire the new i18n keys.
4. Where new rules are created (`renderMethod: 'input'`), also set `options: []`.

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/views/SettingContent.vue src/i18n/zh_CN.json src/i18n/en_US.json
git commit -m "$(cat <<'EOF'
feat: expose typed render methods and options in settings UI

EOF
)"
```

---

### Task 4: Store passes options; AttributeRow implements editors

**Files:**
- Modify: `src/store/attribute.ts`
- Modify: `src/components/AttributeRow.vue`

**Interfaces:**
- `innerAttribute` gains `options?: string[]`
- Matched rules copy `matched.options ?? []`
- Unmatched custom: no options / `[]`

- [ ] **Step 1: Pass options from store**

In `src/store/attribute.ts` on `innerAttribute`:

```ts
options?: string[];
```

When pushing matched rows:

```ts
renderMethod: matched.renderMethod,
options: matched.options ?? [],
```

Unmatched custom rows: `options: []` (optional).

- [ ] **Step 2: Extend AttributeRow method detection**

```ts
const SELECT_METHODS = new Set([
  'input', 'tag-input', 'datetime', 'link',
  'select', 'multi-select', 'date', 'checkbox', 'number',
]);

const method = computed<DisplayRenderMethod>(() => {
  const raw = attribute.value?.renderMethod;
  if (raw && SELECT_METHODS.has(raw)) return raw as DisplayRenderMethod;
  return 'input';
});

const ruleOptions = computed(() => attribute.value?.options ?? []);
```

- [ ] **Step 3: Add templates + submit handlers**

**select:**

```vue
<template v-else-if="method === 'select'">
  <t-select
    v-model="draft"
    :borderless="true"
    :disabled="!canEdit || saving"
    clearable
    @change="submitText"
  >
    <t-option
      v-for="opt in selectOptions"
      :key="opt"
      :value="opt"
      :label="opt"
    />
  </t-select>
</template>
```

```ts
const selectOptions = computed(() => {
  const opts = [...ruleOptions.value];
  const current = draft.value;
  if (current && !opts.includes(current)) opts.unshift(current);
  return opts;
});
```

**multi-select:**

```vue
<template v-else-if="method === 'multi-select'">
  <t-select
    v-model="multiValues"
    multiple
    filterable
    :borderless="true"
    :disabled="!canEdit || saving"
    clearable
    @change="submitMulti"
  >
    <t-option
      v-for="opt in multiOptions"
      :key="opt"
      :value="opt"
      :label="opt"
    />
  </t-select>
</template>
```

```ts
const multiValues = ref<string[]>([]);
const multiOptions = computed(() => {
  const opts = [...ruleOptions.value];
  for (const v of multiValues.value) {
    if (v && !opts.includes(v)) opts.push(v);
  }
  return opts;
});

async function submitMulti(): Promise<void> {
  const next = serializeAliasTags(multiValues.value);
  multiValues.value = parseAliasTags(next);
  await persist(next);
}
```

In the attribute `watch`, also set `multiValues.value = parseAliasTags(row.value)`.

**date:**

```vue
<template v-else-if="method === 'date'">
  <t-date-picker
    v-if="canEdit"
    v-model="datePickerValue"
    allow-input
    :borderless="true"
    :placeholder="labels.dateOnlyPlaceholder"
    :disabled="saving"
    @change="submitDateOnly"
  />
  <span v-else class="readonly-value">{{ displayDate }}</span>
</template>
```

```ts
const datePickerValue = ref('');
const displayDate = computed(() => formatSiYuanDateDisplay(draft.value));

// in watch:
const parsedDate = parseSiYuanDate(row.value);
datePickerValue.value = parsedDate ? formatDateForPicker(parsedDate) : '';

function formatDateForPicker(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

async function submitDateOnly(value: string | Date): Promise<void> {
  let date: Date | undefined;
  if (value instanceof Date) date = value;
  else if (typeof value === 'string' && value.trim()) {
    const digits = value.replace(/\D/g, '');
    date = parseSiYuanDate(digits.slice(0, 8)) ?? new Date(value);
    if (Number.isNaN(date.getTime())) date = undefined;
  }
  if (!date) return; // invalid — do not save
  await persist(toSiYuanDate(date));
}
```

**checkbox:**

```vue
<template v-else-if="method === 'checkbox'">
  <t-switch
    :model-value="checkboxOn"
    :disabled="!canEdit || saving"
    @change="submitCheckbox"
  />
</template>
```

```ts
const checkboxOn = computed(() => parseCheckboxValue(draft.value));

async function submitCheckbox(on: boolean): Promise<void> {
  await persist(serializeCheckboxValue(on));
}
```

**number:**

```vue
<template v-else-if="method === 'number'">
  <t-input
    v-model="draft"
    type="number"
    :borderless="true"
    :placeholder="labels.numberPlaceholder"
    :disabled="!canEdit || saving"
    @blur="submitNumber"
  />
</template>
```

```ts
async function submitNumber(): Promise<void> {
  const parsed = parseNumberValue(draft.value);
  if (parsed === undefined) {
    draft.value = lastSaved.value;
    return;
  }
  await persist(parsed);
}
```

Add i18n fallbacks in the component labels for `dateOnlyPlaceholder` / `numberPlaceholder` (or reuse existing date placeholder with a distinct key in i18n if already updating files — optional; inline fallbacks OK).

Import new helpers from `@/services/siyuanFormats`.

- [ ] **Step 4: Typecheck + tests**

```bash
npm run typecheck
npm run test
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/store/attribute.ts src/components/AttributeRow.vue
git commit -m "$(cat <<'EOF'
feat: render select, multi-select, date, checkbox, and number editors

EOF
)"
```

---

### Task 5: Docs + verify

**Files:**
- Modify: `docs/README_zh_CN.md`
- Modify: `docs/README.md`

- [ ] **Step 1: Update READMEs**

In both Features / 插件功能 sections, extend the global settings bullet to mention render methods include 单选/多选/日期/开关/数字 (select / multi-select / date / checkbox / number), and that options are configured only in global rules.

- [ ] **Step 2: Full verify**

```bash
npm run verify
```

Expected: typecheck + all tests + build PASS

- [ ] **Step 3: Manual smoke (SiYuan)**

1. Add global rule exact `custom-status`, method select, options 待办/进行中/完成 → panel shows select; persist reload.
2. multi-select rule → comma storage round-trip.
3. date vs datetime rules on two customs → `YYYYMMDD` vs 14-digit.
4. checkbox / number behave as specified.
5. Open block dialog → same editors.
6. Field settings has no renderMethod/options controls.

- [ ] **Step 4: Commit**

```bash
git add docs/README_zh_CN.md docs/README.md
git commit -m "$(cat <<'EOF'
docs: document typed attribute render methods

EOF
)"
```

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| New render methods union | 1 |
| Global `options` on rules | 1, 3 |
| Normalize options | 1 |
| date/checkbox/number helpers | 2 |
| Settings UI | 3 |
| Store passes options | 4 |
| AttributeRow widgets + unknown-option display | 4 |
| Docs | 5 |
| No AV / no doc override of method/options | honored throughout |

## Placeholder / consistency review

- `normalizeRenderMethod("checkbox")` semantics change is explicit in Task 1.
- Multi-select storage reuses `parseAliasTags` / `serializeAliasTags` (same as tag-input).
- Date helpers reject 14-digit datetime strings so the two methods stay distinct.

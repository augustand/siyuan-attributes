# SiYuan Attribute Panel Completion Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the current document attribute panel into a reliable SiYuan attribute editor with complete document-level CRUD, synchronized database attributes, configurable display, and a foundation for block-level attributes.

**Architecture:** Introduce a typed SiYuan API service layer that normalizes response codes and errors before UI code sees them. Move panel ownership and attribute state into explicitly managed Pinia stores/services so Vue apps are mounted once, refreshed consistently, and always unmounted. Existing TDesign components remain the presentation layer and consume store actions instead of calling raw HTTP endpoints directly.

**Tech Stack:** Vue 3, Pinia, TDesign Vue Next, SiYuan Plugin API, Vite 8, TypeScript, Vitest, Vue Test Utils, happy-dom.

**Spec:** `docs/README_zh_CN.md`; external acceptance references are [Issue #4](https://github.com/InEase/SiYuan-Attributes-Panel/issues/4), [Issue #5](https://github.com/InEase/SiYuan-Attributes-Panel/issues/5), and [Issue #7](https://github.com/InEase/SiYuan-Attributes-Panel/issues/7). The acceptance criteria below are the executable interpretation of those sources.

## Global Constraints

- Node.js CI and local development use Node 22.
- Every implementation task must keep `npm ci`, `npm run build`, and `npm run test` green.
- All SiYuan HTTP responses must pass through one response-normalization helper; components must not interpret raw `code/msg` themselves.
- Document attributes are created/updated through `POST /api/attr/setBlockAttrs`.
- Deleting a document attribute sends an empty string as its value through `setBlockAttrs`; SiYuan treats empty values as deletion.
- New/updated database cell writes use `itemID`; `rowID` is deprecated and must not appear in new service calls.
- Do not enable database writes until the response and refreshed value have been verified; select/multi-select/date writes remain read-only until their dedicated task lands.
- Keep plugin name `SiYuan-Attribute-Panel` and package name `mux-plugin-siyuan-attribute-panel` unchanged.
- Supported frontends remain `desktop`, `desktop-window`, and `browser-desktop`; mobile is release research, not this plan.
- User-visible text added by this plan must use both `src/i18n/zh_CN.json` and `src/i18n/en_US.json`.

## Current Gaps Being Closed

| Priority | Gap | Evidence |
|---|---|---|
| P0 | `eventBus.off` receives a newly created handler, so the original handler is not removed | `src/index.ts:60-65` |
| P0 | Mounted Vue panel apps are not tracked or unmounted | `src/index.ts:117-133`, `src/index.ts:60-67` |
| P0 | Raw `fetchPost` success callbacks can show success for failed writes | `src/components/AttributeRow.vue:59`, `src/components/DbRow.vue:138` |
| P1 | Document attribute CRUD is incomplete | `src/components/BuiltInAttrs.vue:6` disables `AttributeRowAdd`; no delete action exists |
| P1 | Attribute add UI calls a nonexistent store method | `src/components/AttributeRowAdd.vue:55` |
| P2 | Database changes are loaded only once | `src/store/attribute.ts:76-140` |
| P2 | Database cell writes use deprecated `rowID` | `src/components/DbRow.vue:144`, `src/components/DbRow.vue:160`, `src/components/DbRow.vue:181`, `src/components/DbRow.vue:206`, `src/components/DbRow.vue:237` |
| P2 | Select/multi-select/date editing is disabled | `src/components/DbRow.vue:7`, `src/components/DbRow.vue:29`, `src/components/DbRow.vue:37`, `src/components/DbRow.vue:41` |
| P3 | Settings persistence exists, but there is no usable settings UI | `src/store/rules.ts:108-157`, empty `src/views/SettingContent.vue` |
| P4 | Block-level attribute panel is absent | `src/store/attribute.ts:26` defines unused `pageBlockAttributes`; Issue #7 is open |

## Milestone Roadmap

| Milestone | Outcome | Exit criteria |
|---|---|---|
| M0 — Reliability foundation | Stable lifecycle, typed API layer, test harness | Handler cleanup is unit-tested; every write uses normalized API services; build/test/typecheck are green; plugin reloads in SiYuan without console errors |
| M1 — Document CRUD | Users can add, edit, and delete custom document attributes | Add custom `custom-*` attribute works; delete works; refresh shows the same state; protected built-ins cannot be deleted; UI has success/error messages |
| M2 — Database attributes | Database panel shows current values and edits supported field types safely | Values refresh after external changes; text/number/checkbox edits round-trip; select/multi-select/date edit or remains safely read-only with an explicit product decision; all writes use `itemID` |
| M3 — Settings | Users configure visibility, display names, editability, and order | Settings UI persists through reload; rules affect document and database panels; reset-to-defaults works |
| M4 — Block attributes | Users open/edit attributes for arbitrary blocks | Block context menu opens panel; block attrs load/save/delete; multi-database block data can be displayed; no document-panel regression |
| M5 — Release readiness | Maintainable, documented, localized release | i18n is template-free; docs match behavior; typecheck/test/build/release package pass; compatibility matrix is updated |

M2, M3, and M4 touch independent subsystems. Expand each milestone into its own short implementation plan at its entry gate instead of growing this document into a monolithic design.

## Sprint 1: M0 + M1 Implementation Plan

### File Structure

```text
src/
  services/
    siyuanResponse.ts        # Normalizes IWebSocketData.code/msg/data and exposes SiyuanApiError
    blockAttrs.ts            # Document attribute API operations
    panelRegistry.ts         # One Vue app per document panel, with deterministic cleanup
  store/
    attribute.ts             # Async document state, CRUD actions, database state transition
  components/
    AttributeRow.vue         # Edits through blockAttrs service/store only
    AttributeRowAdd.vue      # Adds custom document attributes
    AttributeRowActions.vue  # Deletes custom document attributes after confirmation
    BuiltInAttrs.vue         # Re-enables the add row and mounts per-row actions
  i18n/
    zh_CN.json               # Product UI strings
    en_US.json               # Product UI strings
tests/
  setup.ts                  # happy-dom cleanup and mock restoration
  services/                 # API wrapper and panel registry tests
  store/                    # Attribute store CRUD tests
```

### Task 1: Add the Vitest harness

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `tests/setup.ts`

**Interfaces:**
- Consumes: existing `@` Vite alias.
- Produces: `npm run test`, `npm run test:watch`, and `npm run typecheck` commands used by all later tasks.

- [x] **Step 1: Install dev dependencies**

Run:

```bash
npm install --save-dev vitest @vue/test-utils happy-dom vue-tsc
```

- [x] **Step 2: Add test and typecheck scripts**

Add these entries to `package.json`:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "vue-tsc --noEmit"
  }
}
```

- [x] **Step 3: Create Vitest configuration**

Create `vitest.config.ts`:

```ts
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "happy-dom",
    setupFiles: ["./tests/setup.ts"],
  },
});
```

- [x] **Step 4: Create shared DOM cleanup**

Create `tests/setup.ts`:

```ts
import { afterEach } from "vitest";

afterEach(() => {
  document.body.innerHTML = "";
});
```

- [x] **Step 5: Verify the harness**

Run:

```bash
npm run test -- --run false --no coverage
```

Expected: Vitest starts and reports that no test files exist, then exits non-zero only because no tests have been written yet.

Run:

```bash
npm run typecheck || true
```

Expected: Vue SFC imports become resolvable. Existing type errors may remain, but `Cannot find module './App.vue'` must no longer appear. Record any remaining errors in the task output.

- [x] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts tests/setup.ts
git commit -m "test: add Vitest and Vue typecheck harness"
```

### Task 2: Normalize SiYuan response handling

**Files:**
- Create: `src/services/siyuanResponse.ts`
- Test: `tests/services/siyuanResponse.spec.ts`

**Interfaces:**
- Consumes: SiYuan `IWebSocketData`.
- Produces: `SiyuanApiError` and `assertSiyuanData<T>(response?: IWebSocketData, fallbackMessage = "SiYuan request failed"): T`.

- [x] **Step 1: Write failing tests**

Create `tests/services/siyuanResponse.spec.ts`:

```ts
import { describe, expect, it } from "vitest";
import { assertSiyuanData, SiyuanApiError } from "@/services/siyuanResponse";

describe("assertSiyuanData", () => {
  it("returns data for a successful response", () => {
    expect(assertSiyuanData({ code: 0, msg: "", data: { id: "doc" } })).toEqual({
      id: "doc",
    });
  });

  it("throws a typed error for a non-zero response", () => {
    try {
      assertSiyuanData({ code: -1, msg: "invalid attribute" });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(SiyuanApiError);
      expect((error as SiyuanApiError).code).toBe(-1);
      expect((error as SiyuanApiError).message).toBe("invalid attribute");
    }
  });

  it("throws when data is missing", () => {
    expect(() => assertSiyuanData({ code: 0, msg: "" })).toThrow(SiyuanApiError);
  });
});
```

- [x] **Step 2: Run the test and confirm the new module is missing**

Run:

```bash
npm run test -- tests/services/siyuanResponse.spec.ts
```

Expected: FAIL because `@/services/siyuanResponse` does not exist.

- [x] **Step 3: Implement the helper**

Create `src/services/siyuanResponse.ts`:

```ts
import type { IWebSocketData } from "siyuan";

export class SiyuanApiError extends Error {
  readonly code: number;

  constructor(message: string, code = -1) {
    super(message);
    this.name = "SiyuanApiError";
    this.code = code;
  }
}

export function assertSiyuanData<T>(
  response?: IWebSocketData,
  fallbackMessage = "SiYuan request failed",
): T {
  if (!response || response.code !== 0) {
    throw new SiyuanApiError(response?.msg || fallbackMessage, response?.code ?? -1);
  }

  if (response.data === undefined || response.data === null) {
    throw new SiyuanApiError(fallbackMessage, response.code);
  }

  return response.data as T;
}
```

- [x] **Step 4: Run the test**

Run:

```bash
npm run test -- tests/services/siyuanResponse.spec.ts
```

Expected: 3 passed.

- [x] **Step 5: Commit**

```bash
git add src/services/siyuanResponse.ts tests/services/siyuanResponse.spec.ts
git commit -m "feat: normalize SiYuan API responses"
```

### Task 3: Add document attribute API operations

**Files:**
- Create: `src/services/blockAttrs.ts`
- Test: `tests/services/blockAttrs.spec.ts`

**Interfaces:**
- Consumes: `assertSiyuanData<T>` and SiYuan `fetchSyncPost`.
- Produces:
  - `fetchBlockAttrs(id: string): Promise<Record<string, string>>`
  - `writeBlockAttrs(id: string, attrs: Record<string, string>): Promise<void>`

- [x] **Step 1: Write failing tests**

Create `tests/services/blockAttrs.spec.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchSyncPost } from "siyuan";
import { fetchBlockAttrs, writeBlockAttrs } from "@/services/blockAttrs";

const fetchSyncPostMock = vi.mocked(fetchSyncPost);

vi.mock("siyuan", () => ({
  fetchSyncPost: vi.fn(),
}));

describe("blockAttrs service", () => {
  beforeEach(() => {
    fetchSyncPostMock.mockReset();
  });

  it("fetches block attributes", async () => {
    fetchSyncPostMock.mockResolvedValue({ code: 0, msg: "", data: { id: "doc" } });
    await expect(fetchBlockAttrs("doc")).resolves.toEqual({ id: "doc" });
    expect(fetchSyncPostMock).toHaveBeenCalledWith("/api/attr/getBlockAttrs", { id: "doc" });
  });

  it("deletes by writing an empty string", async () => {
    fetchSyncPostMock.mockResolvedValue({ code: 0, msg: "", data: null });
    await writeBlockAttrs("doc", { "custom-old": "" });
    expect(fetchSyncPostMock).toHaveBeenCalledWith("/api/attr/setBlockAttrs", {
      id: "doc",
      attrs: { "custom-old": "" },
    });
  });

  it("throws normalized errors", async () => {
    fetchSyncPostMock.mockResolvedValue({ code: -1, msg: "bad attribute" });
    await expect(writeBlockAttrs("doc", { "custom-x": "1" })).rejects.toThrow("bad attribute");
  });
});
```

- [x] **Step 2: Run the test and confirm failure**

Run:

```bash
npm run test -- tests/services/blockAttrs.spec.ts
```

Expected: FAIL because `src/services/blockAttrs.ts` does not exist.

- [x] **Step 3: Implement the service**

Create `src/services/blockAttrs.ts`:

```ts
import { fetchSyncPost } from "siyuan";
import { assertSiyuanData } from "./siyuanResponse";

export async function fetchBlockAttrs(id: string): Promise<Record<string, string>> {
  const data = assertSiyuanData<Record<string, string>>(
    await fetchSyncPost("/api/attr/getBlockAttrs", { id }),
    "Failed to load block attributes",
  );

  return data;
}

export async function writeBlockAttrs(
  id: string,
  attrs: Record<string, string>,
): Promise<void> {
  await assertSiyuanData<unknown>(
    await fetchSyncPost("/api/attr/setBlockAttrs", { id, attrs }),
    "Failed to save block attributes",
  );
}
```

SiYuan returns `data: null` for a successful `setBlockAttrs`; in that case, change `assertSiyuanData` usage to a dedicated `assertSiyuanSuccess` helper if the Task 2 implementation rejects `null`. The helper must have this exact signature:

```ts
export function assertSiyuanSuccess(response?: IWebSocketData, fallbackMessage = "SiYuan request failed"): void
```

Update the Task 2 tests to cover both `data: null` success and `code !== 0` failure before marking this step complete.

- [x] **Step 4: Run the test**

Run:

```bash
npm run test -- tests/services/blockAttrs.spec.ts
```

Expected: 3 passed.

- [x] **Step 5: Commit**

```bash
git add src/services/blockAttrs.ts src/services/siyuanResponse.ts tests/services/blockAttrs.spec.ts tests/services/siyuanResponse.spec.ts
git commit -m "feat: add document attribute API service"
```

### Task 4: Make panel lifecycle deterministic

**Files:**
- Create: `src/services/panelRegistry.ts`
- Modify: `src/index.ts:1-142`
- Test: `tests/services/panelRegistry.spec.ts`

**Interfaces:**
- Consumes: Vue `App` objects created in `src/index.ts`.
- Produces:
  - `class PanelRegistry`
  - `mount(id: string, app: App<Element>, element: HTMLElement): void`
  - `has(id: string): boolean`
  - `unmount(id: string): boolean`
  - `unmountAll(): void`

- [x] **Step 1: Write failing registry tests**

Create `tests/services/panelRegistry.spec.ts`:

```ts
import { createApp, defineComponent } from "vue";
import { describe, expect, it } from "vitest";
import { PanelRegistry } from "@/services/panelRegistry";

function createTestApp() {
  const element = document.createElement("div");
  document.body.append(element);
  return { app: createApp(defineComponent({ template: "<p>panel</p>" })), element };
}

describe("PanelRegistry", () => {
  it("replaces an existing panel for the same id", () => {
    const registry = new PanelRegistry();
    const first = createTestApp();
    const second = createTestApp();
    first.app.mount(first.element);
    second.app.mount(second.element);

    registry.mount("doc", first.app, first.element);
    registry.mount("doc", second.app, second.element);

    expect(registry.has("doc")).toBe(true);
    expect(first.element.isConnected).toBe(false);
    expect(second.element.isConnected).toBe(true);

    registry.unmountAll();
    expect(second.element.isConnected).toBe(false);
  });
});
```

- [x] **Step 2: Run the test and confirm failure**

Run:

```bash
npm run test -- tests/services/panelRegistry.spec.ts
```

Expected: FAIL because `PanelRegistry` does not exist.

- [x] **Step 3: Implement the registry**

Create `src/services/panelRegistry.ts`:

```ts
import type { App } from "vue";

interface PanelRegistration {
  app: App<Element>;
  element: HTMLElement;
}

export class PanelRegistry {
  readonly #panels = new Map<string, PanelRegistration>();

  has(id: string): boolean {
    return this.#panels.has(id);
  }

  mount(id: string, app: App<Element>, element: HTMLElement): void {
    this.unmount(id);
    this.#panels.set(id, { app, element });
  }

  unmount(id: string): boolean {
    const panel = this.#panels.get(id);
    if (!panel) return false;

    panel.app.unmount();
    panel.element.remove();
    this.#panels.delete(id);
    return true;
  }

  unmountAll(): void {
    for (const id of [...this.#panels.keys()]) {
      this.unmount(id);
    }
  }
}
```

- [x] **Step 4: Refactor the plugin entry**

In `src/index.ts`:

1. Import the registry:

```ts
import { PanelRegistry } from "@/services/panelRegistry";
```

2. Add stable instance fields:

```ts
private readonly panelRegistry = new PanelRegistry();
private readonly handleLoadedProtyle = (event: { detail: { protyle: { block: { id: string } } } }) => {
  this.mountAttributePanel(event.detail.protyle.block.id);
};
```

3. Replace the anonymous callback construction with a private `mountAttributePanel(docId: string)` method. It must keep the existing DOM insertion, Pinia, TDesign context, `provide("$plugin", this)`, and `provide("$docId", docId)` behavior.

4. Use the registry after creating the app:

```ts
this.panelRegistry.mount(docId, app, newDiv);
```

5. If `panelRegistry.has(docId)` returns true and the stored panel element is still connected, return early. If the panel is disconnected, `panelRegistry.mount` replaces it.

6. Change lifecycle registration to use the same stable handler:

```ts
onLayoutReady() {
  this.eventBus.on("loaded-protyle-static", this.handleLoadedProtyle);
}

async onunload() {
  this.eventBus.off("loaded-protyle-static", this.handleLoadedProtyle);
  this.panelRegistry.unmountAll();
}
```

7. Delete the private `createInitEventHandler` method.

- [x] **Step 5: Run focused verification**

Run:

```bash
npm run test -- tests/services/panelRegistry.spec.ts
npm run build
```

Expected: registry tests pass; production build succeeds.

- [x] **Step 6: Verify reload in SiYuan**

Run:

```bash
npm run dev
```

Expected output includes:

```text
[siyuan-auto-reload] reload requested
```

Open a document in SiYuan, then disable and re-enable the plugin. The panel must reappear exactly once and the browser/desktop console must not contain duplicate-mount warnings.

- [x] **Step 7: Commit**

```bash
git add src/index.ts src/services/panelRegistry.ts tests/services/panelRegistry.spec.ts
git commit -m "fix: track and unmount document attribute panels"
```

### Task 5: Make document attribute state reloadable and writable

**Files:**
- Modify: `src/store/attribute.ts:1-180`
- Modify: `src/App.vue`

**Interfaces:**
- Consumes: `fetchBlockAttrs`, `writeBlockAttrs`.
- Produces:
  - `loadDocumentAttributes(): Promise<void>`
  - `setAttribute(key: string, value: string): Promise<void>`
  - `deleteCustomAttribute(key: string): Promise<void>`
  - `readonly isSaving: Ref<boolean>`

- [x] **Step 1: Add store-level tests**

Create `tests/store/attribute.spec.ts`:

```ts
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAttributesStore } from "@/store/attribute";

const fetchBlockAttrs = vi.fn();
const writeBlockAttrs = vi.fn();

vi.mock("@/services/blockAttrs", () => ({
  fetchBlockAttrs: (id: string) => fetchBlockAttrs(id),
  writeBlockAttrs: (id: string, attrs: Record<string, string>) => writeBlockAttrs(id, attrs),
}));

describe("attributes store CRUD", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    fetchBlockAttrs.mockReset();
    writeBlockAttrs.mockReset();
  });

  it("replaces state instead of appending duplicate attributes", async () => {
    fetchBlockAttrs.mockResolvedValue({ id: "doc", "custom-x": "1" });
    const store = useAttributesStore();
    store.documentId = "doc";
    await store.loadDocumentAttributes();
    await store.loadDocumentAttributes();

    expect(store.builtInAttributes.filter((item) => item.key === "custom-x")).toHaveLength(1);
  });

  it("adds a valid custom attribute and refreshes", async () => {
    writeBlockAttrs.mockResolvedValue(undefined);
    fetchBlockAttrs.mockResolvedValue({ id: "doc", "custom-x": "1" });
    const store = useAttributesStore();
    store.documentId = "doc";

    await store.setAttribute("custom-x", "1");

    expect(writeBlockAttrs).toHaveBeenCalledWith("doc", { "custom-x": "1" });
    expect(store.builtInAttributes.some((item) => item.key === "custom-x")).toBe(true);
  });

  it("rejects protected keys on delete", async () => {
    const store = useAttributesStore();
    store.documentId = "doc";
    await expect(store.deleteCustomAttribute("id")).rejects.toThrow("protected");
    expect(writeBlockAttrs).not.toHaveBeenCalled();
  });

  it("deletes custom keys by writing an empty string", async () => {
    writeBlockAttrs.mockResolvedValue(undefined);
    fetchBlockAttrs.mockResolvedValue({ id: "doc" });
    const store = useAttributesStore();
    store.documentId = "doc";

    await store.deleteCustomAttribute("custom-x");

    expect(writeBlockAttrs).toHaveBeenCalledWith("doc", { "custom-x": "" });
  });
});
```

- [x] **Step 2: Run tests and confirm failure**

Run:

```bash
npm run test -- tests/store/attribute.spec.ts
```

Expected: FAIL because `loadDocumentAttributes`, `setAttribute`, and `deleteCustomAttribute` do not exist.

- [x] **Step 3: Implement the store actions**

Replace `fetchInnerAttributes()` with:

```ts
const isSaving = ref(false);

async function loadDocumentAttributes(): Promise<void> {
  const attrs = await fetchBlockAttrs(documentId as string);
  const next: innerAttribute[] = [];

  for (const [attributeName, attributeValue] of Object.entries(attrs)) {
    const rule = matchRules(attributeName);
    if (rule && !rule.display) continue;

    next.push(rule
      ? { ...rule, key: attributeName, value: attributeValue }
      : {
          key: attributeName,
          value: attributeValue,
          name: attributeName,
          displayAs: attributeName.replace(/^custom-/, ""),
          rule: attributeName,
          renderMethod: "input",
          matchMethod: "精确",
          editable: true,
          display: true,
        });
  }

  builtInAttributes.value = next.sort((left, right) => (left.order ?? 999) - (right.order ?? 999));

  if ("custom-avs" in attrs) {
    await loadDatabaseAttributes();
  }
}
```

Rename `fetchDBAttributes()` to:

```ts
async function loadDatabaseAttributes(): Promise<void>
```

It keeps the current conversion behavior but becomes `await`-able. Add these actions:

```ts
const protectedDeleteKeys = new Set([
  "id", "updated", "type", "subtype", "fold", "scroll", "title", "icon", "custom-avs",
]);

function assertCustomKey(key: string): void {
  if (!/^custom-[a-z][a-z0-9-]*$/.test(key)) {
    throw new Error("Attribute key must match custom-[lowercase-name]");
  }
}

async function setAttribute(key: string, value: string): Promise<void> {
  assertCustomKey(key);
  isSaving.value = true;
  try {
    await writeBlockAttrs(documentId as string, { [key]: value });
    await loadDocumentAttributes();
  } finally {
    isSaving.value = false;
  }
}

async function deleteCustomAttribute(key: string): Promise<void> {
  if (protectedDeleteKeys.has(key) || !key.startsWith("custom-")) {
    throw new Error(`Attribute key is protected and cannot be deleted: ${key}`);
  }

  isSaving.value = true;
  try {
    await writeBlockAttrs(documentId as string, { [key]: "" });
    await loadDocumentAttributes();
  } finally {
    isSaving.value = false;
  }
}
```

Export:

```ts
isSaving,
loadDocumentAttributes,
setAttribute,
deleteCustomAttribute,
```

Remove `fetchInnerAttributes` from the store return object.

- [x] **Step 4: Update the app entry**

In `src/App.vue`, replace the fire-and-forget call:

```ts
attributeStore.fetchInnerAttributes();
```

with:

```ts
onMounted(() => {
  void attributeStore.loadDocumentAttributes().catch((error) => {
    MessagePlugin.error(error instanceof Error ? error.message : "加载属性失败");
  });
});
```

Add the corresponding imports for `onMounted` and `MessagePlugin`.

- [x] **Step 5: Run store tests**

Run:

```bash
npm run test -- tests/store/attribute.spec.ts
```

Expected: 4 passed.

- [x] **Step 6: Commit**

```bash
git add src/store/attribute.ts src/App.vue tests/store/attribute.spec.ts
git commit -m "feat: add reloadable document attribute store actions"
```

### Task 6: Enable add/delete UI for custom attributes

**Files:**
- Modify: `src/components/AttributeRowAdd.vue`
- Create: `src/components/AttributeRowActions.vue`
- Modify: `src/components/AttributeRow.vue`
- Modify: `src/components/BuiltInAttrs.vue`
- Modify: `src/components/BaseRow.vue`
- Modify: `src/i18n/zh_CN.json`
- Modify: `src/i18n/en_US.json`

**Interfaces:**
- Consumes: store `setAttribute`, `deleteCustomAttribute`, and `isSaving`.
- Produces:
  - `AttributeRowActions` props: `attributeKey: string`
  - Built-in row template receives an optional `actions` slot.

- [x] **Step 1: Replace the broken add implementation**

Rewrite `AttributeRowAdd.vue` so the form contains:

1. One TDesign input for the attribute key.
2. One TDesign input for the value.
3. One save button.
4. On save, normalize the input, trim it, call `store.setAttribute(key, value)`, and clear the form only after success.
5. On error, call `MessagePlugin.error(error instanceof Error ? error.message : "添加失败")`.

The key validation is the store's validation; the UI must disable save until:

```ts
const canSave = computed(() => /^custom-[a-z][a-z0-9-]*$/.test(key.value.trim()) && value.value.trim().length > 0 && !store.isSaving);
```

- [x] **Step 2: Create row actions**

Create `src/components/AttributeRowActions.vue`:

```vue
<template>
  <t-popconfirm
    :content="i18n.attributes.deleteConfirm"
    @confirm="deleteAttribute"
  >
    <t-button
      :disabled="store.isSaving"
      size="small"
      theme="danger"
      variant="text"
    >
      {{ i18n.attributes.delete }}
    </t-button>
  </t-popconfirm>
</template>

<script setup lang="ts">
import { MessagePlugin } from "tdesign-vue-next";
import { useAttributesStore } from "@/store/attribute";

const props = defineProps<{ attributeKey: string }>();
const store = useAttributesStore();
const i18n = window.siyuan?.languages ?? {};

async function deleteAttribute(): Promise<void> {
  try {
    await store.deleteCustomAttribute(props.attributeKey);
    MessagePlugin.success(i18n.attributes.deleteSuccess ?? "删除成功");
  } catch (error) {
    MessagePlugin.error(error instanceof Error ? error.message : "删除失败");
  }
}
</script>
```

Do not rely on an undefined `window.siyuan.languages.attributes` shape. Add a small `src/services/i18n.ts` getter backed by `plugin.loadI18n()` or the plugin-provided i18n object before implementing this step, and use its returned strings in both locales.

- [x] **Step 3: Add an actions slot**

In `BaseRow.vue`, append after the default slot:

```vue
<slot name="actions" />
```

In `AttributeRow.vue`, pass `props.index` and the current attribute key through the actions slot:

```vue
<template #actions>
  <AttributeRowActions :attribute-key="builtInAttributes[index].key" />
</template>
```

Inside `AttributeRow.vue`, import `AttributeRowActions` and replace the raw `fetchPost` call with:

```ts
await attributeStore.setAttribute(key.value, value.value);
```

`handleSubmit` becomes:

```ts
async function handleSubmit(): Promise<void> {
  try {
    await attributeStore.setAttribute(key.value, value.value);
    MessagePlugin.success("设置成功");
  } catch (error) {
    MessagePlugin.error(error instanceof Error ? error.message : "设置失败");
  }
}
```

Keep built-in non-custom attributes editable when their rule allows it, but `deleteCustomAttribute` remains the only delete path and rejects protected keys.

- [x] **Step 4: Re-enable the add row**

In `BuiltInAttrs.vue`, replace:

```vue
<!-- <AttributeRowAdd /> -->
```

with:

```vue
<AttributeRowAdd />
```

- [x] **Step 5: Add localized strings**

Replace the template-only entries in both i18n files with an `attributes` section:

```json
{
  "attributes": {
    "add": "添加属性",
    "keyPlaceholder": "custom-key",
    "valuePlaceholder": "属性值",
    "save": "保存",
    "saveSuccess": "设置成功",
    "saveFailed": "设置失败",
    "delete": "删除",
    "deleteConfirm": "确认删除该属性？",
    "deleteSuccess": "删除成功",
    "deleteFailed": "删除失败"
  }
}
```

Use equivalent English strings in `en_US.json`.

- [x] **Step 6: Verify CRUD in SiYuan**

Run:

```bash
npm run test
npm run build
npm run dev
```

Manual checks on a disposable test document:

1. Add `custom-test-key` with value `test-value`; the row appears after save.
2. Edit `custom-test-key` to `updated-value`; reload the document and verify persistence.
3. Delete `custom-test-key`; reload the document and verify it is gone.
4. Attempt to delete `id` through the console by calling the store; the promise rejects and no write is sent.
5. Verify the browser/desktop console contains no plugin errors.

- [x] **Step 7: Commit**

```bash
git add src/components src/i18n src/services/i18n.ts tests
git commit -m "feat: complete custom document attribute CRUD"
```

### Task 7: Documentation and sprint release gate

**Files:**
- Modify: `docs/README.md`
- Modify: `docs/README_zh_CN.md`
- Modify: `package.json`

**Interfaces:**
- Consumes: all Sprint 1 implementation tasks.
- Produces: accurate release documentation and an aggregate verification command.

- [x] **Step 1: Add an aggregate verify script**

Update `package.json`:

```json
{
  "scripts": {
    "verify": "npm run typecheck && npm run test && npm run build"
  }
}
```

- [x] **Step 2: Fix stale product claims**

Update both READMEs to state exactly:

1. Document-level custom attributes support add, edit, delete, and refresh.
2. Built-in document attributes are display/filter-governed; protected keys cannot be deleted.
3. Database attributes are display-only until M2 lands.
4. Block-level attributes are not implemented yet.
5. Desktop and browser-desktop are supported; mobile is not supported.

- [x] **Step 3: Run the release gate**

Run:

```bash
npm run verify
```

Expected: typecheck, tests, and production build all pass. `package.zip` must contain `index.js`, `index.css`, `plugin.json`, `i18n/*.json`, `icon.png`, `preview.png`, and both README files.

- [x] **Step 4: Commit**

```bash
git add package.json package-lock.json docs/README.md docs/README_zh_CN.md
git commit -m "docs: update attribute panel feature status"
```

## Next-Milestone Entry Criteria

### M2 Database Attributes

Before implementation, create a separate plan covering:

1. A typed attribute-view model that preserves option IDs instead of option indexes.
2. A `src/services/attributeViews.ts` wrapper for `getAttributeViewKeys` and `setAttributeViewBlockAttr`.
3. Replacement of every `rowID` payload field with `itemID`.
4. A debounced refresh strategy for `loaded-protyle-dynamic`, `switch-protyle`, and relevant SiYuan database change events.
5. Field-by-field edit acceptance tests for text, number, checkbox, select, multi-select, date, date range, URL, and template.

Exit condition: database writes round-trip in a disposable document and stale panel state updates without a full document reload.

### M3 Settings

Before implementation, create a separate plan covering:

1. A typed `PanelSettings` model replacing the unsafe asynchronous initialization in `src/store/rules.ts`.
2. A settings UI for visibility, display name, editability, display order, and reset-to-defaults.
3. A real top-bar/settings entry that replaces the disabled `if (false)` block.
4. Persistence through `plugin.saveData` with versioned defaults and migration-safe loading.

Exit condition: changing settings affects both existing and newly opened panels after plugin reload.

### M4 Block Attributes

Before implementation, create a separate plan covering:

1. A block selection entry point using SiYuan's block context menu.
2. A reusable attribute panel component that accepts a target block ID.
3. Separation of document state from `pageBlockAttributes`.
4. Explicit behavior for container blocks, leaf blocks, and blocks bound to multiple databases.

Exit condition: users can open and edit a block's attributes without leaving the editor.

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Empty string may be mistaken for an intended empty value | SiYuan's kernel defines empty string as deletion; the UI must show delete confirmation before sending it |
| Database option values are currently converted to array indexes | M2 must preserve stable option IDs and reject duplicate option names until normalization is defined |
| SiYuan `rowID` is deprecated and can fail on current kernels | Remove `rowID` from all new database write payloads and use `itemID` |
| Plugin writes can corrupt user data on errors | All writes go through services that check `code`, surface `msg`, and refresh from source before reporting success |
| TypeScript strictness may reveal latent failures when `.vue` typechecking improves | Fix Task 1 typecheck errors before M1 UI work is marked complete; do not weaken global strictness to hide them |
| Existing user rules may not match the new typed settings shape | M3 must version persisted settings and migrate unknown attributes to defaults instead of dropping them |

# Block-Level Attribute Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Open a modal attribute dialog from the SiYuan block menu that reuses the document panel’s CRUD + global rules for an arbitrary block id.

**Architecture:** Keep document title panels on `PanelRegistry` keyed by document id. Add a separate single-slot `BlockDialogHost` that mounts one Vue app into a body overlay, providing `$docId` = target block id and `$panelMode` = `"block"`. AttributePanel hides document-only「字段设置」in block mode. Menu entry via `click-blockicon` (plus low-cost `open-menu-content`).

**Tech Stack:** Vue 3, Pinia, TDesign Vue Next, TypeScript, Vitest, SiYuan EventBus / Menu APIs.

**Spec:** `docs/superpowers/specs/2026-09-19-block-level-attributes-design.md`

## Global Constraints

- Entry label: **属性面板** / **Attribute panel**.
- Primary hook: `click-blockicon`; also wire `open-menu-content` when a block `data-node-id` resolves.
- Reuse `getBlockAttrs` / `setBlockAttrs` via existing store (`$docId` = block id).
- Global rules + `renderMethod` apply; **no** per-block field-settings overrides.
- Hide「字段设置」when `$panelMode === "block"` (avoids writing `custom-mux-attrs-doc-fields` onto leaf blocks).
- At most **one** block dialog; opening another replaces the previous.
- Dialog host must **not** share `PanelRegistry` keys with document panels (a block id can equal the open document id).
- Document title panel behavior unchanged; `settings.showPanel` does not gate the block dialog.
- On dialog close, plugin `onunload`, or opening another block: unmount app and remove DOM (class `mux-block-attr-dialog`).
- `npm run verify` must pass after the final task.

## File map

| File | Responsibility |
|------|----------------|
| `src/services/blockMenu.ts` | Resolve block id from menu events; pure helpers |
| `tests/services/blockMenu.spec.ts` | Unit tests for id resolution |
| `src/services/blockDialogHost.ts` | Single-slot mount/unmount of block dialog Vue app |
| `tests/services/blockDialogHost.spec.ts` | Host replaces previous dialog; cleanup |
| `src/views/BlockAttributeDialog.vue` | Overlay + header (title, copyable id) + AttributePanel + init |
| `src/views/AttributePanel.vue` | Hide field-settings button in block mode |
| `src/index.ts` | Register menu listeners; open/close host; onunload |
| `src/i18n/zh_CN.json`, `src/i18n/en_US.json` | Menu + dialog copy |
| `docs/README_zh_CN.md`, `docs/README.md` | Document block dialog; remove “coming soon” / “尚未实现” |

---

### Task 1: Resolve block id from menu events

**Files:**
- Create: `src/services/blockMenu.ts`
- Create: `tests/services/blockMenu.spec.ts`

**Interfaces:**
- Produces:
  - `resolveBlockIdFromBlockElements(blockElements: Array<HTMLElement | null | undefined>): string | undefined`
  - `resolveBlockIdFromContentTarget(target: EventTarget | null | undefined): string | undefined`
  - Prefer first element with non-empty `dataset.nodeId` (or `getAttribute("data-node-id")`).
  - Content target: walk `closest("[data-node-id]")` from the event target if it is a Node.

- [x] **Step 1: Write the failing test**

Create `tests/services/blockMenu.spec.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  resolveBlockIdFromBlockElements,
  resolveBlockIdFromContentTarget,
} from "@/services/blockMenu";

describe("blockMenu", () => {
  it("takes the first data-node-id from blockElements", () => {
    const a = document.createElement("div");
    a.dataset.nodeId = "20240101120000-aaaaaaa";
    const b = document.createElement("div");
    b.dataset.nodeId = "20240101120000-bbbbbbb";
    expect(resolveBlockIdFromBlockElements([a, b])).toBe("20240101120000-aaaaaaa");
  });

  it("skips empty ids and null entries", () => {
    const empty = document.createElement("div");
    empty.dataset.nodeId = "";
    const ok = document.createElement("div");
    ok.setAttribute("data-node-id", "20240101120000-ccccccc");
    expect(resolveBlockIdFromBlockElements([null, empty, ok])).toBe("20240101120000-ccccccc");
    expect(resolveBlockIdFromBlockElements([])).toBeUndefined();
  });

  it("resolves content target via closest data-node-id", () => {
    const block = document.createElement("div");
    block.dataset.nodeId = "20240101120000-ddddddd";
    const child = document.createElement("span");
    block.append(child);
    document.body.append(block);
    expect(resolveBlockIdFromContentTarget(child)).toBe("20240101120000-ddddddd");
    expect(resolveBlockIdFromContentTarget(null)).toBeUndefined();
    block.remove();
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/services/blockMenu.spec.ts`

Expected: FAIL (module not found)

- [x] **Step 3: Write minimal implementation**

Create `src/services/blockMenu.ts`:

```ts
function readNodeId(el: HTMLElement | null | undefined): string | undefined {
  if (!el) return undefined;
  const id = el.dataset?.nodeId || el.getAttribute?.("data-node-id") || "";
  const trimmed = id.trim();
  return trimmed || undefined;
}

export function resolveBlockIdFromBlockElements(
  blockElements: Array<HTMLElement | null | undefined>,
): string | undefined {
  for (const el of blockElements) {
    const id = readNodeId(el ?? undefined);
    if (id) return id;
  }
  return undefined;
}

export function resolveBlockIdFromContentTarget(
  target: EventTarget | null | undefined,
): string | undefined {
  if (!target || !(target instanceof Node)) return undefined;
  const el = target instanceof Element ? target : target.parentElement;
  const host = el?.closest?.("[data-node-id]") as HTMLElement | null | undefined;
  return readNodeId(host ?? undefined);
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npm run test -- tests/services/blockMenu.spec.ts`

Expected: PASS

- [x] **Step 5: Commit**

```bash
git add src/services/blockMenu.ts tests/services/blockMenu.spec.ts
git commit -m "$(cat <<'EOF'
feat: resolve block ids from SiYuan menu events

EOF
)"
```

---

### Task 2: Single-slot block dialog host

**Files:**
- Create: `src/services/blockDialogHost.ts`
- Create: `tests/services/blockDialogHost.spec.ts`

**Interfaces:**
- Produces:
  - `class BlockDialogHost`
  - `open(create: (host: HTMLElement) => { app: App<Element>; element: HTMLElement }): void` — closes previous, then registers
  - `close(): void`
  - `isOpen(): boolean`
  - Host root class: `mux-block-attr-dialog` appended to `document.body`
- Consumes: Vue `App` unmount + element remove (same cleanup idea as `PanelRegistry`, but one slot and a fixed DOM wrapper)

- [x] **Step 1: Write the failing test**

Create `tests/services/blockDialogHost.spec.ts`:

```ts
import { createApp, defineComponent } from "vue";
import { describe, expect, it } from "vitest";
import { BlockDialogHost } from "@/services/blockDialogHost";

function mountInto(host: HTMLElement) {
  const element = document.createElement("div");
  host.append(element);
  const app = createApp(defineComponent({ template: "<p>block-dialog</p>" }));
  app.mount(element);
  return { app, element };
}

describe("BlockDialogHost", () => {
  it("opens one dialog and replaces the previous", () => {
    const host = new BlockDialogHost();
    host.open(mountInto);
    expect(host.isOpen()).toBe(true);
    expect(document.querySelectorAll(".mux-block-attr-dialog").length).toBe(1);

    const firstRoot = document.querySelector(".mux-block-attr-dialog");
    host.open(mountInto);
    expect(document.querySelectorAll(".mux-block-attr-dialog").length).toBe(1);
    expect(firstRoot?.isConnected).toBe(false);

    host.close();
    expect(host.isOpen()).toBe(false);
    expect(document.querySelector(".mux-block-attr-dialog")).toBeNull();
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/services/blockDialogHost.spec.ts`

Expected: FAIL (module not found)

- [x] **Step 3: Write minimal implementation**

Create `src/services/blockDialogHost.ts`:

```ts
import type { App } from "vue";

interface Registration {
  app: App<Element>;
  element: HTMLElement;
  root: HTMLElement;
}

export class BlockDialogHost {
  #current: Registration | undefined;

  isOpen(): boolean {
    return Boolean(this.#current?.root.isConnected);
  }

  open(create: (host: HTMLElement) => { app: App<Element>; element: HTMLElement }): void {
    this.close();
    const root = document.createElement("div");
    root.className = "mux-block-attr-dialog";
    document.body.append(root);
    const { app, element } = create(root);
    this.#current = { app, element, root };
  }

  close(): void {
    const current = this.#current;
    if (!current) return;
    current.app.unmount();
    current.root.remove();
    this.#current = undefined;
  }
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npm run test -- tests/services/blockDialogHost.spec.ts`

Expected: PASS

- [x] **Step 5: Commit**

```bash
git add src/services/blockDialogHost.ts tests/services/blockDialogHost.spec.ts
git commit -m "$(cat <<'EOF'
feat: add single-slot host for block attribute dialog

EOF
)"
```

---

### Task 3: Block dialog Vue shell + panel mode

**Files:**
- Create: `src/views/BlockAttributeDialog.vue`
- Modify: `src/views/AttributePanel.vue`
- Modify: `src/i18n/zh_CN.json`
- Modify: `src/i18n/en_US.json`

**Interfaces:**
- Consumes: `inject("$docId")`, `inject("$plugin")`, `inject("$panelMode")`, `inject("$closeBlockDialog")`
- Produces: dialog UI; initializes settings + loads attrs (same responsibilities as `App.vue`, without `showPanel` gate and without protyle refresh listeners)
- `AttributePanel`: if `$panelMode === "block"`, do not render the「字段设置」button / `FieldSettingsDialog`

- [x] **Step 1: Add i18n keys**

In `src/i18n/zh_CN.json` add under a new top-level `"blockDialog"` object (and keep existing keys intact):

```json
"blockDialog": {
  "menuLabel": "属性面板",
  "title": "块属性",
  "close": "关闭",
  "copyId": "复制 ID",
  "loadFailed": "加载块属性失败"
}
```

In `src/i18n/en_US.json`:

```json
"blockDialog": {
  "menuLabel": "Attribute panel",
  "title": "Block attributes",
  "close": "Close",
  "copyId": "Copy ID",
  "loadFailed": "Failed to load block attributes"
}
```

- [x] **Step 2: Hide field settings in block mode**

In `src/views/AttributePanel.vue`:

1. `import { inject } from 'vue'`
2. `const panelMode = inject<"document" | "block">("$panelMode", "document");`
3. Wrap the field-settings `t-button` and `FieldSettingsDialog` so they only render when `panelMode !== "block"`:

```vue
<t-button
    v-if="panelMode !== 'block'"
    size="small"
    theme="default"
    variant="text"
    @click="showFieldSettings = true"
>
    ...
</t-button>
...
<FieldSettingsDialog
    v-if="panelMode !== 'block' && showFieldSettings"
    @saved="refreshPanel"
    @close="showFieldSettings = false"
/>
```

- [x] **Step 3: Create `BlockAttributeDialog.vue`**

Create `src/views/BlockAttributeDialog.vue`:

```vue
<template>
    <div class="block-attr-overlay" role="dialog" aria-modal="true" @click.self="close">
        <div class="block-attr-dialog">
            <header class="dialog-header">
                <div class="header-main">
                    <h2>{{ labels.title }}</h2>
                    <code class="block-id">{{ blockId }}</code>
                </div>
                <div class="header-actions">
                    <t-button size="small" variant="text" @click="copyId">{{ labels.copyId }}</t-button>
                    <t-button size="small" variant="text" @click="close">{{ labels.close }}</t-button>
                </div>
            </header>
            <div class="dialog-body">
                <AttributePanel />
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { inject, onMounted, onUnmounted } from "vue";
import { MessagePlugin } from "tdesign-vue-next";
import type { Plugin } from "siyuan";
import AttributePanel from "@/views/AttributePanel.vue";
import { useAttributesStore } from "@/store/attribute";
import { useConfigStore } from "@/store/rules";
import { setI18n, getI18nText } from "@/services/i18n";
import { onSettingsChanged } from "@/services/settingEvents";

const plugin = inject<Plugin>("$plugin");
const blockId = inject<string>("$docId", "");
const closeDialog = inject<() => void>("$closeBlockDialog", () => undefined);
setI18n(plugin?.i18n as Record<string, unknown> | undefined);

const attributeStore = useAttributesStore();
const settingsStore = useConfigStore();
const removeSettingsChangedListener = onSettingsChanged(() => {
    void reloadFromSettings();
});

const labels = {
    title: getI18nText("blockDialog.title", "块属性"),
    close: getI18nText("blockDialog.close", "关闭"),
    copyId: getI18nText("blockDialog.copyId", "复制 ID"),
};

function close(): void {
    closeDialog();
}

async function copyId(): Promise<void> {
    try {
        await navigator.clipboard.writeText(blockId);
        MessagePlugin.success(getI18nText("attributes.copySuccess", "已复制"));
    } catch {
        MessagePlugin.error(getI18nText("attributes.copyFailed", "复制失败"));
    }
}

function refreshAttributes(): void {
    void attributeStore.loadDocumentAttributes().catch((error) => {
        MessagePlugin.error(
            error instanceof Error
                ? error.message
                : getI18nText("blockDialog.loadFailed", "加载块属性失败"),
        );
    });
}

async function reloadFromSettings(): Promise<void> {
    await settingsStore.initialize();
    refreshAttributes();
}

onMounted(() => {
    void settingsStore
        .initialize()
        .then(refreshAttributes)
        .catch((error) => {
            MessagePlugin.error(error instanceof Error ? error.message : "加载设置失败");
        });
});

onUnmounted(() => {
    removeSettingsChangedListener();
});
</script>

<style scoped>
.block-attr-overlay {
    position: fixed;
    inset: 0;
    z-index: 400;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: rgba(0, 0, 0, 0.45);
}

.block-attr-dialog {
    display: flex;
    flex-direction: column;
    width: min(720px, 100%);
    max-height: min(80vh, 900px);
    overflow: hidden;
    border-radius: var(--td-radius-large);
    background: var(--td-bg-color-container);
    box-shadow: var(--td-shadow-3);
}

.dialog-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    padding: 16px 20px;
    border-bottom: 1px solid var(--td-component-stroke);
}

.header-main h2 {
    margin: 0 0 6px;
    font-size: 16px;
}

.block-id {
    display: block;
    color: var(--td-text-color-secondary);
    font-size: 12px;
    word-break: break-all;
}

.header-actions {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
}

.dialog-body {
    overflow: auto;
    padding: 8px 20px 20px;
}
</style>
```

- [x] **Step 4: Typecheck the Vue pieces**

Run: `npm run typecheck`

Expected: PASS (or only pre-existing unrelated errors — fix any introduced by this task)

- [x] **Step 5: Commit**

```bash
git add src/views/BlockAttributeDialog.vue src/views/AttributePanel.vue src/i18n/zh_CN.json src/i18n/en_US.json
git commit -m "$(cat <<'EOF'
feat: add block attribute dialog shell without field overrides

EOF
)"
```

---

### Task 4: Wire block menu entry in the plugin

**Files:**
- Modify: `src/index.ts`

**Interfaces:**
- Consumes: `BlockDialogHost`, `resolveBlockIdFromBlockElements`, `resolveBlockIdFromContentTarget`, `BlockAttributeDialog`
- Produces: menu items on `click-blockicon` and `open-menu-content`; `openBlockAttributeDialog(blockId)`; cleanup on `onunload`

- [x] **Step 1: Implement open helper + menu handlers in `src/index.ts`**

Add imports:

```ts
import BlockAttributeDialog from "./views/BlockAttributeDialog.vue";
import { BlockDialogHost } from "@/services/blockDialogHost";
import {
  resolveBlockIdFromBlockElements,
  resolveBlockIdFromContentTarget,
} from "@/services/blockMenu";
```

Inside the plugin class:

```ts
private readonly blockDialogHost = new BlockDialogHost();

private openBlockAttributeDialog(blockId: string): void {
  const id = blockId.trim();
  if (!id) return;

  this.blockDialogHost.open((host) => {
    const element = document.createElement("div");
    host.append(element);
    const app = createApp(BlockAttributeDialog);
    const pinia = createPinia();
    app.provide("$plugin", this);
    app.provide("$EventBus", this.eventBus);
    app.provide("$docId", id);
    app.provide("$panelMode", "block");
    app.provide("$closeBlockDialog", () => this.blockDialogHost.close());
    app.use(pinia);
    app.mount(element);
    return { app, element };
  });
}

private readonly handleClickBlockIcon = (event: {
  detail: { menu: { addItem: (item: Record<string, unknown>) => void }; blockElements?: HTMLElement[] };
}) => {
  const blockId = resolveBlockIdFromBlockElements(event.detail.blockElements ?? []);
  if (!blockId) return;
  event.detail.menu.addItem({
    icon: "iconAttributePanelSettings",
    label: this.i18n?.blockDialog?.menuLabel ?? "属性面板",
    click: () => this.openBlockAttributeDialog(blockId),
  });
};

private readonly handleOpenMenuContent = (event: {
  detail: {
    menu: { addItem: (item: Record<string, unknown>) => void };
    element?: HTMLElement;
    // some SiYuan builds pass the originating event
    event?: Event;
  };
}) => {
  const fromEl = resolveBlockIdFromContentTarget(event.detail.element ?? null);
  const fromEvent = resolveBlockIdFromContentTarget(event.detail.event?.target ?? null);
  const blockId = fromEl ?? fromEvent;
  if (!blockId) return;
  event.detail.menu.addItem({
    icon: "iconAttributePanelSettings",
    label: this.i18n?.blockDialog?.menuLabel ?? "属性面板",
    click: () => this.openBlockAttributeDialog(blockId),
  });
};
```

In `onLayoutReady`, also register:

```ts
this.eventBus.on("click-blockicon", this.handleClickBlockIcon);
this.eventBus.on("open-menu-content", this.handleOpenMenuContent);
```

In `onunload`, off those listeners and:

```ts
this.blockDialogHost.close();
```

(Keep existing document panel registry cleanup.)

If TypeScript complains about `this.i18n?.blockDialog`, use:

```ts
const i18n = this.i18n as { blockDialog?: { menuLabel?: string } } | undefined;
label: i18n?.blockDialog?.menuLabel ?? "属性面板",
```

- [x] **Step 2: Run typecheck + targeted tests**

Run:

```bash
npm run typecheck
npm run test -- tests/services/blockMenu.spec.ts tests/services/blockDialogHost.spec.ts
```

Expected: PASS

- [x] **Step 3: Commit**

```bash
git add src/index.ts
git commit -m "$(cat <<'EOF'
feat: open block attribute dialog from block menus

EOF
)"
```

---

### Task 5: Docs + verify

**Files:**
- Modify: `docs/README_zh_CN.md`
- Modify: `docs/README.md`

- [x] **Step 1: Update Chinese README**

In `docs/README_zh_CN.md`:

1. Remove or rewrite the「即将推出的功能」bullet that only points at issue #7 as unimplemented — state that **块菜单对话框** is available; keep issue #7 only if still tracking *inline* display as future work.
2. In「插件功能」, replace「块级属性面板尚未实现」with: 从块标菜单（及内容右键菜单）打开对话框，编辑该块的 `custom-*` 属性；使用全局规则；不支持块级字段覆盖。
3. In EventBus / UI notes, mention `click-blockicon` / `open-menu-content` and that the dialog mounts under `.mux-block-attr-dialog`.

- [x] **Step 2: Update English README**

In `docs/README.md`, update the issue #7 bullet so it no longer reads as wholly unimplemented: dialog from block menu is shipped; inline display may remain future work if that was the original issue title.

- [x] **Step 3: Full verify**

Run: `npm run verify`

Expected: typecheck + tests + build all PASS

- [x] **Step 4: Manual smoke (in SiYuan after `npm run build` / reload)**

1. Open a document with the title panel visible; confirm it still works.
2. Click a leaf block’s gutter icon → **属性面板** → dialog shows that block’s attrs.
3. Add `custom-test` with a value; close; reopen → value persists.
4. Open dialog on block A, then block B without closing → only B’s attrs; one `.mux-block-attr-dialog` in DOM.
5. Confirm no「字段设置」button in the block dialog.
6. Close dialog → no leftover `.mux-block-attr-dialog`.

- [x] **Step 5: Commit**

```bash
git add docs/README_zh_CN.md docs/README.md
git commit -m "$(cat <<'EOF'
docs: document block attribute dialog entry points

EOF
)"
```

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| Menu entry 属性面板 / Attribute panel | 4 (+ i18n in 3) |
| `click-blockicon` | 4 |
| Optional `open-menu-content` | 4 |
| Resolve `data-node-id`; skip invalid | 1, 4 |
| Modal dialog + title + copyable id | 3 |
| Reuse list/CRUD/editors | 3 (AttributePanel) |
| Global rules / renderMethod | inherited via store + `$docId` |
| No per-block overrides / hide field settings | 3 |
| One dialog at a time; clean unmount | 2, 4 |
| Document panel unchanged; ignore `showPanel` for dialog | 3, 4 |
| README update | 5 |
| Load/save errors via toast / closeable dialog | 3 |

## Placeholder / consistency review

- No TBD steps; signatures use `$docId` + `$panelMode` + `$closeBlockDialog` consistently across Tasks 3–4.
- Dialog host key is independent of document `PanelRegistry` ids.
- Field-settings deliberately omitted in block mode per phase-1 non-goals.

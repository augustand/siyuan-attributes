# Settings Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persisted, versioned settings panel that controls document/database panel visibility and attribute display, name, editability, and ordering.

**Architecture:** Replace the asynchronous prototype settings store with a typed settings model and a migration-safe persistence service. Keep settings as the single source of truth for display rules, expose explicit store actions for mutation/reset, and use a same-window settings-change event to refresh already-mounted document panels. Mount a real SiYuan settings dialog behind a top-bar button instead of the current disabled prototype block.

**Tech Stack:** Vue 3, Pinia, TDesign Vue Next, SiYuan Plugin `loadData`/`saveData`, TypeScript, Vitest, Vue Test Utils.

**Spec:** `docs/superpowers/plans/2026-09-15-siyuan-attribute-panel-completion.md`, milestone M3; upstream acceptance is [Issue #5](https://github.com/InEase/SiYuan-Attributes-Panel/issues/5).

## Global Constraints

- Persist settings under a new versioned key: `settings-v1`.
- Read legacy `rules` and `configurations` keys for migration, but do not delete them.
- Unknown persisted fields normalize to defaults; unknown persisted rules are preserved.
- Every built-in default rule must remain recoverable through reset-to-defaults.
- Setting changes must survive plugin reload and affect both newly opened panels and already-open panels.
- No API call or state refresh may run before settings initialization completes.
- Settings UI must provide explicit save and reset actions.
- Both Simplified Chinese and English strings must be updated.
- `npm run verify` must pass before M3 is complete.

## File Structure

```text
src/
  models/
    settings.ts            # Panel settings, display rules, defaults, normalizers/migration
  services/
    settings.ts            # load/save/reset through SiYuan plugin data storage
    settingEvents.ts       # Same-window settings-change event helpers
  store/
    rules.ts               # Typed initialized settings store and rule mutations
    attribute.ts           # Waits for settings before loading/matching document attributes
  components/
    DbAttrs.vue            # Applies database display/order/editability rules
  views/
    SettingContent.vue     # Real settings UI
    SettingPage.vue        # Settings page shell
  index.ts                 # Top bar + native settings dialog + unload cleanup
tests/
  models/settings.spec.ts
  services/settings.spec.ts
  store/rules.spec.ts
```

## Settings Contract

```ts
export type DisplayRuleScope = "document" | "database" | "all";
export type DisplayMatchMethod = "exact" | "wildcard" | "regex";

export interface DisplayRule {
  id: string;
  name: string;
  rule: string;
  matchMethod: DisplayMatchMethod;
  scope: DisplayRuleScope;
  display: boolean;
  displayAs: string;
  editable: boolean;
  renderMethod?: "input" | "link" | "datetime" | "tag-input";
  order: number;
  icon?: string;
  system?: boolean;
}

export interface PanelSettings {
  version: 1;
  showPanel: boolean;
  showDocumentPanel: boolean;
  showDatabasePanel: boolean;
  rules: DisplayRule[];
}
```

Legacy migration:

```text
settings-v1 missing:
  rules <= legacy key "rules" (normalize old Chinese matchMethod values)
  showPanel/showDocumentPanel <= legacy configurations.show
  showDatabasePanel <= legacy configurations.showSettings.page
  write settings-v1

settings-v1 present:
  normalize and preserve unknown rules
  add any missing new default system rules
```

## Task 1: Typed settings model and migration

**Files:**
- Create: `src/models/settings.ts`
- Test: `tests/models/settings.spec.ts`

**Interfaces:**

```ts
export const DEFAULT_PANEL_SETTINGS: PanelSettings;
export function normalizePanelSettings(input: unknown): PanelSettings;
export function normalizeLegacySettings(input: {
  settings?: unknown;
  legacyRules?: unknown;
  legacyConfigurations?: unknown;
}): PanelSettings;
export function matchDisplayRule(rule: DisplayRule, name: string): boolean;
export function compareDisplayRules(left: DisplayRule, right: DisplayRule): number;
```

- [ ] Normalize old `"精确" | "通配符" | "正则"` to `"exact" | "wildcard" | "regex"`.
- [ ] Implement wildcard matching with `*` converted to a safely escaped anchored regex.
- [ ] Implement regex matching without throwing on invalid expressions; invalid regex never matches.
- [ ] Sort by `order`, then stable rule id.
- [ ] Preserve unknown persisted rules and append missing default system rules.

### Task 2: Versioned persistence service

**Files:**
- Create: `src/services/settings.ts`
- Test: `tests/services/settings.spec.ts`

**Interfaces:**

```ts
interface PluginDataStore {
  loadData(storageName: string): Promise<any>;
  saveData(storageName: string, content: any): Promise<unknown>;
}

export async function loadPanelSettings(store: PluginDataStore): Promise<PanelSettings>;
export async function savePanelSettings(store: PluginDataStore, settings: PanelSettings): Promise<void>;
export async function resetPanelSettings(store: PluginDataStore): Promise<PanelSettings>;
```

- [ ] Read `settings-v1`, then migrate legacy `rules` and `configurations` when missing.
- [ ] Save normalized versioned settings after migration.
- [ ] Reset saves and returns `DEFAULT_PANEL_SETTINGS`.
- [ ] Surface API errors instead of silently using defaults after initialization.

### Task 3: Typed settings store and refresh event

**Files:**
- Modify: `src/store/rules.ts`
- Create: `src/services/settingEvents.ts`

**Interfaces:**

```ts
initialize(): Promise<void>;
isReady: Ref<boolean>;
settings: Ref<PanelSettings>;
updateSettings(next: PanelSettings): Promise<void>;
updateRule(id: string, patch: Partial<DisplayRule>): Promise<void>;
addRule(rule: DisplayRule): Promise<void>;
removeRule(id: string): Promise<void>;
moveRule(id: string, direction: -1 | 1): Promise<void>;
resetSettings(): Promise<void>;
applyDatabaseRules(fields: DatabaseField[]): DatabaseField[];
```

**Events:**

```ts
export const SETTINGS_CHANGED_EVENT = "mux-attribute-panel:settings-changed";
export function emitSettingsChanged(): void;
export function onSettingsChanged(listener: () => void): () => void;
```

- [ ] Load settings through the persistence service.
- [ ] Save normalized settings on every mutation, then emit the same-window change event.
- [ ] Provide `applyDatabaseRules` for filtering, renaming, editability, and ordering.
- [ ] Clean up the event listener returned by `onSettingsChanged`.

### Task 4: Apply settings to panels

**Files:**
- Modify: `src/App.vue`
- Modify: `src/store/attribute.ts`
- Modify: `src/components/DbAttrs.vue`

**Interfaces:**

```ts
const settingsStore = useConfigStore();
await settingsStore.initialize();
await attributeStore.loadDocumentAttributes();
```

- [ ] Hide the whole panel when `showPanel` is false.
- [ ] Hide document/database tab content according to scoped settings.
- [ ] Load document attributes only after settings initialize.
- [ ] Apply display name, visibility, editability, and order from matching document rules.
- [ ] Apply database field rules through `applyDatabaseRules`.
- [ ] On `SETTINGS_CHANGED_EVENT`, reload settings and attributes without reloading the whole page.

### Task 5: Build settings UI

**Files:**
- Modify: `src/views/SettingContent.vue`
- Modify: `src/views/SettingPage.vue`

**UI requirements:**

- General section:
  - show panel
  - show document panel
  - show database panel
- Rules section:
  - display
  - display name
  - editable
  - order
  - scope
  - match method
  - match expression
  - move up/down
  - delete rule
  - add rule
- Footer actions:
  - Save
  - Reset defaults
- Show saving state and success/error messages.

- [ ] The UI does not write until Save is clicked.
- [ ] Reset confirms before replacing local edits.
- [ ] Save calls `updateSettings`, emits the refresh event, and shows success/error state.

### Task 6: Register a real settings entry

**Files:**
- Modify: `src/index.ts`

**Interfaces:**

```ts
private settingApp?: App<Element>;
```

- [ ] Register a custom settings icon and top-bar button during `onload`.
- [ ] Mount `SettingPage` into a native SiYuan `Setting` dialog with its own Pinia instance and `$plugin`.
- [ ] Remove the disabled `if (false)` prototype block.
- [ ] Use the built-in `Plugin.openSetting()` entry from the top bar.
- [ ] Unmount the settings app during `onunload`.

### Task 7: Localization and release gate

**Files:**
- Modify: `src/i18n/zh_CN.json`
- Modify: `src/i18n/en_US.json`
- Modify: `docs/README.md`
- Modify: `docs/README_zh_CN.md`

- [ ] Add all settings strings in both locales.
- [ ] Remove stale “目前没有任何设置项” wording.
- [ ] Run:

```bash
npm run verify
```

Expected: typecheck, tests, and production build pass.

## Runtime Acceptance

1. The plugin top bar opens a settings dialog.
2. Changing a document rule name/order affects an already-open document panel after Save.
3. Changing a database rule affects an already-open database panel after Save.
4. Disabling the whole panel hides it after Save.
5. Reload SiYuan or disable/re-enable the plugin; persisted settings survive.
6. Reset defaults restores the initial panel behavior and persisted data.
7. Console contains no settings initialization or plugin unload errors.

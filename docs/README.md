## Database Properties Panel<sup>SiYuan-Attribute-Panel</sup>

This version centers on SiYuan’s built-in **database (Attribute View)**: show and edit fields for the current document under the title.

Editing document `custom-*` attributes, global match rules, and the block-level custom dialog is **paused** (code kept, not mounted at runtime).

### Features

1. Under-title database properties panel; read/write common types (text, number, select/multi-select, date, checkbox, url, …)
2. Tabs when a document belongs to multiple databases
3. Per-database column visibility, hide-empty, hide-primary-key (plugin settings)
4. Plugin settings: show panel, default hide primary key, default hide empty
5. Dark mode

Documents not bound to any database show an empty-state hint. Relation / asset / template / rollup are display-only in this phase.

### Compatibility

Developed against SiYuan v3.8.x. Requires `/api/av/getAttributeViewKeys` and `/api/av/setAttributeViewBlockAttr` (`itemID`). Mobile is not supported yet.

### Data security

APIs used:

1. `/api/av/getAttributeViewKeys`
2. `/api/av/setAttributeViewBlockAttr`
3. EventBus: `loaded-protyle-static` / `loaded-protyle-dynamic` / `switch-protyle` / `destroy-protyle`

Settings persist via `plugin.loadData` / `saveData`. Fully local; no network.

If another database properties panel plugin is installed, two under-title panels may appear—turn this one off in settings if needed.

### Feedback

Use [GitHub Issues](https://github.com/InEase/SiYuan-Attributes-Panel/issues).

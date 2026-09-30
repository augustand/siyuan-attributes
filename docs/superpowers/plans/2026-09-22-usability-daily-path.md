# 易用性第 1 刀 Implementation Plan

> **For agentic workers:** Execute task-by-task. Spec: `docs/superpowers/specs/2026-09-22-usability-daily-path-design.md`

**Goal:** Dock 当前文档优先；导入进「更多」；无库引导新建；成功文案；设置页帮助文案。

**Tech:** Vue 3 `DocDatabaseDock.vue`, `SettingContent.vue`, i18n zh/en.

## Task 1: Restructure DocDatabaseDock

**Files:** `src/views/DocDatabaseDock.vue`, i18n if keys added

- [ ] Reorder template: current doc section first, ours second  
- [ ] Wrap register + collectPage in collapsible「更多」  
- [ ] When `!ownedDatabases.length`, primary button label「先新建库」→ open create dialog  
- [ ] On bind success toast: mention 标题下原生属性；keep refreshBound  
- [ ] Update empty/help strings  

## Task 2: Settings copy only

**Files:** `src/views/SettingContent.vue`, `src/i18n/zh_CN.json`, `src/i18n/en_US.json`

- [ ] Point daily add flow to Dock  

## Task 3: Verify

- [ ] `npm run typecheck` && relevant tests  
- [ ] `vite build --watch` into `dev/` + reloadUI  

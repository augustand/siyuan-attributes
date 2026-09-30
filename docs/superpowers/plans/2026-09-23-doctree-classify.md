# 文档旁归类 Implementation Plan

> Spec: `docs/superpowers/specs/2026-09-23-doctree-classify-design.md`

**Goal:** Doctree right-click「标为任务/项目/产品」→ hang to per-type primary DB; Dock stays create/list/repair.

## Tasks

- [x] Settings `ownedDbPrimaryByType` + normalize
- [x] `pickPrimaryDatabaseForType` + tests
- [x] `hangDocToType` + doctree menu items
- [x] Create/hang sets primary; create-from-classify auto-hangs pending doc
- [x] i18n zh/en menuMark* / guide / createOk
- [x] Typecheck, test, reload

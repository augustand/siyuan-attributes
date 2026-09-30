# 刀5 i18n 补齐 + 选库搜索 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** 消除 i18n 双真源(引用但缺失 / 漂移 / 硬编码 / 死键),并给 AddToDatabaseDialog 加关键字搜索。

**Architecture:** 先建 `scripts/check-i18n.mjs` 作为唯一事实源扫描器(引用提取含直接调用与疑似键字符串两类),按其报告补齐/对齐/删除;选库对话框内加组件内存态过滤。

**Tech Stack:** Node ESM 脚本(零依赖)、Vue 3、Vitest

**Spec:** `docs/superpowers/specs/2026-09-29-usability-i18n-picker-search-design.md`

## Global Constraints

- 中文文案 = 代码兜底原文;英文给可用译文
- 不移除休眠 `docDatabaseRules` 机制;死键删除仅限脚本确认 + `grep` 全源无引用者
- `npm run verify` 为验收链;现有测试不回归

---

### Task 1: i18n 扫描脚本 + verify 接入

**Files:**
- Create: `scripts/check-i18n.mjs`
- Modify: `package.json`(scripts)

**Interfaces:**
- Produces: `npm run check:i18n` → 退出码:缺失=1,仅无引用告警=0;stdout 输出 `MISSING` / `UNREFERENCED` 清单

- [x] **Step 1:** 写脚本——遍历 `src/**/*.{ts,vue}` 提取两类"引用":(a) `getI18nText\(\s*"([^"]+)"` 直接调用;(b) 所有字符串字面量中形如 `<顶层段>.<…>` 的疑似键路径(防 nameKey 等间接引用漏报)。收集 zh_CN.json / en_US.json 全路径键集。缺失 = 引用了但任一语言包没有 → 列出并 exit 1;无引用 = 语言包有但零引用 → 列出(告警,不失败)。

- [x] **Step 2:** `package.json` scripts 加 `"check:i18n": "node scripts/check-i18n.mjs"`,`verify` 前置追加。

- [x] **Step 3:** `npm run check:i18n` → 记录完整 MISSING 清单(应含已知 26 个 ownedDb 键)与 UNREFERENCED 候选。

### Task 2: 补 26 键 + 对齐漂移 + 拆 createOk

**Files:**
- Modify: `src/i18n/zh_CN.json`, `src/i18n/en_US.json`
- Modify: `src/views/DocDatabaseDock.vue`(仅 createOk 插值调用点)

**Interfaces:**
- Produces: 新键 `ownedDb.createOkName`(值含 `{name}` 占位,调用点 `.replace("{name}", db.name)`)

- [x] **Step 1:** zh_CN.json `ownedDb` 补 26 键,中文取代码兜底原文(addEmpty/addTitle/addTo/allCollected/already/alreadyBound/collect/collectPage/collected/collectedN/current/exists/needDoc/noDoc/noHits/noneOnPage/notBound/ours/oursEmpty/register/registerTitle/remove/search/searchPh/unbind/unbindOk)。`collected`/`collectedN` 兜底含插值 → 值写成含 `{name}`/`{n}` 占位,调用点改为 `getI18nText(...).replace(...)`。

- [x] **Step 2:** en_US.json 同步 26 键英文(`"Our libraries"`, `"Add to database…"`, `"No matching databases"` 等)。

- [x] **Step 3:** 漂移对齐:`ownedDb.dbNamePh` zh 改 `例如：本周任务`(en 同步语义);`createOk` 拆键——静态调用点保留 `createOk`,插值调用点改用 `createOkName`,JSON 增 `createOkName`(zh `已创建「{name}」` / en `"Created \"{name}\""`)。

- [x] **Step 4:** `npm run check:i18n` → MISSING 中 ownedDb 归零;新增键无 UNREFERENCED 误报。

### Task 3: 剩余缺失 + 硬编码 + 死键清理

**Files:**
- Modify: `src/i18n/zh_CN.json`, `src/i18n/en_US.json`
- Modify: `src/index.ts:48,193,206`

- [x] **Step 1:** 按 Task 1 报告补齐 ownedDb 之外的缺失键(如 `close` 等),zh 取兜底、en 给译文。

- [x] **Step 2:** `index.ts` 三处 `title: "文档数据库"` 改 `title: getI18nText("docDatabase.title", "文档数据库")`,两份语言包顶层(或就近段)增 `docDatabase.title`(zh `文档数据库` / en `"Doc Databases"`)。

- [x] **Step 3:** UNREFERENCED 候选逐个 `grep -rn "<key>" src/` 确认(排除同名子串),确认者从两份语言包删除;存疑者保留。

- [x] **Step 4:** `npm run check:i18n` → MISSING=0;UNREFERENCED 清空或仅剩存疑项(在脚本输出里可见)。

### Task 4: 选库对话框搜索

**Files:**
- Modify: `src/components/AddToDatabaseDialog.vue`

**Interfaces:**
- Consumes: `displayOwnedDatabaseName(db)`(`@/models/ownedDatabaseHang`)、`DATABASE_TYPES` / 类型标签(nameKey → `getI18nText`)

- [x] **Step 1:** `keyword = ref("")`;列表 `databases` → `filtered = computed(...)`:空关键字全量;否则 `displayOwnedDatabaseName(db)` 或类型标签包含关键字(不区分大小写)。模板在列表上方加 `t-input`(clearable,`v-if="databases.length"`,placeholder 复用 `ownedDb.searchPh`);`filtered.length===0` 显示 `ownedDb.noHits` 空态;`v-for` 改遍历 `filtered`。

- [x] **Step 2:** `npm run typecheck && npm run test`;对话框既有测试(若有)不回归。

### Task 5: 总验证

- [x] `npm run verify`(typecheck + test + build + check:i18n)全绿。

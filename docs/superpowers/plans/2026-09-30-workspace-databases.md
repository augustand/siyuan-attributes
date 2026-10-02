# 工作区全部数据库 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. 刀1 → 刀2 顺序执行,每刀验证三件套。

**Goal:** 全库发现服务 + Dock/设置两处全库视图(采纳/只读)+ 互斥挂接收敛到表格集合。

**Architecture:** 刀1 只动 services/models + 测试(migrate 解绑交集、workspaceDatabase 分类);刀2 UI 消费(Dock 开关、设置 section、i18n)。

**Tech Stack:** Vue 3 + TDesign、Vitest、思源 `/api/av/*` `/api/file/*`

**Spec:** `docs/superpowers/specs/2026-09-30-workspace-databases-design.md`

## Global Constraints

- 只读枚举,不删任何库;孤儿无采纳按钮
- 内核响应坑:readDir 的 data 是数组;getFile 对 av 文件返回裸文件体;getUnusedAttributeViews 形状实现时先实测
- i18n 两包同步,`node scripts/check-i18n.mjs` 退出 0;每刀 `npm run typecheck && npm run test` 全绿(基线 186)
- 不 commit;编辑后 grep -n 验证落点;结构编辑用 python3 断言替换

---

## 刀1:服务 + 互斥收敛(TDD)

**Files:** Create `src/services/workspaceDatabase.ts`、`tests/services/workspaceDatabase.spec.ts`;Modify `src/services/ownedDatabaseMigrate.ts`、`tests/services/ownedDatabaseMigrate.spec.ts`、`src/services/doctreeClassify.ts`、`tests/services/doctreeClassify.spec.ts`

**Produces(刀2 消费):**
```ts
export type WorkspaceDbOrigin = "managed" | "collected" | "active" | "orphan";
export interface WorkspaceDatabaseEntry { avID: string; name: string; hostPath?: string; origin: WorkspaceDbOrigin; health: "ok" | "broken" | "missing"; }
export async function listWorkspaceDatabases(input: { owned: OwnedDatabase[] }): Promise<WorkspaceDatabaseEntry[]>;
```
- [ ] migrate 交集(TDD 先红):`migrateDocumentToOwnedDatabase` 解绑循环在 `ownedAvIDs` 提供时只解绑 `currentlyBound ∩ ownedAvIDs`(target 除外);未提供保持现行为。`joinTableByKey` 调 migrate 前加载目录并传 avID 集。更新两个 spec 文件断言(新增"原生绑定不被拆"用例)
- [ ] `listWorkspaceDatabases`:readDir(data=数组)全量 avID → searchAttributeView("") 命中(hostPath)→ getMirrorDatabaseBlocks 逐 ID 健康 → 目录分类(managed/collected,含 name 用目录名)→ 未收录:有引用=active,无引用=orphan;`getUnusedAttributeViews` 仅用于给孤儿补名字(形状实测后解析,解析失败静默跳过命名)。并发健康探测(小量 ID,Promise.all)
- [ ] 单测:mock 内核四端点(readDir 数组形状、搜索命中、mirror 有/无引用、unused 名单),覆盖四类分类、目录名优先、孤儿命名、健康标注;先红后绿
- [ ] 验证三件套

## 刀2:Dock 开关 + 设置页 section + i18n

**Files:** Modify `src/views/DocDatabaseDock.vue`、`src/views/SettingContent.vue`、两 i18n 包

- [x] Dock:「表格」标题行加「工作区」切换按钮(`showWorkspace` ref,默认关);开 → 目录列表区替换为全库列表(四类分组头 + 行:名字(hostPath 副行)+ 来源徽标 + 健康徽标;active 行「采纳」按钮 → `ownedFromSearchHit` 需 blockID——服务条目带 blockID 则传,无则降级搜索补齐;采纳后回目录视图 + refreshHealth + toast adoptOk;orphan 行无按钮,副行显示 avID + orphanHint)
- [x] 服务条目补充 `blockID?`/`source`: active 命中来自搜索结果(带 blockID);managed/collected 带目录对象引用以便复用行动作(文档/打开/补齐列/移除照旧)
- [x] 设置页:「工作区全部数据库」section(目录 section 之下):筛选 chips(全部/未收录/孤儿)+ 同样行渲染 + 采纳;managed/collected 行显示「在目录中」
- [x] i18n 两包新增:`workspaceAll`(工作区全部数据库/All workspace databases)、`showWorkspace`(工作区/Workspace)、`showCatalog`(表格目录/My tables)、`originManaged`(托管/Managed)、`originCollected`(已收录/Adopted)、`originActive`(未收录/Not adopted)、`originOrphan`(孤儿/Orphaned)、`adopt`(采纳/Adopt)、`adoptOk`(已采纳「{name}」/Adopted "{name}")、`orphanHint`(无引用的孤儿库;本插件暂不提供删除/Orphaned (unreferenced); deletion not provided)、`wsFilterAll`(全部/All)、`wsFilterActive`(未收录/Not adopted)、`wsFilterOrphan`(孤儿/Orphaned)
- [x] 验证三件套 + `npm run verify` 全链 + build

---

## 刀3:管理动作(打开宿主 + 孤儿批量删除)

**日期:** 2026-09-30。用户明确要求孤儿可删除,**取代**刀1/刀2 的「孤儿只标记不删」决策。

**Files:** Modify `src/services/workspaceDatabase.ts`、`tests/services/workspaceDatabase.spec.ts`、`src/views/DocDatabaseDock.vue`、`src/views/SettingContent.vue`、两 i18n 包

- [ ] 服务:`WorkspaceDatabaseEntry` 增加 `hostDocID?` —— 收集搜索命中 blockID,`/api/query/sql`(SELECT id, root_id FROM blocks WHERE id IN …,每批 50)解析 root_id,条目 blockID 命中即带 hostDocID;SQL 失败静默降级(无 hostDocID);孤儿/未见条目无 blockID 恒为 undefined。新增 `removeOrphanDatabase(avID)` —— POST `/api/av/removeUnusedAttributeView` {id}(单一版;**绝不可用**复数版 removeUnusedAttributeViews,那会删光全工作区未用库),assertSiyuanData 断言 code===0
- [ ] TDD:spec 增 `/api/query/sql` mock;用例:hostDocID 解析(含索引缺块无 hostDocID)、50 条分批(51 命中 → 2 次 SQL)、SQL 失败静默降级、removeOrphanDatabase 成功/内核报错拒绝/请求抛错拒绝;先红后绿
- [ ] Dock(工作区态):未收录(active)行加「打开宿主」(ownedDb.openHost,无 hostDocID 隐藏)与「采纳」并存;孤儿行前置 t-checkbox(`wsOrphanSelected` Set),选中非空时孤儿组头出现危险按钮「删除选中(N)」→ DialogPlugin.confirm(orphanDeleteConfirmBody,{n} 替换、注明不可恢复)→ 确认后顺序逐个 removeOrphanDatabase(单个失败不中断,收集失败数)→ orphanDeleteOk + (失败时) orphanDeletePartial 错误 toast → 清空选择 → refreshWorkspace();切回目录态清空选择
- [ ] 设置页:工作区 section 镜像两处 —— active 行「打开宿主」;孤儿卡片勾选 + ws-head 处「删除选中(N)」同款确认/逐删/ toasted;删除后本地 refreshWorkspace
- [ ] i18n 两包 ownedDb 新增:openHost(打开宿主/Open host)、orphanDelete(删除选中/Delete selected)、orphanDeleteConfirmTitle(删除孤儿库/Delete orphaned databases)、orphanDeleteConfirmBody(将永久删除 {n} 个孤儿数据库及其数据，不可恢复。/This permanently deletes {n} orphaned databases and their data. This cannot be undone.)、orphanDeleteOk(已删除 {n} 个/{n} deleted)、orphanDeletePartial({n} 个删除失败/{n} failed);orphanHint 文案同步去掉「暂不提供删除」旧承诺;check-i18n 退出 0
- [ ] 验证:typecheck / test(208 通过)/ check-i18n / verify 全链通过

---

## 刀4:全库默认视图 + 数据库级删除(内核 3.8.6 实测收敛)

**日期:** 2026-09-30。用户升级到 3.8.6 后实测:内核未用库原语全部失效 —— `getUnusedAttributeViews` 恒返回 `[]`(死原语)、`removeUnusedAttributeView` 拒绝一切("attribute view is not unused")。用户指令:「我们只管理数据库,文档不关心」「上来就能看到所有的数据库,然后对数据库进行管理」。

**Files:** Modify `src/services/workspaceDatabase.ts`、`tests/services/workspaceDatabase.spec.ts`、`src/views/DocDatabaseDock.vue`、`src/views/SettingContent.vue`、两 i18n 包

- [x] 服务分类重做:删 `fetchUnusedNames` / `fetchFreshUnusedAvIDs` / `removeOrphanDatabase`(死原语);origin `"orphan"` → `"unreferenced"`,语义 = readDir 磁盘文件 − 搜索命中 − 目录(文件确凿存在,health 按既有约定仍为 "missing");`searchAttributeView("")` 实测与 blocks 表 type='av' 计数完全一致,作为"在用"唯一判定
- [x] 新增 `removeDatabaseCompletely({avID, blockID?})`:有 blockID 先 `/api/block/deleteBlock`(任何失败忽略,继续),再 `/api/file/removeFile /data/storage/av/<avID>.json`(code 0 与 code 404 均算成功,其余非零抛内核 msg);全程 raw fetch(fetchSyncPost 会自己 toast)
- [x] Dock:`showWorkspace` 默认 true(上来就是全库视图,挂载即加载);新建按钮两种视图都显示;勾选 + 「删除选中」覆盖未收录(active)与无引用(unreferenced)两组;批量删除走 removeDatabaseCompletely(条目带 blockID),无 fresh-unused 预筛、无 skipped 分类
- [x] 设置页镜像:同款勾选 + 批量删除;筛选 chips 全部/未收录/无引用(内部值 "unreferenced")
- [x] i18n 两包(键名不变改值):originOrphan=无引用/Unreferenced、orphanHint=无引用的数据库，未被任何文档使用、orphanDeleteConfirmBody=将永久删除选中数据库的数据；被文档引用的会一并移除其嵌入块。不可恢复。、wsFilterOrphan=无引用;删除已无引用的 orphanDeleteSkipped 键;check-i18n 退出 0
- [x] 验证:typecheck / test 209 通过(基线 211,删旧原语测试 −21、新增 +19)/ check-i18n / verify 全链

---

## Spec coverage

| Spec 目标 | 刀 |
|---|---|
| 全量发现/四类分类/形状坑 | 1(刀4:分类改三来源,unused 原语移除) |
| 互斥收敛 + 回归测试 | 1 |
| Dock 开关 + 设置 section + 采纳 | 2(刀4:工作区改为默认视图) |
| 孤儿只标记 | 2(刀3 改为可勾选批量删除;刀4 数据库级直删) |
| 打开宿主 + 孤儿批量删除 | 3(刀4:改走 removeFile,内核 unused 校验绕过) |

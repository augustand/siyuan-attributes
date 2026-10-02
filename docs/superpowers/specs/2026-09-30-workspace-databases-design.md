# 工作区全部数据库管理(全库视图)

**日期:** 2026-09-30
**状态:** 已批准(对话:两处都要 + 孤儿只标记不删 +「互斥收敛」无异议)
**前置:** 文档表格重定位已合并 main(6c5bc26)

## 问题

插件目前只管理自己目录内的表格;用户工作区还有大量原生数据库(日记内嵌库、联系人库等)和 **56 个孤儿库**(无任何引用的历史垃圾)。用户要求对所有数据库可管理、可治理。另有一个隐患:互斥挂接会解绑文档上**所有**已有绑定,包括用户原生加的库。

## 目标

1. **全量发现(只读)**:`readDir /data/storage/av/` 全量枚举 ⊕ `searchAttributeView("")` 定位在用库宿主路径 ⊕ `getMirrorDatabaseBlocks` 健康 ⊕ 目录归属 → 四类:**托管(managed)/ 已收录(collected)/ 在用未收录(active)/ 孤儿(orphan)**。孤儿名单辅助参考内核官方 `getUnusedAttributeViews`。
2. **两处全库视图(同一服务层)**:
   - Dock「表格」区:开关切换「目录 / 工作区」;工作区态按四类分组,未收录行带「采纳」;孤儿行显示名字 + avID +「暂不提供删除」提示
   - 设置页:「工作区全部数据库」新 section,同样数据,筛选(全部/未收录/孤儿),managed/collected 行标「在目录中」
3. **采纳(collected)**:在用未收录库一键入目录(复用 `ownedFromSearchHit`,`source:"collected"`),获得改名/补列/筛文档/挂接全套能力;**孤儿与缺宿主路径的库不提供采纳**(镜像不健康,挂接无意义)
4. **互斥收敛(修隐患)**:`migrateDocumentToOwnedDatabase` 解绑范围 = 现有绑定 ∩ 表格集合(`ownedAvIDs`);不再触碰用户原生绑定。`joinTableByKey` 必须传目录 avID 集
5. **孤儿只标记**:不提供删除(用户明确选择);行内提示 avID 便于用户自行处理

## 非目标

- 删除孤儿库(内核 `removeUnusedAttributeViews` 留待用户明确要求的后续刀)
- 未收录库的改名/补列/挂接(采纳后才可);内核本无改名 API
- 跨库联合查询;移动端

## 方案要点

- 新服务 `src/services/workspaceDatabase.ts`:
  ```ts
  export type WorkspaceDbOrigin = "managed" | "collected" | "active" | "orphan";
  export interface WorkspaceDatabaseEntry { avID: string; name: string; hostPath?: string; origin: WorkspaceDbOrigin; health: "ok"|"broken"|"missing"; }
  export async function listWorkspaceDatabases(input: { owned: OwnedDatabase[] }): Promise<WorkspaceDatabaseEntry[]>;
  ```
  - readDir 的 `data` 是**数组**(非对象);getFile 对 av 文件返回**裸文件体**(已踩过,勿再踩)
  - `getUnusedAttributeViews` 返回结构以实现时实测为准(探查显示字段名与直觉不符),实现者须先打内核确认形状再写解析
  - 分类:目录命中(managed/collected)→ 搜索命中(active,带 hostPath)→ 镜像有引用(active,host 未知)→ 无引用(orphan);全量并集 = readDir ∪ 搜索 ∪ 目录
- 采纳动作:`ensureOwnedDatabaseTemplateColumns` 不跑(未收录库不补列);入目录后走既有 collected 全套
- 互斥:`migrateDocumentToOwnedDatabase` 的解绑循环改为 `ownedAvIDs` 提供时取交集;未提供时保持现行为;`joinTableByKey` 补传目录集
- i18n 两包:workspaceAll、originManaged/originCollected/originActive/originOrphan、adopt/adoptOk、orphanHint、showWorkspace/showCatalog 等;`check-i18n` 退出 0

## 成功标准

1. 全库视图正确显示用户工作区:7 个在用库(含日记内嵌)+ 56 孤儿 + 3 托管,分类无误
2. 未收录库采纳后出现在目录,可改名/挂接/筛文档;孤儿无采纳按钮
3. 文档同时绑定原生库 + 表格时,加入表格**不再**拆掉原生绑定(回归测试锁定)
4. `npm run verify` 全绿,不回归(现 186 测试)

## Spec 自检

- [x] 两处视图共享服务层;孤儿只标记不删已写入非目标
- [x] 内核响应形状两处已知坑(数组 data / 裸文件体)显式标注;unused 列表形状标注为实现时实测
- [x] 互斥收敛含回归测试要求
- [x] 成功标准可验证

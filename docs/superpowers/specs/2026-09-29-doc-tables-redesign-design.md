# 文档表格重定位:默认表格库 + 统一管理

**日期:** 2026-09-29
**状态:** 已批准(对话:方向 OK + 管理面补充 OK +「好的,继续吧」)
**分支:** `feat/database-centric-panel`
**前置:** 类型分组管理台、列表管理刀、查询刀均已交付

## 问题(用户原话归纳)

1. 库类型(任务/项目/产品)像标签,不重要;围绕类型建的类型分组、主库、文档树「标为××」整套前提错了。
2. 之前生成的库没有名字(种子 AV `name:""` + 改名写文件被内核内存态覆盖),模板字段(状态/优先级/负责人)是团队协作味,个人用不上。用户要的是**一批默认表格模板拿来就用**,不想手动建库。
3. 真实心智:**利用思源数据库做表格,每行记录对应一篇文档**(现有绑定机制天然如此,行主键=文档,点击跳转)。

## 目标

1. 概念重定位:「我们的库」→**「表格」**;数据库=表格,行=文档。类型全面降级为兼容数据字段。
2. 内置**三张默认表格模板**,一键生成(自动命名、自动推断笔记本),拿来就用:

   | 模板 key | 表名 | 列(主键外) |
   |---|---|---|
   | `tasks` | 任务清单 | 状态(单选:待办/进行中/已完成/取消)、优先级(单选:高/中/低)、截止日期(date)、标签(mSelect:工作/个人/灵感)、完成(checkbox) |
   | `projects` | 项目追踪 | 状态(单选:规划/进行中/暂停/已完结)、阶段(text)、开始日期(date)、结束日期(date)、标签(mSelect 同上) |
   | `inbox` | 素材收集箱 | 来源(url)、标签(mSelect 同上)、收集日期(date)、摘要(text) |

3. **命名修复**:种子 AV 直接以最终名构建(主键 block 列名=表名),废除建库路径上的「事后改文件名」。
4. **一键生成**:Dock 空名单 →「一键生成默认表格」大按钮;设置页「补齐缺失的默认表」;按 `templateKey` 幂等(缺哪张补哪张,不重复)。
5. **自建表格管理**:新建对话框改「**名称 + 起点**」(空白表格 / 以三张默认模板任一为底);空白表格=主键+一个「备注」文本列。所有表格宿主文档集中到可配置存放笔记本,命名 `表 · <表名>`。
6. **列表即管理台**:扁平列表(去类型分组头);行内显示**绑定文档数**(复用 `fetchDatabaseQueryData` 行数);保留过滤/只看异常/行内改名/补齐列/移除/按列筛文档。
7. **文档树**:「标为任务/项目/产品」→「**加入表格**」:三张默认表名平铺 + 「更多表格…」;点默认表 → 表不存在则**自动生成再挂接**(零配置),已存在直挂。

## 非目标

- 删除类型代码(照 `custom-*` 惯例休眠;`typeId`/`ownedDbPrimaryByType` 数据保留不读)
- 表内手动新建纯文本行转文档(原生行为,不拦截;后续刀再议)
- 模板可视化编辑;跨表查询;移动端
- 旧库数据迁移(用户现存无名库保留在名单,可自行移除)

## 方案要点

- **模型**:`TableTemplate { key, nameKey, nameFallback, columns }` + `DEFAULT_TABLE_TEMPLATES`;`OwnedDatabase.templateKey?: string`(normalize 透传)。
- **种子**:`buildEmptyAttributeViewJson` 只含主键(block,名=表名)+ 表格视图;去掉种子单选列(与模板「状态」列重名冲突的根源);模板列全部经 `ensureOwnedDatabaseTemplateColumns` 追加(按列名幂等)。空白起点列 = `[{name:"备注",type:"text"}]`。
- **建库**:`createOwnedDatabase({notebookId?, name, templateKey?, columns?, typeId?})`——`typeId` 参数保留但仅作兼容(旧 UI 调用点在刀 B 摘除);跳过 rename。
- **服务**:`generateDefaultTables({plugin?, notebookId?, nameOf?})`(nameOf 缺省用 nameFallback,UI 传 i18n 解析);`ensureTableForTemplateKey(...)` → `{db, created}`;`joinTableByKey({plugin, docId, templateKey})` = ensure + 互斥迁移 + 补列 + 记 `ownedDbLastAvID` + 刷新编辑器,返回 `bound|created|already`。
- **文档树菜单**(`index.ts`):三表名平铺(icon 不变)+ `更多表格…` → `CLASSIFY_PICK_TABLE_EVENT`;`DoctreeClassifyHost` 改为承载 `AddToDatabaseDialog`(传 docId + 健康表格),原 need-create 建库对话框流程摘除(生成已自动化)。
- **Dock**:当前文档区未挂时 = 三张默认表快捷按钮(走 `joinTableByKey`)+「选择其它表格…」;已挂 = 表名 + 移出。类型 chips、换类型确认、主库设/清/徽标、类型分组头全部摘除(函数保留休眠)。
- **计数**:列表行文档数 = `fetchDatabaseQueryData(avID).rows.length`(挂载/变更后懒刷新;失败隐藏该徽标)。
- **显示名兜底**:`displayOwnedDatabaseName` 兜底顺序 → templateKey 对应模板名 → 类型标签(休眠)→ 原值。

## 成功标准

1. 空名单新用户打开 Dock → 一键 → 三张**有名有字段**的表可用;设置页补齐幂等。
2. 写文档 → 文档树右键「任务清单」→ 无表则自动生成并挂接,标题下出现字段;再点一次 → toast「已在表中」。
3. 自建表格:名称+起点(含空白);宿主文档集中、命名 `表 · <表名>`;列表有文档数;改名/过滤/筛文档可用。
4. 英文环境无中文漏出;`npm run verify` 全绿(既有 142 测试不回归,新增模板/生成/join 测试)。

## Spec 自检

- [x] 三条用户反馈逐条映射到目标;类型降级与休眠策略明确
- [x] 模板字段定稿(含 starter 选项);幂等键、命名修复根因写清
- [x] 服务签名与 UI 摘除清单完整;成功标准可验证
- [x] 旧数据不迁移、url 列类型若内核拒绝降级 text(实现时验证并记录)

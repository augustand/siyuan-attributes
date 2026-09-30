# 业务库类型（第一刀）：模板建库

**日期：** 2026-09-22  
**状态：** 已批准（对话：原生字段 + 第一刀做库类型目录 +「继续」）  
**分支意向：** `feat/database-centric-panel`

## 问题

当前「我们的库」只是通用 AV 名单 + 一堆杂项列，没有业务语义。用户期望以思源数据库为底座，做任务库 / 项目库 / 产品库等**类型化业务**，并完善字段——但字段编辑继续完全使用原生 AV，插件不自建编辑器。

## 目标（本刀）

1. 定义内置**库类型**（任务 / 项目 / 产品 / 通用）。
2. 新建库时**先选类型**，按模板用原生 API 添加列（含单选选项）。
3. 已创建的库在名单中带 `typeId`，Dock 列表可显示类型标签。
4. 成功标准：用户能建出一个「任务库」，打开文档绑定后，标题下原生区域出现模板字段并可编辑。

## 非目标

- 插件内字段值编辑器 / 第二套属性面板  
- 设置页可视化改模板  
- 对已有库「一键补齐缺失列」（第二刀）  
- 当前文档按类型上下文（第二刀）  
- 按字段查询、自动绑定规则  

## 方案（已选 A）

代码内置模板 → `createOwnedDatabase({ typeId, name, notebookId })` → 现有 duplicate/append/mirror 流程 + 按模板 `addAttributeViewKey`（及选项）。

否决：设置可编辑模板（B）；模板存成思源文档（C）。

## 产品约定

### 类型与模板

```ts
type DatabaseTypeId = "task" | "project" | "product" | "generic";

interface DatabaseTypeColumn {
  name: string;
  type: string; // SiYuan AV key type: select | mSelect | text | number | date | checkbox | url | ...
  /** For select / mSelect */
  options?: Array<{ name: string; color?: string }>;
}

interface DatabaseTypeDef {
  id: DatabaseTypeId;
  nameKey: string; // i18n
  descriptionKey: string;
  columns: DatabaseTypeColumn[];
}
```

内置列（主键由思源默认保留；实现时删掉多余默认「单选」或重命名为模板第一列，计划里定一种，避免双「单选」）：

| typeId | 列 |
|--------|-----|
| `task` | 状态(select: 待办/进行中/完成/取消)、优先级(select: 高/中/低)、截止日期(date)、负责人(text)、完成(checkbox) |
| `project` | 状态(select: 规划/进行/暂停/完成)、阶段(text)、开始日期(date)、结束日期(date)、负责人(text) |
| `product` | 状态(select: 构想/开发/上线/归档)、版本(text)、优先级(select: P0/P1/P2)、负责人(text) |
| `generic` | 现有 `DEFAULT_OWNED_DATABASE_COLUMNS` |

### 建库 UI

```
新建我们的库
  库类型：[任务 ▼]
  库名称：[        ]
  （高级）存放笔记本…
  [创建]
```

- 无类型选择时不创建（默认选「任务」或上次类型 `ownedDbLastTypeId`）。
- 创建成功 toast：已创建「名称」（任务库）。请在标题下原生区域编辑字段。

### 名单模型

`OwnedDatabase` 增加可选：

- `typeId?: DatabaseTypeId`（旧数据缺省视为 `generic`）

设置 `ownedDbLastTypeId` 记住上次新建类型。

### 成功标准

1. Dock 新建可选四种类型；任务库创建后原生列符合模板（状态选项可见）。  
2. 名单显示类型标签；`typeId` 持久化。  
3. 仍无插件标题下字段表单。  
4. typecheck + 模板/建列相关单测通过；`dev/` 构建可 reload。

## 后续刀（不在本 spec）

2. 业务库列表体验加深 + 按库看文档/状态  
3. 当前文档：识别所属类型库、缺列补齐  
4. 查询 / 规则绑定  

## 技术草图

| 模块 | 职责 |
|------|------|
| `src/models/databaseTypes.ts` | 内置类型定义 + normalize |
| `src/services/ownedDatabase.ts` | `createOwnedDatabase` 按 `typeId` 加列/选项 |
| `src/models/ownedDatabase.ts` | `typeId` |
| `src/models/settings.ts` | `ownedDbLastTypeId` |
| `src/views/DocDatabaseDock.vue` | 新建对话框类型选择 + 列表标签 |
| i18n | 类型名、描述 |

列添加须走 `/api/av/addAttributeViewKey`（及 SiYuan 写 select options 的既有/调研 API），禁止只改 putFile JSON 却无 mirror。

# 文档数据库管理器设计（让位原生）

**日期：** 2026-09-21  
**状态：** 已批准，待写实现计划  
**分支意向：** `feat/database-centric-panel`（在既有分支上转向；或后续切 `feat/doc-database-manager`）

## 问题

思源已在文档标题下提供**原生数据库属性区域**（展示/编辑绑定行字段）。本插件刚落地的标题下 AV 面板与之重复，造成「一下子两个」的体验。

更有价值的差异化不在「再做一套属性表单」，而在成为**文档 × 数据库的管理者**：定义默认绑定关系、管理绑定、按字段查询——字段编辑继续复用原生 UI 与同一套 AV 数据。

## 目标（第一刀）

- **让位原生**：默认不再挂载标题下属性面板；设置文案明确「字段请用系统数据库区域」。
- **Dock「文档数据库」**一体提供：
  - **定义**：笔记本或路径前缀 → 默认 `avID`（及绑定所需 `blockID`）规则
  - **管理**：当前文档绑定状态；绑定 / 解绑；按库列出绑定文档
  - **查询**：对登记库做单字段简单筛选，结果跳转文档
- 所有绑定与查询走官方 `/api/av/*`，不另造数据源。

## 非目标（本刀）

- 标题下第二套字段编辑器（含刚做的 `DatabasePanel` 挂载）
- 在插件内新建数据库、增删改列类型/选项
- 多条件组合查询、保存视图、看板/日历
- 自动强制绑定（无确认）
- 复活 `custom-*` 文档属性面板为主表面
- 手机端专门适配

## 方案

**管理者 Dock + 休眠标题下面板（推荐）**

- 新增 Dock 应用为产品主入口。
- 复用已有 `src/models/attributeView.ts`、`src/services/attributeView.ts` 中读侧能力；扩展绑定/渲染/检索 API 封装。
- `index.ts` 中 `mountDatabasePanel` **默认不执行**（或设置 `showUnderTitlePanel: false` 且默认 false）；保留代码可日后高级开关打开，但不作为卖点。
- custom / 规则编辑器代码继续休眠。

## 产品约定

### 挂载与入口

| 入口 | 行为 |
|------|------|
| Dock「文档数据库」 | 主 UI：当前文档 / 规则 / 库文档列表 / 查询 |
| 顶栏设置 | 规则 CRUD、是否允许「高级：标题下面板」（默认关） |
| 标题下 | 默认不挂插件面板；原生「数据库」区域负责字段 |

### 定义（规则）

```ts
interface DocDatabaseRule {
  id: string;
  /** 展示名 */
  name: string;
  /** 匹配：笔记本 id，或文档 path 前缀（二选一或同时，实现时定一种优先顺序） */
  notebookId?: string;
  pathPrefix?: string;
  /** 目标属性视图 */
  avID: string;
  /** addAttributeViewBlocks 所需的数据库块 id */
  avBlockID: string;
  /** 可选：默认视图 */
  viewID?: string;
  enabled: boolean;
}
```

- 存插件 `settings`（如 `docDatabaseRules: DocDatabaseRule[]`）。
- **不修改**原生库 schema。
- 打开文档且命中规则、且当前文档尚未绑定该 `avID` 时：Dock「当前文档」区显示提示 + **「绑定到 xxx」**按钮；不自动绑定。

规则匹配优先级（建议）：更长 `pathPrefix` 优先；同前缀再比 `notebookId` 精确匹配；禁用规则跳过。

### 管理

**当前文档**

- `GET` `/api/av/getAttributeViewKeys` `{ id: docId }` → 已绑定库列表。
- **绑定**：`/api/av/addAttributeViewBlocks`  
  `{ avID, blockID: avBlockID, srcs: [{ id: docId, isDetached: false }] }`
- **解绑**：`/api/av/removeAttributeViewBlocks`  
  `{ avID, srcIDs: [docId] }`（不删除文档本身）
- 绑定/解绑成功后刷新列表；可 `reloadUI` 或依赖思源自身 AV 刷新。

**按库看文档**

- 选择一个已在规则中登记的库（或手动输入/搜索 `avID`）。
- 使用 `/api/av/renderAttributeView` 或 `/api/av/getAttributeViewPrimaryKeyValues`（实现计划里选定稳定接口）列出绑定行。
- 点击主键/标题 → 打开对应文档（`openTab` / 官方打开块 API）。

### 查询（薄）

- 选择登记库 → 选择一列（来自 `getAttributeView` / keys）→ 条件：`equals` | `contains` | `isEmpty`。
- 在渲染结果或主键列表上过滤（第一刀可客户端过滤；行数过大时再改为 SQL/内核过滤，本刀不强制）。
- 结果列表：显示主键文案 + 跳转。

### 设置

- `docDatabaseRules` 编辑 UI。
- `showUnderTitlePanel` 默认 `false`；开启时才挂旧 `DatabasePanel`（高级，文案警告与原生重复）。
- 保留既有 `databasePrefs` / dormant custom rules 于 JSON，不强删。

### 成功标准

1. 默认打开绑定库的文档：只有**原生**标题下数据库区，没有插件第二套表单。
2. Dock 能看到当前文档绑定、能绑定/解绑到规则指定库。
3. 至少一条规则可配置；命中未绑定文档时出现一键绑定提示。
4. 能对某库某字段做一次简单筛选并打开文档。

## 技术草图

| 模块 | 职责 |
|------|------|
| `src/models/docDatabaseRules.ts` | 规则 normalize / 匹配 |
| `src/services/attributeView.ts` | 扩展 add/remove/render/search |
| `src/store/docDatabase.ts` | Dock 状态：当前 doc、规则、查询 |
| `src/views/DocDatabaseDock.vue` | Dock UI |
| `src/index.ts` | `addDock`；条件挂载标题下面板 |
| 设置页 | 规则列表 + 高级开关 |

测试：规则匹配纯函数；绑定请求 payload 构造；查询过滤纯函数。

## 与上一刀关系

| 上一刀（标题下 AV 面板） | 本刀 |
|--------------------------|------|
| P1+P2 字段编辑 | **默认下线挂载** |
| `attributeView` normalize/write | 保留；管理侧多用 read + bind API |
| 列偏好 | 可留在高级标题下面板；Dock 第一刀不依赖 |

## 后续（非本刀）

- 必填列检查、绑定向导  
- 多条件查询与保存筛选  
- 批量绑定笔记本下文档  
- 真正「操作原生 DOM」级增强（若官方提供扩展点再评估）

## Spec 自检

- [x] 让位原生与管理者定位写清  
- [x] 定义 / 管理 / 查询第一刀边界明确  
- [x] API 方向标明（add/remove/getKeys/render）  
- [x] 与刚交付的标题下面板关系写清  
- [x] 非目标含不改 schema、不强制自动绑定  

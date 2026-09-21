# 以数据库为中心的属性面板设计

**日期：** 2026-09-21  
**状态：** 已批准，待写实现计划  
**分支意向：** `feat/database-centric-panel`（新工作流；`custom-*` 功能开发暂停）

## 问题

插件当前以 `custom-*` 块属性为中心：全局规则、文档级字段覆盖、自研类型编辑器。这等于在重新发明思源**内置数据库（属性视图 Attribute View）**已有的 schema 与交互。用户把文档绑进数据库后，AV 字段往往已在别处可见（例如集市插件 Macavity/siyuan-database-properties-panel，或核心属性对话框的「数据库」页签），而我们标题下的面板却忽略 AV，另起一套类型与选项。

仓库里曾做过 AV 支持，后在 `3310fe5` 整段移除（复杂度与类型写入问题）。产品方向现转回：**以思源数据库为中心设计**，并暂停把 `custom-*` 当作主表面。

## 目标（本交付 = P1 + P2）

- 标题下面板改为当前文档的 **AV 行属性面板**。
- 通过内核 API 读写常见 AV 字段类型。
- 文档属于多个数据库时：按 `avID` 用 **Tab** 切换。
- 按库配置列显隐、隐藏空字段、隐藏主键（存插件设置，不写文档属性）。
- `custom-*` UI **休眠**：运行时不挂载、设置入口隐藏；代码保留（方案 A）。

## 非目标（本交付不做）

- 继续开发或演进 `custom-*`（规则、字段设置、块级 custom 对话框）。
- 在面板内新建/重命名 AV 列，或改列选项定义。
- 完整的「把文档加入某个库」向导（仅空态文案提示）。
- 可写的关联 / 资源 / 模板 / 汇总 / 创建更新等系统列。
- 与 Macavity 的互斥检测或兼容层。
- 手机端专门适配。
- 块级 AV 编辑、非绑定行流程（**P3**，另开 spec）。

## 竞品背景（调研摘要）

| 插件 | 角色 |
|------|------|
| Macavity/siyuan-database-properties-panel | 标题下 AV 编辑；列显隐；README 写明受 TransMux Attributes Panel 启发 |
| loonghfut/siyuan-database-display | 多为只读，在多种块上展示 AV 字段 |
| famotime/siyuan-property-manager | Dock + 标题下 `custom-*`（与我们暂停的表面重叠） |

**立场：** 正面重做自己的标题下 AV 面板。可参考公开 API 与交互，运行时不依赖 Macavity。差异化留给 P3 以及日后「以库为中心整合其它能力」，而不是在 v1 逐项复刻 Macavity。

## 方案

**A — 新建 AV 模块 + 休眠 `custom-*` 代码（已选）**

- 新建 `DatabasePanel`（名称可调整）、AV service/store、按 AV 列类型的值编辑器。
- `App.vue` 在「显示面板」开启时只挂载 AV 面板。
- AttributePanel / FieldSettings / rules / typed custom editors 留在仓库，但从运行时入口断开引用。
- **不要**原样恢复 `3310fe5` 之前的 `DbAttrs`/`DbRow`（已知类型写坏风险）；按当前 `itemID` 等 API 约定重写。

本阶段否决：硬删全部 custom UI（B）；原样复活旧 DB 组件（C）。

## 产品约定

### 挂载

- 沿用 protyle 钩子：`loaded-protyle-static` 插在文档标题下（`protyle-title` 后 / `protyle-attr` 前）。
- 容器类名例如 `.mux-database-panel`（与旧属性面板类名区分）。
- `switch-protyle` / `loaded-protyle-dynamic`：按新 `docId` 重载。
- `destroy-protyle`：经现有 panel registry 卸载。
- 总开关：插件设置「显示面板」— 开 → 挂 AV 面板；关 → 不挂。

### 数据加载

- 对文档 id 调用 `/api/av/getAttributeViewKeys`。
- 零个 AV → 空态：提示将文档加入数据库后即可编辑字段。**不**回退到 `custom-*` 面板。
- 一个或多个 AV → 每个库一个 Tab（优先库名，缺省短 id）。切换 Tab 只换字段列表（不整页重挂 protyle）。

### 读 / 写

- **读：** 从 `getAttributeViewKeys` 取当前 `avID` 的 key/value。
- **写：** `/api/av/setAttributeViewBlockAttr`，参数含 `avID`、`keyID`、`itemID`（绑定文档行用 doc id）以及按类型组装的 `value`。不要求已废弃的 `cellID`。若某内核版本仍要旧字段 `rowID`，在 service 层封装兼容。
- 保存失败：toast + 回滚乐观 UI。

### 可编辑类型（P1）

| AV 类型 | 面板行为 |
|---------|----------|
| `text` | 可编辑文本 |
| `number` | 可编辑数字 |
| `mSelect`（按列配置单选/多选） | 从列选项选择（含颜色若有） |
| `date` | 日期编辑 |
| `checkbox` | 开关 |

清空时写入该类型对应的空/清除结构。

### 面板内只读（P1+P2）

`relation`、`mAsset`、`template`、`rollup`、创建/更新等系统列：只展示；尝试编辑可提示「暂不支持在面板中编辑」。

类型与选项以 AV 列定义为准，不用 custom 的 `renderMethod` 规则。UI 可借鉴现有 TDesign 用法，数据路径全新。

### 列偏好（P2）

存在**插件设置/data**，按 `avID` 分 key（不写进文档属性）：

| 字段 | 含义 | 默认 |
|------|------|------|
| `hiddenKeyIDs` | 面板中隐藏的列 | `[]` |
| `hideEmpty` | 隐藏空值字段 | `false` |
| `hidePrimaryKey` | 隐藏主键列 | `true` |

- 面板工具条：列设置（当前库勾选）+ 隐藏空字段开关。
- 过滤顺序：列显隐 → 隐藏主键 → 隐藏空字段。
- 每个 `avID` 独立记忆；Tab 之间不串配置。
- 全局设置可提供 `hidePrimaryKey` / `hideEmpty` 的默认值，在某库尚无本地偏好时生效。

### 设置与休眠

- 设置页只展示 AV 相关项（显示面板、默认隐藏主键、默认隐藏空字段）。隐藏 custom 规则列表 / 渲染方式 / 文档覆盖说明。
- 现有 settings JSON 中的 rules/overrides 字段 **保留不读、不迁移、不删除**。
- 本阶段停用块菜单 custom 属性对话框注册。
- README / i18n / `plugin.json` 文案转向「数据库属性面板」；注明文档 custom 属性编辑已暂停。
- 若同时安装 Macavity，可能出现两个标题下面板——在设置说明中写明。不做主动冲突处理。

### 成功标准

1. 文档绑定 ≥1 个数据库：标题下能查看并修改常见字段类型。
2. 多库 Tab 可用；按库列隐藏 / 隐藏空字段 / 隐藏主键可用。
3. 未绑定库：空态清晰；不再出现 custom 面板。

## 技术草图（供写计划用）

建议模块（名称可调整）：

- `src/services/attributeView.ts` — 取 keys、写 attr、映射内核 payload / `itemID`。
- `src/models/attributeView.ts` — 规范化 AV key/value；类型守卫。
- `src/store/databasePanel.ts`（或同类）— 当前 docId、av 列表、active avID、字段行、偏好。
- `src/views/DatabasePanel.vue` — Tab、工具条、字段列表宿主。
- `src/components/av/*` — 行组件 + 各类型值编辑器。
- 设置：扩展或替换当前设置页；磁盘上休眠 custom 模型保留。

测试：纯函数规范化/过滤；set-attr payload 构造；偏好合并；单元测试避免脆弱的全 protyle E2E。

## 本 spec 之后的分期

| 期 | 范围 |
|----|------|
| **本 spec（P1+P2）** | 文档标题下 AV 面板 + 偏好 |
| **P3** | 块级 AV 入口；非绑定行；日后若需再以库为中心整合 custom |
| **更远** | 复杂类型写入；绑定入库流程；可选的 AV+custom 同屏 |

## 留给实现计划的开放点（非产品阻塞）

- 若 `getAttributeViewKeys` 不带展示名，库名如何解析（可能需额外 AV meta API）。
- 各类型「空值」payload 的精确形状（对照当前内核确认）。
- 主键列是靠 key 上的稳定标志识别，还是约定俗成字段。

## Spec 自检

- [x] 已拍板产品决策无 TBD 占位
- [x] 与方案 A、P1+P2 范围一致
- [x] 非目标与 P3 明确延期
- [x] custom 休眠 vs 删除已写清
- [x] API 注明 `itemID` 与旧 `rowID`

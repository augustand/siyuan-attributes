## 数据库属性面板<sup>SiYuan-Attribute-Panel</sup>

当前版本以**思源内置数据库（属性视图）**为中心：在文档标题下展示并编辑该文档绑定的数据库字段。

文档 `custom-*` 属性编辑、全局匹配规则与块级 custom 对话框已**暂停**（代码保留，运行时不挂载）。

### 插件功能

1. 文档标题下显示数据库属性面板；支持文本、数字、单选/多选、日期、勾选、链接等常见类型的读写
2. 文档属于多个数据库时，用 Tab 切换
3. 按库配置列显隐、隐藏空字段、隐藏主键（存在插件设置中）
4. 插件设置：显示面板、默认隐藏主键、默认隐藏空字段
5. 支持暗黑模式

未绑定任何数据库的文档会显示空态提示。关联 / 资源 / 模板 / 汇总等类型本阶段只读展示。

### 兼容性说明

当前开发环境为 SiYuan v3.8.x。需要内核支持 `/api/av/getAttributeViewKeys` 与 `/api/av/setAttributeViewBlockAttr`（`itemID`）。暂时不支持手机端。

| 版本号  | 电脑端 | 网页端 | 手机端 |
| --------- | -------- | -------- | -------- |
| v3.8.x | ✅     | ✅     | 不支持 |

### 数据安全声明

出于对数据安全的绝对重视，本插件特此声明插件使用的所有API，同时代码完全开源（未编译未混淆），欢迎大家提出安全问题 / PR / Issue。

本插件依赖的 API：

1. `/api/av/getAttributeViewKeys`：获取文档绑定的数据库字段
2. `/api/av/setAttributeViewBlockAttr`：写入数据库单元格
3. `EventBus`：`loaded-protyle-static` / `loaded-protyle-dynamic` / `switch-protyle` / `destroy-protyle`

插件设置通过 `plugin.loadData` / `saveData` 持久化。

#### 插件权限

* **关于数据**：仅在用户操作下修改指定数据库字段，不会修改其他内容
* **关于UI**：在文档标题下增加数据库属性面板；设置对话框用于面板偏好
* **关于联网**：完全本地，不包括任何外网通信

若同时安装了其他「数据库属性面板」类插件，标题下可能出现两个面板，可在设置中关闭本面板。

### 反馈

请使用 [GitHub Issues](https://github.com/InEase/SiYuan-Attributes-Panel/issues) 提交 bug 或功能请求。

## 属性面板<sup>SiYuan-Attributes-Panel</sup>

Note: The current version focuses on document attributes. Database field features have been temporarily removed.

### Coming soon

- Block menu dialog is available: open **Attribute panel** from the block gutter menu or content context menu to edit that block's `custom-*` attributes
- [Inline block-level attributes](https://github.com/InEase/SiYuan-Attributes-Panel/issues/7) (tracked)

Feedback and suggestions welcome.

### Features

1. Attribute panel under the document title for **document-level** custom attributes (add / edit / delete; `custom-` prefix is normalized on save)
2. **Attribute Panel Settings** (plugin settings): global default rules (display name, visibility, editability, order, wildcards/regex)
3. **Field settings** (in-panel): overrides for **this document only**; other fields still follow global defaults
4. Dark mode support
5. Open a dialog from the block gutter menu (and content context menu) to edit that block's `custom-*` attributes; uses global rules; no per-block field overrides

The plugin stores per-document overrides in the reserved attribute `custom-mux-attrs-doc-fields`, which is hidden from the panel.

### 为什么开发这个插件

相关讨论可见这个issue: https://github.com/siyuan-note/siyuan/issues/10084

### 兼容性说明

当前开发环境为 SiYuan v3.8.3。暂时不支持手机端；手机端需要单独设计交互，后续另行验证。

因为本插件依赖的API非常基础，并不依赖于最新更新的特性，所以理论上更低的版本也能兼容，但是未经测试

| 版本号  | 电脑端 | 网页端 | 手机端 |
| --------- | -------- | -------- | -------- |
| v3.8.3 | ✅     | ✅     | 不支持 |

✅：经过测试，全部功能可用

### 数据安全声明

[出于对数据安全的绝对重视](https://ld246.com/article/1702808653385)，本插件特此声明插件使用的所有API，同时代码完全开源（未编译未混淆），欢迎大家报告安全问题

本插件依赖的API有且仅有：

1. `plugin.loadData` / `plugin.saveData`：保存版本化设置
2. `/api/attr/getBlockAttrs`：用于获取已有属性
3. `/api/attr/setBlockAttrs`：用于设置属性
4. `EventBus`监听：`loaded-protyle-static`，用于插入属性面板
5. `EventBus`监听：`loaded-protyle-dynamic`、`switch-protyle`，用于刷新属性面板
6. `EventBus`监听：`click-blockicon`、`open-menu-content`，用于在块菜单中注入**属性面板**入口；对话框挂载于 `.mux-block-attr-dialog`

#### 插件权限

* **关于数据**：本插件对您数据的修改仅限于**在用户操作下**，根据用户指示，对指定块的属性做出指定的修改，不会修改其他任何内容
* **关于UI**：本插件在文档标题下增加属性面板；块级编辑通过块菜单打开的对话框（挂载于 `.mux-block-attr-dialog`），不修改其他界面区域
* **关于联网**：本插件完全本地，不包括任何外网通信

### 实现原理

为了快速开发，本插件使用如下技术栈：

框架Vue，组件库[TDesign](https://tdesign.tencent.com/)，其中自定义组件的支持完全来自于组件库

### 支持与反馈

有多种反馈方法任您选择：

1. 在QQ群中找到我：思源笔记官方群一群二群三群以及折腾群里都能找到我（QQ：2294227991），您可以直接at我或者加我好友，但是QQ不常用，不保证一定能看到消息，更稳妥的话可以选择下面三个方法
2. 通过微信：您可以直接扫描下面这个二维码添加我的微信，对您来说，这样是最快最高效的方式，但是我比较忙，可能回复的不会那么及时在此表示抱歉

<details>

<summary>微信二维码（如果看不到图请搜索微信号 `TransMux`）</summary>

![WeChat QR code](./images/Wechat.jpg)

</details>

3. 通过Github Issue：您可以直接提一个Issue，这样的话便于大家一起讨论，但是可能及时性不会那么高
4. 或者您是大佬，直接提一个PR进行改进：非常欢迎，荣幸之至！感谢您的贡献！

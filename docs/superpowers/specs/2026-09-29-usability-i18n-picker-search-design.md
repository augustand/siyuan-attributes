# 易用性优化（第 5 刀）：i18n 补齐 + 选库对话框搜索

**日期：** 2026-09-29
**状态：** 草稿（待对话确认）
**前置：** 第 4 刀（快加 / 右键 / 按库看文档 / 引导）已交付
**来源：** 2026-09-29 差距盘点（P0 项）

## 问题

1. **缺键（已脚本核实）**：`src/` 里 `getI18nText("ownedDb.*")` 共引用 63 个键，`zh_CN.json` / `en_US.json` **两份语言包都缺 26 个**。中文用户看到代码内联兜底无感知；英文用户直接看到中文。缺失清单：

   `ownedDb.addEmpty / addTitle / addTo / allCollected / already / alreadyBound / collect / collectPage / collected / collectedN / current / exists / needDoc / noDoc / noHits / noneOnPage / notBound / ours / oursEmpty / register / registerTitle / remove / search / searchPh / unbind / unbindOk`

2. **文案漂移**：部分已存在键与代码兜底不一致（如 `ownedDb.dbNamePh`、`ownedDb.createOk`、`notebookHint`），两处真源。
3. **硬编码中文**：设置对话框标题「文档数据库」等写死在 `index.ts`，未走 i18n。
4. **疑似死键**：`ownedDb.cleanExtraNeed / quickAdd / menuAdd / noHealthy / guideUnbound` 在 JSON 里无代码引用；`labels.addTo / labels.notBound` 在组件里定义但模板未用。以扫描脚本确认为准。
5. **选库对话框无搜索**：`AddToDatabaseDialog` 纯列表无关键字过滤（「导入已有库」对话框反而有搜索）；库超过十个后挂接选库低效。

## 目标

1. `getI18nText` 引用的全部键落入两份语言包；中文取代码兜底原文，英文给可用译文
2. 漂移键以代码兜底为准对齐 JSON，消除双真源
3. 硬编码中文全部改走 `getI18nText`
4. 新增脚本扫描「引用但缺失」与「存在但无引用」两类问题，挂进 `npm run verify`（缺失报错、无引用告警）
5. `AddToDatabaseDialog` 顶部加搜索框（候选 ≥1 时显示），按 `displayOwnedDatabaseName` + 类型标签过滤；关键字仅组件内存态，不持久化

## 非目标

- 移除休眠的 `docDatabaseRules` 机制及其 i18n 键（**单独一刀**，需先拍板去留：删代码 or 留睡）
- `ownedDb.*` 之外历史键（如 `settings.*` 休眠键）的清理
- 英文文案润色（本轮只求可用、无中文漏出）

## 要点

- `src/i18n/zh_CN.json`、`src/i18n/en_US.json`：补 26 键、对齐漂移键、清确认后的死键
- `src/components/AddToDatabaseDialog.vue`：`Input` 搜索框 + `computed` 过滤；无结果复用 `ownedDb.noHits` 空态
- 新脚本 `scripts/check-i18n.mjs`（纯 node，零依赖）：正则提 `getI18nText\("([^"]+)"` 与两份 JSON 键集求差
- `package.json`：`verify` 链路接入

## 成功标准

1. `npm run verify` 通过；i18n 扫描缺失为 0
2. 切英文环境：Dock / 设置 / 各对话框无中文漏出
3. 选库对话框输入关键字实时过滤，清空恢复全量
4. 既有测试不回归

## Spec 自检

- [x] 缺失 / 漂移 / 硬编码 / 死键四类逐项列出，缺键清单已脚本核实
- [x] 扫描脚本进 verify，防回归
- [x] 休眠规则机制的清理单独立刀、去留待拍板
- [x] 成功标准可验证

## 文档数据库<sup>SiYuan-Attribute-Panel</sup>

本插件做**文档 × 数据库管理**，不在标题下再挂一套属性面板。

字段的查看与编辑请使用思源原生「数据库」区域。

### 能做什么

1. **绑定规则**：按笔记本或路径前缀指定默认数据库（avID + 数据库块 ID）
2. **Dock「文档数据库」**：查看当前文档绑定、一键绑定/解绑、按库浏览文档列表
3. 字段编辑交给原生 UI，避免与系统面板重复

### API

- `/api/av/getAttributeViewKeys`
- `/api/av/addAttributeViewBlocks` / `removeAttributeViewBlocks`
- `/api/av/getAttributeViewPrimaryKeyValues`

设置存于 `plugin.loadData` / `saveData`。完全本地。

### 反馈

[GitHub Issues](https://github.com/InEase/SiYuan-Attributes-Panel/issues)

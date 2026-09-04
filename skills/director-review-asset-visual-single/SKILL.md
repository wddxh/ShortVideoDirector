---
name: director-review-asset-visual-single
description: 审核一个基础资产卡与对应图片是否匹配。
user-invocable: false
context: fork
agent: director
allowed-tools: Read, Glob, Bash
model: opus
---

## 输入与范围

- `$ARGUMENTS[0]`：basic-only asset_path，仅 character/location/item/building
- `$ARGUMENTS[1]`：对应且唯一允许读取的 image_path
- `$ARGUMENTS[2]`：ep

读取资产卡、该一张 PNG、当前 script 和共享 review 规则。只在严重偏离卡片且打断剧情，或禁忌内容时打回；不做跨图比较，不审核 storyboard sheets。

通过返回空字符串；失败返回：

```json
{"asset_path":"assets/characters/张三.md","image_path":"assets/images/characters/张三.png","issue":"具体偏差","prompt_direction":"修复方向"}
```

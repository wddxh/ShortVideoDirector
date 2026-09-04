---
name: director-review-asset-prompt-single
description: 审核单个基础资产卡的图像提示表达。
user-invocable: false
context: fork
agent: director
allowed-tools: Read, Glob, Bash
model: opus
---

## 输入

- `$ARGUMENTS[0]`：basic-only 资产路径，仅允许 `assets/characters|locations|items|buildings/*.md`
- `config.md`
- 共享 output-language、review-meta-rules、visual-prompt-craft-common 规则

读取卡片，审核 `## 图像生成提示` 的模型可消费性、语言和资产引用；衍生资产还检查基础资产/基础类型路径。只读文本，不读 PNG，不评 storyboard sheet。

通过返回空字符串；失败返回：

```json
{"asset_path":"assets/items/道具.md","issue":"具体问题","prompt_direction":"修复方向"}
```

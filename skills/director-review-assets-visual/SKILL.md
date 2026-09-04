---
name: director-review-assets-visual
description: 批量调度基础资产视觉审核。
user-invocable: false
context: fork
agent: director
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Task
model: opus
---

## 范围

本 generic visual aggregate 是 basic-only。调用格式为 `--type=<基础类型组合> {ep} [明确 asset card paths]`；Storyboard sheets 使用专属 reviewer。

## Scope 合同

```json
{
  "argument_parser": "complete $ARGUMENTS token sequence",
  "default_source": "parse-new-assets.sh",
  "explicit_source": "remaining asset path tokens",
  "explicit_replaces_default": true,
  "explicit_may_include_existing": true,
  "validate_path_type": true
}
```

解析完整 `$ARGUMENTS` token 序列：先取 `--type=<逗号分隔类型>` 和其后的 `{ep}`，剩余 token 全部视为显式 asset card paths。无剩余路径时保持默认行为，使用 `parse-new-assets.sh` 仅收集本集新增资产；有显式路径时不调用默认收集器，只审核这些路径，允许包含本集已有资产。每条路径必须 canonical、文件存在、属于 `assets/{characters,locations,items,buildings}/`，且目录类型在 `--type` 中；按路径去重，不 Glob 扩大范围。

按 Scope 合同得到候选 asset paths，计算 PNG 路径并预检缺图。存在图片的每批最多 5 个，使用 Skill tool 调用 `director-review-asset-visual-single` skill；transform 将其映射为隔离 Task。失败重试一次。聚合写入 `story/episodes/{ep}/.review-basic-assets-visual.md`，每轮维护 `### dirty list`、`### 无法判定` 和唯一 footer `<!-- /round-N -->`。

仅 M=0 且 K=0 返回 `pass`；否则返回 `needs_revision M` 或 unknown 变体。Dirty entry 固定为 `{asset_path}|{image_path}`。

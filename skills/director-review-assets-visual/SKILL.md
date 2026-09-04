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

本 generic visual aggregate 是 basic-only，仅接受 `--type=characters,locations,items,buildings {ep}` 的任意基础类型组合。Storyboard sheets 使用专属 reviewer。

用 `parse-new-assets.sh` 收集本集新增资产，计算 PNG 路径并预检缺图。存在图片的每批最多 5 个，使用 Skill tool 调用 `director-review-asset-visual-single` skill；transform 将其映射为隔离 Task。失败重试一次。聚合写入 `story/episodes/{ep}/.review-basic-assets-visual.md`，每轮维护 `### dirty list`、`### 无法判定` 和唯一 footer `<!-- /round-N -->`。

仅 M=0 且 K=0 返回 `pass`；否则返回 `needs_revision M` 或 unknown 变体。Dirty entry 固定为 `{asset_path}|{image_path}`。

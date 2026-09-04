---
name: creator-fix-asset-image
description: 消费基础资产 visual review dirty list，修提示并重生整张资产图。
user-invocable: false
context: fork
agent: creator
allowed-tools: Read, Edit, Glob, Grep, Bash, Task
model: sonnet
---

## 范围

本 generic image fix 是 basic-only，只接受 `.review-basic-assets-visual.md`。Storyboard sheet 由 `creator-fix-storyboard-sheet-image` 修复。

读取最后一轮 `{asset_path}|{image_path}` dirty entries。仅修改 dirty 基础资产卡的 `## 图像生成提示`，删除对应 PNG，再使用 Skill tool 调用 `creator-generate-images` skill，参数 `{ep} paths {asset_path}`。不读取图片，不改其他 section 或非 dirty 资产。系统类失败最多重试 2 次，保留原始失败供下一轮 review。

返回处理、修改、成功和失败清单。

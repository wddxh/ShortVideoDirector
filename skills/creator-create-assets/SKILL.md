---
name: creator-create-assets
description: Creator为新资产创建完整Markdown文件，包含视觉描述和图像生成提示词。
user-invocable: false
context: fork
agent: creator
allowed-tools: Read, Write, Edit, Glob
---

## 输入

### 文件读取
- `story/episodes/$ARGUMENTS[0]/novel.md` — 必须读取
- `story/episodes/$ARGUMENTS[0]/outline.md` — 必须读取（从「本集资产清单」的「新增资产」部分获取资产列表）
- `config.md` — 必须读取（目标图像模型）
- `assets/**/*.md` — 使用 Glob 列出所有已有文件，选择性读取（风格一致性 + 查重）
- `skills/creator-create-assets/rules.md` — 必须读取并严格遵循（输出格式、规则）

### 动态参数（$ARGUMENTS）
- `$ARGUMENTS[0]` — 当前集数（如 ep01）

## 职责描述

根据资产清单和小说原文，为每个新资产创建完整的 Markdown 文件，包含视觉描述和图像生成提示词。

## 规则参考

- `skills/creator-create-assets/rules.md` — 必须读取并严格遵循

## 输出

### 文件操作
- 使用 Write 在 `assets/` 对应子目录（`characters/`、`items/`、`locations/`、`buildings/`）下创建每个资产的 `.md` 文件

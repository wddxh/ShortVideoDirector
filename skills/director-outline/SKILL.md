---
name: director-outline
description: Director生成本集详细大纲和outline.md内容。自动读取config.md、arc.md，并写入ep outline和story outline。
user-invocable: false
context: fork
agent: director
allowed-tools: Read, Write, Edit, Glob, Grep
---

## 输入

### 文件读取
- `config.md` — 必须读取
- `story/arc.md` — 若存在则读取
- `story/outline.md` — 若存在则读取
- 最近 M 集 novel.md — 若 `story/outline.md` 存在，根据 config.md 中 `上下文集数` M，使用 Glob 匹配 `story/episodes/ep*/novel.md` 找到最近 M 集并读取
- `skills/director-outline/rules.md` — 必须读取并严格遵循（输出格式、规则）

### 模式判断
- 若 `story/outline.md` 不存在 → new-story 模式
- 若 `story/outline.md` 已存在 → continue-story 模式

### 动态参数（$ARGUMENTS）
- `$ARGUMENTS[0]` — 当前集数（如 ep01）
- `$ARGUMENTS[1]` — 选定的剧情方向（引号包裹的完整文本）

## 职责描述

根据选定的剧情方向，生成本集详细大纲和 outline.md 追加内容。

## 规则参考

- `skills/director-outline/rules.md` — 必须读取并严格遵循

## 输出

### 文件操作
- 使用 Write 将本集大纲写入 `story/episodes/$ARGUMENTS[0]/outline.md`
- 若 `story/outline.md` 不存在：使用 Write 创建（new-story 场景）
- 若 `story/outline.md` 已存在：使用 Edit 在文件末尾追加新集内容（continue-story 场景，append-only）

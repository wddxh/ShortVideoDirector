---
name: writer-novel
description: Writer根据大纲生成具有画面感和紧凑叙事节奏的小说原文。自动读取大纲、config和角色资产。
---

## 输入

### 文件读取
- `story/episodes/$ARGUMENTS[0]/outline.md` — 必须读取
- `story/outline.md` — 必须读取
- `config.md` — 必须读取
- `assets/characters/*.md` — 若 `assets/characters/` 下有文件则全部读取（角色一致性参考）
- 最近 M 集 novel.md — 若 `assets/characters/` 下有文件（说明非第一集），根据 config.md 中 `上下文集数` M，使用 Glob 匹配 `story/episodes/ep*/novel.md` 找到最近 M 集并读取
- `skills/writer-novel/rules.md` — 必须读取并严格遵循（输出格式、输出约束、规则）

### 动态参数（$ARGUMENTS）
- `$ARGUMENTS[0]` — 当前集数（如 ep01）

## 职责描述

根据本集大纲和整体故事设定，生成具有画面感和紧凑叙事节奏的小说原文。

## 规则参考

- `skills/writer-novel/rules.md` — 必须读取并严格遵循

## 输出

### 文件操作
- 使用 Write 将小说原文写入 `story/episodes/$ARGUMENTS[0]/novel.md`

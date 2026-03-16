---
name: writer-fix-novel
description: Writer根据Director修改意见定向修正小说原文。读取现有小说，只修改指出的问题。
user-invocable: false
context: fork
agent: writer
allowed-tools: Read, Write, Edit, Glob
---

## 输入

### 文件读取
- `story/episodes/$ARGUMENTS[0]/novel.md` — 必须读取（现有小说）
- `story/episodes/$ARGUMENTS[0]/outline.md` — 必须读取
- `story/outline.md` — 必须读取（整体故事大纲）
- `config.md` — 必须读取
- `assets/characters/*.md` — 若存在则全部读取（角色一致性参考）
- `skills/writer-novel/rules.md` — 必须读取并严格遵循

### 动态参数（$ARGUMENTS）
- `$ARGUMENTS[0]` — 当前集数（如 ep01）
- `$ARGUMENTS[1]` — Director 修改意见（由 workflow 从 Director 审核结果中传入）

## 职责描述

根据 Director 修改意见（$ARGUMENTS[1]），定向修正现有小说中的具体问题。

## 规则

1. **只修改 Director 指出的问题** — 逐条对照 $ARGUMENTS[1] 中的修改意见进行修正，不得擅自修改 Director 未提及的内容
2. **严格遵循 rules.md** — 修正后的内容必须严格遵循 `skills/writer-novel/rules.md` 中的所有格式和规则，不得因修正而偏离格式
3. **保持未涉及内容不变** — Director 未指出问题的段落必须保持完全不变，逐字保留

## 输出

### 文件操作
- 使用 Write 覆写 `story/episodes/$ARGUMENTS[0]/novel.md`

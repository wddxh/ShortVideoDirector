---
name: director-fix-outline
description: Director根据修改意见定向修正本集大纲。同步更新story/outline.md中对应内容。
user-invocable: false
context: fork
agent: director
---

## 输入

### 文件读取
- `story/episodes/$ARGUMENTS[0]/outline.md` — 必须读取（现有本集大纲）
- `story/outline.md` — 必须读取（整体故事大纲）
- `story/arc.md` — 若存在则读取
- `config.md` — 必须读取
- `skills/director-outline/rules.md` — 必须读取并严格遵循

### 动态参数（$ARGUMENTS）
- `$ARGUMENTS[0]` — 当前集数（如 ep01）
- `$ARGUMENTS[1]` — 修改意见（由 workflow 传入，来源可能是用户编辑请求）

## 职责描述

根据修改意见（`$ARGUMENTS[1]`），定向修正本集大纲中的具体问题，并同步更新 story/outline.md。

## 规则

1. **只修改指出的问题** — 逐条对照 `$ARGUMENTS[1]` 中的修改意见进行修正，不得擅自修改未提及的内容
2. **严格遵循 rules.md** — 修正后的内容必须严格遵循 `skills/director-outline/rules.md` 中的所有格式和规则，不得因修正而偏离格式
3. **保持未涉及内容不变** — 未指出问题的部分必须保持完全不变，逐字保留
4. **同步 story/outline.md** — 修正本集大纲后，必须同步更新 `story/outline.md` 中对应本集的内容（注意：这是对 append-only 规则的例外，编辑场景下允许修改已有内容）

## 输出

### 文件操作
- 使用 Write 覆写 `story/episodes/$ARGUMENTS[0]/outline.md`
- 使用 Edit 更新 `story/outline.md` 中本集对应内容

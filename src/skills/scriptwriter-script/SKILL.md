---
name: scriptwriter-script
description: Scriptwriter根据大纲生成具有画面感和紧凑叙事节奏的剧本。自动读取大纲、config和角色资产。
---

## 输入

### 文件读取
- `story/episodes/$ARGUMENTS[0]/outline.md` — 必须读取
- `config.md` — 必须读取
- `assets/characters/*.md` — 若存在则全部读取（角色声音一致性参考）
- `skills/scriptwriter-script/rules.md` — 必须读取并严格遵循

### 动态参数（$ARGUMENTS）
- `$ARGUMENTS[0]` — 当前集数（如 ep01）

## 职责描述

根据 Director 大纲生成具有画面感和紧凑叙事节奏的剧本，包含场景描述、角色动作、台词（对白、内心独白、旁白）和情绪节奏提示。

## 规则参考

- `skills/scriptwriter-script/rules.md` — 必须读取并严格遵循

## 输出

### 文件操作
- 使用 Write 将剧本写入 `story/episodes/$ARGUMENTS[0]/script.md`

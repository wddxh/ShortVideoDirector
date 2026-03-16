---
name: creator-fix-asset
description: Creator根据修改意见定向修正指定资产文件。修改视觉描述时同步更新图像提示词。
user-invocable: false
context: fork
agent: creator
allowed-tools: Read, Write, Edit, Glob
---

## 输入

### 文件读取
- `$ARGUMENTS[0]` 指定的资产文件 — 必须读取（现有资产）
- `config.md` — 必须读取
- 同目录下其他资产文件 — 选择性读取（风格一致性参考）
- `skills/creator-create-assets/rules.md` — 必须读取并严格遵循

### 动态参数（$ARGUMENTS）
- `$ARGUMENTS[0]` — 资产文件路径（如 `assets/characters/林北.md`）
- `$ARGUMENTS[1]` — 修改意见（由 workflow 传入，来源可能是用户编辑请求）

## 职责描述

根据修改意见（$ARGUMENTS[1]），定向修正指定资产文件中的具体问题。

## 规则

1. **只修改指出的问题** — 逐条对照 $ARGUMENTS[1] 中的修改意见进行修正，不得擅自修改未提及的内容
2. **严格遵循 rules.md** — 修正后的内容必须严格遵循 `skills/creator-create-assets/rules.md` 中的所有格式和规则，不得因修正而偏离格式
3. **视觉描述与提示词同步** — 修改视觉描述时必须同步更新图像生成提示词，保持两者一致
4. **图像提示词语言** — 图像生成提示词语言必须遵循 config.md 语言设置
5. **保持未涉及内容不变** — 未指出问题的字段必须保持完全不变，逐字保留

## 输出

### 文件操作
- 使用 Write 覆写 `$ARGUMENTS[0]`

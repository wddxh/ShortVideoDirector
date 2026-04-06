---
name: short-storyboard
description: Storyboarder将剧本转化为完整分镜提示词。包含内部自检循环（最多3轮）。
user-invocable: false
context: fork
agent: storyboarder
allowed-tools: Read, Write, Edit, Glob, Grep
---

## 输入

### 文件读取
- 从 `story/episodes/$ARGUMENTS[0]/outline.md` 的「本集资产清单」中提取本集引用的资产名称
- 使用 Glob 获取 `assets/**/*.md` 全部文件路径列表，仅读取文件名与清单中资产名称匹配的文件
- `story/episodes/$ARGUMENTS[0]/script.md` — 必须读取
- `story/episodes/$ARGUMENTS[0]/outline.md` — 必须读取（含资产清单）
- `config.md` — 必须读取
- `skills/short-storyboard/rules.md` — 必须读取并严格遵循（输出格式、字段约束、规则）

### 动态参数（$ARGUMENTS）
- `$ARGUMENTS[0]` — 当前集数（如 ep01）

## 职责描述

将剧本转化为完整的分镜提示词，包含镜头类型、运动、时长、转场和时间线叙事描写，并执行自检循环确保质量。

## 规则参考

- `skills/short-storyboard/rules.md` — 必须读取并严格遵循

## 分镜自检

生成分镜后，按照 `skills/short-storyboard/rules.md` 中的输出格式、字段约束和规则逐条自检（最多 3 轮）：
1. 全部达标 → 完成
2. 不达标 → 按照反馈修正问题 → 重新自检
3. 3 轮后仍有不足 → 接受当前结果

## 输出

### 文件操作
- 使用 Write 将分镜写入 `story/episodes/$ARGUMENTS[0]/storyboard.md`

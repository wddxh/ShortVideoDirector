---
name: storyboarder-storyboard
description: Storyboarder将小说原文转化为完整分镜提示词。包含内部台词密度自检循环（最多3轮）。
---

## 输入

### 文件读取
- 从 `story/episodes/$ARGUMENTS[0]/outline.md` 的「本集资产清单」中提取本集引用的资产名称
- 使用 Glob 获取 `assets/**/*.md` 全部文件路径列表，仅读取文件名与清单中资产名称匹配的文件
- `story/episodes/$ARGUMENTS[0]/novel.md` — 必须读取
- `story/episodes/$ARGUMENTS[0]/outline.md` — 必须读取（含资产清单）
- `config.md` — 必须读取
- 根据 `$ARGUMENTS[0]` 计算上一集集数（如 `$ARGUMENTS[0]` 为 ep02 则上一集为 ep01），读取 `story/episodes/{上一集}/outline.md` — 若上一集存在则读取
- `story/episodes/{上一集}/storyboard.md` — 若存在则读取末尾 2-3 个镜头
- `skills/storyboarder-storyboard/rules.md` — 必须读取并严格遵循（输出格式、字段约束、规则）

### 动态参数（$ARGUMENTS）
- `$ARGUMENTS[0]` — 当前集数（如 ep01）

## 职责描述

将小说原文转化为完整的分镜提示词，包含镜头类型、运动、时长、转场和时间线叙事描写，并执行自检循环确保质量。

## 规则参考

- `skills/storyboarder-storyboard/rules.md` — 必须读取并严格遵循

## 分镜自检

生成分镜后，按照 `skills/storyboarder-storyboard/rules.md` 中的输出格式、字段约束和规则逐条自检（最多 3 轮）：
1. 全部达标 → 完成
2. 不达标 → 按照反馈修正问题 → 重新自检
3. 3 轮后仍有不足 → 接受当前结果

## 输出

### 文件操作
- 使用 Write 将分镜写入 `story/episodes/$ARGUMENTS[0]/storyboard.md`

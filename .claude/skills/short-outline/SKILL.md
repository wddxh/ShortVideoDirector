---
name: short-outline
description: Director为单集短视频生成详细大纲。自动读取config.md，写入ep01 outline。
user-invocable: false
context: fork
agent: director
---

## 输入

### 文件读取
- `config.md` — 必须读取
- `skills/short-outline/rules.md` — 必须读取并严格遵循

### 动态参数（$ARGUMENTS）
- `$ARGUMENTS[0]` — 用户选择的剧情方向（完整引用文本）

## 职责描述

根据用户选择的剧情方向和配置，生成单集短视频的详细大纲，规划完整的故事弧线（铺垫 → 冲突 → 高潮 → 收束）。

## 规则参考

- `skills/short-outline/rules.md` — 必须读取并严格遵循

## 输出

### 文件操作
- 使用 Write 将大纲写入 `story/episodes/ep01/outline.md`

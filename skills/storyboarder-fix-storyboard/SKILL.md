---
name: storyboarder-fix-storyboard
description: Storyboarder根据Director修改意见定向修正分镜，只修改受影响的 shot。
user-invocable: false
context: fork
agent: storyboarder
allowed-tools: Read, Write, Edit, Glob, Grep
model: sonnet
---

## 输入

- `story/episodes/$ARGUMENTS[0]/storyboard.md`
- `story/episodes/$ARGUMENTS[0]/script.md`
- `story/episodes/$ARGUMENTS[0]/outline.md`
- `story/episodes/$ARGUMENTS[0]/.review-storyboard.md`
- `config.md` 与相关基础资产卡
- `${CLAUDE_PLUGIN_ROOT}/skills/storyboarder-storyboard/rules.md`

## 动态参数

- `$ARGUMENTS[0]`：当前集数

## 流程

1. 读取最后一轮 review，把每条意见定位到具体 shot。
2. 只修改意见涉及的 shot；增删或重编号时同步更新受影响范围。
3. 修改动作后同步核对终态、朝向、屏幕方向、持有物与空间关系。修改时长后重算场景总时长。
4. 不规划 panel，不修改 storyboard sheet 卡片或图片；这些由 Creator 下游重建。
5. 严格遵守七字段 schema、资产边界、对白原文和配速约束。

## 输出

覆写 `story/episodes/$ARGUMENTS[0]/storyboard.md`，并返回四个机器可读集合：

```text
changed shots: 2,5
added shots: none
deleted shots: none
renumbered shots: none
```

集合无成员时写 `none`。下游据此选择 full 或 incremental sheet card 重建。

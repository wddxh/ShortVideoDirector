---
name: director-input-confirm
description: Director根据用户故事材料生成结构化确认说明。自动读取config.md、arc.md、outline.md、最近M集novel。
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

### 动态参数（$ARGUMENTS）
- `用户故事输入` — 用户提供的故事材料（必须）
- `用户反馈内容` — 用户补充说明（可选，重新生成时传入）

## 职责描述

根据用户提供的故事材料，生成结构化的确认说明，梳理核心设定、关键转折和集尾钩子。

## 输出格式

**new-story 时（story/outline.md 不存在）：** 与职责 1 new-story 单个选项格式一致（无 A/B/C 编号）

**continue-story 时（story/outline.md 已存在）：** 与职责 1 continue-story 单个选项格式一致（无 A/B/C 编号和稳健/激进/拓展标签）

## 规则

- 忠实于用户输入，不过度发挥

## 输出

### 返回内容
- 结构化确认说明（Markdown 格式） → 返回给 workflow 展示

---
name: director-input-confirm
description: Director根据用户故事材料生成结构化确认说明。自动读取config.md、arc.md、outline.md、最近M集novel。
user-invocable: false
context: fork
agent: director
allowed-tools: Read, Write, Edit, Glob, Grep
model: sonnet
---

## 输入

### 文件读取
- `config.md` — 必须读取
- `story/arc.md` — 若存在则读取
- `story/outline.md` — 若存在则读取
- 最近 M 集 novel.md — 若 `story/outline.md` 存在，根据 config.md 中 `上下文集数` M，使用 Glob 匹配 `story/episodes/ep*/novel.md` 找到最近 M 集并读取

### 模式判断
- 若 `story/outline.md` 不存在 → new-story 模式
- 若 `story/outline.md` 已存在 → continue-story 模式

### 动态参数（$ARGUMENTS）
- `$ARGUMENTS[0]` — 用户故事输入或用户反馈内容

## 职责描述

根据用户提供的故事材料，生成结构化的确认说明，梳理核心设定、关键转折和集尾钩子。

## 输出格式

**new-story 时（story/outline.md 不存在）：**

```markdown
## {主题名称}
- **剧名：** {剧名}
- **核心设定：** {一句话概括世界观和主角定位}
- **开篇钩子：** {第一集的核心冲突/悬念}
- **卖点分析：** {为什么适合短视频}
```

**continue-story 时（story/outline.md 已存在）：**

```markdown
## {走向名称}
- **关键转折：** {本集核心冲突或反转}
- **涉及角色：** {主要出场角色}
- **集尾钩子：** {收束方式 — 描述}
- **对整体剧情的影响：** {如何推动后续剧情}
```

## 规则

- 忠实于用户输入，不过度发挥

## 输出

### 返回内容
- 结构化确认说明（Markdown 格式） → 返回给 workflow 展示

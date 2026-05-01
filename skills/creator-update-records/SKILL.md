---
name: creator-update-records
description: Creator为本集出场的已有资产追加出场记录条目。
user-invocable: false
context: fork
agent: creator
allowed-tools: Read, Write, Edit, Glob
model: sonnet
---

## 输入

### 文件读取
- `story/episodes/$ARGUMENTS[0]/outline.md` — 必须读取（从「本集资产清单」的「已有资产（本集出场）」部分获取资产列表）
- `story/episodes/$ARGUMENTS[0]/novel.md` — 必须读取（获取出场细节）
- 对应已有资产文件 — 读取 `assets/` 下每个需要更新的资产 `.md` 文件

### 动态参数（$ARGUMENTS）
- `$ARGUMENTS[0]` — 当前集数（如 ep01）

## 职责描述

为本集中出场的已有资产追加出场记录条目。

## 输出格式

每个需更新的资产，在其 `## 出场记录` 末尾追加一条：

```markdown
- EP{XX}: {简要描述在该集中的表现}
```

## 规则

- 仅追加，不修改已有内容
- 追加内容必须简洁准确，描述该资产在本集中的具体出场情况

## 输出

### 文件操作
- 使用 Edit 对每个已有资产文件，在 `## 出场记录` 末尾追加 `- EP{XX}: {简要描述}`

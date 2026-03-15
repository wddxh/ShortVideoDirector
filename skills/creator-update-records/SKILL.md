---
name: creator-update-records
description: Creator为本集出场的已有资产追加出场记录条目。
user-invocable: false
context: fork
agent: creator
allowed-tools: Read, Write, Edit, Glob
---

## 输入文件读取

当前集数由 $ARGUMENTS 传入（如 `ep01`）。

1. 读取 `story/episodes/{当前集数}/outline.md` — 必须读取（从「本集资产清单」的「已有资产（本集出场）」部分获取需要更新的资产列表）
2. 读取 `story/episodes/{当前集数}/novel.md` — 必须读取（获取出场细节）
3. 读取 `assets/` 下对应已有资产文件 — 读取每个需要更新的资产文件

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

## 输出文件操作

使用 Edit 对每个已有资产文件，在 `## 出场记录` 末尾追加 `- EP{XX}: {简要描述}`。

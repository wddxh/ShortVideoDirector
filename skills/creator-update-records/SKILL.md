---
name: creator-update-records
description: 在复用资产需要登记本集表现或恢复中核对出场记录时使用。
user-invocable: false
agent: creator
allowed-tools: Read, Write, Edit, Glob, Bash
model: sonnet
---

## 输入

### 文件读取
- 委托本集的 `story/episodes/{ep}/script.md` — 从「本集资产清单」的「已有资产（本集出场）」获取范围，从实际场景获取出场事实
- 已有 novel、outline — 仅在相关时辅助理解，不是必需输入，也不能覆盖剧本
- 对应已有资产文件 — 读取 `assets/` 下每个需要更新的资产 `.md` 文件

### 委托上下文
- 确认 ep、需要登记或核对的资产及写入授权。仅核对时返回差异，不更新文件；目标不清不默认最新集或全部资产。

## 职责描述

登记本集中实际复用资产的出场记录。可用 `node "${CLAUDE_PLUGIN_ROOT}/scripts/episode-assets.mjs" "story/episodes/{ep}/script.md" existing` 获取去重路径。缺清单时返回整理请求，不猜测或从 outline 回退。加载本 skill 不改变负责人、不触发后续制作。

## 输出格式

每个需更新的资产，在其 `## 出场记录` 保持本集恰好一条：

```markdown
- EP{XX}: {简要描述在该集中的表现}
```

## 规则

- 先检查本集 EP 编号：无记录才追加；已有且事实仍准确则保留；事实改变时仅更新本集条目。发现本集重复条目时合并为一条准确记录，其他集与其他 section 保持不变。
- 追加内容必须简洁准确，描述该资产在本集中的具体出场情况
- 优先记录后续有用的出场事实，例如“在古宅门口持火把探路”，而非泛写“出现”。区分本集临时状态与稳定身份，不把出场记录变成修改基础形象的途径；涉及视觉变化时提出衍生资产建议，不在此改其他 section。

## 输出

### 文件操作
- 使用 Edit 仅更新本集条目，返回实际 appended、updated、preserved 和失败路径。新增卡已含首次记录时直接复用，恢复不追加第二条。

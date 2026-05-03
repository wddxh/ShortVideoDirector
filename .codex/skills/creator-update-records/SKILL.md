---
name: creator-update-records
description: Creator为本集出场的已有资产追加出场记录条目。
user-invocable: false
---

<!-- BEGIN CODEX RUNTIME MAPPING: generated from .codex/tool-mapping.md -->

# Codex Runtime Mapping

This skill was authored for the Claude Code plugin runtime. When executing it in Codex, apply the following mapping.

## File and shell tools

- Claude `Read` means read a local file from the current workspace.
- Claude `Write` means create or overwrite a local file in the current workspace.
- Claude `Edit` means apply a targeted local file edit.
- Claude `Glob` means find files by pattern.
- Claude `Grep` means search file contents, preferably with `rg`.
- Claude `Bash` means run a local shell command when it is necessary for the skill.

## Skill calls

- `使用 Skill tool 调用 <skill-name> skill` means invoke or follow the generated Codex skill named `<skill-name>`.
- If direct skill invocation is unavailable, read `.codex/skills/<skill-name>/SKILL.md` and execute that skill's instructions with the supplied arguments.
- Preserve the source skill's `$ARGUMENTS` contract when passing arguments.

## Agent calls

- Claude `Agent` means delegate to a Codex sub-agent when available.
- If a matching role exists, use the corresponding role intent from `agents/<role>.md`.
- If custom role injection is unavailable, execute the delegated task in the current Codex session while following the relevant role prompt.

## Cron and automation

- Claude `CronCreate`, `CronList`, and `CronDelete` are not literal Codex tools.
- This first Codex compatibility pass does not implement a dedicated `/auto-video` override.
- Until that override exists, prefer manual or external periodic calls to `/check-video <target> --auto` when running in Codex.
- Never bypass the safety rules in `check-video` or `creator-video-dreamina`.

## Model hints

- Claude `model: opus` and `model: sonnet` are advisory only in Codex.
- In Codex, use the active model unless the user explicitly asks for a different model.

## Tool allowlists

- Claude `allowed-tools` metadata is advisory only in generated Codex skills.
- If a named Claude tool is unavailable in Codex, apply this mapping instead of failing solely because the tool name differs.

<!-- END CODEX RUNTIME MAPPING -->

<!-- BEGIN ORIGINAL SKILL: skills/creator-update-records/SKILL.md -->

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

<!-- END ORIGINAL SKILL -->

---
name: director-input-confirm
description: Director根据用户故事材料生成结构化确认说明。自动读取config.md、arc.md、outline.md、最近M集novel。
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

<!-- BEGIN ORIGINAL SKILL: skills/director-input-confirm/SKILL.md -->

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

<!-- END ORIGINAL SKILL -->

---
name: director-arc
description: Director生成阶段级剧情弧线规划。自动读取config.md、outline.md、最近M集novel，并写入arc.md。
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

<!-- BEGIN ORIGINAL SKILL: skills/director-arc/SKILL.md -->

## 输入

### 文件读取
- `config.md` — 必须读取
- `story/outline.md` — 若存在则读取
- 最近 M 集 novel.md — 若 `story/outline.md` 存在，根据 config.md 中 `上下文集数` M，使用 Glob 匹配 `story/episodes/ep*/novel.md` 找到最近 M 集并读取

### 动态参数（$ARGUMENTS）
- `$ARGUMENTS[0]` — 总集数
- `$ARGUMENTS[1]` — 选定的剧情方向（引号包裹的完整文本）

## 职责描述

根据总集数和剧情方向，生成阶段级剧情弧线规划。

## 输出格式

```markdown
# 剧情弧线

总集数：{N}

## 总体剧情
{完整故事的总体概述：核心冲突、主要角色关系、故事走向和最终结局。篇幅根据故事复杂度自行决定，确保后续各阶段和每集规划都能从中找到清晰的叙事依据}

## 第1-{X}集：{阶段名称}
- **阶段目标：** {描述}
- **关键转折点：** {描述}
- **角色发展：** {描述}
- **阶段结尾钩子：** {描述}

### 每集规划
- **第1集：** {本集主要剧情概述}
- **第2集：** {本集主要剧情概述}
- ...
- **第{X}集：** {本集主要剧情概述}

## 第{X+1}-{Y}集：{阶段名称}
- **阶段目标：** {描述}
- **关键转折点：** {描述}
- **角色发展：** {描述}
- **阶段结尾钩子：** {描述}

### 每集规划
- **第{X+1}集：** {本集主要剧情概述}
- ...
- **第{Y}集：** {本集主要剧情概述}

## 第{Z}-{N}集：{阶段名称}（大结局）
- **阶段目标：** {描述}
- **关键转折点：** {描述}
- **角色发展：** {描述}
- **大结局：** {精彩的结局设计}

### 每集规划
- **第{Z}集：** {本集主要剧情概述}
- ...
- **第{N}集：** {本集主要剧情概述}
```

## 规则

- 阶段划分合理，每阶段覆盖的集数根据总集数自行决定
- 最后一个阶段必须包含精彩的大结局设计，替换"阶段结尾钩子"为"大结局"
- 在阶段规划的基础上，为每集分配大概的剧情规划（一句话概述本集主要剧情），供 outline 生成时严格遵循
- 每集规划只是方向性概述，不是详细大纲，具体事件和细节由 outline skill 展开
- continue-story 时必须与已有 outline 保持逻辑连贯

## 输出

### 文件操作
- 使用 Write 将剧情弧线写入 `story/arc.md`

<!-- END ORIGINAL SKILL -->

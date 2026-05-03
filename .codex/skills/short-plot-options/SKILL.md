---
name: short-plot-options
description: Director为单集短视频生成3个差异化剧情选项。自动读取config.md。
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

<!-- BEGIN ORIGINAL SKILL: skills/short-plot-options/SKILL.md -->

## 输入

### 文件读取
- `config.md` — 必须读取

### 动态参数（$ARGUMENTS）
- `$ARGUMENTS[0]` — 用户偏好描述（可选，重新生成时传入）

## 职责描述

根据单集短视频配置，生成 3 个差异化的剧情选项供选择。每个选项覆盖完整的单集剧情走向，包括开端、发展与结局。

## 输出格式

```markdown
## 选项 A: {主题名称}
- **剧名：** {剧名}
- **剧情概要：** {一句话概括完整剧情走向}
- **结局类型：** {反转/温馨/开放/幽默/...}
- **卖点分析：** {为什么适合短视频}

## 选项 B: {主题名称}
...

## 选项 C: {主题名称}
...
```

## 规则

- 3 个选项必须有明显差异（不同故事类型或叙事风格）
- 避免侵权：禁止直接照搬已有影视作品的剧情结构或角色关系
- 每个选项须自洽完整，适合单集短视频的时长和节奏
- 版权规避：不得使用现实中的明星或公众人物名字、真实地名、商标名

## 用户交互

生成选项后，等待用户操作：
- 用户选择某个选项 → 将选定方向文本返回给 workflow
- 用户提出偏好并要求重新生成 → 将偏好作为 `$ARGUMENTS[0]` 重新执行本 skill

## 输出

### 返回内容
- 用户选定的剧情选项（Markdown 格式） → 返回给 workflow

<!-- END ORIGINAL SKILL -->

---
name: short-input-confirm
description: Director根据用户故事材料生成单集短视频的结构化确认说明。自动读取config.md。
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

<!-- BEGIN ORIGINAL SKILL: skills/short-input-confirm/SKILL.md -->

## 输入

### 文件读取
- `config.md` — 必须读取

### 动态参数（$ARGUMENTS）
- `$ARGUMENTS[0]` — 用户故事材料文本

## 职责描述

根据用户提供的故事材料，生成结构化的确认说明，梳理主题、剧情走向、结局类型和短视频卖点，供用户确认或提出修改意见。

## 输出格式

```markdown
## {主题名称}
- **剧名：** {剧名}
- **剧情概要：** {一句话概括完整剧情走向}
- **结局类型：** {反转/温馨/开放/幽默/...}
- **卖点分析：** {为什么适合短视频}
```

## 规则

- 忠实于用户输入，不过度发挥
- 版权规避：不得使用现实中的明星或公众人物名字、真实地名、商标名
- 若故事材料涉及现实版权作品（如已出版小说、影视IP），须在确认说明末尾添加版权规避提示，建议将人名、地名、设定进行改编

## 用户交互

展示确认说明后，等待用户操作：
- 用户确认 → 将确认的方向文本返回给 workflow
- 用户提出修改意见 → 根据反馈重新生成确认说明，直至用户确认

## 输出

### 返回内容
- 用户确认的剧情方向（Markdown 格式） → 返回给 workflow

<!-- END ORIGINAL SKILL -->

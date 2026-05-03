---
name: storyboarder-fix-storyboard
description: Storyboarder根据Director修改意见定向修正分镜。读取现有分镜，只修改指出的问题。
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

<!-- BEGIN ORIGINAL SKILL: skills/storyboarder-fix-storyboard/SKILL.md -->

## 输入

### 文件读取
- `story/episodes/$ARGUMENTS[0]/storyboard.md` — 必须读取（现有分镜）
- `story/episodes/$ARGUMENTS[0]/novel.md` — 必须读取（对照原文）
- `story/episodes/$ARGUMENTS[0]/outline.md` — 必须读取（含资产清单）
- `config.md` — 必须读取
- 从 `story/episodes/$ARGUMENTS[0]/outline.md` 的「本集资产清单」中提取本集引用的资产名称，使用 Glob 获取 `assets/**/*.md` 全部文件路径列表，仅读取文件名与清单中资产名称匹配的文件
- `skills/storyboarder-storyboard/rules.md` — 必须读取并严格遵循

### 动态参数（$ARGUMENTS）
- `$ARGUMENTS[0]` — 当前集数（如 ep01）
- `$ARGUMENTS[1]` — 修改意见（由 workflow 传入，来源可能是 Director 审核或用户编辑请求）

## 职责描述

根据修改意见（$ARGUMENTS[1]），定向修正现有分镜中的具体问题。

## 规则

1. **只修改指出的问题** — 逐条对照 $ARGUMENTS[1] 中的修改意见进行修正，不得擅自修改未提及的内容
2. **严格遵循 rules.md** — 修正后的内容必须严格遵循 `skills/storyboarder-storyboard/rules.md` 中的所有格式和规则，不得因修正而偏离格式
3. **保持未涉及内容不变** — 未指出问题的镜头必须保持完全不变，逐字保留
4. **时长修正保留细节** — 因内容超出镜头时长而需要精简时，只精简实际占用时间的元素（台词、角色动作、环境动态描写），不得删减不占用时间的视觉修饰词和细节描写（如光线质感、色调、材质、氛围形容词等）。例如"光线柔和地照亮房间"中"柔和地"是视觉细节而非时间消耗，删除它不会节约时间反而丢失画面质感。精简应优先通过缩短台词、合并动作、减少事件数量来实现

## 输出

### 文件操作
- 使用 Write 覆写 `story/episodes/$ARGUMENTS[0]/storyboard.md`

<!-- END ORIGINAL SKILL -->

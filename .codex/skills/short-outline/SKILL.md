---
name: short-outline
description: Director为单集短视频生成详细大纲。自动读取config.md，写入ep01 outline。
user-invocable: false
---

# Codex Adapter

This is a generated Codex wrapper. The source skill remains the single source of truth at `skills/short-outline/SKILL.md`.

Do not edit this wrapper by hand. Update the source skill only when you intentionally want to change Claude behavior, then regenerate wrappers with `python3 .codex/build-codex-skills.py`.

## Runtime Mapping

# Codex Runtime Mapping

This repository keeps Claude Code skills unchanged under `skills/`. Codex loads generated wrapper skills under `.codex/skills/`; each wrapper applies this mapping and then executes the original source skill.

## File and shell tools

- Claude `Read` means read a local file from the current workspace.
- Claude `Write` means create or overwrite a local file in the current workspace.
- Claude `Edit` means apply a targeted local file edit.
- Claude `Glob` means find files by pattern.
- Claude `Grep` means search file contents, preferably with `rg`.
- Claude `Bash` means run a local shell command when it is necessary for the skill.

## Skill calls

- `使用 Skill tool 调用 <skill-name> skill` means invoke or follow the Codex wrapper skill named `<skill-name>`.
- If direct skill invocation is unavailable, read `skills/<skill-name>/SKILL.md` and execute that skill's instructions with the supplied arguments.
- Preserve the source skill's `$ARGUMENTS` contract when passing arguments.

## Agent calls

- Claude `Agent` means delegate to a Codex sub-agent when available.
- If a matching role exists, use the corresponding role intent from `agents/<role>.md`.
- If custom role injection is unavailable, execute the delegated task in the current Codex session while following the relevant role prompt.

## Cron and automation

- Claude `CronCreate`, `CronList`, and `CronDelete` are not literal Codex tools.
- For `/auto-video`, prefer Codex automation support when available.
- If Codex automation is unavailable, use manual or external periodic calls to `/check-video <target> --auto`.
- Never bypass the safety rules in `check-video` or `creator-video-dreamina`.

## Model hints

- Claude `model: opus` and `model: sonnet` are advisory only in Codex.
- In Codex, use the active model unless the user explicitly asks for a different model.

## Tool allowlists

- Claude `allowed-tools` metadata from the source skill is advisory only in Codex.
- If a named Claude tool is unavailable in Codex, apply this mapping instead of failing solely because the tool name differs.

## Execute Source Skill

1. Read `skills/short-outline/SKILL.md` and execute that skill's instructions with the user's original arguments.
2. Treat `skills/short-outline/` as the source skill directory. When the source skill references sibling files such as `rules.md` or `config-template.md`, resolve them relative to that directory.
3. Treat repository-root paths such as `scripts/`, `agents/`, `story/`, `assets/`, and `config.md` as paths relative to the current workspace root.
4. Do not copy or edit source skill instructions while executing this wrapper.

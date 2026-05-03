# Codex Install

Codex support is provided through `.codex-plugin/plugin.json`.

Claude Code and Codex both load the same source skills from `skills/`.

## Single Skill Source

`skills/` is the only human-edited skill directory. Do not create or edit a second generated copy under `.codex/skills/`.

When running in Codex, apply the runtime compatibility notes in `.codex/tool-mapping.md`. They explain how to interpret Claude-oriented terms such as `Read`, `Write`, `Edit`, `Bash`, `Agent`, `CronCreate`, `allowed-tools`, and `model`.

## User-facing workflows

- `series-video`
- `short-video`
- `series-edit-story`
- `short-edit-story`
- `series-repair-story`
- `short-repair-story`
- `generate-video`
- `check-video`
- `auto-video`

## Notes

- All skills live under `skills/`, including internal workflow and role-owned skills, because user-facing workflows call them by skill name.
- Claude-only frontmatter such as `allowed-tools` and `model` remains in the shared source files for Claude Code. Codex treats those fields as advisory metadata.
- `/auto-video` still describes Claude Cron behavior. In Codex, prefer Codex automation support when available; otherwise use `/check-video <target> --auto` periodically.

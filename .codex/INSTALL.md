# Codex Install

Codex support is provided through `.codex-plugin/plugin.json`.

Claude Code loads the source skills from `skills/`. Codex loads generated thin wrappers from `.codex/skills/`.

## Single Skill Source

`skills/` is the only human-edited skill directory. Do not edit generated wrappers under `.codex/skills/` by hand.

Wrappers only contain Codex-safe metadata, `.codex/tool-mapping.md`, and a pointer back to the source `skills/<name>/SKILL.md`. They do not copy the source skill body.

After changing `.codex/tool-mapping.md` or source skill frontmatter, regenerate wrappers:

```bash
python3 .codex/build-codex-skills.py
```

To verify wrappers without writing:

```bash
python3 .codex/build-codex-skills.py --check
```

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

- All source skills live under `skills/`, including internal workflow and role-owned skills, because user-facing workflows call them by skill name.
- Claude-only frontmatter such as `allowed-tools` and `model` remains in the source files for Claude Code. Codex wrapper frontmatter keeps only portable discovery metadata.
- `/auto-video` still describes Claude Cron behavior in the source skill. Codex interprets it through `.codex/tool-mapping.md`.

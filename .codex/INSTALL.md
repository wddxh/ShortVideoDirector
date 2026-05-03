# Codex Install

Codex support is provided through `.codex-plugin/plugin.json`.

Claude Code continues to use `.claude-plugin/plugin.json` and the source `skills/` directory directly. Codex uses generated skills under `.codex/skills/`, which inject `.codex/tool-mapping.md` before the original skill instructions.

## Generate Codex skills

After editing any source skill under `skills/`, regenerate the Codex artifacts:

```bash
python3 .codex/build-codex-skills.py
```

Generated files under `.codex/skills/` should not be edited by hand.

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

- All 39 source skills are generated, including internal workflow and role-owned skills, because user-facing workflows call them by skill name.
- Claude-only frontmatter such as `allowed-tools` and `model` is removed from generated Codex skill frontmatter.
- `/auto-video` is generated for completeness, but this first compatibility pass does not add a dedicated Codex override for Claude Cron behavior. In Codex, use `/check-video <target> --auto` periodically until that override is implemented.

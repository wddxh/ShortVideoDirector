# Codex Compatibility Implementation Plan

Status: implemented as a shared-skill layout. Claude Code and Codex now load the same `skills/` directory, so skill edits have a single source of truth.

## Background

The repository uses a Claude Code plugin layout:

- `.claude-plugin/plugin.json` points Claude Code to `./skills/`.
- `skills/*/SKILL.md` contains the workflow and role skills.
- `agents/*.md` defines role prompts used by the workflow design.
- `scripts/` contains local helpers used by skills through shell commands.

Codex support is provided through `.codex-plugin/plugin.json`. The previous first-pass implementation generated a second skill tree under `.codex/skills/`, but that created a synchronization risk whenever `skills/` changed.

## Current Approach

Use `skills/` as the only skill source:

```text
ShortVideoDirector/
├── .claude-plugin/
│   └── plugin.json                  # Claude Code manifest
├── .codex-plugin/
│   └── plugin.json                  # Codex manifest
├── .codex/
│   ├── CODEX_COMPAT_IMPLEMENTATION_PLAN.md
│   ├── INSTALL.md
│   └── tool-mapping.md              # Codex runtime mapping notes
├── agents/
├── scripts/
├── skills/                          # Shared source of truth
└── README.md
```

Both manifests point to the same directory:

```json
"skills": "./skills/"
```

There is no generated `.codex/skills/` directory and no regeneration step.

## Compatibility Policy

The shared skills may still contain Claude-oriented metadata or runtime names such as `allowed-tools`, `model`, `Agent`, `CronCreate`, `CronList`, and `CronDelete`.

Codex interprets those terms using `.codex/tool-mapping.md`:

- File tools map to normal workspace file reads and writes.
- `调用或执行 <skill-name> skill` means invoke that skill by name, or read `skills/<skill-name>/SKILL.md` and follow it.
- `Agent` maps to Codex sub-agents when available, or to performing the delegated role in the current session.
- Claude Cron tools map to Codex automation support when available.
- `allowed-tools` and `model` are advisory in Codex.

## Acceptance Criteria

1. Claude Code can still load the plugin through `.claude-plugin/plugin.json`.
2. Codex can load the plugin through `.codex-plugin/plugin.json`.
3. `skills/` is the only skill directory.
4. `.codex/skills/` and `.codex/build-codex-skills.py` are absent.
5. README and `.codex/INSTALL.md` document that skill edits happen only in `skills/`.
6. Internal skill calls remain available because all source skills are still present under `skills/`.

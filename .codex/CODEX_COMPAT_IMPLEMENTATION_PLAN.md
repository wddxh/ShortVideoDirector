# Codex Compatibility Implementation Plan

Status: implemented as generated Codex wrapper skills. Claude Code source skills remain unchanged under `skills/`; Codex-specific adaptation lives under `.codex/`.

## Background

The repository uses a Claude Code plugin layout:

- `.claude-plugin/plugin.json` points Claude Code to `./skills/`.
- `skills/*/SKILL.md` contains the source workflow and role skills.
- `agents/*.md` defines role prompts used by the workflow design.
- `scripts/` contains local helpers used by skills through shell commands.

Codex needs runtime mapping for Claude-oriented terms such as `Skill tool`, `Agent`, `CronCreate`, `allowed-tools`, and `model`. That mapping should not be injected into or edited inside `skills/`, because those files are the Claude Code source of truth.

## Current Approach

Use `.codex/skills/` for generated thin wrappers:

```text
ShortVideoDirector/
├── .claude-plugin/
│   └── plugin.json                  # Claude Code manifest -> ./skills/
├── .codex-plugin/
│   └── plugin.json                  # Codex manifest -> ./.codex/skills/
├── .codex/
│   ├── CODEX_COMPAT_IMPLEMENTATION_PLAN.md
│   ├── INSTALL.md
│   ├── build-codex-skills.py        # Wrapper generator and --check verifier
│   ├── tool-mapping.md              # Codex runtime mapping
│   └── skills/                      # Generated wrapper skills
├── agents/
├── scripts/
├── skills/                          # Claude source of truth
└── README.md
```

The Codex manifest points to generated wrappers:

```json
"skills": "./.codex/skills/"
```

Each wrapper:

1. Preserves portable discovery frontmatter from the source skill.
2. Embeds `.codex/tool-mapping.md`.
3. Instructs Codex to read and execute `skills/<name>/SKILL.md`.
4. Resolves sibling files such as `rules.md` or `config-template.md` relative to the source skill directory.

Wrappers do not copy the source skill body or support files.

## Generator

Run:

```bash
python3 .codex/build-codex-skills.py
```

Verify without writing:

```bash
python3 .codex/build-codex-skills.py --check
```

The generator preserves these frontmatter keys:

- `name`
- `description`
- `user-invocable`
- `argument-hint`

It intentionally omits Claude-only frontmatter such as `allowed-tools` and `model` from Codex wrappers.

## Acceptance Criteria

1. Claude Code can still load `.claude-plugin/plugin.json` and use the unchanged `skills/` directory.
2. Codex can load `.codex-plugin/plugin.json` and discover wrappers under `.codex/skills/`.
3. Source skill behavior is changed only in `skills/`; Codex adaptation is changed only in `.codex/`.
4. `.codex/skills/` contains thin wrappers, not full copies of source skills.
5. `python3 .codex/build-codex-skills.py --check` passes after generation.
6. README and `.codex/INSTALL.md` document the wrapper workflow.

# Codex Compatibility Implementation Plan

Status: first-pass implemented. The generic Codex compatibility layer is present, generated Codex skills exist under `.codex/skills/`, and the existing Claude Code runtime remains unchanged. A dedicated `/auto-video` Codex override is intentionally deferred.

## Background

The repository currently uses a Claude Code plugin layout:

- `.claude-plugin/plugin.json` points Claude Code to `./skills/`.
- `skills/*/SKILL.md` contains 39 skills, including 9 user-invocable workflow entries.
- `agents/*.md` defines role prompts used by the Claude-oriented workflow design.
- `scripts/` contains local helpers used by skills through Bash.

The goal is to make the same plugin usable from Codex without changing the existing Claude Code usage:

```bash
claude --plugin-dir /path/to/ShortVideoDirector
```

The main compatibility issue is not the business content of the skills. The skill content is already mostly portable. The issue is that the skills mention Claude runtime concepts such as `Skill tool`, `Agent`, `CronCreate`, `CronList`, `CronDelete`, `allowed-tools`, and `opus` / `sonnet` model hints. Codex needs a runtime mapping before executing those instructions.

## Goals

1. Keep Claude Code behavior unchanged.
2. Avoid putting Codex-only runtime instructions in `AGENTS.md`.
3. Make Codex load user-facing workflows from a Codex plugin manifest.
4. Inject a Codex tool/runtime mapping before every generated Codex skill.
5. Keep the original `skills/` directory as the single human-edited source of truth.
6. Make the generated Codex skills deterministic and easy to verify.

## Non-goals

1. Do not migrate this repo to a full `src/ -> generated runtime artifacts` architecture in the first implementation.
2. Do not change Claude Code installation or invocation.
3. Do not edit the source `skills/*/SKILL.md` just to satisfy Codex.
4. Do not introduce `AGENTS.md` for Codex-only behavior.
5. Do not implement opencode compatibility as part of this plan.

## Proposed layout

Add Codex-specific files alongside the existing Claude plugin files:

```text
ShortVideoDirector/
├── .claude-plugin/
│   └── plugin.json                  # Existing Claude Code manifest; unchanged
├── .codex-plugin/
│   └── plugin.json                  # New Codex plugin manifest
├── .codex/
│   ├── CODEX_COMPAT_IMPLEMENTATION_PLAN.md
│   ├── INSTALL.md                   # Codex installation and usage notes
│   ├── tool-mapping.md              # Shared Codex runtime mapping
│   ├── build-codex-skills.py        # Deterministic generator
│   └── skills/                      # Generated Codex skill artifacts
├── agents/
├── scripts/
├── skills/                          # Claude Code source of truth
└── README.md
```

`skills/` remains the canonical source. `.codex/skills/` is generated and should not be edited by hand.

## Codex manifest

Add `.codex-plugin/plugin.json`:

```json
{
  "name": "short-video-director",
  "version": "1.0.0",
  "description": "将故事创意转化为 AI 视频分镜提示词和资产图像提示词的多 Agent 协作系统",
  "skills": "./.codex/skills/",
  "interface": {
    "displayName": "Short Video Director",
    "shortDescription": "Story-to-video planning workflows for Codex",
    "developerName": "Hikaru518",
    "category": "Creative",
    "capabilities": ["Interactive", "Read", "Write"]
  }
}
```

The important part is that Codex points to `./.codex/skills/`, while Claude Code continues to point to `./skills/`.

## Tool mapping injection

Create `.codex/tool-mapping.md` as the shared runtime note. The generator inserts this content near the top of every generated Codex `SKILL.md`.

Draft mapping:

```md
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
- For `/auto-video`, prefer Codex automation support when available.
- If Codex automation is unavailable, use an in-session loop with the requested interval, or instruct the user to run `/check-video <target> --auto` periodically.
- Never bypass the safety rules in `check-video` or `creator-video-dreamina`.

## Model hints

- Claude `model: opus` and `model: sonnet` are advisory only in Codex.
- In Codex, use the active model unless the user explicitly asks for a different model.

## Tool allowlists

- Claude `allowed-tools` metadata is advisory only in generated Codex skills.
- If a named Claude tool is unavailable in Codex, apply this mapping instead of failing solely because the tool name differs.
```

This mapping is intentionally Codex-only. It should not be placed in `AGENTS.md`, because `AGENTS.md` can be consumed by other tools and IDEs.

## Generator behavior

Add `.codex/build-codex-skills.py`.

The script should:

1. Read `.codex/tool-mapping.md`.
2. Delete and recreate `.codex/skills/`.
3. Iterate over every `skills/<skill-name>/` directory.
4. Copy non-`SKILL.md` support files into `.codex/skills/<skill-name>/`.
   - Examples: `rules.md`, `config-template.md`, `failure-classification.md`.
5. Read `skills/<skill-name>/SKILL.md`.
6. Parse the frontmatter block.
7. Generate `.codex/skills/<skill-name>/SKILL.md` with:
   - Codex-safe frontmatter.
   - The injected tool mapping.
   - The original skill body.

### Frontmatter policy

Generated Codex skills should preserve user-facing and routing metadata:

- `name`
- `description`
- `user-invocable`
- `argument-hint`

Generated Codex skills should drop or demote Claude-only metadata:

- `allowed-tools`
- `model`

Those fields should not be needed for Codex execution because the injected mapping explains how to interpret the Claude runtime assumptions. Dropping them also avoids exposing unsupported Claude tool names such as `CronCreate` as if they were literal Codex tools.

### Generated skill shape

Example generated file:

```md
---
name: series-video
description: 将故事创意转化为AI视频分镜提示词和资产图像提示词。支持持续创作，自动检测新故事/续写模式。输入故事点子、原文或概述，输出完整的分镜和资产提示词。使用 /series-video 启动，/series-video config 编辑配置。
user-invocable: true
argument-hint: "[总集数] [故事材料|文件路径]"
---

<!-- BEGIN CODEX RUNTIME MAPPING: generated from .codex/tool-mapping.md -->

# Codex Runtime Mapping

...

<!-- END CODEX RUNTIME MAPPING -->

<!-- BEGIN ORIGINAL SKILL: skills/series-video/SKILL.md -->

## 总流程

...

<!-- END ORIGINAL SKILL -->
```

The original source file should remain unchanged.

## User-facing workflows

The current user-invocable skills are:

- `auto-video`
- `check-video`
- `generate-video`
- `series-edit-story`
- `series-repair-story`
- `series-video`
- `short-edit-story`
- `short-repair-story`
- `short-video`

All 39 skills should be generated into `.codex/skills/`, not only the user-facing entries. Internal workflows such as `new-story`, `continue-story`, `director-outline`, and `writer-novel` are needed because user-facing workflows call them by skill name.

## Handling `/auto-video`

`auto-video` is the highest-risk compatibility point because the source skill currently uses Claude Cron tools.

The first implementation should keep the source `skills/auto-video/SKILL.md` unchanged and rely on the injected mapping to reinterpret Cron behavior in Codex:

- `CronCreate` maps to Codex automation support when available.
- `CronList` maps to listing existing Codex automations when available.
- `CronDelete` maps to deleting the matching Codex automation when available.
- If automation support is unavailable, the skill should fall back to an in-session loop or tell the user to run `/check-video <target> --auto` periodically.

If testing shows the injected mapping is not strong enough for reliable `/auto-video` behavior, add a second-phase Codex-only override file:

```text
.codex/overrides/auto-video.md
```

The generator can then insert the override before the original `auto-video` body. This should be reserved for `/auto-video`; the other workflows should use the generic mapping.

## Installation documentation

Add `.codex/INSTALL.md` with:

1. How to install or point Codex at the local plugin.
2. The fact that Codex reads `.codex-plugin/plugin.json`.
3. The user-facing workflow list.
4. A warning that `skills/` is the Claude source and `.codex/skills/` is generated.
5. The build command:

```bash
python3 .codex/build-codex-skills.py
```

Do not recommend a bare symlink from `~/.agents/skills` to `.codex/skills` as the primary path unless it is verified, because these skills also reference repository-root resources such as `scripts/`, `agents/`, and the original `skills/` paths.

## README update

Add a short Codex section to `README.md`, after the Claude installation section:

```md
## Codex

Codex support is provided through `.codex-plugin/plugin.json`.

Claude Code continues to use `.claude-plugin/plugin.json` and `skills/` directly. Codex uses generated skills under `.codex/skills/`, which inject Codex runtime mapping before the original skill instructions.

To regenerate Codex skills after editing `skills/`:

```bash
python3 .codex/build-codex-skills.py
```
```

Keep this section concise. The detailed Codex-only instructions should live in `.codex/INSTALL.md`.

## Verification

After implementation, verify:

```bash
python3 .codex/build-codex-skills.py
git diff -- skills .claude-plugin
find skills -mindepth 1 -maxdepth 1 -type d | wc -l
find .codex/skills -mindepth 1 -maxdepth 1 -type d | wc -l
rg -l '^user-invocable: true' skills/*/SKILL.md | wc -l
rg -l '^user-invocable: true' .codex/skills/*/SKILL.md | wc -l
```

Expected:

- `git diff -- skills .claude-plugin` prints nothing.
- Source skill count and generated Codex skill count match.
- Source user-invocable count and generated user-invocable count match.
- Generated `series-video` includes the Codex runtime mapping before the original body.
- Generated `auto-video` includes the Codex runtime mapping and no literal Codex frontmatter dependency on `CronCreate`.

## Acceptance criteria

1. Claude Code can still use:

   ```bash
   claude --plugin-dir /path/to/ShortVideoDirector
   ```

2. `.claude-plugin/plugin.json` is unchanged unless a separate Claude-side change is intentionally requested.
3. Source `skills/` files are unchanged by Codex compatibility generation.
4. Codex has a plugin manifest at `.codex-plugin/plugin.json`.
5. Codex generated skills exist under `.codex/skills/`.
6. Every generated skill includes the Codex runtime mapping.
7. Internal skill calls remain available because all 39 skills are generated.
8. `/auto-video` has a documented Codex fallback path for Cron behavior.

## Review questions before implementation

1. Should generated `.codex/skills/` be committed, or should users generate it locally after clone?
   - Recommended: commit it, so the plugin works immediately after clone.
2. Should `model: opus` / `model: sonnet` be dropped from generated frontmatter or preserved as comments?
   - Recommended: drop from frontmatter and explain in the injected mapping.
3. Should `/auto-video` rely on the generic tool mapping first, or should we immediately add a Codex-specific override?
   - Recommended: start with generic mapping, then add an override only if testing shows unreliable behavior.
4. Should README include only a short Codex section, or should it include full install details?
   - Recommended: short README section plus detailed `.codex/INSTALL.md`.

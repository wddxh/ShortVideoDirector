---
name: storyboarder-asset-list
description: Storyboarder提取本集使用的所有资产（标注新增/已有），写入ep outline.md。
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

<!-- BEGIN ORIGINAL SKILL: skills/storyboarder-asset-list/SKILL.md -->

## 输入

### 文件读取
- `story/episodes/$ARGUMENTS[0]/novel.md` 或 `story/episodes/$ARGUMENTS[0]/script.md` — 必须读取（优先 novel.md，若不存在则读取 script.md）
- `assets/**/*.md` — 使用 Glob 获取所有文件路径列表（判断资产新增/已有）

### 动态参数（$ARGUMENTS）
- `$ARGUMENTS[0]` — 当前集数（如 ep01）

## 职责描述

阅读本集小说原文或剧本，提取本集使用的所有角色、造型变体、物品、场景和建筑，标注每个资产是新增还是已有，生成完整资产清单。

## 输出格式

```markdown
## 本集资产清单

### 新增资产

#### 新角色
- **{角色名}：** {外貌/性格简要描述}

#### 角色造型变体
- **{角色名}-{造型名}：** {造型描述}

#### 新物品
- **{物品名}：** {简要描述}

#### 新场景
- **{场景名}：** {环境简要描述}

#### 新建筑
- **{建筑名}：** {简要描述}

### 已有资产（本集出场）
- **{资产名}（{类型}）：** {本集出场简述}
```

每个新增子分类下无新增时标注"无"。已有资产无出场时省略该分类或标注"无"。

## 规则

- 造型变体命名格式：`{角色名}-{造型名}`（如 `张三-战斗装`）
- 当角色在本集中更换服装/装备时，必须为新造型创建独立的造型变体条目
- **变体必要性判断** — 提出造型变体前，先判断该造型变化是否对剧情有实质影响（如身份转变、关键场景需要等）。若服装变化对剧情无实质影响，则不提变体需求，直接使用基础资产。
- **必须通过 Glob 检查 assets/ 下已有文件来判断资产是新增还是已有** — 在 assets/ 文件路径列表中能找到对应文件的资产列为「已有资产（本集出场）」，否则列为新增资产。

## 输出

### 文件操作
- 使用 Edit 在 `story/episodes/$ARGUMENTS[0]/outline.md` 末尾追加「本集资产清单」章节

<!-- END ORIGINAL SKILL -->

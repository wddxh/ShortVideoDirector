---
name: creator-generate-images
description: 批量为指定集的资产生成参考图片。读取config后将工作委托给对应的模型skill。
user-invocable: false
---

# Codex 适配器

这是生成的 Codex 适配层。源 skill 仍是唯一事实来源，位置为 `skills/creator-generate-images/SKILL.md`。

不要手动编辑这个适配层。只有在确实需要改变 Claude 行为时才修改源 skill，然后运行 `python3 .codex/build-codex-skills.py` 重新生成适配层。

## 运行时映射

# Codex 运行时映射

本仓库保持 `skills/` 下的 Claude Code skill 不变。Codex 加载 `.codex/skills/` 下生成的适配层；每个适配层会应用本映射，然后执行原始源 skill。

## 文件和 Shell 工具

- Claude `Read` 表示读取当前工作区中的本地文件。
- Claude `Write` 表示在当前工作区创建或覆盖本地文件。
- Claude `Edit` 表示对本地文件进行定向修改。
- Claude `Glob` 表示按模式查找文件。
- Claude `Grep` 表示搜索文件内容，优先使用 `rg`。
- Claude `Bash` 表示在 skill 必要时执行本地 shell 命令。

## Skill 调用

- `使用 Skill tool 调用 <skill-name> skill` 表示调用或执行名为 `<skill-name>` 的 Codex 适配层 skill。
- 如果不能直接调用 skill，则读取 `skills/<skill-name>/SKILL.md`，并带着原始参数执行其中的说明。
- 传递参数时保留源 skill 的 `$ARGUMENTS` 约定。

## Agent 调用

- Claude `Agent` 表示在可用时委托给 Codex sub-agent。
- 如果存在匹配的角色，则使用 `agents/<role>.md` 中的角色意图。
- 如果当前环境不支持自定义角色注入，则在当前 Codex 会话中执行委托任务，并遵循对应角色提示词。

## 定时任务和自动化

- Claude `CronCreate`、`CronList` 和 `CronDelete` 不是 Codex 中的字面工具名。
- 对于 `/auto-video`，优先使用 Codex automation 能力。
- 如果当前环境没有 Codex automation 能力，则使用手动或外部周期性调用 `/check-video <target> --auto`。
- 不得绕过 `check-video` 或 `creator-video-dreamina` 中的安全规则。

## 模型提示

- Claude `model: opus` 和 `model: sonnet` 在 Codex 中仅作为提示信息。
- 在 Codex 中，除非用户明确要求切换模型，否则使用当前活动模型。

## 工具白名单

- 源 skill 中的 Claude `allowed-tools` 元数据在 Codex 中仅作为提示信息。
- 如果某个 Claude 工具名在 Codex 中不可用，不要仅因为工具名不同而失败，应按本映射执行。

## 执行源 Skill

1. 读取 `skills/creator-generate-images/SKILL.md`，并使用用户的原始参数执行该 skill 的说明。
2. 将 `skills/creator-generate-images/` 视为源 skill 目录。当源 skill 引用 `rules.md` 或 `config-template.md` 等同级文件时，相对该目录解析。
3. 将 `scripts/`、`agents/`、`story/`、`assets/` 和 `config.md` 等仓库根路径视为相对当前工作区根目录的路径。
4. 执行本适配层时，不要复制或修改源 skill 说明。

---
name: director-review-storyboard
description: Director审核Storyboarder分镜，检查叙事完整性、节奏、台词密度和技术合规性。
user-invocable: false
---

# Codex 适配器

这是生成的 Codex 适配层。源 skill 仍是唯一事实来源，位置为 `${CLAUDE_PLUGIN_ROOT}/skills/director-review-storyboard/SKILL.md`。

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
- 如果不能直接调用 skill，则读取 `${CLAUDE_PLUGIN_ROOT}/skills/<skill-name>/SKILL.md`，并带着原始参数执行其中的说明。
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

## Plugin-rooted Path 解析

源 skill 使用 `${CLAUDE_PLUGIN_ROOT}/...` 引用 plugin 内文件（meta rules / 跨 skill rules / scripts）。Codex 已**原生**为 plugin 进程设置 `CLAUDE_PLUGIN_ROOT` 环境变量（与 Claude Code 兼容；详见 OpenAI Codex plugins 文档）。

**bash 工具调用**：`${CLAUDE_PLUGIN_ROOT}` 由 bash 直接展开。例：
```bash
bash ${CLAUDE_PLUGIN_ROOT}/scripts/read-config.sh "总集数"
```

**Read 工具调用 plugin 内文件**：Codex 不在 skill content 做 inline 替换。LLM 需先取得 literal 路径再用 Read：
1. 跑 bash `echo $CLAUDE_PLUGIN_ROOT` 取得绝对路径
2. 拼接构造完整路径
3. 用 Read 工具读取该绝对路径

或更简：用 bash `cat ${CLAUDE_PLUGIN_ROOT}/path/to/file` 一次性读取并加入上下文。

## 执行源 Skill

1. 读取 `${CLAUDE_PLUGIN_ROOT}/skills/director-review-storyboard/SKILL.md`，并使用用户的原始参数执行该 skill 的说明。
2. 将 `${CLAUDE_PLUGIN_ROOT}/skills/director-review-storyboard/` 视为源 skill 目录。当源 skill 引用 `rules.md` 或 `config-template.md` 等同级文件时，相对该目录解析。
3. plugin directory 是 `${CLAUDE_PLUGIN_ROOT}`；plugin 内 scripts/agents/skills 相对它解析。项目的 story/assets/config.md 仍相对当前工作区根目录。
4. 执行本适配层时，不要复制或修改源 skill 说明。

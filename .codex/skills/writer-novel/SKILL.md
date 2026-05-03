---
name: writer-novel
description: Writer根据大纲生成具有画面感和紧凑叙事节奏的小说原文。自动读取大纲、config和角色资产。
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

<!-- BEGIN ORIGINAL SKILL: skills/writer-novel/SKILL.md -->

## 输入

### 文件读取
- `story/episodes/$ARGUMENTS[0]/outline.md` — 必须读取
- `story/outline.md` — 必须读取
- `config.md` — 必须读取
- `assets/characters/*.md` — 若 `assets/characters/` 下有文件则全部读取（角色一致性参考）
- 最近 M 集 novel.md — 若 `assets/characters/` 下有文件（说明非第一集），根据 config.md 中 `上下文集数` M，使用 Glob 匹配 `story/episodes/ep*/novel.md` 找到最近 M 集并读取
- `skills/writer-novel/rules.md` — 必须读取并严格遵循（输出格式、输出约束、规则）

### 动态参数（$ARGUMENTS）
- `$ARGUMENTS[0]` — 当前集数（如 ep01）

## 职责描述

### 核心使命

把本集大纲扩展成具有画面感的小说原文。下游消费者是 storyboarder-storyboard（拆分镜）和 director-review-novel（审稿）：storyboarder 不会重新创作画面——他把你写的画面转成镜头语言，所以你的画面密度直接决定分镜质量；如果你的小说只有"角色 A 告诉角色 B 这件事"，下游必须二次发挥，分镜会变成无视觉细节的对白堆。审核者关心的是大纲一致性、人物塑造、铺垫充分度，不是文学技巧。

### 工作思路

1. 先通读 outline，标出本集每个「主要事件」对应的画面场景、参与角色、关键信息点
2. 对照「本集信息传达」清单，规划每条信息怎样落到具体段落（对话/独白/动作）
3. 决定铺垫的密度和节奏——大纲只列节点，铺垫是你的工作；为每个转折至少安排一两段铺垫
4. 动笔每段时，先想"读者眼前看到什么"再写台词和心理——画面在前，对白在后
5. 集尾呼应大纲设定的集尾钩子，最后一段必须留下"接下来会怎样"的悬念
6. 续集时参考最近 M 集 novel.md 保持人物声音和叙事节奏一致

### 常见误区

- **复述大纲** — 大纲是最近读到的最结构化输入，模型本能拿它当骨架，结果"小说像加了形容词的大纲"；识别信号：你的小说每一段对应大纲的一句话 — 每段先建立画面/感官细节，再进剧情
- **跳过铺垫只写转折** — 大纲只写关键节点，模型容易直接执行节点，导致后续转折突兀 — 在每个关键节点之前主动设计一两个铺垫（伏笔/对白/状态变化）
- **画面感稀薄** — 模型容易写"角色 A 想了想，告诉了角色 B 这件事"，画面外的总结，没有可视化的动作和场景 — 每个对话伴随动作、表情、环境细节
- **旁白式叙述** — rules.md 已禁但模型本能写"林知意此刻心如刀绞"，这是旁白不是画面 — 通过角色动作、表情、内心独白让读者推断情绪，不直接定性

## 规则参考

- `skills/writer-novel/rules.md` — 必须读取并严格遵循

## 输出

### 文件操作
- 使用 Write 将小说原文写入 `story/episodes/$ARGUMENTS[0]/novel.md`

<!-- END ORIGINAL SKILL -->

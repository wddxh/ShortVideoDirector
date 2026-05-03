---
name: scriptwriter-script
description: Scriptwriter根据大纲生成具有画面感和紧凑叙事节奏的剧本。自动读取大纲、config和角色资产。
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

<!-- BEGIN ORIGINAL SKILL: skills/scriptwriter-script/SKILL.md -->

## 输入

### 文件读取
- `story/episodes/$ARGUMENTS[0]/outline.md` — 必须读取
- `config.md` — 必须读取
- `assets/characters/*.md` — 若存在则全部读取（角色声音一致性参考）
- `skills/scriptwriter-script/rules.md` — 必须读取并严格遵循

### 动态参数（$ARGUMENTS）
- `$ARGUMENTS[0]` — 当前集数（如 ep01）

## 职责描述

### 核心使命

把短视频大纲扩展成具有画面感的剧本，按场景组织，每个场景包含地点、时间、氛围、动作、对白、内心独白、旁白和声音反应。下游消费者是 short-storyboard（拆分镜），它把你的剧本转成镜头序列；如果你的剧本只有抽象台词没有画面信息，下游必须替你想画面，分镜质量就掉。短视频时长有限（通常 1-3 分钟），台词必须每句服务剧情或塑造人物，没有冗余空间。

### 工作思路

1. 通读 outline，按事件流划分场景——一个场景=一个地点/时间/氛围块
2. 每个场景先想"画面"再写台词：地点在哪、光线如何、角色在做什么——这是 storyboarder 拆镜头的依据
3. 台词写每句前自问"这句话推进了什么/塑造了什么"——服务不了剧情或人物的台词删掉
4. 安排主角内心独白展现想法和判断，增强代入感；安排声音反应（吼叫/哭泣/叹息）增加听觉密度
5. 节奏按 config 时长目标分配——重要场景多留铺垫秒数，过渡场景压缩

### 常见误区

- **大纲扩写式写剧本** — 和 writer-novel 同根诱因，大纲最近读、最结构化 — 场景切分先于句子扩写
- **台词废话** — 模型容易写寒暄、自然客套（"你好""你来了"），看似真实但占用宝贵秒数；rules.md 已规定"台词精准"但模型本能写"自然对话" — 每句台词通过"剧情推进/人物塑造"二选一过滤
- **场景描写抽象** — 写"温馨的房间内"，下游分镜不知道画面是什么 — 地点要具体到家具/光线/物件，氛围要可视觉化
- **角色声音失忆** — 模型容易把所有角色写成相同语气；rules.md 已规定"角色声音一致"但模型本能用通用对话 — 写每个角色台词前对照其资产文件「声音特征」

## 规则参考

- `skills/scriptwriter-script/rules.md` — 必须读取并严格遵循

## 输出

### 文件操作
- 使用 Write 将剧本写入 `story/episodes/$ARGUMENTS[0]/script.md`

<!-- END ORIGINAL SKILL -->

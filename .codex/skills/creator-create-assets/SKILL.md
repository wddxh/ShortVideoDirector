---
name: creator-create-assets
description: Creator为新资产创建完整Markdown文件，包含视觉描述和图像生成提示词。
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

<!-- BEGIN ORIGINAL SKILL: skills/creator-create-assets/SKILL.md -->

## 输入

### 文件读取
- `story/episodes/$ARGUMENTS[0]/novel.md` — 必须读取
- `story/episodes/$ARGUMENTS[0]/outline.md` — 必须读取（从「本集资产清单」的「新增资产」部分获取资产列表）
- `config.md` — 必须读取（目标图像模型）
- `assets/**/*.md` — 使用 Glob 列出所有已有文件，选择性读取（风格一致性 + 查重）
- `skills/creator-create-assets/rules.md` — 必须读取并严格遵循（输出格式、规则）

### 动态参数（$ARGUMENTS）
- `$ARGUMENTS[0]` — 当前集数（如 ep01）

## 职责描述

### 核心使命

为本集出现的每个新资产（角色/物品/场景/建筑）创建 Markdown 文件，包含视觉描述和图像生成提示词。下游消费者是图像模型（用提示词生成参考图）和 storyboarder（用资产名引用、用图片作为视频生成参考）。视觉描述和图像提示词必须足够具体，让图像模型能生成稳定一致的形象——抽象描述（"美丽的女孩"）会导致每次生成都不一样，毁掉视频生成的资产一致性。

### 工作思路

1. 先用 Glob 列出所有已有资产，对照 outline 的「新增资产」清单查重——若名字相近或形象相似，使用已有资产而非新建
2. 通读 novel，提取每个新资产的视觉细节（外貌/服饰/物品材质/场景光线）
3. 视觉描述要详细到图像模型能复现：人物五官形状、肤色、眼睛颜色、发型、服装层次；物品材质纹理；场景光线空间
4. 图像提示词按 config 中目标图像模型的格式写，但语言严格遵循 config 语言设置
5. 人物基础资产用中性表情和姿态、日常便装——特殊造型作为造型变体单独建
6. 创建造型变体前对比基础资产，无明显视觉差异则拒绝创建

### 常见误区

- **视觉描述抽象** — 写"美丽的女孩"或"古朴的茶馆"，图像模型生成的每张图都不同 — 具象到具体细节（瓜子脸/单眼皮/丹凤眼/...）
- **自动切英文** — rules.md 已禁但模型本能认为"图像模型更适合英文" — 图像提示词的语言严格遵循 config 语言设置，不切换
- **造型变体滥创** — 模型本能为每个不同服装建变体，但 rules.md 规定"无明显剧情视觉区分则拒绝" — 创建前对比基础资产，问"这变体是否对剧情有视觉区分"
- **人物图像提示词漏服装** — 模型容易认为"基础资产是中性形象"就不写衣服，但 rules.md 要求必须包含完整服装描述 — 每个人物图像提示词都过一遍"五官/肤色/发型/服装"四件套

## 规则参考

- `skills/creator-create-assets/rules.md` — 必须读取并严格遵循

## 输出

### 文件操作
- 使用 Write 在 `assets/` 对应子目录（`characters/`、`items/`、`locations/`、`buildings/`）下创建每个资产的 `.md` 文件

<!-- END ORIGINAL SKILL -->

---
name: new-story
description: 新故事工作流。从零开始创建第一集：剧情选项→大纲→小说→资产→分镜，完整的单集生成流程。
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

<!-- BEGIN ORIGINAL SKILL: skills/new-story/SKILL.md -->

# New Story 工作流

> **术语说明：** 本文档中"阶段"指工作流的主要阶段（如阶段 1、阶段 2a），"步骤"指阶段内部的执行项（如步骤 1、步骤 2）。

## 输入

### 动态参数（$ARGUMENTS）
- `$ARGUMENTS[0]` — 工作模式（default / full-auto）
- `$ARGUMENTS[1]` — 总集数（数字，无则为空）
- `$ARGUMENTS[2]` — 故事材料（引号包裹，无则为空）

### 阶段 1: 初始化

1. 使用 Bash 创建目录结构：`story/`、`story/episodes/ep01/`、`assets/characters/`、`assets/items/`、`assets/locations/`、`assets/buildings/`
2. 执行**配置加载**流程：使用 Read 读取 config.md，若不存在则报错提示用户先运行 `/series-video` 进行交互式配置引导
3. 工作模式为 `$ARGUMENTS[0]`（default / full-auto）

### 阶段 1.5: 输入分流

- **`$ARGUMENTS[2]` 非空** → 进入**阶段 2b**（有故事材料）
- **`$ARGUMENTS[2]` 为空** → 进入**阶段 2a**（无故事材料）

### 阶段 2a: Director 生成主题选项

1. 使用 Skill tool 调用 `director-plot-options` skill（无参数）
2. 展示选项给用户：
   - **A/B/C** — 选择对应主题方向
   - **D. 重新生成** — 重新调用 `director-plot-options` skill（无参数），生成全新 3 个方向
   - **E. 告诉 Director 你的偏好** — 收集用户偏好描述，重新调用 `director-plot-options` skill，传递参数：`"{用户偏好描述}"`
   - **[default mode 下等待用户确认；full-auto mode 下 Director 自动选择]**
3. 用户选择 A/B/C → 继续阶段 3

### 阶段 2b: Director 生成输入确认说明

1. 使用 Skill tool 调用 `director-input-confirm` skill，传递参数：`"$ARGUMENTS[2]"`
2. 展示说明给用户：
   - **A. 确认** — 继续阶段 3
   - **B. 重新生成** — 重新调用 `director-input-confirm` skill，传递参数：`"{用户故事输入}"`
   - **C. 补充说明** — 收集用户反馈，重新调用 `director-input-confirm` skill，传递参数：`"{用户反馈内容}"`
   - **[default mode 下等待用户确认；full-auto mode 下 Director 自动确认]**
3. 用户选择 A → 继续阶段 3

### 阶段 2.5: 生成剧情弧线（仅当 `$ARGUMENTS[1]` 非空且 story/arc.md 不存在时执行）

1. 使用 Skill tool 调用 `director-arc` skill，传递参数：`$ARGUMENTS[1] "{选定的剧情方向}"`

### 阶段 3: Director 生成剧情大纲

1. 使用 Skill tool 调用 `director-outline` skill，传递参数：`ep01 "{选定的剧情方向}"`

### 阶段 4: Writer 生成小说原文

**4.1 Writer — 生成小说原文：**

1. 使用 Skill tool 调用 `writer-novel` skill，传递参数：`ep01`

**4.1b 字数校验：**

1. 使用 Bash 调用 `bash scripts/word-count.sh story/episodes/ep01/novel.md` 统计字数（自动检测语言）
2. 对比 config.md 中的 `每集小说字数` 范围
3. 若不在范围内 → 使用 Skill tool 调用 `writer-fix-novel` skill，传递参数：`ep01 "当前字数为{实际字数}，目标范围为{下限}-{上限}，请调整内容使字数符合要求"`（最多 2 轮，每轮修正后重新统计）

**4.2 Director — 审核小说原文：**

1. 使用 Skill tool 调用 `director-review-novel` skill，传递参数：`ep01`
2. 若"需修改"→ 使用 Skill tool 调用 `writer-fix-novel` skill，传递参数：`ep01 "{修改意见}"`（最多 2 轮）

### 阶段 5: 资产创建 + 分镜生成

**5a. Storyboarder — 生成资产清单：**

1. 使用 Skill tool 调用 `storyboarder-asset-list` skill，传递参数：`ep01`
   → 将资产清单写入 ep01/outline.md

**5b. 创建资产：**

1. 使用 Skill tool 调用 `creator-create-assets` skill，传递参数：`ep01`

**5c. 生成分镜 + 生成资产图片（并行）：**

若 config 中图像模型非 `none`，以下两条线并行执行（分镜流程不等待图片完成）：

**图片生成线（后台）：**
使用 Skill tool 调用 `creator-generate-images` skill，传递参数：`ep01`

**分镜流程线（前台，正常推进）：**
1. 使用 Skill tool 调用 `storyboarder-storyboard` skill，传递参数：`ep01`

若 config 中图像模型为 `none`，仅执行分镜流程线。

**5d. Director — 审核分镜：**

1. 使用 Skill tool 调用 `director-review-storyboard` skill，传递参数：`ep01`
2. 若"需修改"→ 使用 Skill tool 调用 `storyboarder-fix-storyboard` skill，传递参数：`ep01 "{修改意见}"`（最多 2 轮）

### 阶段 6: 完成

1. 输出本集摘要：集数编号、镜头数量（分镜数量）、新建资产列表
2. 提示用户可以使用 `/series-video` 继续创作下一集
3. **本次执行到此结束。** 不得自动继续生成下一集或更多集数的内容。

<!-- END ORIGINAL SKILL -->

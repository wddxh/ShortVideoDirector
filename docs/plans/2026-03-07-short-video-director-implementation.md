# ShortVideoDirector Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a standalone Claude Code skill plugin that converts story ideas into AI video storyboard prompts and asset image prompts through a 3-agent pipeline.

**Architecture:** A Claude Code skill plugin with a main `skill.md` orchestrator and 3 subagent prompt files (`director.md`, `writer.md`, `creator.md`). The skill auto-detects new vs. continue mode, dispatches agents sequentially via the Agent tool, and writes outputs to a structured directory in the user's project.

**Tech Stack:** Claude Code skill system (markdown-based), Agent tool for subagent dispatch, Read/Write/Glob tools for file operations.

---

### Task 1: Create config template

**Files:**
- Create: `templates/config.md`

**Step 1: Create the config template file**

```markdown
# ShortVideoDirector 配置

## 模型配置
- 视频模型: generic          # generic / kling / runway / pika
- 图像模型: generic          # generic / midjourney / flux / dall-e

## 创作配置
- 语言: auto                 # auto(跟随输入语言) / zh / en
- 每集分镜数: 15             # 建议10-20
- 每集时长目标: 1-2分钟
- 上下文集数: 3              # continue mode时Director读取前N集novel.md
- 默认模式: review           # review / fast
```

**Step 2: Commit**

```bash
git add templates/config.md
git commit -m "feat: add config template for ShortVideoDirector"
```

---

### Task 2: Write Director Agent prompt

**Files:**
- Create: `agents/director.md`

**Step 1: Write the Director agent system prompt**

The Director agent prompt must cover:

1. **角色定义：** 经验丰富的短视频导演，全局统筹，擅长跌宕起伏的剧情和悬念设置
2. **职责明确列出：**
   - 根据用户输入生成本集剧情大纲
   - 维护 story/outline.md（append-only，不修改已有内容）
   - 将小说原文转化为分镜提示词（Rich格式：镜头编号、类型、视觉描述、时长、镜头运动、对白/旁白、音效、转场）
   - 为 Creator agent 生成资产清单（列出需要新建的人物/物品/场景/建筑）
   - Review mode 下审核 Writer 输出（最多2轮修改反馈）
3. **输入格式说明：**
   - New mode: 用户原始输入 + config
   - Continue mode: 用户新输入 + outline.md + 最近N集 novel.md
4. **输出格式规范：**
   - 剧情大纲格式（含集数、主要事件、悬念点）
   - 分镜提示词格式（顶部引用列表 + 每个镜头的完整Rich格式）
   - 资产清单格式（分类列出新角色/物品/场景/建筑及其简要描述）
   - 追加到 outline.md 的内容格式
5. **关键规则：**
   - 每集结尾必须设置悬念钩子
   - outline.md 只追加不修改
   - 分镜引用角色/资产时使用 Hybrid 模式（短描述+顶部引用）
   - 分镜数量参考 config 中的设定
   - Continue mode 下保持剧情连续性
6. **分镜模板：**

```markdown
# 第X集 分镜提示词

## 资产引用
- [角色名](../../assets/characters/角色名.md) - 短描述
- [物品名](../../assets/items/物品名.md) - 短描述

## 分镜

### 镜头 1
- **镜头类型：** 全景/中景/特写/etc
- **视觉描述提示词：** （适用于AI视频模型的提示词）
- **时长：** Xs
- **镜头运动：** 推/拉/摇/移/固定/etc
- **对白/旁白：** "..."
- **音效/音乐：** 描述
- **转场：** 切/淡入淡出/etc
```

**Step 2: Commit**

```bash
git add agents/director.md
git commit -m "feat: add Director agent prompt"
```

---

### Task 3: Write Writer Agent prompt

**Files:**
- Create: `agents/writer.md`

**Step 1: Write the Writer agent system prompt**

The Writer agent prompt must cover:

1. **角色定义：** 热门网络小说作家，文笔精良，擅长悬念设置和人物描写
2. **职责：**
   - 根据 Director 提供的剧情大纲生成小说原文
   - 擅长从零碎信息拼凑完整故事
   - 根据要求续写故事
3. **输入格式说明：**
   - 本集剧情大纲（来自 Director）
   - outline.md（整体故事背景）
4. **输出格式规范：**
   - 小说原文，包含章节标题
   - 文字量适合 1-2 分钟短视频（约 800-1500 字）
   - 场景描写要具体、可视觉化（为后续分镜服务）
   - 人物外貌、动作、表情要有细节
5. **关键规则：**
   - 每集结尾呼应 Director 设定的悬念
   - 与 outline.md 中已有内容保持一致
   - 人物性格、说话风格保持连贯
   - 场景描写要足够详细以支撑视觉化

**Step 2: Commit**

```bash
git add agents/writer.md
git commit -m "feat: add Writer agent prompt"
```

---

### Task 4: Write Creator Agent prompt

**Files:**
- Create: `agents/creator.md`

**Step 1: Write the Creator agent system prompt**

The Creator agent prompt must cover:

1. **角色定义：** 经验丰富的创意总监，擅长视觉化和图像提示词创作
2. **职责：**
   - 根据 Director 提供的资产清单和小说原文，创建人物/资产的图像生成提示词
   - 检查已有 assets/ 避免重复创建
   - 保持新资产与已有资产风格一致
3. **输入格式说明：**
   - 本集 novel.md
   - Director 提供的资产清单
   - 已有 assets/ 文件内容（如有）
   - config.md 中的目标图像模型
4. **输出格式规范（每个资产文件）：**

```markdown
# 角色名/物品名

## 基本信息
- 首次出场：EPXX
- 类型：主角/配角/道具/场景/建筑

## 视觉描述
（自然语言的外观描述，作为一致性基准，详细具体）

## 图像生成提示词
（针对目标图像模型的提示词，根据 config 中模型配置调整格式）

## 出场记录
- EPXX: 简要描述在该集中的表现
```

5. **关键规则：**
   - 已有资产的"视觉描述"和"图像生成提示词"部分不可修改
   - 只能追加"出场记录"
   - 新资产创建前必须检查已有 assets/ 所有子目录
   - 根据 config 中的图像模型调整提示词格式
   - 人物描述需包含：外貌、服饰、气质、标志性特征
   - 物品描述需包含：外观、材质、尺寸、特殊效果
   - 场景/建筑描述需包含：整体氛围、光线、色调、关键细节

**Step 2: Commit**

```bash
git add agents/creator.md
git commit -m "feat: add Creator agent prompt"
```

---

### Task 5: Write main skill.md — metadata and input parsing

**Files:**
- Create: `skill.md`

**Step 1: Write skill.md with frontmatter, overview, and input parsing section**

The skill.md must include:

1. **Frontmatter:**
```yaml
---
name: short-video
description: 将故事创意转化为AI视频分镜提示词和资产图像提示词。支持持续创作，自动检测新故事/续写模式。输入故事点子、原文或概述，输出完整的分镜和资产提示词。
---
```

2. **Overview section** — 简要说明 skill 功能和 3 个 subagent

3. **Input parsing logic:**
   - 检查 args 是否为文件路径（以 .txt / .md 结尾）→ 读取文件内容
   - 检查 args 是否为 inline text → 直接使用
   - 如果无 args → 交互式询问用户输入
   - 特殊命令：args 为 "config" → 打开/编辑 config.md

4. **Mode detection logic:**
   - 使用 Glob 检查当前目录是否存在 `story/` 文件夹
   - 不存在 → new story mode
   - 存在 → continue mode，用 Glob 检测 `story/episodes/ep*/` 获取最新集数

5. **Config loading logic:**
   - 检查 config.md 是否存在
   - 不存在 → 从 templates/config.md 复制模板到项目根目录
   - 存在 → 读取并解析配置

**Step 2: Commit**

```bash
git add skill.md
git commit -m "feat: add skill.md with metadata, input parsing, and mode detection"
```

---

### Task 6: Write main skill.md — New Story workflow orchestration

**Files:**
- Modify: `skill.md`

**Step 1: Add New Story workflow section to skill.md**

This section defines the complete new story orchestration:

1. **Directory scaffolding:**
   - 创建 `story/`, `story/episodes/ep01/`, `assets/characters/`, `assets/items/`, `assets/locations/`, `assets/buildings/`

2. **Mode selection:**
   - 询问用户选择 review mode 或 fast mode（如果 config 中有默认值则提示默认值）

3. **Step 1 — Director creates outline:**
   - 调用 Agent tool，传入 agents/director.md 内容作为 prompt 的一部分
   - 提供用户输入和 config
   - 指示 Director 生成 EP01 剧情大纲
   - 将大纲写入 `story/episodes/ep01/outline.md`
   - 将整体大纲写入 `story/outline.md`
   - [Review mode] 展示大纲给用户确认，如不满意则重新调用 Director

4. **Step 2 — Writer creates novel:**
   - 调用 Agent tool，传入 agents/writer.md 内容
   - 提供本集大纲 + outline.md
   - 将输出写入 `story/episodes/ep01/novel.md`
   - [Review mode] Director Agent 审核 novel.md，提供修改意见，Writer 修改（最多2轮）

5. **Step 3 — Director + Creator (parallel):**
   - Director Agent：读取 novel.md → 生成分镜提示词 → 写入 `story/episodes/ep01/storyboard.md`，同时输出资产清单
   - Creator Agent：读取 novel.md + 资产清单 → 在 `assets/` 对应子目录创建资产文件
   - [Review mode] 展示分镜和资产给用户确认

6. **完成摘要：** 输出本集概要（集数、场景数、新资产数）

**Step 2: Commit**

```bash
git add skill.md
git commit -m "feat: add new story workflow orchestration to skill.md"
```

---

### Task 7: Write main skill.md — Continue Story workflow orchestration

**Files:**
- Modify: `skill.md`

**Step 1: Add Continue Story workflow section to skill.md**

This section defines the incremental continue workflow:

1. **Context gathering:**
   - 读取 `story/outline.md`
   - 检测最新集数 N，读取最近 `上下文集数`（config）集的 `novel.md`
   - 读取 `assets/` 中所有已有资产文件列表

2. **Step 1 — Director creates new episode outline:**
   - 调用 Agent tool with Director prompt
   - 提供：用户新输入 + outline.md + 最近N集 novel.md
   - 指示 Director 生成新集(EP{N+1})剧情大纲
   - 写入 `story/episodes/ep{N+1}/outline.md`
   - **Append** 新内容到 `story/outline.md`（不修改已有内容，使用 Edit tool 追加）
   - [Review mode] 展示大纲给用户确认

3. **Step 2 — Writer creates novel:**
   - 与 New Story 相同流程
   - 写入 `story/episodes/ep{N+1}/novel.md`
   - [Review mode] Director 审核（最多2轮）

4. **Step 3 — Director + Creator:**
   - Director 生成分镜提示词 + 判断是否需要新资产
   - 如需要新资产 → Creator Agent 读取已有 assets/ 后仅创建新资产
   - 如不需要 → 跳过 Creator
   - 已有资产文件仅追加"出场记录"条目
   - [Review mode] 展示结果给用户确认

5. **完成摘要**

**Step 2: Commit**

```bash
git add skill.md
git commit -m "feat: add continue story workflow orchestration to skill.md"
```

---

### Task 8: Integration review and final polish

**Files:**
- Review: `skill.md`, `agents/director.md`, `agents/writer.md`, `agents/creator.md`, `templates/config.md`

**Step 1: Read all files and verify consistency**

Check:
- skill.md 中引用的 agent 文件路径与实际一致
- 所有输出格式在 skill.md 和 agent prompts 之间一致
- 分镜模板在 director.md 和 skill.md 中一致
- 资产文件格式在 creator.md 和 skill.md 中一致
- config 字段在 templates/config.md 和 skill.md 解析逻辑中一致
- Continue mode 的 append-only 规则在所有文件中被强调

**Step 2: Fix any inconsistencies found**

**Step 3: Test the skill invocation**

Run a manual test by verifying:
- Skill frontmatter is valid YAML
- Agent prompt files are readable and well-structured
- Config template is valid

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete ShortVideoDirector skill plugin

Three-agent pipeline (Director, Writer, Creator) for converting
story ideas into AI video storyboard and asset image prompts.
Supports new story and continue story modes with review/fast options."
```

---

## Task Dependency Graph

```
Task 1 (config template) ─────────────────────┐
Task 2 (Director prompt) ─────────────────────┤
Task 3 (Writer prompt) ───────────────────────┤──→ Task 8 (integration review)
Task 4 (Creator prompt) ──────────────────────┤
Task 5 (skill.md base) → Task 6 (new flow) → Task 7 (continue flow) ──┘
```

Tasks 1-4 are independent and can be done in parallel.
Tasks 5 → 6 → 7 are sequential.
Task 8 depends on all previous tasks.

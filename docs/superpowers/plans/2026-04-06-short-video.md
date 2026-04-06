# 单集短视频功能实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增 `/short-video` 单集短视频创作功能，包含独立的工作流、新增 Scriptwriter agent 和 11 个新 skill。

**Architecture:** 新增入口 skill `short-video/` 驱动完整流水线：Director 生成大纲 → Scriptwriter 写剧本 → Director 审核 → Storyboarder 提取资产 → Creator 建资产 → Storyboarder 生成分镜 → Director 审核分镜。复用 `storyboarder-asset-list`（小幅修改）和 `creator-create-assets`（不改）。

**Tech Stack:** Claude Code Plugin（Markdown skill 文件、YAML frontmatter、Python 脚本）

**设计文档：** `docs/superpowers/specs/2026-04-06-short-video-design.md`

---

### Task 1: 新增 Scriptwriter Agent

**Files:**
- Create: `agents/scriptwriter.md`

- [ ] **Step 1: 创建 agent 定义文件**

```markdown
---
name: scriptwriter
description: 短视频编剧，擅长在极短篇幅内构建完整故事。将Director大纲转化为剧本，包含场景描述、角色动作、台词和情绪节奏提示。
tools: Read, Write, Edit, Glob, Grep
model: inherit
---

# Scriptwriter Agent — 短视频编剧

## 角色定义

短视频编剧，擅长在 1-2 分钟内讲完一个有吸引力的完整故事。精通各类短视频风格：搞笑反转、温馨治愈、悬疑烧脑、日常共鸣、情感冲击。台词设计精准，每句台词都为剧情推进或人物塑造服务，无废话。善于利用内心独白快速建立观众代入感。节奏感强，懂得在短篇幅内制造情绪起伏（铺垫 → 冲突 → 高潮 → 收束）。注重"可拍性"，场景描写服务于视觉呈现，避免难以影像化的抽象内容。

## 全局规则

1. **输出语言** — 所有输出内容的语言必须遵循 config.md 中的 `语言` 设置。auto 则跟随用户输入语言，zh 则全中文，en 则全英文。
2. **版权规避** — 不得使用现实中的明星或公众人物名字、真实地名、商标名，必要时使用虚构替代。
```

- [ ] **Step 2: 验证文件格式**

Run: `head -5 agents/scriptwriter.md`

确认 frontmatter 包含 name、description、tools、model 四个字段。

- [ ] **Step 3: Commit**

```bash
git add agents/scriptwriter.md
git commit -m "feat: add scriptwriter agent for single-episode short video"
```

---

### Task 2: 创建短视频配置模板

**Files:**
- Create: `skills/short-video/config-template.md`

- [ ] **Step 1: 创建配置模板文件**

参考 `skills/series-video/config-template.md` 的格式，去掉系列专属项（上下文集数、默认模式、每集小说字数），保留 8 项配置。

- [ ] **Step 2: 验证与系列配置模板的差异**

Run: `diff skills/series-video/config-template.md skills/short-video/config-template.md`

确认只少了 3 项配置，其余一致。

- [ ] **Step 3: Commit**

```bash
git add skills/short-video/config-template.md
git commit -m "feat: add short-video config template (8 settings)"
```

---

### Task 3: 创建 short-video 入口 skill

**Files:**
- Create: `skills/short-video/SKILL.md`

- [ ] **Step 1: 创建入口 skill**

参考 `skills/series-video/SKILL.md` 的结构，但做以下调整：
- `name: short-video`
- `description`: 单集短视频描述
- `user-invocable: true`
- `allowed-tools: Read, Write, Edit, Glob, Bash, Agent, Skill`
- `argument-hint: "[故事材料|文件路径]"`
- 去掉模式检测（无 new-story/continue-story 分支）
- 去掉总集数参数解析
- 配置引导使用 `short-video/config-template.md`（8 项，无上下文集数/默认模式/小说字数）
- 输入分流：有材料 → `short-input-confirm`，无材料 → `short-plot-options`
- 创建目录后直接执行流水线：`short-outline` → `scriptwriter-script` → `director-review-script`（含 fix 循环）→ `storyboarder-asset-list` → `creator-create-assets` → `short-storyboard` → `short-review-storyboard`（含 fix 循环）

具体的阶段划分、配置引导的每一项选项、输入解析规则、特殊命令 `config` 的处理，都参照 `skills/series-video/SKILL.md` 的对应部分，保持一致风格。

- [ ] **Step 2: 验证 frontmatter**

确认 `name: short-video`、`user-invocable: true`、`argument-hint` 存在。

- [ ] **Step 3: Commit**

```bash
git add skills/short-video/SKILL.md
git commit -m "feat: add short-video entry point skill"
```

---

### Task 4: 创建 short-plot-options skill

**Files:**
- Create: `skills/short-plot-options/SKILL.md`

- [ ] **Step 1: 创建 skill 文件**

frontmatter:
```yaml
---
name: short-plot-options
description: Director为单集短视频生成3个差异化剧情选项。自动读取config.md。
user-invocable: false
context: fork
agent: director
allowed-tools: Read, Write, Edit, Glob, Grep
---
```

参考 `skills/director-plot-options/SKILL.md` 的结构，但做以下调整：
- 输入文件读取：只读 `config.md`（去掉 arc.md、outline.md、前集 novel.md）
- 输出格式使用设计文档中的单集格式（剧名、剧情概要、结局类型、卖点分析）
- 3 个选项必须有明显差异（不同故事类型/风格）
- 用户选择规则：等待用户选择，不满意可重新生成或提供偏好
- 版权规避规则

- [ ] **Step 2: Commit**

```bash
git add skills/short-plot-options/SKILL.md
git commit -m "feat: add short-plot-options skill"
```

---

### Task 5: 创建 short-input-confirm skill

**Files:**
- Create: `skills/short-input-confirm/SKILL.md`

- [ ] **Step 1: 创建 skill 文件**

frontmatter:
```yaml
---
name: short-input-confirm
description: Director根据用户故事材料生成单集短视频的结构化确认说明。自动读取config.md。
user-invocable: false
context: fork
agent: director
allowed-tools: Read, Write, Edit, Glob, Grep
---
```

参考 `skills/director-input-confirm/SKILL.md` 的结构，但做以下调整：
- 输入文件读取：只读 `config.md`（去掉 arc.md、outline.md、前集 novel.md）
- 输出格式使用单集格式（剧名、剧情概要、结局类型、卖点分析）
- 等待用户确认，用户可以修改反馈
- 版权规避规则

- [ ] **Step 2: Commit**

```bash
git add skills/short-input-confirm/SKILL.md
git commit -m "feat: add short-input-confirm skill"
```

---

### Task 6: 创建 short-outline skill + rules

**Files:**
- Create: `skills/short-outline/SKILL.md`
- Create: `skills/short-outline/rules.md`

- [ ] **Step 1: 创建 rules.md**

包含设计文档中定义的大纲输出格式和规则：
- 输出格式：故事类型、开场策略、主要事件（起承转合）、角色出场、结局设计
- 规则：完整故事弧线、开场吸引力、节奏适配 1-2 分钟、结局类型灵活、主角姓名必须传达、版权规避、考虑 config.md 中的时长目标

- [ ] **Step 2: 创建 SKILL.md**

frontmatter:
```yaml
---
name: short-outline
description: Director为单集短视频生成详细大纲。自动读取config.md，写入ep01 outline。
user-invocable: false
context: fork
agent: director
allowed-tools: Read, Write, Edit, Glob, Grep
---
```

参考 `skills/director-outline/SKILL.md` 的结构，但做以下调整：
- 输入：`config.md`（必须读取）、`skills/short-outline/rules.md`（必须读取）
- 动态参数：`$ARGUMENTS[0]` — 用户选择的剧情方向（完整引用文本）
- 输出：只写 `story/episodes/ep01/outline.md`（不写 `story/outline.md`）
- 去掉 arc.md 读取、多集上下文、append-only 逻辑、continue-story 分支

- [ ] **Step 3: Commit**

```bash
git add skills/short-outline/SKILL.md skills/short-outline/rules.md
git commit -m "feat: add short-outline skill with single-episode rules"
```

---

### Task 7: 创建 scriptwriter-script skill + rules

**Files:**
- Create: `skills/scriptwriter-script/SKILL.md`
- Create: `skills/scriptwriter-script/rules.md`

- [ ] **Step 1: 创建 rules.md**

包含剧本的输出格式和写作规则：

输出格式：
```markdown
# {剧名} 剧本

## 场景 1: {场景名称}
**地点：** {具体地点}
**时间：** {时间描述}
**氛围：** {环境氛围、光线、声音环境}

{场景叙事}

## 场景 2: {场景名称}
...
```

规则：
1. **台词精准** — 每句台词都必须为剧情推进或人物塑造服务，无废话
2. **丰富台词设计** — 对白、内心独白、旁白、声音反应（吼叫、哭泣、叹息等），同时场景描写和动作描写要足够详细
3. **场景具象化** — 场景描写必须具体、可视觉化，多用具象描写而非抽象叙述
4. **节奏适配** — 考虑 config.md 中的 `每集时长目标`，合理安排叙事节奏
5. **遵循大纲** — 必须遵循大纲的故事弧线和结局设计
6. **角色声音一致** — 角色声音特征必须与资产文件中的描述一致
7. **主角内心独白** — 多设计主角的内心独白，展现主角的想法、感受和判断，增强观众代入感
8. **禁止旁白式叙述** — 场景信息应通过角色对话、自白或反应来传达
9. **版权规避** — 不得使用现实中的明星或公众人物名字、真实地名、商标名
10. **输出语言** — 遵循 config.md 中的语言设置

- [ ] **Step 2: 创建 SKILL.md**

frontmatter:
```yaml
---
name: scriptwriter-script
description: Scriptwriter根据大纲生成具有画面感和紧凑叙事节奏的剧本。自动读取大纲、config和角色资产。
user-invocable: false
context: fork
agent: scriptwriter
allowed-tools: Read, Write, Edit, Glob, Grep
---
```

结构参考 `skills/writer-novel/SKILL.md`，但做以下调整：
- 输入文件：`story/episodes/$ARGUMENTS[0]/outline.md`（必须读取）、`config.md`（必须读取）、`assets/characters/*.md`（若存在）、`skills/scriptwriter-script/rules.md`（必须读取）
- 动态参数：`$ARGUMENTS[0]` — 当前集数（如 ep01）
- 输出：使用 Write 写入 `story/episodes/$ARGUMENTS[0]/script.md`
- 去掉前集 novel.md 读取、`story/outline.md` 读取

- [ ] **Step 3: Commit**

```bash
git add skills/scriptwriter-script/SKILL.md skills/scriptwriter-script/rules.md
git commit -m "feat: add scriptwriter-script skill with rules"
```

---

### Task 8: 创建 scriptwriter-fix-script skill

**Files:**
- Create: `skills/scriptwriter-fix-script/SKILL.md`

- [ ] **Step 1: 创建 skill 文件**

frontmatter:
```yaml
---
name: scriptwriter-fix-script
description: Scriptwriter根据Director修改意见定向修正剧本。读取现有剧本，只修改指出的问题。
user-invocable: false
context: fork
agent: scriptwriter
allowed-tools: Read, Write, Edit, Glob, Grep
---
```

参考 `skills/writer-fix-novel/SKILL.md` 的结构：
- 输入文件：`story/episodes/$ARGUMENTS[0]/script.md`（必须读取）、`story/episodes/$ARGUMENTS[0]/outline.md`（必须读取）、`config.md`（必须读取）、`assets/characters/*.md`（若存在）、`skills/scriptwriter-script/rules.md`（必须读取）
- 动态参数：`$ARGUMENTS[0]` — 当前集数，`$ARGUMENTS[1]` — 修改意见（引号包裹）
- 输出：使用 Write 重写 `story/episodes/$ARGUMENTS[0]/script.md`
- 规则：仅修改 Director 指出的问题，不改动未提及的内容

- [ ] **Step 2: Commit**

```bash
git add skills/scriptwriter-fix-script/SKILL.md
git commit -m "feat: add scriptwriter-fix-script skill"
```

---

### Task 9: 创建 director-review-script skill

**Files:**
- Create: `skills/director-review-script/SKILL.md`

- [ ] **Step 1: 创建 skill 文件**

frontmatter:
```yaml
---
name: director-review-script
description: Director审核Scriptwriter剧本，检查故事完整性、节奏、人物一致性和结局执行。
user-invocable: false
context: fork
agent: director
allowed-tools: Read, Write, Edit, Glob, Grep
---
```

参考 `skills/director-review-novel/SKILL.md` 的结构：
- 输入文件：`story/episodes/$ARGUMENTS[0]/outline.md`（必须读取）、`story/episodes/$ARGUMENTS[0]/script.md`（必须读取）、`assets/characters/*.md`（若存在）
- 动态参数：`$ARGUMENTS[0]` — 当前集数
- 规则参考：`skills/scriptwriter-script/rules.md` — 必须读取，按照其中的规则逐条审核
- 导演专属审核重点：故事完整性、节奏、人物一致性、结局执行
- 输出格式：通过 / 需修改 + 修改意见列表（与 director-review-novel 一致）
- 最多 2 轮反馈，包含版权规避检查

- [ ] **Step 2: Commit**

```bash
git add skills/director-review-script/SKILL.md
git commit -m "feat: add director-review-script skill"
```

---

### Task 10: 创建 short-storyboard skill + rules

**Files:**
- Create: `skills/short-storyboard/SKILL.md`
- Create: `skills/short-storyboard/rules.md`

- [ ] **Step 1: 创建 rules.md**

从 `skills/storyboarder-storyboard/rules.md` 复制，然后做以下修改：
- 删除规则 1（第一集定位 — "后续剧情留给后续剧集"）
- 删除规则 2（集间连贯性）
- 修改规则 5（结尾收束）— 从"悬念钩子吸引继续观看"改为"根据故事类型选择合适的结局方式（反转、温馨、开放、幽默、自然等）。最后一个镜头的最后几秒必须包含结束转场效果（如画面渐暗淡入黑幕、淡出等），不得直接画面中断。转场效果不宜过长，1-2 秒即可"
- 修改规则 6（台词密度）— "优先使用 Writer 小说原文中的内容"改为"优先使用 Scriptwriter 剧本中的内容"
- 修改规则 16（信息传达）— "结合原文和大纲"改为"结合剧本和大纲"
- 重新编号（从 1 开始连续编号）
- 输出格式、字段约束、格式提醒部分与系列版完全一致

- [ ] **Step 2: 创建 SKILL.md**

frontmatter:
```yaml
---
name: short-storyboard
description: Storyboarder将剧本转化为完整分镜提示词。包含内部自检循环（最多3轮）。
user-invocable: false
context: fork
agent: storyboarder
allowed-tools: Read, Write, Edit, Glob, Grep
---
```

参考 `skills/storyboarder-storyboard/SKILL.md` 的结构，但做以下调整：
- 输入文件：`story/episodes/$ARGUMENTS[0]/outline.md`（本集资产清单）、对应资产文件、`story/episodes/$ARGUMENTS[0]/script.md`（替代 novel.md）、`config.md`、`skills/short-storyboard/rules.md`
- 去掉前集 outline.md 和 storyboard.md 的读取
- 自检循环：按照 `skills/short-storyboard/rules.md` 中的规则逐条自检（最多 3 轮）
- 输出：使用 Write 写入 `story/episodes/$ARGUMENTS[0]/storyboard.md`

- [ ] **Step 3: Commit**

```bash
git add skills/short-storyboard/SKILL.md skills/short-storyboard/rules.md
git commit -m "feat: add short-storyboard skill with single-episode rules"
```

---

### Task 11: 创建 short-review-storyboard skill

**Files:**
- Create: `skills/short-review-storyboard/SKILL.md`

- [ ] **Step 1: 创建 skill 文件**

frontmatter:
```yaml
---
name: short-review-storyboard
description: Director审核单集短视频分镜，检查叙事完整性、节奏、人物一致性和剧情铺垫。
user-invocable: false
context: fork
agent: director
allowed-tools: Read, Write, Edit, Glob, Grep
---
```

参考 `skills/director-review-storyboard/SKILL.md` 的结构：
- 输入文件：`story/episodes/$ARGUMENTS[0]/script.md`（替代 novel.md）、`story/episodes/$ARGUMENTS[0]/storyboard.md`、`story/episodes/$ARGUMENTS[0]/outline.md`、`assets/characters/*.md`（若存在）
- 动态参数：`$ARGUMENTS[0]` — 当前集数
- 规则参考：`skills/short-storyboard/rules.md` — 必须读取，按照其中的规则逐条审核
- 导演专属审核重点：叙事完整性、剧情节奏、人物言行一致性、剧情铺垫是否充分
- 输出格式：通过 / 需修改 + 修改意见列表
- 最多 2 轮反馈

- [ ] **Step 2: Commit**

```bash
git add skills/short-review-storyboard/SKILL.md
git commit -m "feat: add short-review-storyboard skill"
```

---

### Task 12: 创建 short-fix-storyboard skill

**Files:**
- Create: `skills/short-fix-storyboard/SKILL.md`

- [ ] **Step 1: 创建 skill 文件**

frontmatter:
```yaml
---
name: short-fix-storyboard
description: Storyboarder根据Director修改意见定向修正单集短视频分镜。读取现有分镜，只修改指出的问题。
user-invocable: false
context: fork
agent: storyboarder
allowed-tools: Read, Write, Edit, Glob, Grep
---
```

参考 `skills/storyboarder-fix-storyboard/SKILL.md` 的结构：
- 输入文件：`story/episodes/$ARGUMENTS[0]/storyboard.md`（必须读取）、`story/episodes/$ARGUMENTS[0]/script.md`（必须读取）、`story/episodes/$ARGUMENTS[0]/outline.md`（必须读取）、资产文件、`config.md`、`skills/short-storyboard/rules.md`（必须读取）
- 动态参数：`$ARGUMENTS[0]` — 当前集数，`$ARGUMENTS[1]` — 修改意见（引号包裹）
- 输出：使用 Write 重写 `story/episodes/$ARGUMENTS[0]/storyboard.md`
- 规则：仅修改 Director 指出的问题，不改动未提及的内容

- [ ] **Step 2: Commit**

```bash
git add skills/short-fix-storyboard/SKILL.md
git commit -m "feat: add short-fix-storyboard skill"
```

---

### Task 13: 修改 storyboarder-asset-list 支持 script.md

**Files:**
- Modify: `skills/storyboarder-asset-list/SKILL.md:13`

- [ ] **Step 1: 修改文件读取逻辑**

将第 13 行：
```markdown
- `story/episodes/$ARGUMENTS[0]/novel.md` — 必须读取
```
改为：
```markdown
- `story/episodes/$ARGUMENTS[0]/novel.md` 或 `story/episodes/$ARGUMENTS[0]/script.md` — 必须读取（优先 novel.md，若不存在则读取 script.md）
```

同时更新职责描述（第 21 行），从"阅读本集小说原文"改为"阅读本集小说原文或剧本"。

- [ ] **Step 2: 验证改动**

Run: `grep -n "novel\|script" skills/storyboarder-asset-list/SKILL.md`

确认只有文件读取和职责描述部分有改动。

- [ ] **Step 3: Commit**

```bash
git add skills/storyboarder-asset-list/SKILL.md
git commit -m "feat: support script.md fallback in storyboarder-asset-list"
```

---

### Task 14: 更新 README.md

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 添加短视频使用说明**

在 README.md 的"使用"章节中，在系列视频的用法之后，添加短视频用法示例：

```markdown
# 单集短视频
/short-video 一个外卖小哥送错餐发现客户是自己的前女友
/short-video story-idea.txt
/short-video
/short-video config
```

- [ ] **Step 2: 在子代理表格中添加 Scriptwriter**

在四个子代理的表格中增加 Scriptwriter 行：

```markdown
| **Scriptwriter** | 短视频编剧 | 将大纲转化为剧本，擅长在极短篇幅内构建完整故事 |
```

- [ ] **Step 3: 在插件结构中添加新文件**

在插件结构树中添加新增的 agent 和 skill 目录。

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: add short-video usage and scriptwriter to README"
```

---

### Task 15: 最终验证

- [ ] **Step 1: 验证所有新文件存在**

Run:
```bash
ls agents/scriptwriter.md skills/short-video/SKILL.md skills/short-video/config-template.md skills/short-plot-options/SKILL.md skills/short-input-confirm/SKILL.md skills/short-outline/SKILL.md skills/short-outline/rules.md skills/scriptwriter-script/SKILL.md skills/scriptwriter-script/rules.md skills/scriptwriter-fix-script/SKILL.md skills/director-review-script/SKILL.md skills/short-storyboard/SKILL.md skills/short-storyboard/rules.md skills/short-review-storyboard/SKILL.md skills/short-fix-storyboard/SKILL.md
```

所有 15 个文件应该都存在。

- [ ] **Step 2: 验证 frontmatter 格式**

Run:
```bash
grep -l "^name:" skills/short-*/SKILL.md skills/scriptwriter-*/SKILL.md skills/director-review-script/SKILL.md
```

所有新 skill 文件应该都出现。

- [ ] **Step 3: 验证 storyboarder-asset-list 修改**

Run:
```bash
grep "script.md" skills/storyboarder-asset-list/SKILL.md
```

应该能找到 script.md 的引用。

- [ ] **Step 4: Push**

```bash
git push
```

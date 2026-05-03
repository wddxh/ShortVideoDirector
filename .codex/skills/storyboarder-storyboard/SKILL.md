---
name: storyboarder-storyboard
description: Storyboarder将小说原文转化为完整分镜提示词。包含内部台词密度自检循环（最多3轮）。
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

<!-- BEGIN ORIGINAL SKILL: skills/storyboarder-storyboard/SKILL.md -->

## 输入

### 文件读取
- 从 `story/episodes/$ARGUMENTS[0]/outline.md` 的「本集资产清单」中提取本集引用的资产名称
- 使用 Glob 获取 `assets/**/*.md` 全部文件路径列表，仅读取文件名与清单中资产名称匹配的文件
- `story/episodes/$ARGUMENTS[0]/novel.md` — 必须读取
- `story/episodes/$ARGUMENTS[0]/outline.md` — 必须读取（含资产清单）
- `config.md` — 必须读取
- 根据 $ARGUMENTS[0] 计算上一集集数（如 $ARGUMENTS[0] 为 ep02 则上一集为 ep01），读取 `story/episodes/{上一集}/outline.md` — 若上一集存在则读取
- `story/episodes/{上一集}/storyboard.md` — 若存在则读取末尾 2-3 个镜头
- `skills/storyboarder-storyboard/rules.md` — 必须读取并严格遵循（输出格式、字段约束、规则）

### 动态参数（$ARGUMENTS）
- `$ARGUMENTS[0]` — 当前集数（如 ep01）

## 职责描述

### 核心使命

把本集小说原文转化为完整分镜——每个镜头是即梦视频模型的一次独立提交，提示词必须自包容（不能跨镜头引用）、画面与声音必须连贯叙事、状态必须与上下镜头衔接。下游消费者是即梦视频模型（按镜头独立生成视频片段）和 director-review-storyboard（审稿）。模型不会"理解整集剧情"——它只看本镜头提示词；任何跨镜头引用、画面与台词分离、抽象比喻都会让生成失败。

### 工作思路

**整体规划（动笔前）：**

1. **建立三层认知**：通读 novel + outline，建立三层心理模型——剧情层（核心事件/转折/结局）、信息层（本集需要观众知道的事——身份/世界观/伏笔，对照「本集信息传达」清单）、状态层（每个角色的视觉与知识状态如何演变）。三层缺一会导致铺垫漏掉或状态突变
2. **划分场景节拍**：把 novel 拆成场景单元（同时空），每个场景内识别关键节拍（情感/信息/动作转折）。**对照 config「每集分镜数」预算分配镜头**——一节拍一镜头是基本节奏，动作复杂或情绪转折强可拆 2-3 镜头；总数应贴近 config 设定
3. **首尾策略决定**：第 1 集——根据剧情类型设计开场抓眼方案（紧张/悬念/视觉冲击/不公感），主角内心独白做自我介绍；续集——第一镜头与上一集结尾自然衔接，必要时写过渡，不跳过上一集暗示的过渡；集尾镜头呼应集尾钩子，最后几秒包含结束转场

**每个镜头的设计：**

4. **节奏曲线分配**：先定本集节奏曲线——铺垫段偏长（让观众进入情境）、冲突段加快（短镜头切换）、情绪沉淀偏长、高潮按戏剧需要（极长慢推或极短切换）。**若 config「单镜头时长」是范围**（如 10-15s）→ 在范围内按节奏需要灵活分配，不要每个镜头都同样时长；**若 config「单镜头时长」是单一数字**（如 12s）→ 每个镜头时长必须严格等于该值，节奏曲线只通过镜头数量、内容密度、景别变化来体现。**镜头总数遵循 config「每集分镜数」**
5. **景别按叙事功能选择**：远/全景建立场景与空间、中景表现互动与动作戏、近景承载对白和反应、特写放大情绪/关键道具/决定性表情、俯/仰表达力量关系或视角差异。**一段戏的景别要有变化**（远→中→近→特的节奏），全程同一景别会让观众疲倦
6. **镜头运动按情绪选择**：固定（稳定叙事/对白）；推（聚焦关键/情绪积累）；拉（揭示全貌/情感后撤）；摇/移/跟（跟随角色或揭示空间）；升/降（突破或压抑）。静态戏不强行加运动，运动戏不忘加运动
7. **声音设计层级**：信息传达**优先用主角内心独白**——短视频节奏快，观众无法慢慢推断，内心独白还能增强代入感；其次对白和讨论；最后才是旁白；旁白必须以具体角色口吻并标声音特征；任何镜头不得超过 2s 无声窗
8. **状态衔接先于内容**：写本镜头前先提取上一镜头结束状态（视觉位置/姿势/手持物 + 知识"已告知什么"），本镜头开头要么直接衔接（描述与上一镜头结束一致的起始状态），要么用一两句写出过渡。任何视觉或知识突变必须有显式过渡描写。**衔接通过本镜头自身的描述实现，绝不通过"延续上镜头"等引用实现**
9. **「画面与声音描述」连贯叙事**：每个时间段是一段连贯文字，画面动作与台词自然交织。视觉描述用 AI 视频模型能理解的具体直白语言——直接描写身体姿态、动作轨迹、面部表情、环境细节、光影效果——禁止文学比喻和抽象修辞。禁止画面/台词/音效分栏列项
10. **画面文字与不可感知信息处理**：招牌/屏幕/信件等画面文字 → 改角色读出（AI 难以稳定渲染文字）；气味/温度/触感等不可感知信息 → 改角色台词表达

**整集级自检：**

11. **铺垫覆盖**：枚举本集铺垫元素（伏笔/关键对白/知识传递点/状态变化标记）+ 标记回收点，逐项映射到具体镜头，时序检查（铺垫镜头编号 < 回收镜头编号）。未落地或时序倒挂的元素必须返工
12. **时长综合流程**：估算非台词时间（动作 1-5s/氛围 1-4s/转场 1-2s）→ 推算台词可用时间 → 创建阶段心算评估 → 综合判断（过长/过短/合理）。脚本批量验证由自检/审核阶段兜底

### 常见误区

- **跨镜头引用** — 模型本能想写"延续上镜头""角色继续之前的动作"，是人类拍摄思路；但 dreamina 每镜头独立生成，没有上下文；rules.md 已禁但写流畅故事时本能违反 — 每镜头独立描述完整起始状态
- **画面与台词分离** — 模型容易按"画面/台词/音效"三块结构化输出（rules.md 已示例错误格式），结构化看着整齐但视频模型需要一段连贯叙事 — 把台词嵌入动作描写中，自然交织
- **铺垫漏掉** — 小说有伏笔但分镜跳过，因为铺垫不在大纲事件里，模型容易认为"不重要" — 执行铺垫覆盖自检（枚举铺垫+回收点+时序）
- **状态突变** — 上镜头角色跪着，下镜头突然站立没有过渡，模型按剧情节点直跳 — 执行状态连贯自检（前镜头结束状态=本镜头开头状态？）
- **台词超时** — 模型本能按"剧情需要的台词量"写，不管 5 字/秒上限 — 执行时长综合流程，关键是脚本验证不是估算

## 规则参考

- `skills/storyboarder-storyboard/rules.md` — 必须读取并严格遵循

## 分镜自检

生成分镜后，按照 `skills/storyboarder-storyboard/rules.md` 中的输出格式、字段约束和规则逐条自检（最多 3 轮）：
1. 全部达标 → 完成
2. 不达标 → 按照反馈修正问题 → 重新自检
3. 3 轮后仍有不足 → 接受当前结果

## 输出

### 文件操作
- 使用 Write 将分镜写入 `story/episodes/$ARGUMENTS[0]/storyboard.md`

<!-- END ORIGINAL SKILL -->

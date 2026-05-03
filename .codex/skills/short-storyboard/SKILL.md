---
name: short-storyboard
description: Storyboarder将剧本转化为完整分镜提示词。包含内部自检循环（最多3轮）。
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

<!-- BEGIN ORIGINAL SKILL: skills/short-storyboard/SKILL.md -->

## 输入

### 文件读取
- 从 `story/episodes/$ARGUMENTS[0]/outline.md` 的「本集资产清单」中提取本集引用的资产名称
- 使用 Glob 获取 `assets/**/*.md` 全部文件路径列表，仅读取文件名与清单中资产名称匹配的文件
- `story/episodes/$ARGUMENTS[0]/script.md` — 必须读取
- `story/episodes/$ARGUMENTS[0]/outline.md` — 必须读取（含资产清单）
- `config.md` — 必须读取
- `skills/short-storyboard/rules.md` — 必须读取并严格遵循（输出格式、字段约束、规则）

### 动态参数（$ARGUMENTS）
- `$ARGUMENTS[0]` — 当前集数（如 ep01）

## 职责描述

### 核心使命

把短视频剧本转化为完整分镜——每个镜头是即梦视频模型的一次独立提交，提示词必须自包容、画面与声音连贯叙事、状态与上下镜头衔接。下游和 storyboarder-storyboard 相同（即梦视频模型 + short-review-storyboard）。和系列剧分镜不同：单集短视频时长有限（通常 1-3 分钟），铺垫和高潮挤在一集内，分镜密度更高、节奏更紧。

### 工作思路

**整体规划（动笔前）：**

1. **建立三层认知**：通读 script + outline，建立三层心理模型——剧情层（铺垫/冲突/高潮/收束的弧线）、信息层（本集需要观众知道的事——主角姓名/身份/伏笔，对照「角色出场」和故事弧线）、状态层（角色的视觉与知识状态如何演变）
2. **划分场景节拍**：剧本已按场景组织，每个场景内识别关键节拍（情感/信息/动作转折）。**对照 config「每集分镜数」预算分配镜头**——短视频时长有限，节拍数要节制，节拍太多让节奏支离破碎，太少让镜头空洞
3. **首尾策略决定**：第一镜头——根据故事类型设计开场抓眼方案（紧张/悬念/视觉冲击/共鸣），前几秒决定观众是否继续看；集尾镜头——呼应大纲的「结局设计」（反转/温馨/幽默/...），结局执行必须有力度，最后几秒包含结束转场

**每个镜头的设计：**

4. **节奏曲线分配**：短视频节奏比系列剧更紧——铺垫段适度（不能像系列剧那样长），冲突段加快，高潮短而强。**若 config「单镜头时长」是范围** → 在范围内按节奏需要灵活分配，不要每个镜头都同样时长；**若 config「单镜头时长」是单一数字** → 每个镜头时长必须严格等于该值，节奏曲线只通过镜头数量、内容密度、景别变化来体现。**镜头总数遵循 config「每集分镜数」**
5. **景别按叙事功能选择**：远/全景建立场景与空间、中景表现互动与动作戏、近景承载对白和反应、特写放大情绪/关键道具/决定性表情、俯/仰表达力量关系或视角差异。**一段戏的景别要有变化**——全程同一景别会让短视频更显平淡
6. **镜头运动按情绪选择**：固定（稳定叙事/对白）；推（聚焦关键/情绪积累）；拉（揭示全貌/情感后撤）；摇/移/跟（跟随角色或揭示空间）；升/降（突破或压抑）
7. **声音设计层级**：信息传达**优先用主角内心独白**——短视频节奏快，观众无法慢慢推断，内心独白还能增强代入感；其次对白和讨论；最后才是旁白；旁白必须以具体角色口吻并标声音特征；任何镜头不得超过 2s 无声窗
8. **状态衔接先于内容**：写本镜头前先提取上一镜头结束状态（视觉位置/姿势/手持物 + 知识"已告知什么"），本镜头开头要么直接衔接，要么用一两句写出过渡。任何视觉或知识突变必须有显式过渡描写。**衔接通过本镜头自身的描述实现，绝不通过"延续上镜头"等引用实现**
9. **「画面与声音描述」连贯叙事**：每个时间段是一段连贯文字，画面动作与台词自然交织。视觉描述用 AI 视频模型能理解的具体直白语言——直接描写身体姿态、动作轨迹、面部表情、环境细节、光影效果——禁止文学比喻和抽象修辞。禁止画面/台词/音效分栏列项
10. **画面文字与不可感知信息处理**：招牌/屏幕/信件等画面文字 → 改角色读出（AI 难以稳定渲染文字）；气味/温度/触感等不可感知信息 → 改角色台词表达

**整集级自检：**

11. **铺垫覆盖**：枚举剧本中的铺垫元素+回收点，逐项映射到具体镜头，时序检查。短视频铺垫挤压风险更高，必须保证每个回收点在前都有铺垫镜头
12. **时长综合流程**：估算非台词时间 → 推算台词可用时间 → 创建阶段心算评估 → 综合判断。短视频总时长本就紧，台词超时风险更高，脚本批量验证不可省

### 常见误区

- **剧本搬运** — 把剧本台词直接搬到镜头「画面与声音描述」里，没做视听设计；剧本是舞台指示，分镜是视频模型提示词，性质不同 — 每镜头先想画面构图（景别/运动/视觉重点），再嵌入台词
- **跨镜头引用** — 模型本能想写"接上镜头"，但 dreamina 每镜头独立生成，rules.md 已禁但写流畅故事时本能违反 — 每镜头独立描述完整起始状态
- **铺垫挤压** — 短视频时长有限，模型本能压缩铺垫多塞冲突；但缺铺垫的高潮是"莫名其妙的反转" — 宁可少一个事件，保证每个事件有足够铺垫镜头
- **状态突变** — 模型按剧情节点直跳，不管视觉/知识连贯 — 执行状态连贯自检（前镜头结束状态=本镜头开头状态？）
- **台词超时** — 短视频总时长本就紧，超时更明显 — 执行时长综合流程，关键是脚本验证不是估算

## 规则参考

- `skills/short-storyboard/rules.md` — 必须读取并严格遵循

## 分镜自检

生成分镜后，按照 `skills/short-storyboard/rules.md` 中的输出格式、字段约束和规则逐条自检（最多 3 轮）：
1. 全部达标 → 完成
2. 不达标 → 按照反馈修正问题 → 重新自检
3. 3 轮后仍有不足 → 接受当前结果

## 输出

### 文件操作
- 使用 Write 将分镜写入 `story/episodes/$ARGUMENTS[0]/storyboard.md`

<!-- END ORIGINAL SKILL -->

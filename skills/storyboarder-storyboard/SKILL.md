---
name: storyboarder-storyboard
description: 把剧本翻译为 storyboard.md (≤15s 切片 + 镜头创意 + KF 标记)。剥离节奏决策（剧本已分配场景时长，分镜只做拆分）。
user-invocable: false
context: fork
agent: storyboarder
allowed-tools: Read, Write, Edit, Glob, Grep
model: sonnet
---

## 输入

### 文件读取

- `story/episodes/$ARGUMENTS[0]/script.md` — 必须读取（权威节奏源：场景目标时长 + 对白 + 视觉摘要 + 转场）
- `story/episodes/$ARGUMENTS[0]/outline.md` — 必须读取（含「本集资产清单」）
- `config.md` — 必须读取（单镜头时长上限、视频风格等）
- 从 outline.md 「本集资产清单」提取本集引用的 character / location / item 名称；用 Glob 取 `assets/**/*.md` 列表，仅读取文件名匹配清单的文件
- `skills/storyboarder-storyboard/rules.md` — 必须读取并严格遵循（输出 schema、字段顺序、字段约束、自检清单）

### 动态参数（$ARGUMENTS）

- `$ARGUMENTS[0]` — 当前集数（如 ep01）

## 职责描述

### 核心使命

把 script.md 翻译为 storyboard.md。**翻译层定位**：剧本已是权威节奏源（每场景已分配目标时长、已写定对白、已给视觉摘要与转场），分镜不再做节奏决策，只做三件事：

1. **切片**：把每个场景按 ≤15s（视频模型硬约束）拆成 N 个 shot，shot 时长之和落在场景目标时长 ±10% 容差内
2. **镜头创意**：为每个 shot 赋予景别/运动/视频风格/转场，并把剧本对白与视觉摘要翻译成连贯的「画面与声音描述」prose
3. **KF 标记**：按需在 shot 内联标注 `[KF-id]`（首帧/尾帧/参考），并在头部「引用资产」字段同步声明

**禁止越权**：不重新分配场景时长、不改剧本对白字句、不引入剧本未覆盖的 character/location/item。仅 KF 由分镜师自主创建（director-keyframes 在更下游）。

下游消费者：`creator-keyframe-prompts`（按 KF 标记生成关键帧 .md）、`creator-video-dreamina`（按 shot 提交视频生成）、`director-review-storyboard`（审稿）。

### 工作流（5 步）

1. **读 script.md，按场景目标时长准备切片**
   - 通读 script.md 建立全集节奏认知；对每个场景记录「目标时长」+ 容差区间 `[目标 × 0.9, 目标 × 1.1]`
   - 读 config.md 确认单镜头时长上限（默认 ≤15s 硬约束）与视频风格基线
   - 读 outline.md 确认本集资产清单，仅加载清单内 asset 卡

2. **每场景拆 N 个 shot**
   - 切分依据：场景内的视觉节拍 + 对白边界 + 视觉摘要里的关键画面节点
   - 每 shot 时长 ≤15s；该场景所有 shot 时长之和 ∈ 容差区间（±10%）
   - 不挪动场景边界、不合并/拆分场景

3. **每 shot 生成头部字段**（按 rules.md 固定顺序）
   - 镜头类型（景别）/ 镜头运动 / 视频风格 / 时长 / **出场人物**（含 verbatim copy 的声音特征）/ 引用资产（location / item / KF，不含 character）/ 转场
   - 字段顺序与格式严格按 rules.md schema

4. **「画面与声音描述」prose + KF 标记**
   - 把剧本对白嵌入连贯叙事 prose（对白原文保留，括号内补「临场表演」如颤抖/急促/沙哑加剧）
   - 视觉描述使用 AI 视频模型能理解的具体直白语言（身体姿态/动作轨迹/面部表情/光影），禁止文学比喻
   - **KF 标记触发条件**（按需，不滥用）：
     · 关键视觉锚（首帧/尾帧/决定性瞬间）
     · 跨 shot 视觉连续性（相邻 shot 画面需无缝衔接 → 前 shot 尾 + 后 shot 首共享同一 KF-id）
   - 内联标记位置语义必写：`画面首帧是 [KF-id]` / `画面尾帧是 [KF-id]` / `画面参考 [KF-id]`
   - 头部「引用资产」中的 KF 列表必须与 prose 内联引用一致

5. **自检（按 rules.md 自检清单，最多 3 轮）**
   - 全部达标 → 完成
   - 不达标 → 修正问题 → 重新自检
   - 3 轮后仍有不足 → 接受当前结果并在末尾标注未达标项

## 规则参考

- `skills/storyboarder-storyboard/rules.md` — 必须读取并严格遵循（输出 schema、字段顺序、字段约束、自检清单、失败模式）

## 输出

### 文件操作

- 使用 Write 将分镜写入 `story/episodes/$ARGUMENTS[0]/storyboard.md`

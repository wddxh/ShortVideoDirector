---
name: director-outline
description: Director生成本集详细大纲和outline.md内容。自动读取config.md、arc.md，并写入ep outline和story outline。
user-invocable: false
context: fork
agent: director
allowed-tools: Read, Write, Edit, Glob, Grep
model: sonnet
---

## 输入

### 文件读取
- `config.md` — 必须读取
- `story/arc.md` — 若存在则读取
- `story/outline.md` — 若存在则读取
- 最近 M 集 novel.md — 若 `story/outline.md` 存在，根据 config.md 中 `上下文集数` M，使用 Glob 匹配 `story/episodes/ep*/novel.md` 找到最近 M 集并读取
- `skills/director-outline/rules.md` — 必须读取并严格遵循（输出格式、规则）

### 模式判断
- 若 `story/outline.md` 不存在 → new-story 模式
- 若 `story/outline.md` 已存在 → continue-story 模式

### 动态参数（$ARGUMENTS）
- `$ARGUMENTS[0]` — 当前集数（如 ep01）
- `$ARGUMENTS[1]` — 选定的剧情方向（引号包裹的完整文本）

## 职责描述

### 核心使命

根据选定的剧情方向，生成本集详细大纲，并把"主要事件 + 集尾钩子"追加到 story/outline.md。下游消费者是 writer-novel（写小说原文）和后续的 storyboarder（拆分镜）：他们都依赖你列的「主要事件」「角色出场」「本集信息传达」「集尾钩子」作为骨架。本集大纲不是剧情详写——是给下游的工作单：每个事件代表一段戏，集尾钩子代表观众继续看的理由，信息传达列表代表 storyboarder 必须确保观众听到/看到的关键信息。

### 工作思路

1. 先读 arc.md（若存在），明确本集在整个剧集弧线中的位置——本集应推进哪一阶段、不能消耗哪些后续集数的剧情
2. 对照 config 中"每集时长目标"，估算本集容量：太多事件会挤压铺垫空间，太少又显平淡
3. 列「主要事件」时给铺垫留位——大纲若只列转折节点，下游的小说和分镜就会跳过铺垫
4. 设计「本集信息传达」时区分"观众该知道"和"主角该知道"：短视频节奏快，观众无法从画面慢慢推断，必须列清楚
5. 集尾钩子是本集的核心产物——先想"观众看完会带着什么悬念走"，再决定收束方式（悬念/中断/新人物/新地点/情感高潮）
6. new-story 时仅写静态设定（世界观/主角/矛盾/基调），绝不预设后续走向

### 常见误区

- **arc 该集事件全堆进去** — arc 中本集分配的剧情节点容易被照搬为「主要事件」，结果下游小说没空间铺垫 — 节点是骨架，事件是带铺垫的剧情段
- **遗漏「本集信息传达」** — 模型把"信息"等同于"剧情"，认为剧情说清楚了信息就传达了；但短视频节奏下观众能错过任何不被显式标注的信息 — 列出每个新角色的姓名/身份/关系传达方式，列出每个伏笔的传达方式
- **集尾钩子写成事件描述** — 写"主角发现真相"是事件而非钩子，钩子是观众走出本集时仍带着的疑问/期待 — 钩子要回答"观众为什么要继续看"
- **new-story 时把动态剧情塞进核心设定** — rules 已禁但模型本能把"主角后来如何"塞入设定 — 设定只描述世界、人、矛盾、基调四件事，剧情走向另起

## 规则参考

- `skills/director-outline/rules.md` — 必须读取并严格遵循

## 输出

### 文件操作
- 使用 Write 将本集大纲写入 `story/episodes/$ARGUMENTS[0]/outline.md`
- 若 `story/outline.md` 不存在：使用 Write 创建（new-story 场景）
- 若 `story/outline.md` 已存在：使用 Edit 在文件末尾追加新集内容（continue-story 场景，append-only）

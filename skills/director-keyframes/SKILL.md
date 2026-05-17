---
name: director-keyframes
description: Director 规划本集所有关键帧描述与本集资产清单，落盘 keyframes.json 并追加资产清单到 outline.md。
user-invocable: false
context: fork
agent: director
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
model: sonnet
---

## 输入

### 文件读取
- `story/episodes/$ARGUMENTS[0]/outline.md` — 必须读取（剧情骨架/信息传达/集尾钩子）
- `story/episodes/$ARGUMENTS[0]/novel.md` — 必须读取（视觉细节、动作、情绪、场景的来源）
- `config.md` — 必须读取（语言/风格/每集时长目标/每集分镜数）
- `assets/**/*.md` — 必须 Glob 列出所有现有资产文件名（决定复用 vs 新增）
- `story/arc.md` — 若存在则读取（跨集视觉/情绪连贯）
- 上一集 `story/episodes/ep{N-1}/keyframes.json` — 续集模式必须读取最后一张关键帧（衔接校验）
- `story/episodes/$ARGUMENTS[0]/keyframes.json` — 仅在增量模式存在时读取
- `story/episodes/$ARGUMENTS[0]/.review-keyframes-narrative.md` — 仅增量模式必须读取（含本轮 review 意见）
- `skills/director-keyframes/rules.md` — 必须读取并严格遵循（schema 字段、composition 规则、数量规则、增量模式工作流）

### Bash 调用
- `bash scripts/read-config.sh "每集分镜数"` — 读取本集最大分镜数 N，用于关键帧数量校验

### 动态参数（$ARGUMENTS）
- `$ARGUMENTS[0]` — 当前集数（如 `ep01`）
- `$ARGUMENTS[1]` — 模式（可选，`full` 或 `incremental`，缺省为 `full`）

## 职责描述

### 核心使命

把本集小说原文转化为**剧情视觉节点序列**：枚举本集所有不可省略的画面节点，为每个节点写完整描述，登记本集所有资产引用。**不切分 shot、不规划镜头语言**——shot 切分与运镜是 storyboarder 的职责。下游消费者是 director-review-keyframes-narrative（叙事评审）、creator-create-assets（出资产卡）、creator-keyframe-images（出关键帧图）、storyboarder-storyboard（消费关键帧并切分 shot）。关键帧不是"挑几张代表画面"，而是**剧情节奏的视觉锚点**——评审者凭关键帧序列就能判断本集剧情完整性、因果性、节奏张弛；下游图像/视频生成依赖关键帧作为参考图保证一致性。

### 工作思路

1. **通读 outline + novel + arc**，建立三层认知——剧情层（开场/发展/转折/高潮/收束）、信息层（本集需要观众接收的信息）、视觉层（每个剧情进展对应的画面想象）
2. **Glob 现有资产清单**，建立"可复用资产 ID 池"——后续写 composition 时优先从池中选资产，无法复用才新增
3. **读取 config 中的「每集分镜数」N**，作为关键帧数量的硬下限，1.5×N 作为软推荐
4. **枚举关键帧**——不仅要覆盖 outline 的主要事件，还必须覆盖**事件之间的铺垫和演进节点**；任何画面状态发生不可省略的变化都应有关键帧（角色出场/换装/位置移动/情绪转变/道具出现或消失/光线变化）
5. **每张关键帧写 11 个字段**——composition 必须用 `<资产名>` 包裹所有出场角色/场景/道具，便于下游扫描资产引用
6. **聚合本集资产清单**——遍历所有关键帧的 composition / characters / props / scene 字段，按"新增/已有"分类，沿用现有资产清单格式
7. **校验剧情骨架完整**——逐条对照 outline 的「主要事件」「本集信息传达」「集尾钩子」；同时检查事件之间是否有铺垫帧串起因果链
8. **校验视觉因果链**——按集内序号顺序读关键帧的 composition，确认前后两帧之间不存在"无法解释的视觉跳跃"（人物突然换位/道具突然出现/光线突变缺乏理由）
9. **续集衔接校验**——读取上一集最后一张关键帧的 composition，确认本集第 1 张关键帧合理承接（场景/角色状态）
10. **增量模式**：读取现有 keyframes.json 与 `.review-keyframes-narrative.md`（**定位最后一个 `## 第 N 轮` heading**，用 grep `^## 第 [0-9]+ 轮` 找最大 N 段，用该段内的意见列表作为变更依据），判断哪些 keyframes 需要修改/新增/删除，其他保持原样；变更后受影响的关键帧 id 不能被回收复用——新增帧必须用新 id（避免下游重抽误判）

### 常见误区

- **只覆盖大事件不写铺垫** — 把 outline 5 个主要事件画 5 张关键帧就交差，事件间没有铺垫帧 — 主要事件之间的过渡（角色到达/掏出道具/眼神交汇）也是关键帧；下游 storyboarder 需要这些铺垫节点才能切出有节奏的 shot
- **关键帧描述写运镜过程** — 关键帧是静态快照，写"主角推门走进房间"❌；写"主角站在门口右手扶门把，左脚已迈进室内"✅；运镜过程是 storyboarder 的事
- **首末帧用进行时态** — "他正要站起来"❌；"他半弯腰，双手撑在桌面"✅
- **画面字段污染剧情解读** — composition 写"<反派>正在密谋复仇"❌（密谋是抽象的）；写"<反派>背对镜头站在落地窗前，右手攥紧酒杯"✅；剧情含义靠音频字段或后续关键帧承载
- **画面字段写不可见元素** — 写"<反派>就在门后偷听"❌（门关着看不到反派）；要么写可见的暗示（"门缝下露出黑色皮鞋的影子"），要么这一帧不出现反派
- **资产凭空发明** — 写 composition 时引用了 assets/ 中不存在的资产名却没登记到资产清单 — 每写一个 `<xxx>` 都要校验现有资产或加入新增清单
- **复用资产换名字** — 现有资产叫"张三"，新关键帧里写成"穿夹克的男人" — 优先从可复用资产池里精确选名
- **视觉跳跃缺铺垫** — 关键帧 N 主角站在天台、关键帧 N+1 主角在车里，中间无任何过渡帧 — 检查相邻关键帧的 composition，画面状态变化必须有视觉因果（要么补铺垫帧，要么变化本身就是剧情核心）
- **关键帧绑定 shot** — 写关键帧时已经在想"这是哪个 shot 的首/尾帧" — 关键帧只关心"剧情视觉上有什么"，shot 怎么切由 storyboarder 决定
- **数量不足以支撑分镜** — 关键帧数量少于 config「每集分镜数」N，导致 storyboarder 无法保证每个 shot 至少引用 1 张关键帧 — 必须 ≥ N，推荐贴近 1.5×N

## 规则参考

- `skills/director-keyframes/rules.md` — 必须读取并严格遵循

## 输出

### 文件操作
- 使用 Write 创建/覆盖 `story/episodes/$ARGUMENTS[0]/keyframes.json`（全量模式）
- 使用 Edit 修改 `story/episodes/$ARGUMENTS[0]/keyframes.json`（增量模式）
- 使用 Edit 在 `story/episodes/$ARGUMENTS[0]/outline.md` 末尾追加（或更新）「本集资产清单」章节

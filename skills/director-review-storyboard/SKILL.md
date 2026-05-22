---
name: director-review-storyboard
description: Director审核Storyboarder分镜，检查叙事完整性、节奏、台词密度和技术合规性。
user-invocable: false
context: fork
agent: director
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
model: opus
---

## 输入

### 文件读取
- `story/episodes/$ARGUMENTS[0]/script.md` — 必须读取（权威节奏源：场景目标时长 + 对白 + 转场）
- `story/episodes/$ARGUMENTS[0]/storyboard.md` — 必须读取
- `story/episodes/$ARGUMENTS[0]/outline.md` — 必须读取（含本集资产清单）
- 从 outline.md 的「本集资产清单」中提取本集引用的资产名称，使用 Glob 获取 `assets/**/*.md` 全部文件路径列表，仅读取文件名与清单匹配的文件
- `skills/storyboarder-storyboard/rules.md` — 必须读取（输出 schema、字段顺序、字段约束）
- `$SVD_PLUGIN_DIR/skills/_meta/rules/output-language.md` — 必须读取（语言一致性）
- `$SVD_PLUGIN_DIR/skills/_meta/rules/review-meta-rules.md` — 必须读取（review 意见格式规约）
- `$SVD_PLUGIN_DIR/skills/_meta/rules/visual-prompt-craft-common.md` — 必须读取（视觉 prompt 通用原则，用于 phase 12 video prompt 表达审核）
- `$SVD_PLUGIN_DIR/skills/_meta/rules/visual-prompt-craft-video.md` — 必须读取（视频 prompt 独有原则，用于 phase 12 video prompt 表达审核）

### 动态参数（$ARGUMENTS）
- `$ARGUMENTS[0]` — 当前集数（如 ep01）

## 职责描述

### 核心使命

审核 Storyboarder 生成的分镜，输出"通过"或"需修改 + 修改意见列表"。直接下游是 storyboarder-fix-storyboard skill：当你判"需修改"时，意见列表会被自动传给 fix skill 在最多 2 轮内修订分镜，列表里的每一条都会被执行（按 shot 号定位）。判定（通过/需修改）是质量门槛，意见列表是给 fix skill 的工作单。

Storyboarder 是**翻译层**——剧本是权威节奏源（场景目标时长 + 对白 + 视觉摘要 + 转场），分镜只做切片、镜头创意、KF 标记。审核的核心价值是"挡住会让视频生成失败、剧情断裂、或下游 keyframe / TTS 出错的内容"：跨镜头引用、画面台词分离、状态突变、铺垫漏掉、台词超时、切片越界、KF 标记错位、出场人物声音特征漂移、整体观感平淡。
### 工作思路

1. 先做观众视角终极判断（凌驾于其他规则）：从普通观众视角整体审视，剧情精彩吗？流畅吗？吸引人继续看吗？若整体平淡或突兀——即使 rules 全过仍要打回
2. 对照 outline 和 script：叙事完整吗？剧本场景全部覆盖？关键铺垫都到位吗？人物言行符合性格吗？
3. 过 storyboarder-storyboard/rules.md 逐条审核（见下文「分镜技术审核清单」12 项）
4. 决定值得拦截的问题——所有进入意见列表的项都会被 fix skill 执行；只拦"会让视频生成失败"或"会让剧情断裂"或"会让下游 keyframe / TTS 出错"的问题
5. 第二轮 review（fix 修过一次后）：聚焦仍影响视频生成或剧情连贯的关键问题

### 常见误区

- **机械放过** — rules 全过就放行，但观众视角终极标准位列 rules 之上 — 先做观众视角判断，再过 rules
- **挑刺到不可能通过** — 所有列入意见的项都会被 fix skill 执行；反复挑刺 → fix 反复改，质量反而下降 — 只拦关键问题
- **跳过台词时长综合流程** — 时长综合流程要求批量调 `scripts/speech-rate.sh` 验证语速，模型容易跳过脚本仅做心算 — 审核阶段必须执行脚本批量验证
- **切片 sum 不算** — 模型凭印象判断，但 ±10% 容差是硬约束 — 每场景手算 sum(shot 时长) 与剧本目标对比
- **KF 标记不全程查** — 只看 prose 内联 [KF-id] 不查头部「引用资产」KF 列表，导致下游 creator-keyframe-prompts 漏生成 — 两侧 grep 对照
- **出场人物声音特征 verbatim 不核** — 漂移浓缩会导致跨 shot TTS 不一致 — 拿 character 卡 `## 声音特征` section 与 storyboard 出场人物逐字对照
- **越权改剧本** — 发现剧本对白超时本能想"让 storyboard 缩台词"，但对白权威在剧本 — 报回 director-review-script，不写入 storyboard review
- **逐字改写式意见** — fix skill 会照搬作为镜头描述，剥夺 Storyboarder 设计空间 — 说清问题方向，不替 Storyboarder 写最终描述

## 分镜技术审核清单（12 项，rules.md 之外的硬约束）

逐条核查，问题进入意见列表：

- **KF 标记合理性**：每个 [KF-id] 引用都有正确的位置语义（"画面首帧是 [KF-id]" / "画面尾帧是 [KF-id]" / "画面参考 [KF-id]"），无裸 [KF-id] 不带位置语义
- **KF 触发条件正确**：KF 仅在「关键视觉锚（首帧/尾帧/决定性瞬间）」或「跨 shot 视觉连续性（相邻 shot 共享同一 KF-id）」时使用，无随意加 KF
- **切片合理性**：每场景 sum(shot 时长) 落在剧本目标 ±10% 容差内；场景头部「切片 sum Ys ✓」标注与实际计算一致
- **单 shot ≤15s**：硬约束，超时即拦
- **镜头多样性**：避免连续 5 个"中景固定"等同质堆叠
- **speech-rate.sh 通过**：每 shot 对白调 `bash scripts/speech-rate.sh "start-end:speed:text" ...` 批量验证，OVER 即拦
- **引用 asset 完整性**：storyboard 只引用剧本已声明的 asset；不引入剧本未覆盖的 character / location / item
- **内联 KF 与「引用资产」一致**：prose 内联的 [KF-id] 集合 == 头部「引用资产」KF 列表
- **出场人物字段正确性**：character 在「出场人物」字段（不在「引用资产」），每条目附完整声音特征 verbatim copy 自 character 卡 `## 声音特征` section（含 音色/语速/语调 三项）
- **临场表演正确分层**：基线属性（音色/语速/语调）在出场人物字段，临场偏离（颤抖/急促/沙哑加剧等）在 prose `角色 (临场描述): "..."`
- **字段顺序符合约定**：每个 shot 字段严格按 镜头类型 / 镜头运动 / 视频风格 / 时长 / 出场人物 / 引用资产 / 转场 顺序
- **video prompt 表达检查**：每个 shot 的 prose 是否符合 visual-prompt-craft-common.md + visual-prompt-craft-video.md 全部 9 条原则。重点检查：
  - 是否电影摄影指令式（不是小说叙事）
  - 是否含 negative phrasing（"严禁/不要/避免/无 X" 句式）
  - 是否含文学比喻 / 隐喻 / 心理描写
  - 复杂效果是否显式分解（画中画 / 文字 / 复合特效的参数具体指定）
  - 资产引用是否按场景规则使用（prose 不重复描述外观，用裸名字 + 位置语义）
  - 镜头运动是否具象（pan / tilt / dolly / zoom + 速度修饰）
  - 转场是否显式（cut / dissolve / fade + 时长）
  - 音视频事件是否显式指定（音效触发时间 + 音色 / 对白 / BGM）
  - 事件密度是否匹配 shot 时长（1-15s 单 shot，事件量随时长线性）

## 导演专属审核重点（rules.md 与上述 12 项之外）

- **叙事完整性** — 分镜完整覆盖剧本场景，无遗漏关键画面节点
- **剧情节奏** — 切片未让某场景过碎裂或过聚合，破坏剧本节奏意图
- **人物言行与性格一致性** — 临场表演描述符合角色性格
- **剧情铺垫充分** — 剧本铺垫种子在分镜的视觉呈现到位
- **观众视角终极标准** — 整体观感凌驾于其他规则；机械规则全过但整体平淡 / 突兀 / 莫名其妙，仍判需修改

## 输出

写入 `story/episodes/$ARGUMENTS[0]/.review-storyboard.md`（append 模式，每轮追加一段）。

**Round 自检**：Read 文件（不存在则本次为第 1 轮；存在则 grep `^## 第 [0-9]+ 轮` 找最大 N，本次为 N+1 轮）。用 Write（首次）或 Edit（append，oldString 用文件末 50 字符 anchor）追加。

**本轮段格式**（前留空行）：

通过时仅 heading：
```markdown

## 第 {N} 轮 ({YYYY-MM-DD HH:MM}) - 通过
```

不通过时：
```markdown

## 第 {N} 轮 ({YYYY-MM-DD HH:MM}) - 需修改 ({M} 项)

1. **shot {场景.N}：** {问题描述} → {修改建议}
```

**返回内容**：简报 `pass` 或 `needs_revision {M}`（{M} = 本轮意见条数）→ 返回给 workflow；详细意见已落盘，下游 fix skill 自行读取最后一轮段。

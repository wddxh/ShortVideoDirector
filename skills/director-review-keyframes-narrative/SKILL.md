---
name: director-review-keyframes-narrative
description: Director 审核 keyframes.json 的叙事完整性、因果性和节奏，输出"通过"或"需修改 + 修改意见列表"。
user-invocable: false
context: fork
agent: director
allowed-tools: Read, Write, Edit, Glob, Grep
model: opus
---

## 输入

### 文件读取
- `story/episodes/$ARGUMENTS[0]/keyframes.json` — 必须读取（被审产物）
- `story/episodes/$ARGUMENTS[0]/outline.md` — 必须读取（剧情骨架对照）
- `story/episodes/$ARGUMENTS[0]/novel.md` — 必须读取（视觉细节对照）
- 上一集 `story/episodes/ep{N-1}/keyframes.json` — 续集模式必须读取最后一张关键帧（衔接审）
- `assets/**/*.md` — Glob 列出全部资产文件路径（验证 composition 资产引用合法）

### 动态参数（$ARGUMENTS）
- `$ARGUMENTS[0]` — 当前集数（如 `ep01`）

## 职责描述

### 核心使命

审核 `director-keyframes` 生成的 keyframes.json，输出"通过"或"需修改 + 修改意见列表"。直接下游是 `director-keyframes incremental` 模式：当判"需修改"时，意见列表会被自动传给 director-keyframes 在最多 2 轮内修订关键帧。判定（通过/需修改）是质量门槛，意见列表是给下游 fix 的工作单。**本 skill 只评描述，不看图——图的评审是 `director-review-keyframes-visual` 的职责，两步独立**。叙事评审的核心价值是"挡住会让分镜失败或剧情断裂的内容"——剧情节点漏覆盖、铺垫缺失、视觉因果断裂、资产引用断链。

### 工作思路

1. **观众视角终极判断（凌驾于其他规则）**：把 keyframes 数组按集内序号顺序看一遍 narrative_purpose + composition，剧情骨架立得住吗？流畅吗？吸引人吗？若整体平淡或突兀——即使机械规则全过仍要打回
2. **对照 outline 主要事件**：outline 的「主要事件」每一项是否都有至少 1 张关键帧承载？枚举主要事件 → 逐项映射到关键帧 id → 缺失项必须打回
3. **对照 outline 集尾钩子**：最后 1-2 张关键帧的 narrative_purpose 是否明确指向钩子？
4. **铺垫与演进检查**：相邻关键帧之间是否存在视觉跳跃（角色位置/状态/场景的不可解释突变）？跳跃必须由铺垫帧填补，否则打回
5. **视觉因果链检查**：按集内序号顺序读 composition，前后两帧之间的画面变化是否可解释？variation_from_prev 字段是否真实反映了变化？
6. **本集信息传达可视化**：outline 的「本集信息传达」中需要视觉承载的信息（新角色出场/关键道具出现/地点切换）是否都有对应关键帧？
7. **资产引用合法**：composition 中所有 `<>` 标签内的名字必须能在 outline 资产清单（含新增）或 Glob 出的 assets 中找到——这是机械检查，但本 skill 仍要兜底（director-keyframes 可能漏校验）
8. **续集衔接**：第 1 张关键帧的 composition 是否与上一集最后 1 张关键帧自然衔接？不得跳过上一集结尾暗示的过渡
9. **数量合理**：关键帧总数是否 >= config「每集分镜数」？过少则 storyboarder 切不出每 shot 至少 1 张
10. **第二轮 review**（fix 修过一次后）：聚焦仍影响下游分镜的关键问题，不再挑刺

### 常见误区

- **机械放过** — 数量、覆盖度、资产引用全过 → 通过；但关键帧序列可能整体平淡或剧情节奏失衡——观众视角终极标准位列机械规则之上 — 先做观众视角判断，再过机械检查
- **挑刺到不可能通过** — 每张关键帧都能想出"更好的画面"，所有列入意见的项都会被 director-keyframes 执行；反复挑刺 → fix 反复改描述，质量反而下降 — 只拦"会让分镜失败"或"会让剧情断裂"的问题
- **越界评图** — 本 skill 不读图、不评图实现度，发现"看图想到的问题"也不能在这一步提 — visual review 是独立步骤
- **跳过铺垫检查** — 模型容易凭"主要事件覆盖了"就放行，忘了事件之间的视觉因果 — 逐对相邻关键帧扫 composition 跳跃
- **逐字改写式意见** — 写"这张关键帧的 composition 应该改成..."，director-keyframes 会照搬作为最终描述，剥夺 director 的视觉化空间 — 意见说清问题方向（"这张关键帧缺少道具X的体现"），不替 director 写最终 composition

## 输出格式

审核结果写入 `story/episodes/$ARGUMENTS[0]/.review-keyframes-narrative.md`（append 模式，每轮追加一段）。

**Round 自检**：
1. Read `.review-keyframes-narrative.md`（若不存在，本次为第 1 轮；若存在，grep `^## 第 [0-9]+ 轮` 找最大 N，本次为第 N+1 轮）
2. 用 Write（首次创建文件）或 Edit（append；oldString 用文件末尾 50 字符 anchor）追加本轮段

**本轮段格式**：

通过时（仅 heading 行）：
```markdown

## 第 {N} 轮 ({YYYY-MM-DD HH:MM}) - 通过
```

不通过时：
```markdown

## 第 {N} 轮 ({YYYY-MM-DD HH:MM}) - 需修改 ({M} 项)

1. **{KF-id 或 关键帧序号}：** {问题描述} → {修改建议}
2. **{KF-id 或 关键帧序号}：** {问题描述} → {修改建议}
3. **整体：** {跨多张关键帧的整体性问题，如"主要事件 BEAT-03 完全没有关键帧承载"} → {修改建议}
```

注意：每轮段前留一个空行，与上一轮段隔开。

## 规则参考

- `skills/director-keyframes/rules.md` — 必须读取，按照其中的字段约束、数量规则、composition 写作规则、覆盖度自检逐条审核

## 导演专属审核重点

除 rules.md 中的机械规则外，重点审核以下叙事层面的问题：

- **剧情完整性** — 主要事件 + 铺垫 + 演进是否完整覆盖？
- **因果性** — 相邻关键帧之间是否有视觉因果链，composition 字段反映的画面变化是否可解释？
- **节奏张弛** — 高潮节点是否有足够视觉支撑？铺垫节点是否被压缩？
- **观众视角终极标准** — 从普通观众视角整体审视关键帧序列：剧情是否精彩、发展是否自然流畅、有无突兀或莫名其妙的部分。这是凌驾于其他规则之上的最终检验

## 规则

最多 2 轮反馈。审核时需检查是否存在现实中的明星或公众人物名字、真实地名、商标名，发现则要求替换为虚构名称。

## 输出

### 文件操作
- 使用 Write 或 Edit 维护 `story/episodes/$ARGUMENTS[0]/.review-keyframes-narrative.md`（append 模式，详见上文「输出格式」段的 Round 自检流程）

### 返回内容
- 简报：`pass` 或 `needs_revision {M}`（{M} = 本轮意见条数）→ 返回给 workflow
- 详细意见已写入文件，下游 fix skill 自行读取该文件最后一轮段

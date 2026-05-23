---
name: director-review-arc
description: 审查 arc.md 框架完整性、节点分配、人物弧深度、关键转折分布。generate-episode-pipeline 在 new-series 模式 director-arc 之后强制调用。
user-invocable: false
context: fork
agent: director
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
model: opus
---

## 输入

### 文件读取
- `story/arc.md` — 必须读取（review 目标）
- `config.md` — 必须读取（总集数 N、世界观锚点等核对依据）
- `${CLAUDE_PLUGIN_ROOT}/skills/director-arc/rules.md` — 必须读取（schema / 节点集数标注约定 / 6 类失败模式定义在此）
- `story/outline.md` — 若存在（continue-series）则读取，核对 arc 与已播出内容一致
- `${CLAUDE_PLUGIN_ROOT}/skills/_meta/rules/output-language.md` — 必须读取（语言一致性）
- `${CLAUDE_PLUGIN_ROOT}/skills/_meta/rules/review-meta-rules.md` — 必须读取（review 意见格式规约）

### 动态参数（$ARGUMENTS）
- 无。arc 是 series 级文件，无集数参数

## 职责描述

### 核心使命

审核 director-arc 生成的 `story/arc.md`，输出"通过"或"需修改 + 修改意见列表"。直接下游是 director-arc 的 fix 流程（与 review-novel 同模式：意见会被自动消化重写 arc），所以意见列表 = 工作单，每条都会被执行。arc 失败会让后续所有 outline / script / storyboard 在错误骨架上展开，必须严格拦截框架级问题；微调措辞类问题不要列入。

### Phase 0: 脚本硬校验（必跑）

```bash
bash ${CLAUDE_PLUGIN_ROOT}/scripts/arc-event-sum.sh story/arc.md
```

任何 FAIL → review 直接 fail，意见列表第一条引用脚本输出。退出码 0 + WARN（可选 sum > 40%）算 PASS，但意见列表追加该 WARN 说明。

### 工作思路（按 rules.md §5 6 类失败模式 + schema 校验逐项过）

1. **schema / 标注合规**：节点 header 是否带 `(epXX-YY, 节点预算 ~Zs)`；集数零填充；节点序列集数总和 = `## 总集数`；首尾相接、无重叠、无 gap；**核心事件 bullet 严格 `(~Ns, 必需|可选)` 格式**；**节点 bullet sum ≤ 预算**（由 Phase 0 脚本兜底）
2. **arc 完整性**：节点序列是否覆盖"起承转合"；世界观要点是否清晰、对叙事关键
3. **节点集数分配合理性**：参照 rules.md §3 三段式（铺垫 ~30% / 发展 ~40-50% / 收束 ~20-30%）；典型反例如"8 集铺垫 + 2 集高潮 + 0 集收束"
4. **人物弧深度**：起点与终点状态是否存在**可观察的差异**（信念/关系/能力/处境）；关键转折是否 ≥2 且分布在不同节点；转折是否带 epXX 锚点
5. **关键转折分布**：转折是否分布于全 arc，每节点至少 1 个推进；杜绝"全部集中在 ep01-03"
6. **事件咬合度 + 伏笔回收**：

   **6a. 事件咬合度**

   检查节点内 bullet 事件之间是否存在因果链。失败模式：
   - 某节点的若干 bullet 互相无依赖，调换顺序也成立 → 节点降级为"事件清单"，缺乏推进感
   - 出现孤立事件：bullet 描述的事件与节点目标、前后 bullet 无明显关系 → 多半是凑预算或残留废案

   判定方式（纯 LLM 语义）：
   - 对每个节点，逐 bullet 自问"删掉这条事件，节点的'推进目标'还能达成吗？"。能 → 标可疑
   - 对每个节点，自问"这些 bullet 重排顺序，因果是否被破坏？"。否 → 标可疑
   - 可疑 bullet 占节点总 bullet > 30% → review FAIL，输出节点名 + 可疑 bullet 列表

   **6b. 伏笔回收**

   检查 arc 中所有显式或隐式的伏笔/暗示是否在本 arc 内被回收。失败模式：
   - 节点 N 的某 bullet 含"伏笔 / 暗示 / 铺垫 / 埋下 / 留线索 / 暗藏"等语义，但后续所有节点的 bullet 与人物弧关键转折中找不到对应"回收 / 揭晓 / 印证 / 兑现 / 浮出"事件
   - 人物弧"关键转折"中出现"突然 / 凭空"的转变，但 arc 早期节点无任何铺垫

   判定方式（纯 LLM 语义，不依赖关键词字典）：
   1. 通读全 arc，列出所有「悬而未决项」（未交代的人物动机、被埋下的物件/秘密、提及但未展开的关系、被暗示的反派/势力等）
   2. 对每项悬而未决项，在后续节点 + 人物弧中寻找显式回应
   3. 找不到回应 → review FAIL，输出悬而未决项 + 所在节点 epXX + 建议回收时机

   **每个 arc 必须自洽闭环，所有伏笔在本 arc 内回收，无跨 arc 豁免。**

   6a 与 6b 各自独立判定，任一 FAIL → 本检查项总判 FAIL。
7. **continue-series 一致性**（若 outline.md 存在）：已播出集数对应的回溯节点是否忠实保留既成事实，无改写

### 常见误区

- **与 narrative review 混淆** — 跑去评价"剧情精彩不精彩 / 角色台词好不好"。arc review 只看**框架**，剧情质量是 outline / novel review 的职责
- **漏检 schema 标注** — 只看叙事不查 `(epXX-YY)` 合规与集数总和，导致后续 director-outline 定位 epXX 节点失败
- **挑刺到不可能通过** — 每个节点都能想出"更精彩的转折"，反复挑剔 → arc fix 被打补丁直到崩塌；只列愿意为之耗一轮 fix 的框架级问题
- **逐句改写式意见** — 写"这句话可以改成..."；意见说清问题方向（"节点 2 集数过长导致高潮被压缩"），不替 director 写最终文字

## 输出格式

审核结果写入 `story/.review-arc.md`（append 模式，每轮追加一段）。

**Round 自检**：
1. Read `.review-arc.md`（若不存在，本次为第 1 轮；若存在，grep `^## 第 [0-9]+ 轮` 找最大 N，本次为第 N+1 轮）
2. 用 Write（首次创建文件）或 Edit（append；oldString 用文件末尾 50 字符 anchor）追加本轮段

**本轮段格式**：

通过时（仅 heading 行）：
```markdown

## 第 {N} 轮 ({YYYY-MM-DD HH:MM}) - 通过
```

不通过时：
```markdown

## 第 {N} 轮 ({YYYY-MM-DD HH:MM}) - 需修改 ({M} 项)

1. **{位置（节点/人物名）}：** {问题描述} → {修改建议}
2. **{位置}：** {问题描述} → {修改建议}
```

注意：每轮段前留一个空行，与上一轮段隔开。

## 规则

最多 2 轮反馈。审核时若发现现实中的明星 / 公众人物名字、真实地名、商标名，要求替换为虚构名称。

## 输出

### 文件操作
- 使用 Write 或 Edit 维护 `story/.review-arc.md`（append 模式，详见上文「输出格式」段的 Round 自检流程）

### 返回内容
- 简报：`pass` 或 `needs_revision {M}`（{M} = 本轮意见条数）→ 返回给 workflow
- 详细意见已写入文件，下游 fix skill 自行读取该文件最后一轮段

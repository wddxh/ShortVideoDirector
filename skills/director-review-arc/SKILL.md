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
- `skills/director-arc/rules.md` — 必须读取（schema / 节点集数标注约定 / 5 类失败模式定义在此）
- `story/outline.md` — 若存在（continue-series）则读取，核对 arc 与已播出内容一致
- `skills/_meta/rules/output-language.md` — 必须读取（语言一致性）
- `skills/_meta/rules/review-meta-rules.md` — 必须读取（review 意见格式规约）

### 动态参数（$ARGUMENTS）
- 无。arc 是 series 级文件，无集数参数

## 职责描述

### 核心使命

审核 director-arc 生成的 `story/arc.md`，输出"通过"或"需修改 + 修改意见列表"。直接下游是 director-arc 的 fix 流程（与 review-novel 同模式：意见会被自动消化重写 arc），所以意见列表 = 工作单，每条都会被执行。arc 失败会让后续所有 outline / script / storyboard 在错误骨架上展开，必须严格拦截框架级问题；微调措辞类问题不要列入。

### 工作思路（按 spec §6.3 5 类失败模式 + schema 校验逐项过）

1. **schema / 标注合规**：节点 header 是否带 `(epXX-YY)`；集数零填充；主线节点集数总和 = `## 总集数`；同一线无重叠/无 gap；副线（若有）内部首尾相接
2. **arc 完整性**：主线节点是否覆盖"起承转合"；世界观要点是否清晰、对叙事关键
3. **节点集数分配合理性**：参照 rules.md §3 三段式（铺垫 ~30% / 发展 ~40-50% / 收束 ~20-30%）；典型反例如"8 集铺垫 + 2 集高潮 + 0 集收束"
4. **人物弧深度**：起点与终点状态是否存在**可观察的差异**（信念/关系/能力/处境）；关键转折是否 ≥2 且分布在不同节点；转折是否带 epXX 锚点
5. **关键转折分布**：转折是否分布于全 arc，每节点至少 1 个推进；杜绝"全部集中在 ep01-03"
6. **副线服务主线**：B 线人物与主线是否有交集；B 线事件是否至少 1 次显式影响主线（提供信息 / 制造障碍 / 推动抉择 / 反衬主题）
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

---
name: director-review-keyframes-visual
description: Director 视觉审核汇总层——按集内序号分批并行调用 director-review-keyframe-visual-single（每批 ≤5 张），聚合成完整 review 结果、dirty list 与无法判定列表。
user-invocable: false
context: fork
agent: director
allowed-tools: Read, Write, Edit, Grep, Skill
model: opus
---

## 输入

### 文件读取
- `story/episodes/$ARGUMENTS[0]/keyframes.json` — 必须读取（取关键帧列表与集内序号顺序）

### Skill 调用
- `director-review-keyframe-visual-single` — 对每张关键帧调用一次

### 动态参数（$ARGUMENTS）
- `$ARGUMENTS[0]` — 当前集数（如 `ep01`）

## 职责描述

### 核心使命

把单帧 visual review 的结果**纯透传聚合**为本集完整的 visual review 结果。直接下游是 `creator-fix-keyframe-image`：本 skill 输出"通过"或"需修改 + 意见列表 + dirty list"，fix 据 dirty list 改 prompt 重抽。**纯透传——不做整体扫视、不做剧情节奏判断**（这些是 narrative review 的职责）；本 skill 只负责调度单帧 review 与聚合输出。

### 工作思路

1. **读 keyframes.json**，按 keyframes 数组顺序拿到所有 KF-id
2. **预计算 (kfId, prevId) 对**：第 1 张 prevId 为空字符串；第 i 张 (i≥2) prevId = 第 i-1 张的 KF-id。一次性算完，不依赖任何 review 结果
3. **按全局顺序切批**：每批 ≤5 张连续切分。例：30 张 → 6 批 [1-5][6-10][11-15][16-20][21-25][26-30]
4. **逐批执行**：
   - 在主 skill 单条 message 内，对批内每张 (kfId, prevId) 对**并行使用 Skill tool 调用** `director-review-keyframe-visual-single` skill，传递参数：`$ARGUMENTS[0] {kfId} {prevId}`（每条 message 内 ≤5 个并行调用，OC plugin 自动转成 task 调用）
   - 等批内全部 done
   - 检查失败的：subagent 抛错 / 返回非空非 JSON
   - 若有失败 → **同批内立即 re-dispatch 失败者**：再次在一条新 message 内使用 Skill tool 调用 `director-review-keyframe-visual-single` skill，传递参数同上（仅重试失败的 KF-id），重试 done 才进入下一批
   - 每个失败 KF-id 最多重试 1 次；重试仍失败 → 计入「无法判定」列表
   - 重试时 prevId 保持不变
5. **进度日志**：每批 dispatch 前主 skill 输出一行简短日志，例 `批 2/6: KF-EP01-006..010`
6. **收集每次返回**：
   - 空字符串 → 该帧通过，不入意见列表
   - JSON 对象 → 该帧需修改，加入意见列表，KF-id 加入 dirty list
   - 重试仍失败 → KF-id 加入「无法判定」列表，**不入 dirty list**
7. **聚合输出**（按 KF-id 在 keyframes.json 的全局顺序排序意见列表与 dirty list）：
   - M=0, K=0 → "通过"
   - M=0, K>0 → "通过 (K 项无法判定)"
   - M>0, K=0 → "需修改 (M 项)" + 意见列表 + dirty list
   - M>0, K>0 → "需修改 (M 项, K 项无法判定)" + 意见列表 + dirty list + 无法判定列表

### 常见误区

- **整体扫视越权** — 单帧全过后再读全部 .md 做"整体节奏判断" — 这是 narrative review 的事，本 skill 纯透传
- **跳过上一帧 KF-id** — 第 2+ 张调用时漏传上一帧 id，导致单帧 skill 无法做衔接判断 — 严格按集内序号传上一帧
- **改写单帧意见** — 收到单帧 JSON 后改写 issue 或 prompt_direction 文字 — 原样透传，不二次加工
- **批内同步等待越权** — 批内某张 done 后立刻处理它并提前进下一批 — 必须等批内 5 张全部 done（含重试 done）才进下一批，遵守 LLM 轮次模型
- **重试无限循环** — 失败时反复重抽以求成功 — 重试最多 1 次，仍失败则归入「无法判定」，不再消耗 token
- **接管子 agent 工作** — 子 agent 失败时主 skill 自己审那张图 — 不接管，遵循 dispatch-discipline；重试 1 次仍失败则归入「无法判定」
- **无法判定混入 dirty list** — 把重试失败的 KF-id 也加进 dirty list 让 fix 处理 — 不能加，fix 不知道改什么 prompt direction，下一轮 review 时会重审

## 输出格式

审核结果写入 `story/episodes/$ARGUMENTS[0]/.review-keyframes-visual.md`（append 模式，每轮追加一段）。

**Round 自检**：
1. Read `.review-keyframes-visual.md`（若不存在，本次为第 1 轮；若存在，grep `^## 第 [0-9]+ 轮` 找最大 N，本次为第 N+1 轮）
2. 用 Write（首次创建文件）或 Edit（append；oldString 用文件末尾 50 字符 anchor）追加本轮段

**本轮段 heading（4 变体）**：

| 情形 | heading |
|---|---|
| M=0, K=0 | `## 第 {N} 轮 ({YYYY-MM-DD HH:MM}) - 通过` |
| M=0, K>0 | `## 第 {N} 轮 ({YYYY-MM-DD HH:MM}) - 通过 ({K} 项无法判定)` |
| M>0, K=0 | `## 第 {N} 轮 ({YYYY-MM-DD HH:MM}) - 需修改 ({M} 项)` |
| M>0, K>0 | `## 第 {N} 轮 ({YYYY-MM-DD HH:MM}) - 需修改 ({M} 项, {K} 项无法判定)` |

其中 M = 意见条数，K = 无法判定条数。

**本轮段 body**：

- `### 意见列表` 与 `### dirty list` 小节仅当 M>0 时出现
- `### 无法判定（subagent 重试失败）` 小节仅当 K>0 时出现
- 意见列表与 dirty list 均按 KF-id 在 keyframes.json 的全局顺序排序
- 无法判定列表按 KF-id 全局顺序排序

通过时（M=0, K=0，仅 heading 行）：
```markdown

## 第 {N} 轮 ({YYYY-MM-DD HH:MM}) - 通过
```

完整变体示例（M>0, K>0）：
```markdown

## 第 {N} 轮 ({YYYY-MM-DD HH:MM}) - 需修改 ({M} 项, {K} 项无法判定)

### 意见列表
1. **{KF-id}：** {issue} → {prompt_direction}
2. **{KF-id}：** {issue} → {prompt_direction}
...

### dirty list
KF-EP01-003 KF-EP01-007

### 无法判定（subagent 重试失败）
KF-EP01-012 KF-EP01-019
```

dirty list 为空格分隔的 KF-id，供下游 `creator-fix-keyframe-image` 直接消费。
「无法判定」列表只供 user 与下一轮 review 参考，fix skill 自然跳过。

注意：每轮段前留一个空行，与上一轮段隔开。

## 规则

- **分批并行调用单帧 skill**：每批 ≤5 张，主 skill 单条 message 内并行使用 Skill tool 调用 `director-review-keyframe-visual-single` skill（OC plugin 自动转成 task call）；批内同步等待全部 done，批间串行
- **重试规则**：单张失败（subagent 抛错 / 返回非空非 JSON）最多重试 1 次；重试仍失败则计入「无法判定」列表，**不入 dirty list**
- **进度日志**：每批 dispatch 前输出一行 `批 i/N: KF-EP01-AAA..BBB`，让 user 在 OC 主 session 看到进度
- 调度顺序严格按 keyframes.json 中 keyframes 数组顺序（切批与聚合都按此顺序）
- 单帧 skill 返回的 JSON 内容不二次加工，原样透传到意见列表
- 不接管子 agent 的 review 工作（遵循 dispatch-discipline）

## 输出

### 文件操作
- 使用 Write 或 Edit 维护 `story/episodes/$ARGUMENTS[0]/.review-keyframes-visual.md`（append 模式，详见上文「输出格式」段的 Round 自检流程）

### 返回内容

简报（4 变体，{M} = 本轮意见条数，{K} = 无法判定条数）→ 返回给 workflow：

| 情形 | 简报 |
|---|---|
| M=0, K=0 | `pass` |
| M=0, K>0 | `pass {K}_unknown` |
| M>0, K=0 | `needs_revision {M}` |
| M>0, K>0 | `needs_revision {M} {K}_unknown` |

注意：
- K=0 时不输出 `_unknown` 后缀（即简报永不形如 `pass 0_unknown`）
- 文件 heading 用中文（`通过` / `需修改`，user 可读）；返回简报用英文 token（`pass` / `needs_revision`，caller 匹配）—— 两个通道独立，不要混用

调用方判断规则：
- 简报以 `needs_revision` 开头 → 进入 fix 循环
- 简报以 `pass` 开头 → 本轮通过（即使有 K 项无法判定也不阻塞流程；下一轮 review 会自然重审）

详细意见、dirty list 与无法判定列表已写入文件，下游 fix skill 自行读取该文件最后一轮段的 dirty list。

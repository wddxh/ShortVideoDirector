---
name: director-review-keyframes-visual
description: Director 视觉审核汇总层——按集内序号遍历所有关键帧，逐张调用 director-review-keyframe-visual-single，聚合成完整 review 结果与 dirty list。
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
2. **遍历**：对第 i 张关键帧（i 从 1 开始），使用 Skill tool 调用 `director-review-keyframe-visual-single` skill：
   - 第 1 张：传 `$ARGUMENTS[0]` + 当前 KF-id + 空字符串（无上一帧）
   - 第 2+ 张：传 `$ARGUMENTS[0]` + 当前 KF-id + 上一帧 KF-id
3. **收集每次返回**：
   - 空字符串 → 该帧通过，不入意见列表
   - JSON 对象 → 该帧需修改，加入意见列表，KF-id 加入 dirty list
4. **聚合输出**：
   - 全通过 → 输出"通过"
   - 至少 1 张需修改 → 输出"需修改" + 意见列表 + dirty list

### 常见误区

- **整体扫视越权** — 单帧全过后再读全部 .md 做"整体节奏判断" — 这是 narrative review 的事，本 skill 纯透传
- **跳过上一帧 KF-id** — 第 2+ 张调用时漏传上一帧 id，导致单帧 skill 无法做衔接判断 — 严格按集内序号传上一帧
- **改写单帧意见** — 收到单帧 JSON 后改写 issue 或 prompt_direction 文字 — 原样透传，不二次加工
- **并行调用** — 想同时调用多个单帧 skill 加速 — 串行调用，避免单帧 skill fork context 同时打开多张图

## 输出格式

审核结果写入 `story/episodes/$ARGUMENTS[0]/.review-keyframes-visual.md`（append 模式，每轮追加一段）。

**Round 自检**：
1. Read `.review-keyframes-visual.md`（若不存在，本次为第 1 轮；若存在，grep `^## 第 [0-9]+ 轮` 找最大 N，本次为第 N+1 轮）
2. 用 Write（首次创建文件）或 Edit（append；oldString 用文件末尾 50 字符 anchor）追加本轮段

**本轮段格式**：

通过时（仅 heading 行）：
```markdown

## 第 {N} 轮 ({YYYY-MM-DD HH:MM}) - 通过
```

不通过时：
```markdown

## 第 {N} 轮 ({YYYY-MM-DD HH:MM}) - 需修改 ({M} 项)

### 意见列表
1. **{KF-id}：** {issue} → {prompt_direction}
2. **{KF-id}：** {issue} → {prompt_direction}
...

### dirty list
KF-EP01-003 KF-EP01-007 KF-EP01-012
```

dirty list 为空格分隔的 KF-id，供下游 `creator-fix-keyframe-image` 直接消费。

注意：每轮段前留一个空行，与上一轮段隔开。

## 规则

- 串行调用单帧 skill（不并行）
- 调度顺序严格按 keyframes.json 中 keyframes 数组顺序
- 单帧 skill 返回的 JSON 内容不二次加工，原样透传到意见列表

## 输出

### 文件操作
- 使用 Write 或 Edit 维护 `story/episodes/$ARGUMENTS[0]/.review-keyframes-visual.md`（append 模式，详见上文「输出格式」段的 Round 自检流程）

### 返回内容
- 简报：`pass` 或 `needs_revision {M}`（{M} = 本轮意见条数）→ 返回给 workflow
- 详细意见与 dirty list 已写入文件，下游 fix skill 自行读取该文件最后一轮段

---
name: director-review-novel
description: Director审核Writer小说原文，检查与大纲一致性、角色塑造和叙事质量。
user-invocable: false
context: fork
agent: director
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
model: opus
---

## 输入

### 文件读取
- `story/episodes/$ARGUMENTS[0]/outline.md` — 必须读取
- `story/episodes/$ARGUMENTS[0]/novel.md` — 必须读取
- `assets/characters/*.md` — 若存在则读取（角色一致性审核）
- `$SVD_PLUGIN_DIR/skills/_meta/rules/output-language.md` — 必须读取（语言一致性）
- `$SVD_PLUGIN_DIR/skills/_meta/rules/review-meta-rules.md` — 必须读取（review 意见格式规约）

### 动态参数（$ARGUMENTS）
- `$ARGUMENTS[0]` — 当前集数（如 ep01）

## 职责描述

### 核心使命

审核 Writer 生成的小说，输出"通过"或"需修改 + 修改意见列表"。直接下游是 writer-fix-novel skill：当你判"需修改"时，意见列表会被自动传给 fix skill 在最多 2 轮内修订原文，列表里的每一条都会被执行。审核的两个产物承担不同责任：判定（通过/需修改）是质量门槛，意见列表是给 fix skill 的工作单。审核的价值不在"挑了多少刺"，而在"挡住会卡住整条流水线的内容"——文学瑕疵不影响后续分镜消化就不该拦；大纲偏离、人物突变、画面感稀薄会让分镜质量崩塌，必须拦。

### 工作思路

1. 先扫整体观感（作为读者读完）：剧情通顺、人物可信、画面感够吗？
2. 对照 outline：本集核心情节、关键转折、信息传达——是否都落地？
3. 对照人物档案（若有）：性格/能力/外观是否一致？
4. 过 writer-novel/rules.md 的格式与机械约束（画面感、台词密度、禁旁白等）
5. 决定值得拦截的问题——所有进入意见列表的项都会被 fix skill 执行；审美瑕疵（不修也不影响后续分镜消化）不要列入；列了就是命令 fix skill 改
6. 第二轮 review 时（fix 已修过一次后）：知道这是最后一轮 fix 机会，意见聚焦在仍影响后续分镜的关键问题上

### 常见误区

- **机械放过** — rules.md 全过 → 通过；但小说可能整体平淡或剧情不连贯，rules 抓不到这层 — rules 是底线不是终点，整体观感判定凌驾于 rules
- **挑刺到不可能通过** — 每段都能想出"更优写法"，所有列入意见的项都会被 fix skill 执行；2 轮 fix 上限内反复挑刺 → fix skill 在打补丁之间反复重写，质量反而可能下降 — 仅列愿意为之耗一轮 fix 的问题；审美瑕疵忍下
- **跳过 outline 对照** — 模型容易先按"小说审美"评价，忘了对照 outline 检查"本集要做的事都做了吗" — 每条意见前自问"这是 outline 偏离还是审美偏好"
- **逐句改写式意见** — 写"这句话可以改成..."，fix skill 会照搬作为最终文字，反而剥夺 Writer 的创作空间，且上下文衔接和情绪连续性会出问题 — 意见说清问题方向（"这段画面感稀薄需要补具体动作"），不替 Writer 写最终文字

## 三维质性校验（必跑）

新增三维校验（替代字数检查）。三维一律 fail → 意见列具体定位, fix 阶段处理:

| 维度 | 校验方式 |
|---|---|
| (a) 场景覆盖 | 按 outline 场景标题列表逐项 grep novel.md + 质性确认每场景在 novel 中可定位 |
| (b) 因果链 | 顺序读 novel, 标记每场景"因"和"果", 前场果在后场因中被引用 |
| (c) 过渡自然 | 场景切换处是否有过渡句 / 时空转场描述 / 视角切换提示 |

config.md 中如存在 `每集小说字数` 字段，本 review 静默忽略（不再用作硬阈值）。

## 输出格式

审核结果写入 `story/episodes/$ARGUMENTS[0]/.review-novel.md`（append 模式，每轮追加一段）。

**Round 自检**：
1. Read `.review-novel.md`（若不存在，本次为第 1 轮；若存在，grep `^## 第 [0-9]+ 轮` 找最大 N，本次为第 N+1 轮）
2. 用 Write（首次创建文件）或 Edit（append；oldString 用文件末尾 50 字符 anchor）追加本轮段

**本轮段格式**：

通过时（仅 heading 行）：
```markdown

## 第 {N} 轮 ({YYYY-MM-DD HH:MM}) - 通过
```

不通过时：
```markdown

## 第 {N} 轮 ({YYYY-MM-DD HH:MM}) - 需修改 ({M} 项)

1. **{位置}：** {问题描述} → {修改建议}
2. **{位置}：** {问题描述} → {修改建议}
```

注意：每轮段前留一个空行，与上一轮段隔开。

## 规则参考

- `skills/writer-novel/rules.md` — 必须读取，按照其中的规则逐条审核

## 规则

最多 2 轮反馈。审核时需检查是否存在现实中的明星或公众人物名字、真实地名、商标名，发现则要求替换为虚构名称。

## 输出

### 文件操作
- 使用 Write 或 Edit 维护 `story/episodes/$ARGUMENTS[0]/.review-novel.md`（append 模式，详见上文「输出格式」段的 Round 自检流程）

### 返回内容
- 简报：`pass` 或 `needs_revision {M}`（{M} = 本轮意见条数）→ 返回给 workflow
- 详细意见已写入文件，下游 fix skill 自行读取该文件最后一轮段

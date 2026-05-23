---
name: director-fix-arc
description: 按 .review-arc.md 最后一轮意见定向修正 story/arc.md。
user-invocable: false
context: fork
agent: director
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
model: opus
---

## 输入

通过 prompt 接收:
- $ARGUMENTS[0] — `.review-arc.md` 路径 (一般 `story/.review-arc.md`)

## 必读

- `story/arc.md` — 必读 (现有 arc, 待修订源)
- `$ARGUMENTS[0]` — 必读 (含多轮 review; 仅取最大轮号那段意见)
- `${CLAUDE_PLUGIN_ROOT}/skills/director-arc/rules.md` — 必读并严格遵循 (schema / 节点合规性 / 失败模式)
- `config.md` — 必读 (取 总集数 字段)
- `${CLAUDE_PLUGIN_ROOT}/skills/_meta/rules/output-language.md` — 必须读取（语言一致性）

## 工作流

### Phase 1: 读现状

1. Read `story/arc.md` 取现有阶段规划
2. Read `config.md`, 用 `bash ${CLAUDE_PLUGIN_ROOT}/scripts/read-config.sh "总集数"` 取整数 N
3. Read `$ARGUMENTS[0]` 全文

### Phase 2: 取最新轮 review 意见

用 grep 查找所有 `^## 第 [0-9]+ 轮` 标题, 找最大 N:

```bash
grep -nE '^## 第 [0-9]+ 轮' $ARGUMENTS[0]
```

仅取最大轮号那段意见作为修复输入。前几轮意见忽略 (已在前轮处理过或被新意见取代)。

### Phase 3: 定向修订

- 只动 review 意见明确指出的问题
- 其他内容 (未提及的节点 / 阶段) 保留原样
- 维持 schema 合规 (按 director-arc/rules.md 节点定义)
- 修订后节点总集数严格等于 N

### Phase 3.5: schema 升级（针对旧 arc.md, 必做）

若现有 arc.md 节点 header 缺 `节点预算 ~Zs` 字段，或核心事件不是 bullet 列表带 `(~Ns, 必需|可选)` 标记，本 phase 主动升级到新 schema：

1. 对每节点 `bash ${CLAUDE_PLUGIN_ROOT}/scripts/arc-budget.sh <节点集数>` 取预算秒，写入 header (epXX-YY, 节点预算 ~Zs)
2. 把核心事件 prose 段拆为 bullet 列表
3. 为每 bullet 加 `(~Ns, 必需|可选)` 标记（LLM 重新决策估时与必需/可选分类）
4. 校验 sum ≤ 预算; 若超, 按 director-arc/rules.md §3.5 创作引导取舍 (拆细 / 合并相似 / 删次要可选 / 重新拆分节点划分, 不改集数)

**不做"宽容补字段"** — 即使本轮 review 意见没明说 schema 升级也要主动做, 否则下游 director-review-arc 立即 FAIL (节点预算字段缺失 / bullet schema 违规)。

### Phase 4: 自检

按 director-arc/rules.md 失败模式清单逐项自查:
- 节点数 / 集数分布合规
- 节点描述完整 (主题 / 冲突 / 收束)
- 与 config.md 总集数一致

**必跑脚本兜底**:

```bash
bash ${CLAUDE_PLUGIN_ROOT}/scripts/arc-event-sum.sh story/arc.md
```

退出码非 0 → 回 Phase 3 / Phase 3.5 重做（schema 违规 / sum 超预算两类）。

不通过则回 Phase 3。

### Phase 5: 写入

Write 覆写 `story/arc.md`。返回 caller (main session) "修订完成 + 修订范围摘要"。

## 失败处理

- 找不到 `## 第 N 轮` 标题: 报错退出 "review 文件格式异常"
- 总集数校验失败: 报错退出 "修订后节点集数总和 ≠ config 总集数 N"
- 任何 schema 违规: 回 Phase 3 重做

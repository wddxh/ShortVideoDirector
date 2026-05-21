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
- `skills/director-arc/rules.md` — 必读并严格遵循 (schema / 节点合规性 / 失败模式)
- `config.md` — 必读 (取 总集数 字段)

## 工作流

### Phase 1: 读现状

1. Read `story/arc.md` 取现有阶段规划
2. Read `config.md`, 用 `bash scripts/read-config.sh "总集数"` 取整数 N
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

### Phase 4: 自检

按 director-arc/rules.md 失败模式清单逐项自查:
- 节点数 / 集数分布合规
- 节点描述完整 (主题 / 冲突 / 收束)
- 与 config.md 总集数一致

不通过则回 Phase 3。

### Phase 5: 写入

Write 覆写 `story/arc.md`。返回 caller (main session) "修订完成 + 修订范围摘要"。

## 失败处理

- 找不到 `## 第 N 轮` 标题: 报错退出 "review 文件格式异常"
- 总集数校验失败: 报错退出 "修订后节点集数总和 ≠ config 总集数 N"
- 任何 schema 违规: 回 Phase 3 重做

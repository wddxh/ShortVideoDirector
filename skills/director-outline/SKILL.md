---
name: director-outline
description: 生成单集 outline，含场景级拆分 + 节奏角色。按 mode 自动加载 series.md 或 short.md 专属指南。
user-invocable: false
context: fork
agent: director
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
model: sonnet
---

## 输入
通过 prompt 接收：
- mode: 'new-series' | 'continue-series' | 'short'
- ep: 'epXX'
- plot_option: plot-options 返回的选定候选结构

## 必读文件
- `${CLAUDE_PLUGIN_ROOT}/skills/director-outline/rules.md` — 必须读取并严格遵循 (公共规则)
- `${CLAUDE_PLUGIN_ROOT}/skills/director-outline/series.md` (when mode=series) — 必须读取并严格遵循
- `${CLAUDE_PLUGIN_ROOT}/skills/director-outline/short.md` (when mode=short) — 必须读取并严格遵循
- `${CLAUDE_PLUGIN_ROOT}/skills/_meta/rules/output-language.md` — 必须读取（语言一致性）

## 工作流

### Phase 1: 检测 mode 并加载专属指南 (必做)
1. 解析 prompt 中的 mode 参数
2. 按 mode 用 Read tool 加载**仅对应 mode 的文件** (避免 prompt 污染):
   - mode in {'new-series', 'continue-series'}: Read('skills/director-outline/series.md')
   - mode='short': Read('skills/director-outline/short.md')
3. **不要**加载非当前 mode 的文件
4. 严格按"公共骨架 + 当前 mode 文件"指引执行后续 Phase

### Phase 2: 上下文准备
- 读 config.md
- 按 series.md / short.md 指引读其他上下文 (arc.md / 上集 outline.md 等)

### Phase 3: 生成 outline 公共骨架
所有 mode 都包含:
  ## 本集信息传达
  ## 场景列表
    ### 场景 N: ...

### Phase 4: 按 mode 加补充字段
按 Phase 1 加载的 series.md / short.md 指引执行

### Phase 4.5: 时长 sum 硬校验（必跑）

```bash
DURATION=$(bash ${CLAUDE_PLUGIN_ROOT}/scripts/read-config.sh "每集时长目标")
# 解析 DURATION 字符串:
# 范围 X-Y 分钟 → --target-min <X*60> --target-max <Y*60>
# 范围 X-Y 秒 → --target-min X --target-max Y
# 单值 N 分钟 → --target <N*60>
# 单值 Ns / N秒 → --target N

bash ${CLAUDE_PLUGIN_ROOT}/scripts/scene-duration.sh story/episodes/{ep}/outline.md \
  [--target-min M --target-max X] | [--target N]
```

退出码非 0 → 按 rules.md `## 时长规划原则` 7 条优先级取舍 (分散吸收 > 砍场景数 > 压缩时长), 再次跑校验直到 PASS 才进 Phase 5。

### Phase 5: 写「本集新增资产」段（必产出）

outline.md **末尾必须含 `## 本集新增资产` 段**（写入位置：所有 mode 专属字段——如 series 的「集尾钩子」、short 的「结局设计」——之后，作为文件最末段），按 `${CLAUDE_PLUGIN_ROOT}/skills/director-outline/rules.md` 「新增资产规则」段 写入：
- 4 类型行（characters / locations / items / buildings）齐全
- 无内容写 `(无)`
- asset id 按 `${CLAUDE_PLUGIN_ROOT}/skills/director-outline/rules.md`「asset id 规则」编写（=资产名，跟随 config.md 「语言」设置）
- 写入前 Glob `assets/{characters,locations,items,buildings}/*.md` 复用判断（精确匹配 / 相近名优先复用既有）

该段是 director-review-outline 做 dangling check 的依据。scriptwriter Phase 5 会读取本段 + 剧本提取的 asset → 合并 dedupe → 重写为 `## 本集资产清单` superset 终态（含「### 新增资产」+「### 已有资产（本集出场）」两子段）。

### Phase 6: 输出 + (按 mode) 同步全局
按 mode 指引

## 通用规则
- 场景颗粒度: 每场景含 1-3 个连续动作
- asset 引用: 所有 character/location 必须在 assets/ 已注册或在"本集新增资产"列出
- 节奏角色互斥: 一场景只能挂一个节奏角色

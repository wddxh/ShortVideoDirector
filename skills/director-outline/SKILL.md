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
- `skills/director-outline/rules.md` — 必须读取并严格遵循 (公共规则)
- `skills/director-outline/series.md` (when mode=series) — 必须读取并严格遵循
- `skills/director-outline/short.md` (when mode=short) — 必须读取并严格遵循

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

### Phase 5: 输出 + (可选) 同步全局
按 mode 指引

## 通用规则
- 场景颗粒度: 每场景含 1-3 个连续动作
- asset 引用: 所有 character/location 必须在 assets/ 已注册或在"本集新增资产"列出
- 节奏角色互斥: 一场景只能挂一个节奏角色

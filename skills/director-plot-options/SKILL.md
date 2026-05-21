---
name: director-plot-options
description: 生成 3 个差异化剧情候选并与用户协商选定。按 mode 自动加载 series.md 或 short.md 专属指南。
user-invocable: false
context: fork
agent: director
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
model: sonnet
---

## 输入

通过 prompt 接收:
- mode: 'new-series' | 'continue-series' | 'short'
- action: 'generate' | 'modify'
- target_option: 'A' | 'B' | 'C' (modify 可选)
- modification: 用户指令文本 (modify 必填)
- previous_options_path: 'tmp/...' (modify 必填)

输出由 action 决定:
- generate → 3 候选
- modify + target_option → 修改后的 1 个候选
- modify 无 target_option → 重生成 3 候选

## 必读文件

- `config.md` — 必读
- `skills/director-plot-options/series.md` (when mode ∈ {new-series, continue-series}) — 必读并严格遵循
- `skills/director-plot-options/short.md` (when mode = short) — 必读并严格遵循

## 工作流

### Phase 1: 检测 mode 并加载专属指南 (必做)

1. 解析 prompt 中的 mode 参数
2. 按 mode 用 Read tool 加载**仅对应 mode 的文件** (避免 prompt 污染):
   - mode ∈ {'new-series', 'continue-series'}: Read('skills/director-plot-options/series.md')
   - mode = 'short': Read('skills/director-plot-options/short.md')
3. **不要**加载非当前 mode 的文件
4. 严格按"公共骨架 + 当前 mode 文件"指引执行后续 Phase

### Phase 2: 上下文准备

- 读 `config.md`
- 按 mode 文件指引读其他上下文 (series 需 arc.md / story/outline.md / 最近 M 集 novel；short 仅 config)

### Phase 3: 按 action 执行

#### Phase 3a (action='generate')

按公共骨架 + mode 文件指引生成 3 候选, 差异显著:
- 输出 3 个候选 (选项 A / B / C)
- 3 个候选必须差异显著 (主题、冲突类型或叙事风格不同)
- 版权规避: 不得使用现实明星 / 公众人物 / 真实地名 / 商标
- 按 mode 文件中"每候选字段"清单填写

#### Phase 3b (action='modify' + target_option)

1. Read previous_options_path 取之前 3 候选
2. 仅按 modification 修改 target_option 指向的候选
3. 输出 1 个修改后候选

#### Phase 3c (action='modify' 无 target_option)

1. Read previous_options_path 取之前 3 候选 (反向约束: 新 3 候选不应与旧雷同)
2. 按 modification 偏好重生成 3 候选

### Phase 4: 自检

按 mode 文件中"专属失败模式"自查; 不通过则回 Phase 3。

## 输出

不与用户交互, 直接返回结果给 caller:
- generate / modify-without-target: 3 候选 markdown
- modify-with-target: 1 个修改后候选 markdown

## 通用规则

- 3 候选差异必须落在结构层 (主线 / 冲突 / 情感落点)，不是仅换名字
- continue-series 时，候选不得偏离 arc 当前阶段目标

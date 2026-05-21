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

通过 prompt 接收：
- mode: 'new-series' | 'continue-series' | 'short'
- $ARGUMENTS[0] (可选): 用户偏好描述 (重新生成时传入)

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

### Phase 3: 生成 3 候选 (公共骨架)

所有 mode 都满足:
- 输出 3 个候选 (选项 A / B / C)
- 3 个候选必须差异显著 (主题、冲突类型或叙事风格不同)
- 版权规避：不得使用现实明星 / 公众人物 / 真实地名 / 商标
- 按 mode 文件中"每候选字段"清单填写

### Phase 4: mode 专属强制交互

- 按 Phase 1 加载的 series.md / short.md "强制问用户" 指引执行
- series mode **必须**额外问"总集数 (整数)"，留待 director-arc 接收
- short mode **不问**总集数

### Phase 5: 协商与选定

呈现 3 候选 + (series) 总集数追问，等待用户回应:
- 用户选定某候选 → 将该候选完整文本 (+ series 的总集数) 返回 workflow
- 用户提偏好并要求重生成 → 偏好作为 `$ARGUMENTS[0]` 重新执行本 skill

### Phase 6: 自检

按 Phase 1 加载的 mode 文件中"专属失败模式"自查；不通过则回 Phase 3。

## 通用规则

- 3 候选差异必须落在结构层 (主线 / 冲突 / 情感落点)，不是仅换名字
- continue-series 时，候选不得偏离 arc 当前阶段目标
- full-auto mode: 按"观众吸引力 > 短视频适配性 > 剧情张力"自动选定 (series mode 总集数走 config 默认或追问)

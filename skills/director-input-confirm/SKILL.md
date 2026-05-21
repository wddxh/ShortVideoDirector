---
name: director-input-confirm
description: Director 根据用户故事材料生成结构化确认说明。按 mode 自动加载 series.md 或 short.md 专属指南。
user-invocable: false
context: fork
agent: director
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
model: sonnet
---

## 输入

通过 prompt 接收:
- mode: 'new-series' | 'continue-series' | 'short'
- story_input: 用户故事材料 (原始文本或文件路径)
- selected_plot_option: 从 plot-options 阶段返回的选定剧情方向 (new-series 必填; continue-series / short 可选)

## 必读文件

- `config.md` — 必读
- `skills/director-input-confirm/series.md` (when mode ∈ {new-series, continue-series}) — 必读并严格遵循
- `skills/director-input-confirm/short.md` (when mode = short) — 必读并严格遵循

## 工作流

### Phase 1: 检测 mode 并加载专属指南 (必做)

1. 解析 prompt 中的 mode 参数
2. 按 mode 用 Read tool 加载**仅对应 mode 的文件** (避免 prompt 污染):
   - mode ∈ {'new-series', 'continue-series'}: Read('skills/director-input-confirm/series.md')
   - mode = 'short': Read('skills/director-input-confirm/short.md')
3. **不要**加载非当前 mode 的文件
4. 严格按"公共骨架 + 当前 mode 文件"指引执行后续 Phase

### Phase 2: 上下文准备

- 读 `config.md`
- 按 mode 文件指引读其他上下文 (series 需 arc.md / story/outline.md / 最近 M 集 novel；short 仅 config)

### Phase 3: 生成结构化确认说明 (公共骨架)

所有 mode 都满足：
- 输出 Markdown 格式确认说明
- 忠实于用户输入，不过度发挥
- 版权规避：不得使用现实明星 / 公众人物 / 真实地名 / 商标
- 若材料涉及现实版权 IP，须在说明末尾追加版权规避提示
- 按当前 mode 文件中"字段清单"填写

### Phase 4: mode 专属字段填充

按 Phase 1 加载的 series.md / short.md "字段填写要求" 指引补充字段:
- series 模式: restate 总集数 (来自 config.md 总集数 字段); restate arc 状态 (continue-series 时)
- short 模式: 无 arc 字段, 无总集数字段

### Phase 5: 自检并返回

按 mode 文件"专属失败模式自查"清单确认; 通过则返回 markdown 给 caller。

## 输出

不与用户交互, 直接返回结构化确认说明 markdown:
- mode 标识
- (series) 总集数 restate
- (continue-series) arc 当前阶段 restate
- 故事材料摘要 + mode 专属字段
- (涉及现实 IP 时) 版权规避提示

## 通用规则

- "总集数"已存 config.md 总集数 字段; 本 skill 仅 **restate**, 不追问任何字段
- continue-series 时确认说明须与 arc 当前阶段目标对齐

---
name: director-plot-options
description: 生成 3 个差异化剧情候选 (action='generate') 或按 modification 修订候选 (action='modify')。按 mode 自动加载 series.md 或 short.md 专属指南。
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
- `skills/_meta/rules/output-language.md` — 必须读取（语言一致性）

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

按 mode 文件中"专属失败模式"自查; 不通过则回 Phase 3 对应分支 (3a/3b/3c, 按本次 action) 重做。

## 落盘

子代理**必须自己落盘**到 `story/plot-options.md`，而非把完整 markdown 塞 prompt（避免主 session 收到长 prompt 后再 Write/Edit 分段时 anchor 错位）。

### 落盘约束（强制，违反即视为生成失败）

1. **每个候选作为完整单元一次性 Write 或 Edit**，严禁按字段切片
   - 若单候选 > 2000 chars，用 `## 选项 N: <名称>` 整行作为 oldString anchor（该行在文件内唯一）
   - **绝不**用 `---` 或 `**字段名：**` 类作 anchor（不唯一，会错位）

2. **文件末尾必须留 sentinel 行**，给 main session 后续 Edit append "用户已选定方向" 块用：
   ```
   <!-- 候选列表结束，等待用户选定 -->
   ```

### 落盘步骤

#### action='generate' 或 'modify-without-target'

1. Write `story/plot-options.md`：先写头部 + 选项 A 完整段 + sentinel（确保单次 Write ≤2000 chars；若选项 A 超长，仅 Write 头部 + sentinel，留下空 placeholder）
2. Edit append 选项 B（anchor=`<!-- 候选列表结束，等待用户选定 -->`，newString=`## 选项 B: ...\n（完整 B 段）\n\n---\n\n<!-- 候选列表结束，等待用户选定 -->`）
3. Edit append 选项 C 同上模式
4. 若选项 A 留了 placeholder，用 anchor=`## 选项 A: <名称>` + 后续 placeholder 行替换为完整 A 段

#### action='modify-with-target'

只 Edit 替换该 target 选项整段：
- oldString=`## 选项 {target}: <现名称>` 整段到下一 `## 选项` 或 sentinel 之前
- newString=修改后该选项整段

不动其他选项，不动 sentinel。

## 输出（返回 caller 的 prompt 内容）

不与用户交互，prompt 仅返回简短摘要：

```
已落盘 3 候选到 story/plot-options.md。
- 选项 A: <主题名称>
- 选项 B: <主题名称>
- 选项 C: <主题名称>
（modify-with-target 时仅列被修改的那一项）
```

main session 收到该摘要后 Read `story/plot-options.md` → 呈现给用户 → 用户选定（A/B/C 或要求修改）→ main session 按 generate-episode-pipeline mode 文件指引处理后续动作。

## 通用规则

- 3 候选差异必须落在结构层 (主线 / 冲突 / 情感落点)，不是仅换名字
- continue-series 时，候选不得偏离 arc 当前阶段目标

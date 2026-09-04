---
name: generate-episode-pipeline
description: 内部 pipeline 调度。按 mode 参数 (new-series | continue-series | short) 编排调用链。由 series-video / short-video 入口 delegate 给它。
user-invocable: false
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Task
model: opus
---

## 输入
通过 prompt 接收：
- mode: 'new-series' | 'continue-series' | 'short'
- ep: 'epXX'
- 其他上下文（用户原始故事材料、plot_option 等，按 mode 透传给下游 skill）

## 必读文件 (按 mode 加载，双重保护)
- `${CLAUDE_PLUGIN_ROOT}/skills/generate-episode-pipeline/new-series.md` (when mode='new-series')
- `${CLAUDE_PLUGIN_ROOT}/skills/generate-episode-pipeline/continue-series.md` (when mode='continue-series')
- `${CLAUDE_PLUGIN_ROOT}/skills/generate-episode-pipeline/short.md` (when mode='short')

## 工作流

### Phase 1: 检测 mode 并加载对应 mode 文件 (必做)
1. 解析 prompt 中的 mode 参数
2. 按 mode 用 Read tool 加载**仅对应 mode 的文件** (避免 prompt 污染)：
   - mode='new-series': Read('skills/generate-episode-pipeline/new-series.md')
   - mode='continue-series': Read('skills/generate-episode-pipeline/continue-series.md')
   - mode='short': Read('skills/generate-episode-pipeline/short.md')
3. **不要**加载非当前 mode 的文件
4. 严格按加载的 mode 文件指引执行 Phase 2

### Phase 2: 按 mode 文件指引执行调用链
- 逐步执行 mode 文件指引的调用链（每步使用 Skill tool 调用对应的具体 skill）
- 每步明确告知 mode 和 ep 参数
- 遇到 review dirty 按 mode 文件中的循环上限处理
- 任一步失败立即停止并向用户报告

## 通用规则
- mode 一旦确定不再变更；如需切换，由入口 skill 重新派发
- ep 参数贯穿全流程，所有 sub-skill dispatch 必须显式传递
- review 循环上限：≤2 rounds（除非 mode 文件另有说明）

## Sheet Review Owner 路由

Sheet prompt review 的 dirty entries 按 owner 固定顺序处理，共享一个 `fix_attempts`，最多 2 次：

- `upstream-storyboard`：使用 Skill tool 调用 `storyboarder-fix-storyboard` skill。再使用 Skill tool 调用 `director-review-storyboard` skill。通过后使用 Skill tool 调用 `creator-storyboard-sheet-prompts` skill 重建受影响 cards。
- `generator`：使用 Skill tool 调用 `creator-storyboard-sheet-prompts` skill，缺卡/编号集合问题用 full，现存 card 问题用 incremental。
- `prompt-fix`：使用 Skill tool 调用 `creator-fix-storyboard-sheet-prompt` skill。

每一轮所有 owner 执行完后，只使用 Skill tool 调用 `director-review-storyboard-sheet-prompts` skill 一次。Visual dirty 时使用 Skill tool 调用 `creator-fix-storyboard-sheet-image` skill。再使用 Skill tool 调用 `director-review-storyboard-sheets-visual` skill；最多 2 轮。首次生成不调用 impact。

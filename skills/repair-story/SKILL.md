---
name: repair-story
description: 检测指定集的文件完整性，从断点处恢复生成。自动检测 series/short mode。
argument-hint: "[epXX, 可选；short mode 忽略]"
user-invocable: true
agent: director
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Skill, Task
model: opus
---

## 失败处理（核心规则）

**sub-agent task 失败后，永远不要在主 session 自己接管本应由 sub-agent 做的工作。**

1. 分析失败原因（task return 值 / 错误信息）
2. 如可修复：用修正后的参数重新派发同一 sub-agent
3. 如不可修复：将失败原因和已尝试方案返回给用户，停止流程

错误做法：自己 Write/fallback 应由 sub-agent 完成的内容。主 session 缺少 sub-agent 的隔离上下文，自己接管会导致质量下降、permission 错配等问题。

## 输入

- `$ARGUMENTS[0]`：可选集数（如 ep03）。short mode 下忽略，恒为 ep01。

## 必读文件（按 mode 加载，双重保护）

- `${CLAUDE_PLUGIN_ROOT}/skills/repair-story/series.md` (when mode='series')
- `${CLAUDE_PLUGIN_ROOT}/skills/repair-story/short.md` (when mode='short')

## 工作流

### Phase 0: Mode 检测（必做，先于一切业务）

1. 在仓库根目录执行 `bash ${CLAUDE_PLUGIN_ROOT}/scripts/detect-mode.sh`
2. 捕获 stdout（'series' | 'short'），作为本次会话的 `mode`
3. 若退出码非 0 或值非法 → 告知用户"mode 检测失败"并结束；不要猜测

### Phase 1: 加载对应 mode 文件（必做）

1. 按 Phase 0 的 mode 用 Read tool 加载**仅对应 mode 的文件**（避免 prompt 污染）：
   - mode='series': Read('skills/repair-story/series.md')
   - mode='short': Read('skills/repair-story/short.md')
2. **不要**加载非当前 mode 的文件
3. 严格按加载的 mode 文件指引执行 Phase 2-6

### Phase 2: 确定目标集数 + 读取配置

1. 按 mode 文件规则解析集数（series 从 $ARGUMENTS[0] 或 `bash ${CLAUDE_PLUGIN_ROOT}/scripts/latest-episode.sh`；short 硬编码 ep01）
2. 若集目录不存在 → 按 mode 文件指引提示用户先用对应入口 skill 创建，结束
3. 使用 Bash 调用 `bash ${CLAUDE_PLUGIN_ROOT}/scripts/read-config.sh "每集分镜数"` 等获取所需配置值

### Phase 3: 逐项检测完整性

使用 Bash 调用 `bash ${CLAUDE_PLUGIN_ROOT}/scripts/check-episode.sh {集数}` 一次性检查所有项目。

脚本输出每行一项检查结果，格式为 `{检查项}:{状态}[:详情]`：
- `outline:ok` / `outline:missing` / `outline:incomplete`
- `novel:ok` / `novel:missing` / `novel:incomplete:{实际字数}/{目标下限}`
- `script:ok` / `script:missing` / `script:incomplete`
- `asset-list:ok` / `asset-list:missing`
- `assets:ok` / `assets:missing:{缺失资产名}`
- `images:ok` / `images:missing:{缺失资产名}` / `images:skipped`
- `storyboard:ok` / `storyboard:missing` / `storyboard:incomplete:{详情}` / `storyboard:invalid:{详情}`
- `storyboard-sheets:ok` / `storyboard-sheets:invalid:{详情}`
- `storyboard-sheet-images:ok` / `storyboard-sheet-images:invalid:{详情}` / `storyboard-sheet-images:skipped`
- `storyboard-sheet-prompt-review:ok` / `storyboard-sheet-prompt-review:missing` / `storyboard-sheet-prompt-review:needs_revision`
- `storyboard-sheet-visual-review:ok` / `storyboard-sheet-visual-review:missing` / `storyboard-sheet-visual-review:needs_revision` / `storyboard-sheet-visual-review:skipped`

根据输出判断第一个非 ok 状态；`storyboard:missing|incomplete|invalid` 使用同一 storyboard recovery 入口。按基础资产卡→基础资产图片→storyboard→sheet card→sheet prompt review→sheet PNG→sheet visual review 的依赖顺序恢复。

### Phase 4: 报告 + 确认

1. 向用户报告检测结果：哪些通过，哪些缺失/不完整
2. 若所有检查通过 → 提示"该集文件完整，无需修复"，结束
3. 若大纲缺失/不完整 → 按 mode 文件指引提示用户用对应入口 skill 重新生成，结束
4. 其他情况 → 提示将从哪个步骤开始恢复，询问用户确认

### Phase 5: 从断点恢复

按 mode 文件「断点 → 恢复链路」执行：从第一个非 ok 步骤开始，依次执行后续所有步骤。所有 sub-skill 调用通过 Skill tool；review 失败 → 调对应 fix skill ≤2 轮。

### Phase 6: 完成

输出恢复摘要：从哪个步骤开始、重新生成了哪些内容、提示用户检查结果。

## 通用规则

- mode 一旦在 Phase 0 确定不再变更
- 所有 sub-skill dispatch 必须显式传递 ep（series 解析得到；short 恒为 ep01）
- Phase 5 执行前必须取得用户对恢复起点的确认
- `config.md` 图像模型 = `none` 时图片与 visual/impact 节点以 skipped 终态报告，sheet card 与 prompt review 不跳过

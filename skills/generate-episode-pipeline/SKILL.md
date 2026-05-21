---
name: generate-episode-pipeline
description: 内部 pipeline 调度。按 mode 参数 (new-series | continue-series | short) 编排调用链。由 series-video / short-video 入口 delegate 给它。
user-invocable: false
context: fork
agent: director
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Task
model: opus
---

## 输入
通过 prompt 接收：
- mode: 'new-series' | 'continue-series' | 'short'
- ep: 'epXX'
- 其他上下文（用户原始故事材料、plot_option 等，按 mode 透传给下游 skill）

## 必读文件 (按 mode 加载，双重保护)
- `skills/generate-episode-pipeline/new-series.md` (when mode='new-series')
- `skills/generate-episode-pipeline/continue-series.md` (when mode='continue-series')
- `skills/generate-episode-pipeline/short.md` (when mode='short')

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
- 逐步派发 sub-skill（task tool dispatch on OC，Skill tool on CC）
- 每步明确告知 mode 和 ep 参数
- 遇到 review dirty 按 mode 文件中的循环上限处理
- 任一步失败立即停止并向用户报告

## 通用规则
- mode 一旦确定不再变更；如需切换，由入口 skill 重新派发
- ep 参数贯穿全流程，所有 sub-skill dispatch 必须显式传递
- review 循环上限：≤2 rounds（除非 mode 文件另有说明）

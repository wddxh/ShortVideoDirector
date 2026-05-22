---
name: director-fix-outline
description: 按修订意见定向修正本集 outline。按 mode 自动加载 series.md 或 short.md 专属指南。
user-invocable: false
context: fork
agent: director
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
model: sonnet
---

## 输入

通过 prompt 接收:
- mode: 'series' | 'short'
- ep: 'epXX'
- $ARGUMENTS[0] — `.review-outline.md` 路径 (一般 `story/episodes/{ep}/.review-outline.md`)
- (可选) extra_instructions — 用户额外编辑请求 (edit-story 调用时传)

## 必读文件
- `story/episodes/{ep}/outline.md` — 必读 (现有大纲)
- `$ARGUMENTS[0]` — 必读 (含多轮 review; 仅取最大轮号那段意见)
- `config.md` — 必读
- `skills/director-outline/rules.md` — 必读并严格遵循 (公共规则)
- `skills/director-fix-outline/series.md` (when mode=series) — 必读
- `skills/director-fix-outline/short.md` (when mode=short) — 必读
- `$SVD_PLUGIN_DIR/skills/_meta/rules/output-language.md` — 必须读取（语言一致性）

## 工作流

### Phase 1: 检测 mode 并加载专属指南 (必做)
1. 解析 prompt 中的 mode 参数
2. 按 mode 用 Read tool 加载**仅对应 mode 的文件** (避免 prompt 污染):
   - mode='series': Read('skills/director-fix-outline/series.md')
   - mode='short': Read('skills/director-fix-outline/short.md')
3. **不要**加载非当前 mode 的文件
4. 严格按"公共骨架 + 当前 mode 文件"指引执行后续 Phase

### Phase 2: 读 outline 与 review 意见

- Read `story/episodes/{ep}/outline.md` 现状
- Read config.md
- Read `$ARGUMENTS[0]`, 用 `grep -nE '^## 第 [0-9]+ 轮' $ARGUMENTS[0]` 找最大 N, 取该段意见为修复输入 (前几轮忽略)
- 若 prompt 含 extra_instructions, 与 review 意见合并为完整修订意见集
- 按 mode 文件指引读其他上下文 (series 需 arc.md / story/outline.md; short 不需要)
- 通读修订意见, 把每条映射到具体事件 / 字段

### Phase 3: 按 mode 修正
- 按 Phase 1 加载的 series.md / short.md 指引定向修改字段
- 不擅自改与意见无关的部分；但必要时扩展到结构相邻字段以保持一致性

### Phase 4: 自检
- 每条意见是否落地？
- 公共骨架完整 (本集信息传达 / 场景列表)？
- 场景节奏角色、asset 引用规则未破坏？
- 按 mode 文件中"专属失败模式"自查

### Phase 5: 输出
- 使用 Write 覆写 `story/episodes/{ep}/outline.md`
- series mode: 额外按 series.md 指引同步 `story/outline.md` 中本集摘要

## 通用规则
- 场景颗粒度: 每场景含 1-3 个连续动作
- asset 引用: 所有 character/location 必须在 assets/ 已注册或在 `## 本集新增资产` 段（director-outline 阶段产物）列出. 修订时 asset id 严格遵循 director-outline/rules.md 「asset id 规则」（= 资产名, 禁止英文 prefix / kebab, 语言遵循 config.md「语言」设置）.
- 节奏角色互斥: 一场景只能挂一个节奏角色
- outline 是上游骨架——任何"主要事件 / 角色出场 / 信息传达 / 钩子或结局"的修改都会让下游已生成的 novel.md / script.md / storyboard.md 失效；修正必须谨慎评估下游波及（由上游 workflow 触发对应 fix skill）

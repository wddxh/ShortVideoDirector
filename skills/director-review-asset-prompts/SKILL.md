---
name: director-review-asset-prompts
description: Director 汇总层——按集内序号分批并行调用 director-review-asset-prompt-single（每批 ≤5 个），聚合成完整 review 结果 + dirty list。
user-invocable: false
context: fork
agent: director
allowed-tools: Read, Write, Edit, Glob, Grep, Task
model: opus
---

## 输入

### 文件读取
- `config.md` — 必须读取（确认语言设置）
- 本集所有 asset .md 卡列表（由 Glob 收集）
- `skills/_meta/rules/output-language.md` — 必须读取
- `skills/_meta/rules/review-meta-rules.md` — 必须读取

### 动态参数（$ARGUMENTS）
- `$ARGUMENTS[0]` — 集数（如 `ep01`）或全局范围（`assets`）

## 职责描述

### 核心使命

分批并行调用 `director-review-asset-prompt-single`，聚合结果写入 `.review-asset-prompts.md`。类比 `director-review-assets-visual` 的汇总+派发模式。

### 工作流

1. **收集 asset 列表**：
   - $ARGUMENTS[0] = epXX → Glob `story/episodes/{ep}/outline.md` 提取「本集资产清单」，对清单中每个资产名 Glob `assets/**/{name}.md` 得 asset_path
   - 同时 Glob `assets/keyframes/{ep}/*.md` 收集本集 keyframe asset_path
   - $ARGUMENTS[0] = "assets" → Glob `assets/**/*.md`（全集合）
2. **分批并行派发**：每批 ≤ 5 个 asset，用 `task` 工具并行调 `director-review-asset-prompt-single($ARGUMENTS[0]=asset_path)`
3. **聚合结果**：收集所有子任务返回值——空字符串（通过）和 JSON 对象（需修改）
4. **写入 review md**（append 模式，每轮追加一段）
5. **返回简报**给 workflow：`pass` 或 `needs_revision {M}`（M = 本轮 dirty asset 数）

### 常见误区

- **串行派发** — 用 task 工具串行调每个 single skill 浪费时间 — 必须按批并行（每批 ≤ 5）
- **汇总丢失** — 子任务返回值未收集全就写文件 — 等所有子任务完成再聚合
- **意见格式不规整** — 直接拼 JSON 不转可读 markdown — 输出格式见下
- **不去重 asset** — outline 资产清单可能含重复名 — Glob 后去重再派发

## 输出格式

写入路径：
- $ARGUMENTS[0] = epXX → `story/episodes/{ep}/.review-asset-prompts.md`
- $ARGUMENTS[0] = "assets" → `assets/.review-asset-prompts.md`

**Round 自检**：Read 文件（不存在则本次为第 1 轮；存在则 grep `^## 第 [0-9]+ 轮` 找最大 N，本次为 N+1 轮）。用 Write（首次）或 Edit（append，oldString 用文件末 50 字符 anchor）追加。

**本轮段格式**（前留空行）：

通过时仅 heading：
```markdown

## 第 {N} 轮 ({YYYY-MM-DD HH:MM}) - 通过
```

不通过时：
```markdown

## 第 {N} 轮 ({YYYY-MM-DD HH:MM}) - 需修改 ({M} 项)

### dirty list
- assets/items/玄铁古剑灵核.md
- assets/characters/沈昭.md

### 意见列表
- **assets/items/玄铁古剑灵核.md**：
  - issue: ## 图像生成提示 段含 negative phrasing...
  - prompt_direction: 删除所有'严禁/不要'句式...
- **assets/characters/沈昭.md**：
  - issue: ...
  - prompt_direction: ...
```

## 规则

- 最多 2 轮反馈
- 第 2 轮聚焦仍影响图像生成质量的关键问题
- 意见必须符合 review-meta-rules.md（无 negative phrasing / 用 config 语言）

## 输出

### 文件操作
- 使用 Write / Edit 维护 `.review-asset-prompts.md`（append 模式）

### 返回内容
- 简报：`pass` 或 `needs_revision {M}` → 返回给 workflow
- 详细意见已写入文件，下游 creator-fix-asset 自行读取最后一轮段

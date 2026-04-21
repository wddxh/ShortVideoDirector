---
name: auto-video
description: 在当前会话内循环监控视频生成状态，sleep 间隔后调用 check-video --auto，全部完成或不可恢复错误时自动停止。使用 /auto-video
  ep01 启动。
user-invocable: true
argument-hint: '[集数|all] [检查间隔秒数]'
allowed-tools: Read, Write, Edit, Glob, Bash, Skill, Agent
---

## 使用示例

```
/auto-video ep01              # 监控 ep01，默认每 1200 秒（20 分钟）检查一次
/auto-video ep01 300          # 监控 ep01，每 5 分钟检查一次
/auto-video all               # 监控所有集，默认 1200 秒
```

## 设计

本 workflow 不依赖任何宿主级调度（Cron / launchd / Task Scheduler）；轮询完全在当前 LLM 会话内进行：

- 每轮通过 sub-agent 调用 `/check-video {目标} --auto`，主会话只处理 sub-agent 返回的 JSON 摘要，不让单轮重活污染主上下文。
- 两轮之间用 Bash 工具调用 `sleep 60`，按 `ceil(间隔 / 60)` 次重复以满足目标间隔；单次 60 秒远低于任何 Bash 工具默认超时，无需调参，跨 runtime 一致。
- 退出口三条：`all_complete=true`、`error` 且 `recoverable=false`、命中安全上限。

> **会话生命周期**：本 workflow 在当前会话内循环，关闭会话即终止。如需脱离会话，请使用 OS 调度周期性触发 `/check-video`（参见 README「OS 调度（可选 advanced）」章节）。

## 安全上限

为防止异常情况下无限循环，本 workflow 内置硬性上限：

- 最多循环 **24 轮**
- 累计 wallclock **不超过 28800 秒（8 小时）**

先到先停。命中上限时输出"已达安全上限，请重新 `/auto-video {目标}` 继续"提示并退出，不再继续轮询。

## 约束

- **严禁自行编写脚本（Python、Node.js、内联 bash 等）。只能调用插件内 `scripts/` 目录下的现有脚本。**
- **严禁绕过 sub-agent 在主会话内直接调 `check-video`。每一轮都必须通过 sub-agent 隔离上下文。**
- **严禁以任何理由（测试、验证、调试）自行调用 dreamina CLI 提交视频/图片生成任务。视频生成成本很高，只有 `check-video` 内部的重试流程才允许提交。**
- **tasks.json 的读取和写入完全交给 `check-video`，本 workflow 不直接读写。**
- **调用插件脚本时，如果相对路径 `scripts/xxx.sh` 找不到，使用 Glob 工具搜索 `**/scripts/xxx.sh` 找到插件目录下的脚本绝对路径。**

## 流程

### 阶段 1: 解析参数

1. 从 `$ARGUMENTS[0]` 获取目标（集数如 `ep01`，或 `all`），未提供时默认 `all`
2. 从 `$ARGUMENTS[1]` 获取检查间隔秒数，未提供时默认 `1200`
3. 计算每轮 sleep 的分块次数：`sleep_chunks = ceil(间隔秒数 / 60)`
4. 初始化循环计数：`iter = 0`，`elapsed_seconds = 0`

### 阶段 2: 前置检查

1. 确认目标 tasks.json 存在：
   - 指定集数 → 检查 `story/episodes/{集数}/videos/tasks.json`
   - `all` → 用 Glob 扫描 `story/episodes/*/videos/tasks.json`，至少有一个匹配
2. 若不存在 → 提示"未找到视频生成任务，请先使用 `/generate-video {集数}` 提交任务"，结束（不进入循环）

### 阶段 3: 进入轮询循环

进入循环。每一轮执行下列步骤；任一退出口触发即跳出循环。

#### 3.1 调用 check-video（sub-agent 隔离上下文）

起一个 sub-agent，要求它执行 `/check-video {目标} --auto` 并把 skill 的完整输出原样返回。sub-agent 的唯一职责是触发 check-video 并回传输出，不做任何额外工作（不调 dreamina、不重试、不解析 JSON）。

- 在 Claude Code 上：使用 Agent 工具，`subagent_type` 选 `general-purpose`，`description` 设为 `check-video iter {iter} for {目标}`。
- 在 opencode 上：使用 task 工具，`agent` 选 `general`，`description` 设为 `check-video iter {iter} for {目标}`。

sub-agent 的 prompt 固定为两行：

```
请执行斜杠命令 /check-video {目标} --auto，并把命令的完整输出原样返回（含末尾的 JSON 摘要）。
不要自行调用 dreamina CLI 或视频生成脚本，不要绕过 check-video 做查询/重试/生成。
```

#### 3.2 解析 JSON 摘要

从 sub-agent 返回文本中提取 `check-video --auto` 末尾的 JSON 摘要：

- 优先找结构化 JSON（通常在末尾，但**不固定**为最后一非空行——用语义理解定位）
- 解析成功 → 进入 3.3 按字段决策
- 解析失败 / 文本中找不到 JSON → 基于整段返回文本的语义推断 `all_complete` 与 `recoverable` 两个值（不确定时偏向 `all_complete=false` / `recoverable=true`）

#### 3.3 决策（三个退出口 + 一个继续路径）

按 JSON（或推断结果）决定：

- **`all_complete == true`**：
  1. 输出最终摘要：done / submitted / failed 数量 + `human_needed` 详情
  2. 提示"全部完成，可用 `/check-video {目标}` 手动处理 human_needed"
  3. **退出循环**（整个 workflow 结束）
- **含 `error` 字段且 `recoverable == false`**：
  1. 输出 `error` 内容（一句话）+ 建议用户检查目标配置（集数是否正确、tasks.json 是否存在）
  2. **退出循环**（整个 workflow 结束）
- **其他情况**（含 `recoverable == true` 或无异常，且未全完成）：
  1. 输出一行简短进度：`[iter {iter}] 完成 X / 排队 Y / 失败 Z（已耗时 {elapsed_seconds}s）`
  2. 进入 3.4

#### 3.4 sleep 等待

用 Bash 工具循环调用 `sleep 60`，重复 `sleep_chunks` 次，达到目标间隔。

- 每次 Bash 调用的 command 固定为 `sleep 60`（无需任何参数化、无需设置 timeout——60s 远低于任何 Bash 工具默认超时上限）
- 每次 sleep 完成后给 `elapsed_seconds` 加 60

#### 3.5 检查安全上限

- `iter += 1`
- 若 `iter >= 24` 或 `elapsed_seconds >= 28800` → 输出"已达安全上限（{iter} 轮 / {elapsed_seconds}s），请重新 `/auto-video {目标}` 继续监控"，**退出循环**
- 否则 → 回到 3.1 开始下一轮

## 输出

### 退出时输出

按退出原因不同：

- **正常完成**：done / submitted / failed 数量摘要 + `human_needed` 详情 + 后续操作提示
- **不可恢复错误**：错误描述 + 用户排查建议
- **达到安全上限**：累计轮数与耗时 + 重新启动提示

### 循环中输出

每轮 3.3 输出一行短进度，格式见 3.3。

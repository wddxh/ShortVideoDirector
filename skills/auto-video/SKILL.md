---
name: auto-video
description: 创建定时任务自动监控视频生成状态，下载完成视频，重试因并行限制失败的任务。使用 /auto-video ep01 启动，任务全部完成后自动停止。
user-invocable: true
allowed-tools: Read, Write, Glob, Bash, CronCreate, CronDelete, CronList, Agent
argument-hint: "[集数|all] [检查间隔秒数]"
---

## 使用示例

```
/auto-video ep01              # 监控 ep01，默认每 20 分钟检查
/auto-video ep01 300          # 监控 ep01，每 5 分钟检查
/auto-video all               # 监控所有集，默认每 20 分钟检查
```

## 约束

- **严禁自行编写脚本（包括 Python、Node.js、内联 bash 脚本等）。只能调用插件内 `scripts/` 目录下的现有脚本。**
- **tasks.json 的读取和写入由你（LLM）直接完成：用 Read 工具读取，用 Write 工具写入。不要用脚本操作 tasks.json。**
- **调用插件脚本时，如果相对路径 `scripts/xxx.sh` 找不到，使用 Glob 工具搜索 `**/scripts/xxx.sh` 找到插件目录下的脚本绝对路径。**

## 流程

### 阶段 1: 解析参数

1. 从 `$ARGUMENTS[0]` 获取目标（集数如 `ep01`，或 `all`），默认 `all`
2. 从 `$ARGUMENTS[1]` 获取检查间隔秒数，默认 `1200`（20 分钟）
3. 将秒数转换为分钟数（向上取整），用于 cron 表达式

### 阶段 2: 检查前置条件

1. 确认目标 tasks.json 存在（若为 `all`，至少有一个 `story/episodes/*/videos/tasks.json`）
2. 若不存在 → 提示"未找到视频生成任务，请先使用 `/generate-video` 提交任务"，结束

### 阶段 3: 检查是否已有同目标定时任务

1. 使用 CronList 列出所有定时任务
2. 检查是否已有 prompt 中包含 `check-video` 和 `{目标}` 的任务
3. 若已存在 → 输出"已有针对 {目标} 的自动监控任务在运行，无需重复创建"，结束
4. 若不存在 → 继续

### 阶段 4: 先执行一次检查（通过 sub-agent 隔离上下文）

为避免重活积压到主会话上下文，首次检查也用 Agent 工具起一个 general-purpose sub-agent 执行。sub-agent 的唯一职责是调用 check-video skill 并返回输出，主会话只处理返回的 JSON 摘要。

1. 使用 Agent 工具发起调用：
   - `subagent_type`: `general-purpose`
   - `description`: `check-video run for {目标}`
   - `prompt`（就两行）：
     ```
     调用 Skill("short-video-director:check-video", "{目标} --auto")，完整返回 skill 的输出。
     不要自行调用 dreamina CLI 或视频生成脚本，不要绕过 skill 做查询/重试。
     ```

2. 从 Agent 返回文本中提取 JSON 摘要：
   - 优先找结构化 JSON（通常在末尾，但**不固定**为最后一非空行——用 LLM 语义理解定位）
   - 解析 JSON 成功 → 进入下一步按字段决策
   - 解析失败 / 文本中找不到 JSON → 基于整段返回文本的语义推断 `all_complete`、`recoverable` 两个值（不确定时偏向 `all_complete=false`、`recoverable=true`）

3. 按 JSON（或推断结果）决定流程：
   - **`all_complete == true`** → 输出最终摘要（done/submitted/failed 数量 + `human_needed` 详情）+ 提示"可用 `/check-video {目标}` 手动处理 human_needed"，**跳过阶段 5**（不建 cron），整个 skill 结束
   - **含 `error` 字段且 `recoverable == false`** → 报错输出 `error` 内容 + 建议用户检查目标配置（集数是否正确、tasks.json 是否存在），**跳过阶段 5**（不建 cron）
   - **其他情况**（含 `recoverable=true` 或无异常） → 输出简短进度 "完成 X / 排队 Y / 失败 Z"，继续进入阶段 5 建 cron

### 阶段 5: 创建定时任务

1. 使用 CronCreate 创建定时任务：
   - `cron`: `*/{分钟数} * * * *`（如 20 分钟 → `*/20 * * * *`）
   - `recurring`: true
   - `prompt`: 见下方

**Cron prompt 内容：**
```
自动视频检查任务触发。目标：{目标}。

1. 使用 Agent 工具发起一个 general-purpose sub-agent，prompt 为：
   "调用 Skill('short-video-director:check-video', '{目标} --auto')，完整返回 skill 的输出。不要自行调用 dreamina CLI 或视频生成脚本，不要绕过 skill 做查询/重试。"

2. 从 Agent 返回文本中提取 JSON 摘要（LLM 理解，不固定最后一行规则）。解析失败或无 JSON 时，基于整段返回文本语义推断 all_complete 与 recoverable（不确定偏向 all_complete=false / recoverable=true）。

3. 按 JSON（或推断结果）决定：
   - all_complete == true → 使用 CronList 找到本定时任务 → 使用 CronDelete 删除自己；输出摘要 + human_needed 详情 + "可用 /check-video {目标} 手动处理"提示
   - 含 error 字段且 recoverable == false → 使用 CronList 找到本定时任务 → 使用 CronDelete 删除自己（防止反复空转浪费资源）；输出 error 描述给用户
   - 其他情况（recoverable=true 或无异常，且未全完成） → 输出一行简短进度（完成 X / 排队 Y / 失败 Z），等待下次触发

严禁：
- 不要以任何理由（包括测试、验证、调试）自行调用 dreamina CLI 提交视频/图片生成任务。视频生成成本很高，只有 check-video skill 内的重试流程才允许提交
- 不要绕过 Agent → Skill(check-video) 路径直接执行查询/重试/生成
- 不要在主会话（cron 触发会话）里直接调 check-video skill——必须通过 Agent 隔离上下文
```

2. 记录返回的 cron job ID
3. 输出：已创建定时任务，每 {N} 分钟检查一次视频生成状态。全部完成后自动停止。注意：定时任务在 Claude 会话内运行，关闭会话后任务将停止，最长运行 7 天。

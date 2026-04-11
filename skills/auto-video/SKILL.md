---
name: auto-video
description: 创建定时任务自动监控视频生成状态，下载完成视频，重试因并行限制失败的任务。使用 /auto-video ep01 启动，任务全部完成后自动停止。
user-invocable: true
allowed-tools: Read, Write, Glob, Bash, CronCreate, CronDelete, CronList
argument-hint: "[集数|all] [检查间隔秒数]"
---

## 使用示例

```
/auto-video ep01              # 监控 ep01，默认每 20 分钟检查
/auto-video ep01 300          # 监控 ep01，每 5 分钟检查
/auto-video all               # 监控所有集，默认每 20 分钟检查
```

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
2. 检查是否已有 prompt 中包含 `auto-video-check.sh {目标}` 的任务
3. 若已存在 → 输出"已有针对 {目标} 的自动监控任务在运行，无需重复创建"，结束
4. 若不存在 → 继续

### 阶段 4: 先执行一次检查

1. 使用 Skill tool 调用 `check-video` skill，传递参数：`{目标} --auto`
2. 若所有任务已完成（无 submitted/pending_retry）→ 输出最终摘要，结束（无需创建定时任务）

### 阶段 5: 创建定时任务

1. 使用 CronCreate 创建定时任务：
   - `cron`: `*/{分钟数} * * * *`（如 20 分钟 → `*/20 * * * *`）
   - `recurring`: true
   - `prompt`: 见下方

**Cron prompt 内容：**
```
自动视频检查任务触发。请执行以下步骤：
1. 使用 Skill tool 调用 `check-video` skill，传递参数：`{目标} --auto`
2. check-video 会自动查询状态、下载完成视频、自动重试可重试的失败任务
3. 若 check-video 报告所有任务已完成（无 submitted/pending_retry）：
   - 使用 CronList 找到本定时任务，使用 CronDelete 删除
   - 提示用户可用 `/check-video {集数}` 手动处理 failed 任务
4. 否则等待下次触发
```

2. 记录返回的 cron job ID
3. 输出：已创建定时任务，每 {N} 分钟检查一次视频生成状态。全部完成后自动停止。注意：定时任务在 Claude 会话内运行，关闭会话后任务将停止，最长运行 7 天。

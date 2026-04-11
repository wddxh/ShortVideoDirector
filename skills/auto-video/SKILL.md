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

1. 使用 Bash 调用 `bash scripts/auto-video-check.sh {目标}`
2. 解析输出摘要（`DONE:N SUBMITTED:N FAILED:N PENDING_RETRY:N RETRIED:N`）
3. 显示当前状态
4. 若退出码为 0（全部完成）→ 输出最终摘要，结束（无需创建定时任务）

### 阶段 5: 创建定时任务

1. 使用 CronCreate 创建定时任务：
   - `cron`: `*/{分钟数} * * * *`（如 20 分钟 → `*/20 * * * *`）
   - `recurring`: true
   - `prompt`: 见下方

**Cron prompt 内容：**
```
自动视频检查任务触发。请执行以下步骤：

1. 使用 Bash 调用 `bash scripts/auto-video-check.sh {目标}`
2. 解析输出，显示进度摘要给用户

3. 对输出中的每个 FAILED 行（格式 `FAILED:shot{N}:{fail_reason}`）：
   判断 fail_reason 属于哪种类型：
   a. **并行限制/频率限制**（如 API 并发数满、请求过于频繁等）→ 标记为可自动重试
   b. **内容安全/合规拒绝** → 标记为需人工处理
   c. **参数错误** → 标记为需人工处理
   d. **服务端临时错误**（如超时、内部错误等）→ 标记为可自动重试
   e. **其他/无法判断** → 标记为需人工处理

4. 对标记为"可自动重试"的失败任务：
   - 读取 tasks.json 中该 shot 的 prompt、images、duration 字段
   - 使用 Bash 调用 `bash scripts/read-config.sh "即梦视频模型版本"` 和 `bash scripts/read-config.sh "视频比例"` 获取配置
   - 逐个调用 `bash scripts/video-gen-dreamina.sh "{prompt}" "{输出路径}" "{images}" "{duration}" "{比例}" "{模型版本}"`
   - 提交成功 → 使用 Bash 调用 `bash scripts/task-status.sh upsert` 更新为新 submit_id + status submitted
   - 提交失败 → 若判断仍为并行限制则停止提交剩余任务，否则保持 failed

5. 对标记为"需人工处理"的失败任务：
   - 输出失败原因，提示用户可用 `/check-video {集数}` 手动处理

6. 若退出码为 0 且无可自动重试的任务（所有任务已完成或需人工处理）：
   - 输出最终摘要
   - 使用 CronList 找到本定时任务，使用 CronDelete 删除
   - 提示用户可用 `/check-video {集数}` 手动处理 failed 任务

7. 若退出码为 1 或有任务被重新提交：
   - 输出进度摘要，等待下次触发
```

2. 记录返回的 cron job ID
3. 输出：已创建定时任务，每 {N} 分钟检查一次视频生成状态。全部完成后自动停止。注意：定时任务在 Claude 会话内运行，关闭会话后任务将停止，最长运行 7 天。

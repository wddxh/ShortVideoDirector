---
name: auto-video
description: 创建定时任务自动监控视频生成状态，下载完成视频，重试因并行限制失败的任务。使用 /auto-video ep01 启动，任务全部完成后自动停止。
user-invocable: true
allowed-tools: Read, Write, Glob, Bash, Skill
argument-hint: "[集数|all] [检查间隔秒数]"
model: opus
---

## 失败处理（核心规则）

**sub-agent task 失败后，永远不要在主 session 自己接管本应由 sub-agent 做的工作。**

正确做法：
1. 分析失败原因（task return 值 / 错误信息）
2. 如可修复：用修正后的参数重新派发同一 sub-agent
3. 如不可修复：将失败原因和已尝试方案返回给用户，停止流程

错误做法：
- ❌ "sub-agent 失败了，我自己来写这个 novel.md"
- ❌ "task 报错了，我在主 session 直接调用 Write"
- ❌ "我 fallback 一下，自己生成 keyframes.json"

原因：主 session 缺少 sub-agent 的隔离上下文（专属 system prompt、skill 加载、permission 配置），自己接管会导致质量下降、跨步骤上下文污染、permission 错配等问题。即使 sub-agent 失败，工作所有权也必须留在 sub-agent 层。

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

## 前置条件（OC 专属）

本 skill 通过 OC server HTTP API 实现定时调度，**必须在带 `--port` 启动的 OC session 内运行**：

```bash
opencode --port 4096 -s YOUR_SESSION_ID
```

如果 OC 启动时没有 `--port`，skill 会在阶段 2 报错并退出，提示重启命令。

## 流程

### 阶段 1: 解析参数

1. 从 `$ARGUMENTS[0]` 获取目标（集数如 `ep01`，或 `all`），默认 `all`
2. 从 `$ARGUMENTS[1]` 获取检查间隔秒数，默认 `1200`（20 分钟）
3. **校验 INTERVAL**：必须为 ≥60 的正整数。否则报错退出：
   ```
   ERROR: INTERVAL 必须是正整数秒数且 ≥60（防 API 打爆），收到：{值}
   ```

### 阶段 2: 检查前置条件 + OC server 发现

1. 确认目标 tasks.json 存在（若为 `all`，至少有一个 `story/episodes/*/videos/tasks.json`）
2. 若不存在 → 提示"未找到视频生成任务，请先使用 `/generate-video` 提交任务"，结束
3. **OC context 解析（OC 专属）**：用 bash 一次性提取 PORT 和 SID，二者缺一不可：
   ```bash
   if [ -z "$OPENCODE_PID" ]; then
     echo "ERROR: OPENCODE_PID 未设置" >&2
     exit 1
   fi

   # Read OC process args once (used for both PORT and SID parsing)
   ARGS=$(ps -p "$OPENCODE_PID" -o args= 2>/dev/null)
   if [ -z "$ARGS" ]; then
     echo "ERROR: 无法读取 OC 进程参数 (PID=$OPENCODE_PID)" >&2
     exit 1
   fi

   # Parse PORT from --port flag
   PORT=$(echo "$ARGS" | awk '{for(i=1;i<NF;i++) if($i=="--port") {print $(i+1); exit}}')

   # PORT fallback: ss / lsof（用户用配置文件而非 --port 启动场景）
   if [ -z "$PORT" ] && command -v ss >/dev/null; then
     PORT=$(ss -tlnp 2>/dev/null \
       | awk -v pid="$OPENCODE_PID" \
           '$0 ~ "pid="pid {split($4,a,":"); print a[length(a)]; exit}')
   fi
   if [ -z "$PORT" ] && command -v lsof >/dev/null; then
     PORT=$(lsof -iTCP -sTCP:LISTEN -P -n -p "$OPENCODE_PID" 2>/dev/null \
       | awk 'NR==2 {split($9,a,":"); print a[length(a)]; exit}')
   fi

   # Parse SID from -s / --session flag
   SID=$(echo "$ARGS" | awk '{for(i=1;i<NF;i++) if($i=="-s" || $i=="--session") {print $(i+1); exit}}')

   # SID fallback: $OPENCODE_SESSION_ID env var
   if [ -z "$SID" ] && [ -n "$OPENCODE_SESSION_ID" ]; then
     SID="$OPENCODE_SESSION_ID"
   fi

   # Fail-fast: both required
   if [ -z "$PORT" ]; then
     echo "ERROR: 无法获取 OC server 端口（既无 --port 启动参数也无监听端口）" >&2
     echo "请退出 OC 并用 'opencode --port 4096 -s YOUR_SESSION_ID' 重启" >&2
     exit 1
   fi
   if [ -z "$SID" ]; then
     echo "ERROR: 无法获取 OC session ID（既无 -s/--session 启动参数也无 OPENCODE_SESSION_ID 环境变量）" >&2
     echo "请退出 OC 并用 'opencode --port 4096 -s YOUR_SESSION_ID' 重启" >&2
     exit 1
   fi

   # Health check
   if ! curl -s --max-time 2 "http://127.0.0.1:$PORT/global/health" \
          | grep -q healthy; then
     echo "ERROR: OC server (port $PORT) 不响应" >&2
     exit 1
   fi
   ```

### 阶段 3: 检查是否已有同目标 loop

1. 检查 PID 文件 `/tmp/svd-auto-video-loop-{目标}-{SID}.pid`：
   - 存在且 `kill -0 $(cat PID_FILE) 2>/dev/null` 成功 → 输出"已有针对 {目标} 的自动监控任务在运行 (PID: X)，无需重复创建"，结束
   - 存在但 PID 已死 → 清理 pid file + 关联的 prompt/log 文件，继续
   - 不存在 → 继续

### 阶段 4: 先执行一次检查（task tool sub-agent）

为避免重活积压到主会话上下文，首次检查也用 task tool 起一个 general sub-agent 执行。

1. 使用 task tool 发起调用：
   - `subagent_type`: `general`
   - `description`: `check-video run for {目标}`
   - `prompt`（就两行）：
     ```
     使用 Skill tool 调用 check-video skill，传递参数：{目标} --auto。
     完整返回 skill 的输出。不要自行调用 dreamina CLI 或视频生成脚本，不要绕过 skill 做查询/重试。
     ```

2. 从 sub-agent 返回文本中提取 JSON 摘要：
   - 优先找结构化 JSON（通常在末尾，但**不固定**为最后一非空行——用 LLM 语义理解定位）
   - 解析 JSON 成功 → 进入下一步按字段决策
   - 解析失败 / 文本中找不到 JSON → 基于整段返回文本语义推断 `all_complete`、`recoverable`（不确定偏向 `all_complete=false` / `recoverable=true`）

3. 按 JSON（或推断结果）决定：
   - **`all_complete == true`** → 输出最终摘要 + 提示"可用 `/check-video {目标}` 手动处理"，**跳过阶段 5**（不装 loop），整个 skill 结束
   - **含 `error` 且 `recoverable == false`** → 报错输出 `error` 内容 + 建议用户检查配置，**跳过阶段 5**（不装 loop）
   - **其他情况** → 输出简短进度 "完成 X / 排队 Y / 失败 Z"，继续进入阶段 5

### 阶段 5: 装 nohup loop

1. **准备文件路径**：
   ```bash
   TARGET={目标}
   # SID 已由阶段 2 OC context 解析得到，此处直接使用；不再读 $OPENCODE_SESSION_ID
   PID_FILE=/tmp/svd-auto-video-loop-${TARGET}-${SID}.pid
   PROMPT_FILE=/tmp/svd-cron-prompt-${TARGET}-${SID}.txt
   LOG_FILE=/tmp/svd-auto-video-loop-${TARGET}-${SID}.log
   ```

2. **从模板生成 cron prompt 写入 PROMPT_FILE**（用 bash 内置变量替换，不用 sed）：
   ```bash
   TEMPLATE=$(cat "${CLAUDE_PLUGIN_ROOT}/.opencode/skill-overrides/auto-video/cron-prompt.txt")
   PROMPT="${TEMPLATE//\{\{TARGET\}\}/$TARGET}"
   PROMPT="${PROMPT//\{\{SID\}\}/$SID}"
   printf '%s' "$PROMPT" > "$PROMPT_FILE"
   ```

3. **启动 nohup loop**（loop.sh 通过环境变量接收所有参数）：
   ```bash
   PORT="$PORT" SID="$SID" INTERVAL="$INTERVAL" \
   PID_FILE="$PID_FILE" PROMPT_FILE="$PROMPT_FILE" LOG_FILE="$LOG_FILE" \
   nohup bash "${CLAUDE_PLUGIN_ROOT}/.opencode/skill-overrides/auto-video/loop.sh" \
     > "$LOG_FILE" 2>&1 &
   echo $! > "$PID_FILE"
   ```

4. **告知 user**：
   ```
   ✓ 自动监控 loop 已启动
     - 目标: {目标}
     - 间隔: {分钟数} 分钟
     - PID:  {PID 值}
     - log:  /tmp/svd-auto-video-loop-{目标}-{SID}.log

   Loop 会自动 health check OC server；OC 关闭后约 3×{分钟数} 分钟自杀清理。
   手动停止: kill $(cat /tmp/svd-auto-video-loop-{目标}-{SID}.pid)
   ```

## 删除任务

视频全部完成 / user 主动取消：

```bash
# SID 由阶段 2 解析得到（或由 cron-prompt.txt 的 {{SID}} 模板替换注入）
TARGET={目标}
kill $(cat /tmp/svd-auto-video-loop-${TARGET}-${SID}.pid) 2>/dev/null
rm -f /tmp/svd-auto-video-loop-${TARGET}-${SID}.{pid,log}
rm -f /tmp/svd-cron-prompt-${TARGET}-${SID}.txt
```

Loop 内部的 cron prompt 会在 `all_complete == true` 时自动执行上面命令清理。

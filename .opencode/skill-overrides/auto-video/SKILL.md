---
name: auto-video
description: 在用户要求持续监控已登记视频任务、下载结果或停止已有监控时使用。
user-invocable: true
allowed-tools: Read, Write, Glob, Bash, Skill, Task
argument-hint: "自然语言监控目标与间隔"
model: opus
---

## 失败处理（核心规则）

本入口调用表示监控/取回，不表示新生成。只延续 tasks 中已登记的实际 initial/retry grants，不重问有效范围的生成许可、不补造通用 consent 或无限重试。缺首次 grant 的新生成交用户后续手动 generate-video；short/series 即使就绪也不自动进入视频提交。首次提交不以预先询问重试许可为条件。

目标、间隔与许可已明确就启动或继续，无额外“开始吗”。周期检查只核对已有 grants，不重问相同 provider、限制或重试选择。新问题先查当前记录并交责任角色在权限内判断；无人值守无法解决才报 human_needed，不把进度或内部审核状态当作用户决策，也不新增创作修复权限。

按共享 intake 规则复用监控目标与持久授权，不重新问创作偏好；无人值守缺决定仅报 human_needed，不先编候选、场景、设计或提示。意外问题仅暂停受影响工作，其他已授权任务可继续。新创作留给后续交互取得相关需求或明确角色/范围/约束委托。

按已选模型/参数处理获准提交，不设预算、费用、积分/余额或最低价前置，不为省钱降级。用户实际费用限制仍绑定，真实账号/provider 失败仍报告；grant constraints 无需费用，首次/重试、inflight 与监控许可保持独立。

必读 `${CLAUDE_PLUGIN_ROOT}/skills/_meta/rules/user-decision-relay.md`。发起角色一次给齐相关问题/表及题界/分支；主 AI 读全并内部保留，沿作者题界完整展示当前题全部选项/解释后原生单题询问，仅应用所给条件，不摘要或倾倒全表。相关原始答复及全部条件批量完整回原角色原任务，不逐题往返，提前回询仅限共享规则例外。无人值守仅报告需决策，不擅自提问或代选，完整计划保留供后续交互，不被状态摘要替代。

纯监控取回不需要生成配置。若查看/修改配置或获准提交，在相关读取/写入/evidence 前从项目根运行 `node "${CLAUDE_PLUGIN_ROOT}/scripts/review-evidence.mjs" config-path`，得到 SVD_CONFIG（未设才 config.md）的 canonical 项目相对 config_path。项目内绝对路径/./ 可规范化；外部配置（含 symlink 越界）明确不支持，在相关副作用前报告，不阻断纯已提交任务取回。

配置读写和 fingerprint 只用 config_path，相关 Bash 显式设置 SVD_CONFIG，helper 配置位置参数也传该路径。首次 checker、周期 prompt、Creator relay 都携带同一路径，videoProfile 与 evidence 共用配置；未用配置的查询不强迫初始化，未决配置不授权提交。

**sub-agent task 失败后，永远不要在主 session 自己接管本应由 sub-agent 做的工作。**

正确做法：
1. 分析失败原因（task return 值 / 错误信息）
2. 如可修复：用修正后的参数重新派发同一 sub-agent
3. 如不可修复：将失败原因和已尝试方案返回给用户，仅暂停受影响工作；独立已授权工作可继续

错误做法：
- ❌ "sub-agent 失败了，我自己来写这个 novel.md"
- ❌ "task 报错了，我在主 session 直接调用 Write"
- ❌ "我 fallback 一下，自己生成 storyboard sheet"

原因：主 session 缺少 sub-agent 的隔离上下文（专属 system prompt、skill 加载、permission 配置），自己接管会导致质量下降、跨步骤上下文污染、permission 错配等问题。即使 sub-agent 失败，工作所有权也必须留在 sub-agent 层。

## 使用示例

```
/auto-video ep01              # 监控 ep01，默认每 20 分钟检查
/auto-video ep01 300          # 监控 ep01，每 5 分钟检查
/auto-video all               # 监控所有集，默认每 20 分钟检查
```

## 约束

- 隔离检查与每次定时调用从 tasks.json 的 `retry_authorization` 恢复真实用户授权，遵守 scope/constraints 和可选次数；监控意图不代表提交许可。check-video 仅委托真实 Creator 在有效 grant 内重试；缺失或耗尽则 human_needed，不补 grant。
- `all_complete` 仅表示停止监控，可能仍有 human_needed 失败，不等于全部下载成功。human_needed 只报告给用户，不自行修正、授权或重生；done 不是视频质量通过。
- querying/exit 1 是正常等待；error/exit 2 保留 submitted/id 并重试取回，不能付费重生下载失败。
- **严禁自行编写脚本（包括 Python、Node.js、内联 bash 脚本等）。只能调用插件内 `scripts/` 目录下的现有脚本。**
- tasks.json 提交状态由 video-gen-dreamina.sh 的 reserve/settle 持久化，监控只读结果。check-video 可按 `initial_authorization` 恢复未调用 pending；inflight 一律人工核实，不能自动清除或重提，不将 untouched pending 标 failed。
- **调用插件脚本时，如果相对路径 `scripts/xxx.sh` 找不到，使用 Glob 工具搜索 `**/scripts/xxx.sh` 找到插件目录下的脚本绝对路径。**

## 前置条件（OC 专属）

本 skill 通过 OC server HTTP API 实现定时调度，**必须在带 `--port` 启动的 OC session 内运行**：

```bash
opencode --port 4096 -s YOUR_SESSION_ID
```

如果 OC 启动时没有 `--port`，skill 会在阶段 2 报错并退出，提示重启命令。

## 流程

### 阶段 1: 解析参数

1. 整体理解原始请求 `$ARGUMENTS` 和会话，解析 canonical epNN 或明确全项目的 all，以及监控/取消意图。缺目标或冲突先问，不默认最新/全部；安装或写入前确认范围。查看配置只读实际配置，缺失不初始化。
2. 按自然语言解析间隔；未指定可建议 1200 秒。只有用户要求监控或已同意默认才启动，监控不授权重试，不要求用户 flags 或位置语法。
3. **校验 INTERVAL**：必须为 ≥60 的正整数。否则报错退出：
   ```
   ERROR: INTERVAL 必须是正整数秒数且 ≥60（防 API 打爆），收到：{值}
   ```

### 阶段 2: 检查前置条件 + OC server 发现

当前 loop target 仅 epNN/all；仅部分镜头的请求先说明限制并确认范围，不静默扩大为整集。无确认不写文件或启动 loop。

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
    printf 'PORT=%s\nSID=%s\n' "$PORT" "$SID"
   ```

### 阶段 3: 检查是否已有同目标 loop

读取发现命令实际返回的 PORT/SID，保留到委托上下文。每次检查 PID、清理旧文件或取消时，在同一 Bash 调用显式绑定已确认 TARGET/SID 或完整文件路径，按阶段 5 的字面量引用规则处理；不读取上次 shell 中的变量。缺任何必要值先停止，不猜 session 或构造空目标路径。

1. 检查 PID 文件 `/tmp/svd-auto-video-loop-{目标}-{SID}.pid`：
   - 存在且 `kill -0 $(cat PID_FILE) 2>/dev/null` 成功 → 输出"已有针对 {目标} 的自动监控任务在运行 (PID: X)，无需重复创建"，结束
   - 存在但 PID 已死 → 清理 pid file + 关联的 prompt/log 文件，继续
   - 不存在 → 继续

### 阶段 4: 先执行一次检查（task tool sub-agent）

为避免重活积压到主会话上下文，首次检查也用 task tool 起一个 general sub-agent 执行。

1. 使用 task tool 发起调用：
   - `subagent_type`: `general`
   - `description`: `check-video run for {目标}`
    - `prompt`：
     ```
      检查已解析目标 {目标} 的登记视频任务，取回完成输出并报告进度、阻塞和是否仍需监控。无人值守，按持久 grants 处理，自行从 descriptions 选择适用知识。
      返回末行 JSON：target、pending、done、submitted、failed、all_complete、human_needed；异常附 error/recoverable，计数不明用 unknown。
       查询按 recorded provider；新提交/重试委托真实 Creator，不加载 skill 冒充角色。
       按已选模型/参数执行真实授权，不加费用/余额预检、不为省钱降级；用户实际限制仍绑定，缺创作需求仅报 human_needed，不编候选/提示，仅暂停受影响工作。
      嵌套不可用返回 role/outcome/references/scope/constraints，等待主 AI 转交，不直接提交。
     ```

2. 保存 checker task_id；若其返回 Creator relay 请求，主 AI 忠实派 sibling Creator，等待后恢复同一 checker task_id 传回实际结果，不能新建 checker 替代。relay 无角色上下文则让 checker 报 human_needed，不自行提交。记住已确认深度限制，不自动调高深度。

只解析 checker 最后一非空行 JSON，验证 check-video 完整摘要且 target 严格等于 {目标}。缺失/无效/目标不符是可恢复协议错误，保持未完成，不从 prose 推断 all_complete/recoverable，也不清理监控。

3. 仅对有效且同目标 JSON 决定：
    - **`all_complete == true`** → 输出最终摘要与 human_needed 详情，区分已下载和需人工处理 + 提示"可用 `/check-video {目标}` 手动处理"，**跳过阶段 5**（不装 loop），整个 skill 结束
   - **含 `error` 且 `recoverable == false`** → 报错输出 `error` 内容 + 建议用户检查配置，**跳过阶段 5**（不装 loop）
   - **其他情况** → 输出简短进度 "完成 X / 排队 Y / 失败 Z"，继续进入阶段 5

### 阶段 5: 装 nohup loop

每段 Bash 都是独立调用，不继承先前 shell 变量。把下面单引号占位符替换为已确认值的 shell 单引号字面量；值内每个 `'` 编码为 `'\''`，不使用 eval、未引用拼接或双引号直接插入用户文本。TARGET/SID/PORT/INTERVAL 使用已核实值，文件路径使用本目标/session 的明确路径。CONFIG 必须绑定实际 canonical config_path；确实未解析则显式写 UNRESOLVED，不用空值或环境 fallback。首次 checker 同样收到此明确配置状态。

1. **准备文件路径**：
   ```bash
    TARGET='{TARGET}'
    SID='{SID}'
   PID_FILE=/tmp/svd-auto-video-loop-${TARGET}-${SID}.pid
   PROMPT_FILE=/tmp/svd-cron-prompt-${TARGET}-${SID}.txt
   LOG_FILE=/tmp/svd-auto-video-loop-${TARGET}-${SID}.log
   ```

2. **在同一调用绑定全部渲染值并写入 prompt**：
   ```bash
    TARGET='{TARGET}'
    SID='{SID}'
    CONFIG='{CONFIG}'
    PROMPT_FILE='{PROMPT_FILE}'
    : "${TARGET:?}" "${SID:?}" "${CONFIG:?}" "${PROMPT_FILE:?}"
    TEMPLATE=$(cat "${CLAUDE_PLUGIN_ROOT}/.opencode/skill-overrides/auto-video/cron-prompt.txt")
    PROMPT="${TEMPLATE//\{\{TARGET\}\}/"$TARGET"}"
    PROMPT="${PROMPT//\{\{SID\}\}/"$SID"}"
    PROMPT="${PROMPT//\{\{CONFIG\}\}/"$CONFIG"}"
   printf '%s' "$PROMPT" > "$PROMPT_FILE"
   ```

3. **启动 nohup loop**（loop.sh 通过环境变量接收所有参数）：
   ```bash
    PORT='{PORT}'
    SID='{SID}'
    INTERVAL='{INTERVAL}'
    PID_FILE='{PID_FILE}'
    PROMPT_FILE='{PROMPT_FILE}'
    LOG_FILE='{LOG_FILE}'
    : "${PORT:?}" "${SID:?}" "${INTERVAL:?}" "${PID_FILE:?}" "${PROMPT_FILE:?}" "${LOG_FILE:?}"
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

无需继续监控（可含 human_needed）/ user 主动取消：

```bash
TARGET='{TARGET}'
SID='{SID}'
: "${TARGET:?}" "${SID:?}"
kill "$(cat "/tmp/svd-auto-video-loop-${TARGET}-${SID}.pid")" 2>/dev/null
rm -f -- "/tmp/svd-auto-video-loop-${TARGET}-${SID}.pid" "/tmp/svd-auto-video-loop-${TARGET}-${SID}.log"
rm -f -- "/tmp/svd-cron-prompt-${TARGET}-${SID}.txt"
```

Loop 的 cron prompt 仅在有效 JSON 的 target 匹配本目标且 all_complete=true，或同目标 error 且 recoverable=false 时清理。用户明确取消可独立停止；无效/跨目标摘要不得清理。

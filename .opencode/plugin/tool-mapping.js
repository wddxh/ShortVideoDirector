// .opencode/plugin/tool-mapping.js
//
// Static constants and prompt templates for the OC plugin's skill transform
// and bootstrap injection. No imports, no side effects — safe to import from
// anywhere.

/**
 * Skills that the user can invoke directly (frontmatter `user-invocable: true`
 * in the CC source). These are the project's "entry workflows" — orchestrators
 * that drive multi-step flows by dispatching sub-agent skills.
 *
 * Used by:
 *   - transform-skills.js: injects ENTRY_WORKFLOW_WRITE_GUIDANCE at top of
 *     these skills' SKILL.md bodies in the OC cache
 *   - bootstrap.js: lists these in the first-message bootstrap so the LLM
 *     knows the entry points
 *
 * MUST stay in sync with the source `skills/<name>/SKILL.md` files that have
 * `user-invocable: true`. Verified at audit time (2026-05-17) by:
 *   grep -l "^user-invocable:[[:space:]]*true" skills/* /SKILL.md
 * If you add or remove a `user-invocable: true` skill in the source, update
 * this Set accordingly.
 */
export const USER_INVOCABLE_ENTRY_WORKFLOWS = new Set([
  'series-video',
  'short-video',
  'series-edit-story',
  'short-edit-story',
  'series-repair-story',
  'short-repair-story',
  'generate-video',
  'check-video',
  'auto-video',
]);

/**
 * Template for the prompt passed to a sub-agent when an orchestrator dispatches
 * via the `task` tool. The sub-agent's first action must be to load the named
 * skill via the `skill` tool.
 *
 * Assumes `skillName` and `agentName` are valid identifiers (no quotes,
 * backslashes, or other characters that would break the embedded JS-like
 * `skill({ name: "..." })` call). Skill names are filesystem-derived and
 * agent names come from a fixed enum, so this is safe in practice.
 *
 * `params` is free-form Chinese text passed through verbatim.
 */
export const TASK_PROMPT_TEMPLATE = ({ skillName, agentName, params }) => `
你是 ${agentName} 子代理。请按以下步骤执行：

1. 调用 \`skill({ name: "${skillName}" })\` 加载完整 SKILL.md
2. 严格按 SKILL.md 工作流执行，参数：
${params}
3. 按 SKILL.md "## 输出" 段定义的格式将结果返回给主代理

不要凭印象省略步骤；不要把 prompt 中的步骤简化为自由发挥。
`.trim();

export const LEAF_CONTEXT_HINT = (agentName) =>
  `> **执行上下文**：本 skill 被设计为由 \`${agentName}\` 子代理通过 \`task\` 工具派发执行。当你看到此 skill 内容时，你已在正确的子代理上下文中；按下方流程执行即可。`;

export const ENTRY_WORKFLOW_WRITE_GUIDANCE = `## 写入约束（OC 专用，必读）

本流程会派发子代理产出长内容（小说正文 / 剧本 / storyboard / asset .md 等）。**派发任意子代理前**，在 task prompt 中明确告知下游：

> 当你需要写入超过约 3000 字符（约 1500 汉字）的内容到单个文件时：
> 1. 先用 Write 工具创建文件并写入第一段（≤3000 字符）
> 2. 后续段落使用 Edit 工具追加（每次 Edit 的 newString ≤3000 字符）
> 3. **不要**用单次 Write 提交完整长内容 —— 会在 OpenCode 下导致 Write 工具调用挂起或超时
>
> 适用对象：novel.md / script.md / storyboard.md / 长 outline / 多镜头 prompt 等
> 不适用对象：keyframes.json / tasks.json 等结构化短数据
`;

export const AUTO_VIDEO_CRON_BODY = `## 安装定时任务

OpenCode 不内置 cron 工具，本 skill 通过 bash 调用系统 crontab 实现定时调度。

执行步骤：

1. **获取当前 OC session ID**：从 \`OPENCODE_SESSION_ID\` 环境变量读取，或调用 \`opencode session list --max-count 1 --format json\` 拿最近 session
2. **生成 cron 条目**：
   \`\`\`bash
   PROJECT_DIR=$(pwd)
   SESSION_ID="<刚获取的 session id>"
   ENTRY="*/5 * * * * cd $PROJECT_DIR && opencode run --session $SESSION_ID '调用 check-video skill' > /tmp/svd-cron-\${SESSION_ID}.log 2>&1 # svd-auto-video:\${SESSION_ID}"
   \`\`\`
3. **安装到 crontab**（追加，不覆盖用户已有条目）：
   \`\`\`bash
   (crontab -l 2>/dev/null; echo "$ENTRY") | crontab -
   \`\`\`
4. **告知用户**：定时任务已安装，每 5 分钟轮询一次 check-video。日志在 \`/tmp/svd-cron-\${SESSION_ID}.log\`。

## 查询任务状态

\`\`\`bash
crontab -l | grep "svd-auto-video:\${SESSION_ID}" || echo "未安装"
\`\`\`

## 删除任务（视频全部完成后或用户主动取消）

\`\`\`bash
crontab -l | grep -v "svd-auto-video:\${SESSION_ID}" | crontab -
\`\`\`

## 安全提示

- 安装定时任务后，cron 会在你不在 OC 会话时自动跑 \`opencode run\`，消耗 LLM token
- 视频全部完成时务必删除，避免无限轮询
- check-video skill 内部应有"全部任务完成 → 自删 cron"的兜底逻辑
- **Session 时效性**：cron 引用的 session 必须保持"近期活跃"。如果创建 cron 后超过 24-48 小时未在 OC 中操作该 session，session 可能"过期"导致 cron 任务静默失败（exit=0 但 LLM 无响应）。建议视频生成总时长 <24h 的场景使用 cron 模式；超长任务建议手动调用 check-video 或重新安装 cron
`;

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
 *   - transform-skills.js: injects ENTRY_WORKFLOW_DISPATCH_DISCIPLINE at top of
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

/**
 * Orchestrator-side directive: format-aware semantic chunking for sub-agent
 * dispatches. Injected at the top of each user-invocable entry workflow's
 * SKILL.md body (the 9 in USER_INVOCABLE_ENTRY_WORKFLOWS) by
 * injectDispatchDiscipline in transform-skills.js.
 *
 * Uses semantic-unit chunking (chapter / scene / shot / JSON
 * entry) rather than an arbitrary character threshold. Length is per-unit,
 * never total — see "长度原则" section in body.
 */
export const ENTRY_WORKFLOW_DISPATCH_DISCIPLINE = `## 派发约束（OC 专用，每次 task 之前执行）

派发 task 之前，必须先分析下游 sub-agent 将产出的文件格式，并在 task prompt 中明确分段策略。

### 分段策略

| 文件类型 | 分段单元 | 写入模式 |
|---|---|---|
| 长 .md（novel / script / storyboard / outline / asset 描述）| 逐章 / 逐场 / 逐镜头 / 逐 asset | 首段 Write，后续段 Edit 追加 |
| .json 数组型（keyframes / tasks）| 逐条目 | 首条 \`Write('[\\n  <e1>\\n]')\`；后续 Edit oldString=\`'\\n]'\` newString=\`',\\n  <eN>\\n]'\` |
| .json 对象嵌数组（\`{"shots":[…]}\`）| 逐条目 | 首 Write 完整骨架含 1 条；后续 Edit 数组结束括号片段 |
| .yaml / .toml | 逐顶层 key | 首 key Write 骨架，后 Edit 追加 |

### Edit 追加 anchor 规则
- 文本：\`oldString\`=上次写入末 50 字符（保证文件中唯一）；\`newString\`=同 50 字符 + 新单元
- JSON：固定结束括号片段（如 \`'\\n]'\` / \`'  ]\\n}'\`）

### task prompt 必备字段
1. 目标文件路径
2. 文件格式
3. 分段单元
4. **明令**："切勿单次 Write 提交完整长内容"

### 长度原则（最重要）

**本约束仅针对每次 Write/Edit 的单次内容长度，不限制最终文件总长度或单元数量。**

- 需要写多长就写多长 —— 章数、镜头数、JSON 条目数由内容自然决定
- 质量优先；不要为了"避免分段"而压缩内容
- 不要在 task prompt 中给 sub-agent 设"总字数上限""最多 X 章"等限制
- 唯一约束：每次 Write 或 Edit 操作的内容是 1 个语义单元

### 反例 / 正例

❌ "请按 SKILL.md 写出完整 novel.md"
✅ "请按 SKILL.md 写 novel.md。格式：Markdown；分段单元：逐章。每章独立一次 Write/Edit。不要在单次 Write 中提交多章。"
`;

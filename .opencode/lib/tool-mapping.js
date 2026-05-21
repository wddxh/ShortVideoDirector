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
 * `user-invocable: true`. Verified at audit time (2026-05-21) by:
 *   grep -l "^user-invocable:[[:space:]]*true" skills/* /SKILL.md
 * Currently 7 entry workflows (was 9 before 2026-05-21: series/short
 * edit-story merged into edit-story; series/short repair-story merged into
 * repair-story). If you add or remove a `user-invocable: true` skill in the
 * source, update this Set accordingly.
 */
export const USER_INVOCABLE_ENTRY_WORKFLOWS = new Set([
  'series-video',
  'short-video',
  'edit-story',
  'repair-story',
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

/**
 * Orchestrator-side directive: format-aware semantic chunking for sub-agent
 * dispatches. Injected at the top of each user-invocable entry workflow's
 * SKILL.md body (the 7 in USER_INVOCABLE_ENTRY_WORKFLOWS) by
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

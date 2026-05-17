// .opencode/plugin/load-agents.js
import { readFile, readdir } from 'fs/promises';
import path from 'path';

/**
 * 读取 agent .md 文件，解析 YAML frontmatter 与 body。
 * 使用简单的手写 parser 避免引入 js-yaml 依赖。
 */
export async function parseAgentFile(filePath) {
  const raw = await readFile(filePath, 'utf-8');
  const content = raw.replace(/\r\n/g, '\n');  // normalize line endings
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) {
    throw new Error(`No YAML frontmatter found in ${filePath}`);
  }
  const [, fmRaw, body] = match;
  const frontmatter = parseSimpleYaml(fmRaw);
  return { frontmatter, body: body.trim() };
}

/**
 * 极简 YAML parser：只支持 `key: value` 单行键值对。
 * 不支持多行字符串、嵌套对象、数组（agent frontmatter 不需要这些）。
 */
function parseSimpleYaml(text) {
  const result = {};
  for (const line of text.split('\n')) {
    const m = line.match(/^([a-zA-Z_-]+):\s*(.*)$/);
    if (!m) continue;
    let value = m[2].trim();
    // 去掉 value 两边的引号
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    result[m[1]] = value;
  }
  return result;
}

/**
 * Convert CC agent frontmatter to OC agent config schema.
 *
 * CC frontmatter has: name, description, tools (comma-string), model
 * OC config.agent[X] needs: description, mode, prompt, permission, optional model
 *
 * This function only handles the frontmatter→config transformation. The body
 * (system prompt) is added by loadAllAgents (Task 2.4). Permissions are
 * built by buildPermissionForAgent (Task 2.3).
 *
 * Behaviors:
 *   - Drops CC's `tools` comma-string (OC uses `permission` for command-level
 *     allow/deny). However we DO explicitly set `tools.bash = true` so the
 *     LLM has access to the bash tool — without this, OC defaults bash to
 *     false for subagents (security default) and the agent can't invoke any
 *     CLI even with permission allows in place. WHICH bash commands actually
 *     run is gated by `permission.bash` (see buildPermissionForAgent).
 *   - Drops `model: inherit` (OC defaults to inheriting from parent)
 *   - Keeps explicit `model: <name>` values
 *   - Sets `mode: 'subagent'` (all 5 ShortVideoDirector agents are subagents)
 *   - Passes through `description` verbatim
 */
export function convertAgentFrontmatter(cc) {
  const out = {
    description: cc.description,
    mode: 'subagent',
    tools: { bash: true },
  };
  if (cc.model && cc.model !== 'inherit') {
    out.model = cc.model;
  }
  return out;
}

const BASE_PERMISSION = {
  task: 'allow',
  skill: 'allow',
  read: 'allow',
  edit: 'allow',
  write: 'allow',
  glob: 'allow',
  grep: 'allow',
  list: 'allow',
  webfetch: 'deny',
  websearch: 'deny',
  todowrite: 'allow',
  question: 'allow',
};

// Per-agent bash config: which scripts/commands to allow.
//
// All 5 agents get permission.bash = 'allow' AND external_directory = 'allow'
// (no ask dialogs, no tool-disabled surprises). Background:
//
// OC derives the effective `tools.<name>` dict from `permission`. If
// permission.bash is an object with `'*': deny` as catch-all, OC concludes
// the bash tool is overall disabled and sets `tools.bash: false`, blocking
// the agent from invoking ANY bash command (even ones with explicit allow
// rules in the object). This bit creator on the 5e workflow — it couldn't
// run dreamina CLI / scripts.
//
// Per-command bash restriction is incompatible with the desired UX (zero
// popups, full agent functionality). Blanket 'allow' for all 5 agents keeps
// bash usable. Security boundary lives in SKILL.md prompts (LLM is told what
// commands to run; the LLM is the gatekeeper, not OC permission system).
const AGENT_BASH_CONFIG = {
  director: { externalDir: 'allow' },
  writer: { externalDir: 'allow' },
  scriptwriter: { externalDir: 'allow' },
  storyboarder: { externalDir: 'allow' },
  creator: { externalDir: 'allow' },
};

/**
 * Build OC permission object for a given agent.
 *
 * All 5 agents use blanket allow for bash + external_directory. WHICH
 * commands actually run is gated by SKILL.md prompts (LLM-side restriction),
 * not OC permission. This trades fine-grained per-command security for zero
 * permission popups and guaranteed tool availability (OC won't disable
 * bash/external_directory tools when permission is blanket-allow).
 *
 * @param agentName - one of director, writer, scriptwriter, storyboarder, creator
 * @param allScripts - unused; kept for API compat with prior signature
 */
export function buildPermissionForAgent(agentName, _allScripts = []) {
  const cfg = AGENT_BASH_CONFIG[agentName];
  if (!cfg) {
    throw new Error(`Unknown agent: ${agentName}`);
  }
  return {
    ...BASE_PERMISSION,
    bash: 'allow',
    external_directory: cfg.externalDir,
  };
}

const OC_EXECUTION_CONTRACT = `

## OC 执行契约

当主代理通过 \`task\` 工具派发任务给你时：

1. **第一步必须**调用 \`skill({ name: "<被指定的 skill>" })\` 加载完整 SKILL.md
2. 严格按 SKILL.md 工作流逐步执行，不跳步、不缩短
3. 按 SKILL.md "## 输出" 段定义的格式将最终结果返回给主代理

不要凭印象或缩短步骤。如果同一 skill 内部又需要派发其他带 \`context: fork\` 的 skill，使用 \`task\` 工具派发；不带 \`context: fork\` 的 skill 用 \`skill\` 工具同上下文加载。

## 写入纪律

orchestrator 在 task prompt 中会指定"分段单元"（逐章 / 逐镜头 / 逐 JSON 条目 / 逐 yaml key）。严格遵循：

- 写完一个单元 → 停 → Edit 追加下一单元
- 绝不在单次 Write 中提交多个单元 —— 即便你"觉得不算长"
- 单次 Write/Edit 内容应 ≤ 1 单元

**长度原则**：本约束仅针对单次 Write/Edit 操作内容，不限制文件最终总长度。需要写多长就写多长；按 SKILL.md 要求的质量和内容完整度生成，按单元分段累积即可。不要因"避免分段"而省略或压缩内容。

### JSON 增量模式

写 JSON 数组类文件（如 keyframes.json）：

1. 首条目：\`Write(path, content='[\\n  <entry1>\\n]')\`
2. 后续每条：\`Edit(path, oldString='\\n]', newString=',\\n  <entryN>\\n]')\`

写 JSON 对象内嵌数组（如 \`{"shots":[...]}\`）：

1. 首：Write 完整骨架，数组内只放第 1 条
2. 续：Edit oldString=数组结束 \`  ]\`（含其前的换行+缩进），newString=\`,\\n    <entryN>\\n  ]\`

orchestrator 未明确指定单元时默认：.md → 逐自然段（500-1500 字符），.json → 逐条目。`;

/**
 * Load all agents from `<pluginRoot>/agents/`, scan `<pluginRoot>/scripts/`,
 * and return a complete config.agent object suitable for OC's config hook.
 *
 * @param pluginRoot - The plugin package's root directory (where the `agents/`,
 *   `scripts/`, `skills/`, and `package.json` live). For ShortVideoDirector
 *   this is the repo root because the project IS the plugin. Typically
 *   computed in index.js as `path.resolve(__dirname, '../..')`.
 */
export async function loadAllAgents(pluginRoot) {
  const agentsDir = path.join(pluginRoot, 'agents');
  const scriptsDir = path.join(pluginRoot, 'scripts');
  const allScripts = (await readdir(scriptsDir)).filter(f => f.endsWith('.sh'));

  const files = (await readdir(agentsDir)).filter(f => f.endsWith('.md'));
  const result = {};
  for (const file of files) {
    const filePath = path.join(agentsDir, file);
    const { frontmatter, body } = await parseAgentFile(filePath);
    if (!frontmatter.name) {
      throw new Error(`Agent file ${file} missing 'name' in frontmatter`);
    }
    const oc = convertAgentFrontmatter(frontmatter);
    oc.prompt = body + OC_EXECUTION_CONTRACT;
    oc.permission = buildPermissionForAgent(frontmatter.name, allScripts);
    result[frontmatter.name] = oc;
  }
  return result;
}

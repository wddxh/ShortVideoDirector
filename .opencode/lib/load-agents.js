// .opencode/plugin/load-agents.js
import { readFile, readdir } from 'fs/promises';
import path from 'path';
import { ROLE_HANDOFF_GUIDANCE } from './tool-mapping.js';

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
 *   - Explicitly enables skill discovery; task follows the source role allowlist
 *   - Keeps explicit `model: <name>` values
 *   - Sets `mode: 'subagent'` (all 4 ShortVideoDirector agents are subagents)
 *   - Passes through `description` verbatim
 */
export function convertAgentFrontmatter(cc) {
  const out = {
    description: cc.description,
    mode: 'subagent',
    tools: {
      bash: true,
      skill: true,
      task: (cc.tools || '').split(',').some(tool => tool.trim() === 'Task'),
    },
  };
  if (cc.model && cc.model !== 'inherit') {
    out.model = cc.model;
  }
  return out;
}

const BASE_PERMISSION = {
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
// All 4 agents get permission.bash = 'allow' AND external_directory = 'allow'
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
// popups, full agent functionality). Blanket 'allow' for all 4 agents keeps
// bash usable. Security boundary lives in SKILL.md prompts (LLM is told what
// commands to run; the LLM is the gatekeeper, not OC permission system).
const AGENT_BASH_CONFIG = {
  reviewer: { externalDir: 'allow' },
  scriptwriter: { externalDir: 'allow' },
  storyboarder: { externalDir: 'allow' },
  creator: { externalDir: 'allow' },
};

/**
 * Build OC permission object for a given agent.
 *
 * All 4 agents use blanket allow for bash + external_directory. WHICH
 * commands actually run is gated by SKILL.md prompts (LLM-side restriction),
 * not OC permission. This trades fine-grained per-command security for zero
 * permission popups and guaranteed tool availability (OC won't disable
 * bash/external_directory tools when permission is blanket-allow).
 *
 * @param agentName - one of reviewer, scriptwriter, storyboarder, creator
 * @param allScripts - unused; kept for API compat with prior signature
 */
export function buildPermissionForAgent(agentName, _allScripts = []) {
  const cfg = AGENT_BASH_CONFIG[agentName];
  if (!cfg) {
    throw new Error(`Unknown agent: ${agentName}`);
  }
  return {
    ...BASE_PERMISSION,
    task: ['reviewer', 'creator'].includes(agentName) ? 'allow' : 'deny',
    bash: 'allow',
    external_directory: cfg.externalDir,
  };
}

const OC_EXECUTION_CONTRACT = `

## OC 执行契约

${ROLE_HANDOFF_GUIDANCE}

## 写入纪律

按文件格式选可独立写入的完整单元（自然段 / 镜头 / JSON 条目 / YAML key）：

- 写完一个单元 → 停 → Edit 追加下一单元
- 切勿单次 Write 提交完整长内容
- 每次 Write/Edit 内容不得超过 2000 字符，JSON/YAML 同样适用

**长度原则**：本约束仅针对单次 Write/Edit 操作内容，不限制文件最终总长度。需要写多长就写多长；按 SKILL.md 要求的质量和内容完整度生成，按单元分段累积即可。不要因"避免分段"而省略或压缩内容。

### JSON 增量模式

普通短编辑可原位进行；每次操作后 JSON 值及整个文档都须完整有效。数组可从有效骨架和完整首条开始，以唯一结束括号片段作 oldString 追加完整条目；对象嵌数组同理。不要在已发布 manifest 的引号内分次拼接不可分割的长字符串（如 prompt）。

长值或条目无法在限额内完整编辑时：

1. 事先与读写方协调目标路径、临时路径和发布时机，避免读取半成品或覆盖并发修改。
2. 在授权路径内离开目标文件分步组装；待发布临时文档与目标须在同一文件系统，以便最终原子替换。可用有界步骤写临时纯文本块，再由本地小脚本按序合并并用 JSON 序列化器编码长值，不靠猜测转义。
3. 完整临时文档须通过 JSON 语法解析及所需结构校验，再原子替换目标；校验失败保留原目标。

工具字符串参数仍受 2000 字符限制（包括 patch、命令和脚本内容）；脚本本身也分步写入，不用巨大 heredoc 或脚本载荷绕过限制。文件总长度不设上限。`;

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
    const filePath = path.resolve(agentsDir, file);
    const { frontmatter, body } = await parseAgentFile(filePath);
    if (!frontmatter.name) {
      throw new Error(`Agent file ${file} missing 'name' in frontmatter`);
    }
    const oc = convertAgentFrontmatter(frontmatter);
    oc.prompt = `Source role file: \`${filePath}\`\nResolve relative links in this role relative to this file's directory.\n\n`
      + body + OC_EXECUTION_CONTRACT;
    oc.permission = buildPermissionForAgent(frontmatter.name, allScripts);
    result[frontmatter.name] = oc;
  }
  return result;
}

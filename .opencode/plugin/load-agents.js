// .opencode/plugin/load-agents.js
import { readFile } from 'fs/promises';

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
 *   - Drops `tools` (OC uses `permission` instead)
 *   - Drops `model: inherit` (OC defaults to inheriting from parent)
 *   - Keeps explicit `model: <name>` values
 *   - Sets `mode: 'subagent'` (all 5 ShortVideoDirector agents are subagents)
 *   - Passes through `description` verbatim
 */
export function convertAgentFrontmatter(cc) {
  const out = {
    description: cc.description,
    mode: 'subagent',
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

// Per-agent bash config: which scripts to allow + extra non-script bash patterns + external_directory policy
const AGENT_BASH_CONFIG = {
  director: {
    allowScripts: ['read-config.sh'],
    extraBash: {},
    externalDir: 'deny',
  },
  writer: { allowScripts: [], extraBash: {}, externalDir: 'deny' },
  scriptwriter: { allowScripts: [], extraBash: {}, externalDir: 'deny' },
  storyboarder: { allowScripts: [], extraBash: {}, externalDir: 'deny' },
  creator: {
    allowScripts: 'ALL',  // creator 自动放行所有 scripts/*.sh (覆盖任何 future script)
    extraBash: {
      'dreamina user_credit': 'allow',
      'dreamina query_result*': 'allow',
      'mkdir -p*': 'allow',
      'mv /tmp/dreamina-pending/*': 'allow',
    },
    externalDir: 'allow',
  },
};

/**
 * Build OC permission object for a given agent, including the per-agent
 * bash allowlist (resolved against the project's scripts/ inventory).
 *
 * @param agentName - one of director, writer, scriptwriter, storyboarder, creator
 * @param allScripts - array of script filenames found in <project>/scripts/ (e.g., ['read-config.sh', ...])
 *
 * Bash allowlist format: keys are bash patterns matched against parsed command,
 * values are 'allow'/'deny'. Wildcard `*` catches anything else.
 * Last matching rule wins per OC permission docs.
 */
export function buildPermissionForAgent(agentName, allScripts = []) {
  const cfg = AGENT_BASH_CONFIG[agentName];
  if (!cfg) {
    throw new Error(`Unknown agent: ${agentName}`);
  }
  const bash = {};
  const scriptsToAllow = cfg.allowScripts === 'ALL' ? allScripts : cfg.allowScripts;
  for (const s of scriptsToAllow) {
    bash[`bash $SVD_PLUGIN_DIR/scripts/${s}*`] = 'allow';
  }
  for (const [k, v] of Object.entries(cfg.extraBash)) {
    bash[k] = v;
  }
  bash['*'] = 'deny';

  return {
    ...BASE_PERMISSION,
    bash,
    external_directory: cfg.externalDir,
  };
}

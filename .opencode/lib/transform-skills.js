import { readFile, writeFile, mkdir, readdir, copyFile, stat } from 'fs/promises';
import path from 'path';
import { parseAgentFile as parseFrontmatterFile } from './load-agents.js';
import { TASK_PROMPT_TEMPLATE, LEAF_CONTEXT_HINT, ENTRY_WORKFLOW_DISPATCH_DISCIPLINE, USER_INVOCABLE_ENTRY_WORKFLOWS } from './tool-mapping.js';

// parseSkillFile 与 parseAgentFile 行为一致；alias 出来让代码语义更清晰
export const parseSkillFile = parseFrontmatterFile;

export function rewriteFrontmatter(cc) {
  const result = {
    name: cc.name,
    description: (cc.description || '').slice(0, 1024),
  };
  const metadata = {};
  const PASSTHROUGH_TO_METADATA = ['context', 'agent', 'user-invocable', 'argument-hint', 'model'];
  for (const key of PASSTHROUGH_TO_METADATA) {
    if (cc[key] !== undefined) {
      metadata[`svd-${key}`] = String(cc[key]);
    }
  }
  if (Object.keys(metadata).length > 0) {
    result.metadata = metadata;
  }
  return result;
}

export function inlineSubstitutePluginRoot(text, pluginRoot) {
  return text.replace(/\$\{CLAUDE_PLUGIN_ROOT\}/g, pluginRoot);
}

// 匹配 "使用 Skill tool 调用 <skill-name>"，包含可选反引号/包裹词
const SKILL_CALL_RE = /使用\s+Skill\s+tool\s+(?:重新|再次|依次)?调用\s+`?([a-z][a-z0-9-]*)`?(?:\s+skill)?/g;

export function rewriteSkillCalls(text, skillMeta) {
  // 行扫描 + code-block 状态机：在 ``` block 与 > quote block 内不替换
  const lines = text.split('\n');
  let inCodeBlock = false;
  const outLines = [];
  for (const line of lines) {
    if (line.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      outLines.push(line);
      continue;
    }
    if (inCodeBlock || line.trim().startsWith('>')) {
      outLines.push(line);
      continue;
    }
    outLines.push(line.replace(SKILL_CALL_RE, (match, skillName) => {
      // Templated refs like `creator-image-{X}` are captured truncated as `creator-image-`.
      // Leave them verbatim — the LLM resolves the template at runtime.
      if (skillName.endsWith('-')) {
        return match;
      }
      const meta = skillMeta[skillName];
      if (!meta) {
        throw new Error(`Unknown skill referenced in source: ${skillName}`);
      }
      if (meta.fork && meta.agent) {
        const prompt = TASK_PROMPT_TEMPLATE({
          skillName,
          agentName: meta.agent,
          params: '<由调用方填充>',
        });
        return `调用 task 工具：\n\`\`\`\ntask({\n  subagent_type: "${meta.agent}",\n  description: "执行 ${skillName}",\n  prompt: \`\n${prompt}\n\`,\n})\n\`\`\``;
      } else {
        return `调用 \`skill({ name: "${skillName}" })\``;
      }
    }));
  }
  return outLines.join('\n');
}

export function injectLeafHint(body, meta) {
  if (!meta.fork || !meta.agent) return body;
  return LEAF_CONTEXT_HINT(meta.agent) + '\n\n' + body;
}

export function injectDispatchDiscipline(body, meta) {
  if (!meta.userInvocable) return body;
  if (!USER_INVOCABLE_ENTRY_WORKFLOWS.has(meta.name)) return body;
  return ENTRY_WORKFLOW_DISPATCH_DISCIPLINE + '\n\n' + body;
}

/** 把 frontmatter 对象序列化回 YAML（极简，与 parser 对偶） */
function stringifyFrontmatter(fm) {
  const lines = ['---'];
  for (const [k, v] of Object.entries(fm)) {
    if (k === 'metadata' && typeof v === 'object') {
      lines.push('metadata:');
      for (const [mk, mv] of Object.entries(v)) {
        lines.push(`  ${mk}: ${JSON.stringify(mv)}`);
      }
    } else {
      lines.push(`${k}: ${JSON.stringify(v)}`);
    }
  }
  lines.push('---');
  return lines.join('\n');
}

/** 扫描所有源 skill 的 metadata 表，给 rewriteSkillCalls 用 */
async function buildSkillMeta(skillsDir) {
  const dirs = await readdir(skillsDir);
  const meta = {};
  for (const name of dirs) {
    const skillFile = path.join(skillsDir, name, 'SKILL.md');
    try {
      const { frontmatter } = await parseSkillFile(skillFile);
      meta[frontmatter.name || name] = {
        agent: frontmatter.agent || null,
        fork: frontmatter.context === 'fork',
        userInvocable: frontmatter['user-invocable'] === 'true' ||
                       frontmatter['user-invocable'] === true,
      };
    } catch (e) {
      continue;
    }
  }
  return meta;
}

const SKILL_OVERRIDES_DIR = '.opencode/skill-overrides';

export async function transformAllSkills(pluginRoot, cacheSkillsDir) {
  const sourceSkillsDir = path.join(pluginRoot, 'skills');
  const overridesDir = path.join(pluginRoot, SKILL_OVERRIDES_DIR);
  const meta = await buildSkillMeta(sourceSkillsDir);
  const entries = await readdir(sourceSkillsDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const skillName = entry.name;
    // 优先用 OC override 目录；若无则用 CC 源
    const overrideDir = path.join(overridesDir, skillName);
    let srcDir = path.join(sourceSkillsDir, skillName);
    try {
      await stat(overrideDir);
      srcDir = overrideDir;
    } catch {
      // 没 override，保留 CC 源
    }
    const dstDir = path.join(cacheSkillsDir, skillName);
    await mkdir(dstDir, { recursive: true });

    const srcSkillFile = path.join(srcDir, 'SKILL.md');
    let parsed;
    try {
      parsed = await parseSkillFile(srcSkillFile);
    } catch {
      continue;
    }
    const { frontmatter, body } = parsed;
    const myMeta = meta[skillName] || { agent: null, fork: false, userInvocable: false };

    let newBody = body;
    newBody = rewriteSkillCalls(newBody, meta);
    newBody = injectLeafHint(newBody, myMeta);
    newBody = injectDispatchDiscipline(newBody, { ...myMeta, name: skillName });
    newBody = inlineSubstitutePluginRoot(newBody, pluginRoot);

    const newFm = rewriteFrontmatter(frontmatter);
    const out = stringifyFrontmatter(newFm) + '\n\n' + newBody;
    await writeFile(path.join(dstDir, 'SKILL.md'), out);

    const auxFiles = (await readdir(srcDir)).filter(f => f !== 'SKILL.md');
    for (const aux of auxFiles) {
      const auxStat = await stat(path.join(srcDir, aux));
      if (auxStat.isFile()) {
        await copyFile(path.join(srcDir, aux), path.join(dstDir, aux));
      }
    }
  }
}

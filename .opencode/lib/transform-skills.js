import { readFile, writeFile, mkdir, readdir, copyFile, stat } from 'fs/promises';
import path from 'path';
import { parseAgentFile as parseFrontmatterFile } from './load-agents.js';
import { TASK_PROMPT_TEMPLATE, LEAF_CONTEXT_HINT, ENTRY_WORKFLOW_WRITE_GUIDANCE, USER_INVOCABLE_ENTRY_WORKFLOWS } from './tool-mapping.js';

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

export function rewriteBashPaths(text) {
  // 严格匹配 "bash scripts/<filename>" 前缀，避免误改 prose
  return text.replace(
    /(\bbash\s+)scripts\//g,
    '$1$SVD_PLUGIN_DIR/scripts/'
  );
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

export function injectEntryWorkflowGuidance(body, meta) {
  if (!meta.userInvocable) return body;
  if (!USER_INVOCABLE_ENTRY_WORKFLOWS.has(meta.name)) return body;
  return ENTRY_WORKFLOW_WRITE_GUIDANCE + '\n\n' + body;
}
